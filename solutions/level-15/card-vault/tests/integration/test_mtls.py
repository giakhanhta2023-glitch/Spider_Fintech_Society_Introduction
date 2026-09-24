"""Test 11: a client with no certificate cannot complete the handshake.

This is in `integration/` rather than beside the unit tests because it opens a
real TLS listener on the loopback interface and performs three real handshakes.
Nothing is mocked. A mocked handshake proves nothing about TLS, which is the
entire reason this file exists.

    pytest tests/integration/test_mtls.py -v

No external service and no network: the certificate authority, the server
certificate and the client certificate are all generated in the fixture and
thrown away when the test ends. That is also how a real private CA works, minus
the part where the root key lives in hardware.

The point being proved is **where** the refusal happens. An unauthenticated
client does not reach the application, does not reach a request handler, and
does not reach a line of your code: it is refused during the handshake, by the
TLS stack, before there is a request at all. That is a stronger position than
any check you could write, because there is no code path to get it wrong in.
"""

from __future__ import annotations

import ipaddress
import socket
import ssl
import threading
import time
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID

HOST = "127.0.0.1"


def _key() -> rsa.RSAPrivateKey:
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


def _name(common_name: str) -> x509.Name:
    return x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, common_name)])


def _write(path: Path, key: rsa.RSAPrivateKey, cert: x509.Certificate) -> None:
    path.write_bytes(
        cert.public_bytes(serialization.Encoding.PEM)
        + key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.TraditionalOpenSSL,
            serialization.NoEncryption(),
        )
    )


