"""A key service you cannot read the master key out of.

That refusal is the entire point of the file. Every method here either wraps or
unwraps a data key, and none of them returns the master key, because a key
service that can hand out its master key is a database with extra steps.

It sleeps 8 ms per call on purpose. Encryption is microseconds; the network
call is milliseconds; and envelope encryption exists to make far fewer of the
second kind. With no latency the design looks like pointless indirection, and
the measurement that justifies it disappears.

The real thing is AWS KMS, and this is not an analogy for it: GenerateDataKey
hands you a plaintext data key and a wrapped copy, Decrypt unwraps it, and the
master key never leaves the service. Having built it by hand, you can read that
documentation and know exactly what each call costs you.
"""

from __future__ import annotations

import os
import time
from dataclasses import dataclass, field

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

CALL_LATENCY_SECONDS = 0.008


@dataclass(frozen=True, slots=True)
class DataKey:
    """A key you may use locally, and the wrapped copy you may store.

    Keep `plaintext` for as long as the batch takes and then let it go. Store
    `wrapped`, which is useless without the key service.
    """

    plaintext: bytes
    wrapped: bytes
    master_key_version: int


class KeyService:
    def __init__(self, latency_seconds: float = CALL_LATENCY_SECONDS) -> None:
        # Master keys by version. Two are readable at once so a rotation does
        # not have to be instantaneous across every record.
        self._masters: dict[int, AESGCM] = {1: AESGCM(AESGCM.generate_key(bit_length=256))}
        self._current = 1
        self._latency = latency_seconds
        self.calls = 0

    # There is deliberately no method that returns a master key. Not a private
    # one either: the dict is the only reference, and nothing hands it out.

    @property
    def current_version(self) -> int:
        return self._current

    @property
    def versions(self) -> list[int]:
        return sorted(self._masters)

    def _charge(self) -> None:
        self.calls += 1
        time.sleep(self._latency)

    def generate_data_key(self) -> DataKey:
        """A fresh data key, plaintext and wrapped. One call."""
        self._charge()
        plaintext = AESGCM.generate_key(bit_length=256)
        return DataKey(
            plaintext=plaintext,
            wrapped=self._wrap(plaintext, self._current),
            master_key_version=self._current,
        )

    def unwrap(self, wrapped: bytes, version: int) -> bytes:
        """Turn a stored wrapped key back into a usable one. One call."""
        self._charge()
        master = self._masters.get(version)
        if master is None:
            raise KeyError(f"master key version {version} has been retired")
        nonce, ciphertext = wrapped[:12], wrapped[12:]
        return master.decrypt(nonce, ciphertext, b"data-key")

    def rotate(self) -> int:
        """Start using a new master key. Old versions stay readable."""
        self._current += 1
        self._masters[self._current] = AESGCM(AESGCM.generate_key(bit_length=256))
        return self._current

    def rewrap(self, wrapped: bytes, from_version: int) -> bytes:
        """Move a data key onto the current master. Two calls' worth of work.

        This is the whole of a rotation. The records are never read, never
        decrypted and never rewritten: only the small number of wrapped data
        keys move.
        """
        plaintext = self.unwrap(wrapped, from_version)
        self._charge()
        return self._wrap(plaintext, self._current)

    def retire(self, version: int) -> None:
        """Remove an old master key, once nothing references it.

        Irreversible, and the point of the retirement job is to prove nothing
        references it first. Retiring a version that something still uses makes
        those records unreadable forever.
        """
        if version == self._current:
            raise ValueError("cannot retire the current master key")
        self._masters.pop(version, None)

    def _wrap(self, plaintext: bytes, version: int) -> bytes:
        nonce = os.urandom(12)
        # "data-key" as additional authenticated data, so a wrapped data key
        # cannot be passed off as a wrapped anything else.
        return nonce + self._masters[version].encrypt(nonce, plaintext, b"data-key")
