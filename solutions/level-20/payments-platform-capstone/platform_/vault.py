"""The vault, reduced to what the capstone exercises.

Level 15 in forty lines: a card number goes in, a meaningless token comes out,
and exactly one function returns a card number. What the capstone needs from it is
the fourth chaos scenario, so the credential is a real object that can be revoked
while the platform is running.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
from dataclasses import dataclass, field


class CredentialRevoked(Exception):
    """The vault refused the caller. Chaos scenario four.

    Named for what happened, because the point of the scenario is that the
    failure is explicit and alertable rather than a silent stream of errors that
    looks like something else.
    """


class NotAuthorised(Exception):
    """A valid caller without the scope for a card number."""


@dataclass
class Vault:
    credential: str = "vault_live_capstone"
    accepted: set[str] = field(default_factory=lambda: {"vault_live_capstone"})
    _tokens: dict[str, str] = field(default_factory=dict)      # token -> sealed pan
    _by_card: dict[str, str] = field(default_factory=dict)     # fingerprint -> token
    _index_key: bytes = field(default_factory=lambda: secrets.token_bytes(32))
    calls: int = 0
    refusals: int = 0

    def tokenise(self, pan: str, credential: str) -> dict:
        self.calls += 1
        self._check(credential)

        fingerprint = hmac.new(self._index_key, pan.encode(), hashlib.sha256).hexdigest()
        if fingerprint in self._by_card:
            token = self._by_card[fingerprint]
        else:
            token = "tok_" + secrets.token_urlsafe(18)
            # "Sealed" here is a reversible transform standing in for level 15's
            # AES-GCM, because the capstone exercises the boundary rather than the
            # cryptography. The property that matters is unchanged: the token is
            # random and carries nothing.
            self._tokens[token] = pan[::-1]
            self._by_card[fingerprint] = token
        return {"token": token, "bin": pan[:6], "last4": pan[-4:]}

    def detokenise(self, token: str, credential: str, scope: set[str]) -> str:
        self.calls += 1
        self._check(credential)
        if "vault:read_pan" not in scope:
            raise NotAuthorised("this caller may not read a card number")
        return self._tokens[token][::-1]

    def _check(self, credential: str) -> None:
        if credential not in self.accepted:
            self.refusals += 1
            raise CredentialRevoked(
                "the vault rejected this credential. Rotate it or restore the "
                "previous one: every payment is failing until it is fixed"
            )

    # --------------------------------------------------------------- chaos
    def revoke(self, credential: str) -> None:
        self.accepted.discard(credential)

    def grant(self, credential: str) -> None:
        self.accepted.add(credential)
