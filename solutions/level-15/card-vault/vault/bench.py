"""Every number the README publishes, and the one that failed to reproduce.

    python -m vault.bench

Five measurements, in the order the design decisions get made:

1. local AES-GCM, so the cost of encryption itself is known before anything is
   argued about
2. envelope encryption against one key service call per record
3. rotation: rewrapping data keys against re-encrypting records
4. token verification, because it sits on every request
5. the timing attack on `==`, which did not reproduce

Numbers move between machines. What does not move is the ratio between them,
and the ratios are the reason the design is shaped this way.
"""

from __future__ import annotations

import hmac
import os
import statistics
import time

import jwt
from cryptography.hazmat.primitives.asymmetric import ec, rsa
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from .envelope import seal
from .keys import CALL_LATENCY_SECONDS, KeyService

PAN = "4111111111111111"        # a test number. Nothing here is a real card.
RECORDS = 20_000
BATCH = 100


def _ms(seconds: float) -> float:
    return seconds * 1000


# ------------------------------------------------- 1. local cryptography
def aes_gcm() -> dict:
    """Seal one card number, 20,000 times, with a key already in hand.

    No key service call, because that is the whole point of a data key: the
    encryption is local and the network is not involved.

    Three variants, because the difference between them is the interesting
    part. The primitive with the cipher object reused is what a cryptography
    benchmark reports. `seal()` builds a fresh AESGCM per record and refuses to
    cache it, which costs about three microseconds and keeps plaintext key
    material out of any structure that outlives the call.
    """
    keys = KeyService(latency_seconds=0.0)
    data_key = keys.generate_data_key()
    plaintext = PAN.encode()

    reused = AESGCM(data_key.plaintext)
    started = time.perf_counter()
    for _ in range(RECORDS):
        reused.encrypt(os.urandom(12), plaintext, b"rec")
    primitive = time.perf_counter() - started

    started = time.perf_counter()
    for _ in range(RECORDS):
        AESGCM(data_key.plaintext).encrypt(os.urandom(12), plaintext, b"rec")
    fresh_cipher = time.perf_counter() - started

    started = time.perf_counter()
    for i in range(RECORDS):
        seal(data_key, f"rec-{i}", plaintext)
    shipped = time.perf_counter() - started

    return {
        "records": RECORDS,
        "primitive_us": primitive / RECORDS * 1e6,
        "primitive_per_second": RECORDS / primitive,
        "fresh_cipher_us": fresh_cipher / RECORDS * 1e6,
        "shipped_us": shipped / RECORDS * 1e6,
        "shipped_per_second": RECORDS / shipped,
    }


# ----------------------------------------------------- 2. the envelope
def envelope() -> dict:
    """One key service call per record, against one per batch.

    The per record number is measured over a sample and multiplied out, because
    running 20,000 calls at 8 ms each takes almost three minutes and proves
    nothing the sample has not already proved. The envelope number is measured
    in full: 200 calls is under two seconds and there is no reason to
    extrapolate it.
    """
    sample = 200
    keys = KeyService()                      # 8 ms per call, as in production
    started = time.perf_counter()
    for _ in range(sample):
        keys.generate_data_key()
    per_call = (time.perf_counter() - started) / sample

    with_envelope = KeyService()
    started = time.perf_counter()
    data_key = with_envelope.generate_data_key()
    used = 0
    for i in range(RECORDS):
        if used >= BATCH:
            data_key = with_envelope.generate_data_key()
            used = 0
        seal(data_key, f"rec-{i}", PAN.encode())
        used += 1
    envelope_seconds = time.perf_counter() - started

    return {
        "per_call_ms": _ms(per_call),
        "per_record_calls": RECORDS,
        "per_record_seconds_extrapolated": per_call * RECORDS,
        "envelope_calls": with_envelope.calls,
        "envelope_seconds_measured": envelope_seconds,
        "call_ratio": RECORDS / with_envelope.calls,
    }


