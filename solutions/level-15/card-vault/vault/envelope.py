"""Envelope encryption, and the context binding that makes it safe.

One data key encrypts many records. The data key is stored wrapped, and the
master key never leaves the key service. The arithmetic is the argument: a key
service call costs milliseconds and local AES costs microseconds, so the design
question is how few calls you can make.

The part people leave out is the **additional authenticated data**. AES-GCM
lets you bind context that stays readable and is still covered by the
authentication tag, so a ciphertext carries the record it belongs to. Without it, moving a ciphertext
from one row to another succeeds silently, and a card number ends up attached
to somebody else's account.
"""

from __future__ import annotations

import os
from dataclasses import dataclass

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from .keys import DataKey, KeyService


class DecryptionFailed(Exception):
    """The ciphertext, the key or the context is wrong. Which one is not said,
    deliberately: an error that distinguishes them is an oracle."""


@dataclass(frozen=True, slots=True)
class Sealed:
    """What gets stored. None of it is useful without the key service."""

    nonce: bytes
    ciphertext: bytes
    wrapped_key: bytes
    master_key_version: int


def seal(data_key: DataKey, record_id: str, plaintext: bytes) -> Sealed:
    """Encrypt one record under a data key you already hold.

    No key service call. That is the point: the caller fetches one data key and
    seals a whole batch with it.
    """
    nonce = os.urandom(12)      # never reused with the same key
    aead = AESGCM(data_key.plaintext)
    return Sealed(
        nonce=nonce,
        # The record id is the binding. It is readable, and it is covered by
        # the authentication tag, so the ciphertext only decrypts in its place.
        ciphertext=aead.encrypt(nonce, plaintext, record_id.encode()),
        wrapped_key=data_key.wrapped,
        master_key_version=data_key.master_key_version,
    )


def open_(keys: KeyService, record_id: str, sealed: Sealed) -> bytes:
    """Decrypt one record. Costs one key service call to unwrap."""
    plaintext_key = keys.unwrap(sealed.wrapped_key, sealed.master_key_version)
    try:
        return AESGCM(plaintext_key).decrypt(
            sealed.nonce, sealed.ciphertext, record_id.encode()
        )
    except InvalidTag as exc:
        raise DecryptionFailed(f"could not open the record {record_id}") from exc


def rotate_data_key(keys: KeyService, sealed: Sealed) -> Sealed:
    """Move a record's data key onto the current master key.

    Returns a new Sealed with the same nonce and the same ciphertext. Only the
    wrapped key changed, which is the whole reason rotation is cheap: the card
    row is not read, not decrypted and not rewritten.
    """
    return Sealed(
        nonce=sealed.nonce,
        ciphertext=sealed.ciphertext,
        wrapped_key=keys.rewrap(sealed.wrapped_key, sealed.master_key_version),
        master_key_version=keys.current_version,
    )
