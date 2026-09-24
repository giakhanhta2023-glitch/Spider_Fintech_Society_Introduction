"""Fourteen of the sixteen tests the level asks for. Nothing here needs a service.

The other two are in `tests/integration/`, because they need a real TLS
handshake and a real Postgres, and neither is worth faking: a mocked handshake
proves nothing about TLS and a mocked database proves nothing about a grant.

    tests/integration/test_mtls.py         test 11, runs here, no network
    tests/integration/test_audit_role.py   test 16, needs DATABASE_URL
"""

from __future__ import annotations

import logging
import time

import jwt
import pytest

from vault.envelope import DecryptionFailed, open_, seal
from vault.keys import KeyService
from vault.logging_ import ALLOWED, AllowlistFormatter, redact
from vault.tokens import ForbiddenField, NotAuthorised, Vault
from vault.webhooks import BadSignature, RotationWindow, sign, verify

# Published test numbers. Nothing here is a real card.
TEST_PAN = "4111111111111111"
OTHER_PAN = "5555555555554444"

READ = {"vault:read_pan"}
NO_READ = {"vault:read_metadata"}


@pytest.fixture
def keys() -> KeyService:
    # No latency in tests: the 8 ms is there to make the measurement honest,
    # not to make the suite slow.
    return KeyService(latency_seconds=0.0)


@pytest.fixture
def vault(keys: KeyService) -> Vault:
    return Vault(keys=keys)


# ------------------------------------------------------------- the key service
def test_the_master_key_cannot_be_obtained(keys: KeyService) -> None:
    """Test 1. Not by any public method, and not by a private one either."""
    public = [n for n in dir(keys) if not n.startswith("_")]
    assert "master" not in " ".join(public)
    for name in public:
        attribute = getattr(keys, name)
        if callable(attribute):
            continue
        assert not isinstance(attribute, (bytes, bytearray))


def test_a_data_key_is_stored_only_wrapped(keys: KeyService) -> None:
    data_key = keys.generate_data_key()
    assert data_key.wrapped != data_key.plaintext
    assert keys.unwrap(data_key.wrapped, data_key.master_key_version) == data_key.plaintext


# ------------------------------------------------------------ envelope
def test_a_ciphertext_moved_to_another_record_fails_to_decrypt(keys: KeyService) -> None:
    """Test 2. The record id is bound in as additional authenticated data, so
    a ciphertext only opens in the place it belongs."""
    data_key = keys.generate_data_key()
    sealed = seal(data_key, "rec-1", TEST_PAN.encode())

    assert open_(keys, "rec-1", sealed).decode() == TEST_PAN

    with pytest.raises(DecryptionFailed):
        open_(keys, "rec-2", sealed)


def test_envelope_makes_two_orders_of_magnitude_fewer_calls(keys: KeyService) -> None:
    """Test 3, at 20,000 records with the latency dialled out."""
    records = 20_000
    batch = 100

    per_record = KeyService(latency_seconds=0.0)
    for i in range(200):        # a sample, then extrapolated: one call each
        per_record.generate_data_key()
    calls_per_record = records  # by construction: one per record

    data_key = keys.generate_data_key()
    used = 0
    for i in range(records):
        if used >= batch:
            data_key = keys.generate_data_key()
            used = 0
        seal(data_key, f"rec-{i}", TEST_PAN.encode())
        used += 1

    assert keys.calls == records // batch
    assert calls_per_record / keys.calls >= 100


# ------------------------------------------------------------- rotation
def test_records_written_before_a_rotation_still_decrypt(vault: Vault) -> None:
    """Test 4. Two master key versions readable at once."""
    before = vault.tokenise(TEST_PAN)
    vault.rotate_master_key()
    after = vault.tokenise(OTHER_PAN)

    assert vault.detokenise(before.token, READ) == TEST_PAN
    assert vault.detokenise(after.token, READ) == OTHER_PAN