# ------------------------------------------------------- 3. rotation
def rotation() -> dict:
    """Rewrapping the data keys, against re-encrypting the records.

    Latency is dialled out of both sides, so this compares the cryptography
    rather than the network. It flatters the re-encryption: rewrapping touches
    200 wrapped keys and re-encryption rewrites 20,000 rows, and the rewrite is
    the part that takes locks, fills the write ahead log and needs the level 13
    backfill. The cryptography is the cheapest thing about it.
    """
    keys = KeyService(latency_seconds=0.0)
    data_keys = [keys.generate_data_key() for _ in range(RECORDS // BATCH)]

    sealed = []
    for i in range(RECORDS):
        key_for_batch = data_keys[i // BATCH]
        sealed.append((f"rec-{i}", seal(key_for_batch, f"rec-{i}", PAN.encode())))

    keys.rotate()

    started = time.perf_counter()
    for data_key in data_keys:
        keys.rewrap(data_key.wrapped, data_key.master_key_version)
    rewrap_seconds = time.perf_counter() - started

    fresh = keys.generate_data_key()
    started = time.perf_counter()
    for record_id, _ in sealed:
        seal(fresh, record_id, PAN.encode())       # decrypt is the same order
    reencrypt_seconds = time.perf_counter() - started

    return {
        "data_keys": len(data_keys),
        "rewrap_ms": _ms(rewrap_seconds),
        "records": RECORDS,
        "reencrypt_ms": _ms(reencrypt_seconds),
        "rows_rewritten_by_rewrap": 0,
        "rows_rewritten_by_reencrypt": RECORDS,
    }


# ----------------------------------------------- 4. token verification
def token_verification(iterations: int = 2_000) -> list[dict]:
    """What a verification costs, per algorithm, on the hot path.

    Quoted as a share of one core at a thousand requests a second, because
    "240 microseconds" sounds free and "24% of a core" does not.
    """
    claims = {
        "sub": "payments-service",
        "aud": "vault",
        "iss": "auth.internal",
        "exp": int(time.time()) + 300,
        "scope": "vault:read_pan",
    }

    rsa_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    ec_key = ec.generate_private_key(ec.SECP256R1())
    secret = b"a-test-secret-that-exists-only-here"

    cases = [
        ("HS256", secret, secret),
        ("RS256", rsa_key, rsa_key.public_key()),
        ("ES256", ec_key, ec_key.public_key()),
    ]

    out = []
    for algorithm, signing_key, verifying_key in cases:
        token = jwt.encode(claims, signing_key, algorithm=algorithm)
        started = time.perf_counter()
        for _ in range(iterations):
            jwt.decode(
                token,
                verifying_key,
                algorithms=[algorithm],     # pinned, never read from the token
                audience="vault",
                issuer="auth.internal",
                options={"require": ["exp", "aud", "iss"]},
            )
        took = time.perf_counter() - started
        each = took / iterations
        out.append(
            {
                "algorithm": algorithm,
                "microseconds_each": each * 1_000_000,
                "core_share_at_1000_rps": each * 1000,
            }
        )
    return out


# ------------------------------------------- 5. the timing attack on ==
def equals(a: str, b: str) -> bool:
    """The comparison being measured. Byte by byte, short circuiting."""
    return a == b


def timing(iterations: int = 200_000) -> dict:
    """Try to measure the leak `==` is supposed to have, and report the result.

    `==` returns as soon as it finds a difference, so a wrong secret differing
    at the first byte should be measurably faster than one differing at the
    last. Over a 64 character hex digest at this sample size the effect is
    buried in the noise: the difference is nanoseconds and the sign moves
    between runs.

    That is not a reason to use `==`. It is a reason to be honest about why
    compare_digest is used: it costs tens of nanoseconds and it removes a
    dependency on an implementation detail that could change.
    """
    expected = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
    differs_first = "0" + expected[1:]
    differs_last = expected[:-1] + "0"

    def measure(candidate: str, compare) -> float:
        runs = []
        for _ in range(5):                    # median of five, not one run
            started = time.perf_counter()
            for _ in range(iterations):
                compare(expected, candidate)
            runs.append((time.perf_counter() - started) / iterations)
        return statistics.median(runs)

    first = measure(differs_first, equals)
    last = measure(differs_last, equals)
    digest = measure(differs_last, hmac.compare_digest)

    return {
        "differs_at_first_byte_ns": first * 1e9,
        "differs_at_last_byte_ns": last * 1e9,
        "leak_reproduced": last > first * 1.5,
        "compare_digest_ns": digest * 1e9,
        "compare_digest_overhead_ns": (digest - last) * 1e9,
    }


def main() -> None:
    print(f"key service latency: {_ms(CALL_LATENCY_SECONDS):.0f} ms per call\n")

    a = aes_gcm()
    print(f"1. AES-256-GCM, one card number, local, {a['records']:,} records")
    print(f"   the primitive, cipher reused: {a['primitive_us']:.1f} us, "
          f"{a['primitive_per_second']:,.0f} a second")
    print(f"   a fresh cipher per record:    {a['fresh_cipher_us']:.1f} us")
    print(f"   seal(), which is shipped:     {a['shipped_us']:.1f} us, "
          f"{a['shipped_per_second']:,.0f} a second\n")

    e = envelope()
    print("2. envelope encryption against one call per record")
    print(f"   key service call: {e['per_call_ms']:.1f} ms")
    print(f"   per record:  {e['per_record_calls']:,} calls, "
          f"{e['per_record_seconds_extrapolated']:.0f} s (extrapolated)")
    print(f"   envelope:    {e['envelope_calls']:,} calls, "
          f"{e['envelope_seconds_measured']:.1f} s (measured)")
    print(f"   {e['call_ratio']:.0f}x fewer calls\n")

    r = rotation()
    print("3. rotation")
    print(f"   rewrap {r['data_keys']} data keys: {r['rewrap_ms']:.0f} ms, "
          f"{r['rows_rewritten_by_rewrap']} card rows rewritten")
    print(f"   re-encrypt {r['records']:,} records: {r['reencrypt_ms']:.0f} ms of "
          f"cryptography, {r['rows_rewritten_by_reencrypt']:,} rows rewritten\n")

    print("4. token verification, per algorithm")
    for case in token_verification():
        print(f"   {case['algorithm']}: {case['microseconds_each']:.1f} us, "
              f"{case['core_share_at_1000_rps'] * 100:.0f}% of a core at 1,000 rps")
    print()

    t = timing()
    print("5. the timing attack on ==")
    print(f"   differs at the first byte: {t['differs_at_first_byte_ns']:.1f} ns")
    print(f"   differs at the last byte:  {t['differs_at_last_byte_ns']:.1f} ns")
    print(f"   leak reproduced: {t['leak_reproduced']}")
    print(f"   compare_digest: {t['compare_digest_ns']:.1f} ns "
          f"({t['compare_digest_overhead_ns']:+.1f} ns)")


if __name__ == "__main__":
    main()
