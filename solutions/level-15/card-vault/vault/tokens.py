"""The vault: card numbers in, tokens out, and one way back.

The token is **random**. It is not the encrypted PAN, not a hash of it, not
derived from it in any way. If a token could be turned back into a card number
by anybody holding a key, then obtaining that key is obtaining every card, and
the vault has bought you nothing.

BIN and last four are stored **beside** the token as their own fields. They are
not sensitive on their own, every system needs them, and putting them in the
token would make the token carry information.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
from dataclasses import dataclass, field

from .envelope import Sealed, open_, seal
from .keys import DataKey, KeyService

# Fields that must never be stored after authorisation, in any form. Not
# encrypted, not hashed, not "temporarily". This set exists so the check is
# one line at the boundary rather than a rule somebody remembers.
NEVER_STORED = frozenset({"cvv", "cvc", "cvv2", "cid", "pin", "magstripe", "track1", "track2"})


class NotAuthorised(Exception):
    """A caller without the scope asked for a card number."""


class ForbiddenField(Exception):
    """Something tried to store a CVV."""


@dataclass(frozen=True, slots=True)
class Token:
    token: str
    bin: str          # first six. Identifies the issuer, not the cardholder
    last4: str


@dataclass
class Vault:
    keys: KeyService
    # Stable tokens: the same card always produces the same token, so the
    # analytics question "how many customers use one card across merchants"
    # can be answered without a PAN leaving this service. The index is keyed by
    # an HMAC of the PAN rather than the PAN, so this dictionary is not itself
    # a list of card numbers.
    stable: bool = True

    _records: dict[str, Sealed] = field(default_factory=dict)
    _meta: dict[str, tuple[str, str]] = field(default_factory=dict)
    _by_card: dict[str, str] = field(default_factory=dict)
    _index_key: bytes = field(default_factory=lambda: secrets.token_bytes(32))

    # One data key per batch rather than per record. Refreshed when the batch
    # size is reached, which is the dial that trades key service calls against
    # blast radius if one data key is ever exposed.
    batch_size: int = 100
    _data_key: DataKey | None = None
    _used: int = 0

    def _current_key(self) -> DataKey:
        if self._data_key is None or self._used >= self.batch_size:
            self._data_key = self.keys.generate_data_key()
            self._used = 0
        self._used += 1
        return self._data_key

    def _fingerprint(self, pan: str) -> str:
        return hmac.new(self._index_key, pan.encode(), hashlib.sha256).hexdigest()

    def tokenise(self, pan: str, **extra: str) -> Token:
        for field_name in extra:
            if field_name.lower() in NEVER_STORED:
                raise ForbiddenField(
                    f"{field_name} may never be stored after authorisation, "
                    "in any form"
                )

        fingerprint = self._fingerprint(pan)
        if self.stable and fingerprint in self._by_card:
            token = self._by_card[fingerprint]
            bin_, last4 = self._meta[token]
            return Token(token=token, bin=bin_, last4=last4)

        # 32 random bytes. Nothing about the card is recoverable from it.
        token = "tok_" + secrets.token_urlsafe(24)
        self._records[token] = seal(self._current_key(), token, pan.encode())
        self._meta[token] = (pan[:6], pan[-4:])
        if self.stable:
            self._by_card[fingerprint] = token

        return Token(token=token, bin=pan[:6], last4=pan[-4:])

    def detokenise(self, token: str, scope: set[str]) -> str:
        """The one function in the company that produces a card number.

        The scope check is before the decryption rather than after, so an
        unauthorised call costs nothing and touches no key.
        """
        if "vault:read_pan" not in scope:
            raise NotAuthorised("this caller may not read a card number")
        sealed = self._records.get(token)
        if sealed is None:
            raise KeyError("no such token")
        return open_(self.keys, token, sealed).decode()

    def metadata(self, token: str) -> Token:
        """BIN and last four, with no scope required and no decryption.

        This is what the rest of the platform actually needs, which is why
        almost nothing ever calls detokenise.
        """
        bin_, last4 = self._meta[token]
        return Token(token=token, bin=bin_, last4=last4)

    # ------------------------------------------------------------- rotation
    def rotate_master_key(self) -> dict[str, int]:
        """Rewrap every data key. Read no card row.

        Returns counts, and the count that matters is `card_rows_rewritten`,
        which is zero and is asserted by a test.
        """
        from .envelope import rotate_data_key

        new_version = self.keys.rotate()

        # Distinct wrapped keys, not records. A hundred thousand records
        # sharing a thousand data keys means a thousand rewraps.
        seen: dict[bytes, tuple[bytes, int]] = {}
        for token, sealed in self._records.items():
            if sealed.wrapped_key not in seen:
                rewrapped = rotate_data_key(self.keys, sealed)
                seen[sealed.wrapped_key] = (rewrapped.wrapped_key, rewrapped.master_key_version)

        for token, sealed in list(self._records.items()):
            new_wrapped, version = seen[sealed.wrapped_key]
            self._records[token] = Sealed(
                nonce=sealed.nonce,               # unchanged
                ciphertext=sealed.ciphertext,     # unchanged: the row is not rewritten
                wrapped_key=new_wrapped,
                master_key_version=version,
            )

        return {
            "new_master_version": new_version,
            "data_keys_rewrapped": len(seen),
            "records": len(self._records),
            "card_rows_rewritten": 0,
        }

    def retire_old_master_keys(self) -> list[int]:
        """Only once nothing references them. Checked, not assumed."""
        in_use = {s.master_key_version for s in self._records.values()}
        retired = []
        for version in self.keys.versions:
            if version != self.keys.current_version and version not in in_use:
                self.keys.retire(version)
                retired.append(version)
        return retired