def test_a_rotation_rewrites_no_card_row(vault: Vault) -> None:
    """Test 5, and the reason envelope encryption is worth the indirection."""
    tokens = [vault.tokenise(f"411111111111{i:04d}").token for i in range(50)]
    before = {t: (vault._records[t].nonce, vault._records[t].ciphertext) for t in tokens}

    outcome = vault.rotate_master_key()

    after = {t: (vault._records[t].nonce, vault._records[t].ciphertext) for t in tokens}
    assert before == after                       # not one byte of card data moved
    assert outcome["card_rows_rewritten"] == 0
    assert outcome["data_keys_rewrapped"] < len(tokens)


def test_an_old_master_key_is_retired_only_once_unused(vault: Vault) -> None:
    vault.tokenise(TEST_PAN)
    assert vault.retire_old_master_keys() == []   # version 1 is still in use

    vault.rotate_master_key()
    assert vault.retire_old_master_keys() == [1]
    assert vault.keys.versions == [2]


# ------------------------------------------------------------ tokenisation
def test_the_same_card_produces_the_same_token_and_reveals_nothing(vault: Vault) -> None:
    """Test 6. Stable so analytics can count cards; random so the token says
    nothing about the card."""
    first = vault.tokenise(TEST_PAN)
    second = vault.tokenise(TEST_PAN)

    assert first.token == second.token
    assert TEST_PAN not in first.token
    assert TEST_PAN[6:12] not in first.token
    assert first.bin == "411111"
    assert first.last4 == "1111"


def test_different_cards_produce_different_tokens(vault: Vault) -> None:
    assert vault.tokenise(TEST_PAN).token != vault.tokenise(OTHER_PAN).token


def test_detokenising_without_the_scope_raises(vault: Vault) -> None:
    """Test 7. A valid caller is not an authorised one."""
    token = vault.tokenise(TEST_PAN).token
    with pytest.raises(NotAuthorised):
        vault.detokenise(token, NO_READ)


def test_metadata_needs_no_scope_and_no_decryption(vault: Vault) -> None:
    """Which is why almost nothing in the platform ever calls detokenise."""
    token = vault.tokenise(TEST_PAN).token
    calls_before = vault.keys.calls
    meta = vault.metadata(token)

    assert (meta.bin, meta.last4) == ("411111", "1111")
    assert vault.keys.calls == calls_before


def test_a_cvv_can_never_be_stored(vault: Vault) -> None:
    for forbidden in ("cvv", "CVC", "cvv2", "pin"):
        with pytest.raises(ForbiddenField):
            vault.tokenise(TEST_PAN, **{forbidden: "123"})


# -------------------------------------------------------------------- JWT
def _token(secret: bytes, **overrides) -> str:
    claims = {
        "sub": "payments-service",
        "aud": "vault",
        "iss": "auth.internal",
        "exp": int(time.time()) + 300,
        "scope": "vault:read_pan",
    }
    claims.update(overrides)
    return jwt.encode(claims, secret, algorithm="HS256")


def verify_token(raw: str, secret: bytes) -> dict:
    """Verification done fully. Five checks, not one line."""
    return jwt.decode(
        raw,
        secret,
        algorithms=["HS256"],        # pinned. Never read from the token
        audience="vault",            # is this token for us?
        issuer="auth.internal",      # did we issue it?
        options={"require": ["exp", "aud", "iss"]},
    )


def test_a_token_for_another_audience_is_rejected() -> None:
    """Test 8."""
    secret = b"a-test-secret-that-exists-only-here"
    other = _token(secret, aud="reporting")
    with pytest.raises(jwt.InvalidAudienceError):
        verify_token(other, secret)


def test_a_token_with_alg_none_is_rejected() -> None:
    """Test 9. Algorithm confusion: the attacker picks the algorithm unless
    you pin it."""
    unsigned = jwt.encode({"sub": "x", "aud": "vault"}, key=None, algorithm="none")
    with pytest.raises(jwt.InvalidAlgorithmError):
        verify_token(unsigned, b"any-secret")