@pytest.fixture(scope="module")
def pki(tmp_path_factory) -> dict[str, Path]:
    """One CA, one server certificate, one client certificate, one stranger.

    The stranger is signed by a second CA that the server does not trust. It is
    there because "no certificate" and "a certificate from somebody else" are
    different failures, and a mutual TLS setup that only refuses the first one
    is not doing its job.
    """
    directory = tmp_path_factory.mktemp("pki")
    now = datetime.now(UTC)

    def ca(common_name: str) -> tuple[rsa.RSAPrivateKey, x509.Certificate]:
        key = _key()
        cert = (
            x509.CertificateBuilder()
            .subject_name(_name(common_name))
            .issuer_name(_name(common_name))              # self signed: it is the root
            .public_key(key.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(now - timedelta(minutes=1))
            .not_valid_after(now + timedelta(days=1))
            .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
            .sign(key, hashes.SHA256())
        )
        return key, cert

    def issued_by(
        ca_key: rsa.RSAPrivateKey,
        ca_cert: x509.Certificate,
        common_name: str,
        server: bool,
    ) -> tuple[rsa.RSAPrivateKey, x509.Certificate]:
        key = _key()
        builder = (
            x509.CertificateBuilder()
            .subject_name(_name(common_name))
            .issuer_name(ca_cert.subject)
            .public_key(key.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(now - timedelta(minutes=1))
            .not_valid_after(now + timedelta(days=1))
        )
        if server:
            # Without this the client refuses the server, because a hostname is
            # matched against the SAN and not against the common name.
            builder = builder.add_extension(
                x509.SubjectAlternativeName(
                    [x509.IPAddress(ipaddress.ip_address(HOST))]
                ),
                critical=False,
            )
        return key, builder.sign(ca_key, hashes.SHA256())

    ca_key, ca_cert = ca("finquest-vault-ca")
    other_ca_key, other_ca_cert = ca("somebody-elses-ca")

    server_key, server_cert = issued_by(ca_key, ca_cert, "vault.internal", server=True)
    client_key, client_cert = issued_by(ca_key, ca_cert, "payments-service", server=False)
    stranger_key, stranger_cert = issued_by(
        other_ca_key, other_ca_cert, "payments-service", server=False
    )

    paths = {
        "ca": directory / "ca.pem",
        "other_ca": directory / "other-ca.pem",
        "server": directory / "server.pem",
        "client": directory / "client.pem",
        "stranger": directory / "stranger.pem",
    }
    paths["ca"].write_bytes(ca_cert.public_bytes(serialization.Encoding.PEM))
    paths["other_ca"].write_bytes(other_ca_cert.public_bytes(serialization.Encoding.PEM))
    _write(paths["server"], server_key, server_cert)
    _write(paths["client"], client_key, client_cert)
    _write(paths["stranger"], stranger_key, stranger_cert)
    return paths


@dataclass
class Listener:
    """The port, and what the server decided about each connection.

    The client's view of a refusal is unreliable, and that is a property of TLS
    1.3 rather than of this test: client authentication happens after the
    client has sent its Finished message, so `wrap_socket` can return
    successfully to a client that is about to be rejected. The refusal then
    arrives on the first read, as an alert, as an empty read, or as a reset
    connection depending on timing. All three were observed on one machine
    running the same test.

    The server always knows. So the assertions below check the server's record
    and the absence of application bytes, not the exception type, which is the
    only version of this test that does not go flaky.
    """

    port: int
    admitted: list[str]
    refused: list[str]

    def wait_for_refusal(self, count: int, timeout: float = 3.0) -> str:
        deadline = time.time() + timeout
        while time.time() < deadline:
            if len(self.refused) >= count:
                return self.refused[count - 1]
            time.sleep(0.01)
        raise AssertionError(f"the server recorded no refusal number {count}")


@pytest.fixture(scope="module")
def vault(pki: dict[str, Path]):
    """A TLS listener that demands a client certificate signed by our CA.

    `verify_mode = CERT_REQUIRED` plus `load_verify_locations` is the whole of
    mutual TLS on the server side. There is no application code involved, and
    nothing above the handshake can be reached without passing it.
    """
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(pki["server"])
    context.verify_mode = ssl.CERT_REQUIRED
    context.load_verify_locations(cafile=str(pki["ca"]))

    listener = socket.socket()
    listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    listener.bind((HOST, 0))
    listener.listen(8)
    state = Listener(port=listener.getsockname()[1], admitted=[], refused=[])
    stop = threading.Event()

    def serve() -> None:
        while not stop.is_set():
            try:
                raw, _ = listener.accept()
            except OSError:
                return
            try:
                with context.wrap_socket(raw, server_side=True) as tls:
                    # Reached only by a client the TLS stack already vouched for.
                    subject = dict(
                        item for rdn in tls.getpeercert()["subject"] for item in rdn
                    )
                    common_name = subject.get("commonName", "unknown")
                    state.admitted.append(common_name)
                    tls.sendall(common_name.encode())
            except (ssl.SSLError, OSError) as exc:
                # A refused handshake. Nothing above this line ran, there was
                # never a request, and the application was never involved.
                state.refused.append(f"{type(exc).__name__}: {exc}")
            finally:
                raw.close()

    thread = threading.Thread(target=serve, daemon=True)
    thread.start()
    yield state
    stop.set()
    listener.close()
    thread.join(timeout=2)


def _client(pki: dict[str, Path], certificate: str | None) -> ssl.SSLContext:
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    context.load_verify_locations(cafile=str(pki["ca"]))
    if certificate:
        context.load_cert_chain(pki[certificate])
    return context


def application_bytes(port: int, context: ssl.SSLContext) -> bytes:
    """Whatever the application sent back, or nothing at all.

    Every TLS level failure becomes empty bytes on purpose. This test asks one
    question: can a caller without a certificate get a single byte out of the
    vault. Which alert arrived varies with timing and is somebody else's test.
    """
    try:
        with socket.create_connection((HOST, port), timeout=5) as raw:
            with context.wrap_socket(raw, server_hostname=HOST) as tls:
                return tls.recv(1024)
    except (ssl.SSLError, OSError):
        return b""


def test_a_client_with_a_certificate_is_admitted(pki, vault) -> None:
    """The control. Without this, the two refusals below prove nothing: a
    listener that refuses everything would pass them both."""
    assert application_bytes(vault.port, _client(pki, "client")) == b"payments-service"
    assert vault.admitted == ["payments-service"]


def test_a_client_with_no_certificate_is_refused_at_the_handshake(pki, vault) -> None:
    """Test 11. The refusal is a TLS alert, not an HTTP 401.

    There is no request to authorise, no header to parse and no handler to
    reach. On this machine the server reports
    `PEER_DID_NOT_RETURN_A_CERTIFICATE` and the client sees
    `TLSV13_ALERT_CERTIFICATE_REQUIRED`, when it sees anything at all.
    """
    assert application_bytes(vault.port, _client(pki, None)) == b""

    reason = vault.wait_for_refusal(1)
    assert "certificate" in reason.lower()
    assert vault.admitted == ["payments-service"]      # still only the one


def test_a_certificate_from_another_authority_is_refused(pki, vault) -> None:
    """Signed, valid, in date, and issued by a CA we do not trust.

    The common name says `payments-service`, which is the point: a name in a
    certificate means nothing on its own. What means something is who signed
    it. The server reports `CERTIFICATE_VERIFY_FAILED, unable to get local
    issuer certificate`.
    """
    assert application_bytes(vault.port, _client(pki, "stranger")) == b""

    reason = vault.wait_for_refusal(2)
    assert "verify failed" in reason.lower() or "issuer" in reason.lower()
    assert vault.admitted == ["payments-service"]