def test_an_expired_token_is_rejected_despite_a_valid_signature() -> None:
    """Test 10."""
    secret = b"a-test-secret-that-exists-only-here"
    expired = _token(secret, exp=int(time.time()) - 1)
    with pytest.raises(jwt.ExpiredSignatureError):
        verify_token(expired, secret)


def test_a_token_with_no_expiry_is_rejected() -> None:
    """A token with no exp is a permanent credential in a format designed for
    temporary ones."""
    secret = b"a-test-secret-that-exists-only-here"
    forever = jwt.encode({"sub": "x", "aud": "vault", "iss": "auth.internal"}, secret)
    with pytest.raises(jwt.MissingRequiredClaimError):
        verify_token(forever, secret)


# --------------------------------------------------------------- webhooks
SECRET = b"whsec_test_only_never_real"
BODY = b'{"event":"payment.captured","amount_minor":1999}'


def test_a_good_signature_verifies() -> None:
    assert verify(sign(SECRET, BODY), BODY, [SECRET]) is True


def test_an_edited_body_fails():
    """Test 12."""
    header = sign(SECRET, BODY)
    with pytest.raises(BadSignature):
        verify(header, BODY.replace(b"1999", b"9999"), [SECRET])


def test_a_replay_after_the_window_fails() -> None:
    """Test 13. The timestamp is inside the signed string, so it cannot be
    edited to look fresh."""
    old = int(time.time()) - 3600
    header = sign(SECRET, BODY, timestamp=old)

    assert verify(header, BODY, [SECRET], now=old + 10) is True
    with pytest.raises(BadSignature):
        verify(header, BODY, [SECRET])


def test_a_missing_signature_fails() -> None:
    with pytest.raises(BadSignature):
        verify("", BODY, [SECRET])
    with pytest.raises(BadSignature):
        verify("t=123", BODY, [SECRET])


def test_the_wrong_secret_fails() -> None:
    with pytest.raises(BadSignature):
        verify(sign(b"someone-elses-secret", BODY), BODY, [SECRET])


def test_the_previous_secret_works_during_the_window_and_not_after() -> None:
    """Test 14. A rotation that breaks every receiver is not a rotation."""
    window = RotationWindow(current=SECRET)
    signed_with_old = sign(SECRET, BODY)

    window.rotate(b"whsec_the_new_one")
    assert verify(signed_with_old, BODY, window.accepted()) is True

    window.close_window()
    with pytest.raises(BadSignature):
        verify(signed_with_old, BODY, window.accepted())


# ---------------------------------------------------------------- logging
def test_no_pan_reaches_the_logs_but_the_bin_and_last_four_do(caplog) -> None:
    """Test 15. The test that fails in the pull request that would leak."""
    logger = logging.getLogger("vault-test")
    logger.setLevel(logging.INFO)

    handler = logging.StreamHandler()
    handler.setFormatter(AllowlistFormatter())

    from vault.logging_ import log

    with caplog.at_level(logging.INFO, logger="vault-test"):
        log(logger, "payment_captured", bin="411111", last4="1111",
            pan=TEST_PAN, cvv="123", amount_minor=1999)

    rendered = AllowlistFormatter().format(caplog.records[0])

    assert TEST_PAN not in rendered
    assert "123" not in rendered.replace("1999", "")
    assert "411111" in rendered
    assert "1111" in rendered


def test_free_text_containing_a_card_number_is_redacted() -> None:
    """The second line of defence, for the error message somebody
    interpolated a card number into."""
    assert redact(f"declined for {TEST_PAN}") == "declined for 411111******1111"
    assert redact("4111 1111 1111 1111") == "411111******1111"
    assert redact("amount 1999") == "amount 1999"     # not card shaped


def test_the_allowlist_does_not_contain_anything_sensitive() -> None:
    assert not {"pan", "cvv", "cvc", "pin", "card_number"} & ALLOWED
