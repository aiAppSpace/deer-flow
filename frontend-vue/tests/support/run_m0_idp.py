"""
【文件职责】     为 G0-7 提供仓库内可控的最小 OIDC provider。
【架构位置】     测试
【主要导出】     main
【依赖关系】     只用 stdlib + backend venv 已有的 PyJWT/cryptography
【边界与注意】   仅供 M0 Gate 使用：无用户交互、无同意页、任何 authorize 请求都直接
                 签发身份。绝不可用于生产，也不要把它做成通用 IdP。
                 走真实 authorization-code + PKCE + nonce，这样 Gateway 侧
                 discover / exchange_code / validate_id_token 全部按真实路径执行。
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import secrets
import threading
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import jwt
from cryptography.hazmat.primitives.asymmetric import rsa
from jwt.algorithms import RSAAlgorithm

KEY_ID = "m0-idp-key"
SUBJECT = "m0-oidc-subject"
EMAIL = "m0-oidc-user@example.com"

_private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
_lock = threading.Lock()
# code -> authorize parameters; also the inspection surface for the Gate.
_codes: dict[str, dict[str, str]] = {}
_authorize_log: list[dict[str, str]] = []


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    issuer = ""
    client_id = ""
    client_secret = ""

    def log_message(self, *_args) -> None:  # keep the Playwright output readable
        return

    # -- helpers ----------------------------------------------------------

    def _json(self, payload: dict, status: int = 200) -> None:
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _redirect(self, location: str) -> None:
        self.send_response(302)
        self.send_header("location", location)
        self.send_header("content-length", "0")
        self.end_headers()

    # -- routes -----------------------------------------------------------

    def do_GET(self) -> None:  # noqa: N802 (BaseHTTPRequestHandler API)
        url = urllib.parse.urlparse(self.path)
        query = {k: v[0] for k, v in urllib.parse.parse_qs(url.query).items()}

        if url.path == "/health":
            self._json({"status": "ok"})
            return

        if url.path == "/.well-known/openid-configuration":
            # No userinfo_endpoint: the ID token already carries email, and
            # skipping that hop keeps the fixture's surface minimal.
            self._json(
                {
                    "issuer": self.issuer,
                    "authorization_endpoint": f"{self.issuer}/authorize",
                    "token_endpoint": f"{self.issuer}/token",
                    "jwks_uri": f"{self.issuer}/jwks",
                    "response_types_supported": ["code"],
                    "subject_types_supported": ["public"],
                    "id_token_signing_alg_values_supported": ["RS256"],
                    "code_challenge_methods_supported": ["S256"],
                }
            )
            return

        if url.path == "/jwks":
            jwk = json.loads(RSAAlgorithm.to_jwk(_private_key.public_key()))
            jwk.update({"kid": KEY_ID, "use": "sig", "alg": "RS256"})
            self._json({"keys": [jwk]})
            return

        if url.path == "/authorize":
            if query.get("client_id") != self.client_id:
                self._json({"error": "unauthorized_client"}, status=400)
                return
            redirect_uri = query.get("redirect_uri", "")
            if not redirect_uri:
                self._json({"error": "invalid_request"}, status=400)
                return

            code = secrets.token_urlsafe(24)
            with _lock:
                _codes[code] = {
                    "redirect_uri": redirect_uri,
                    "nonce": query.get("nonce", ""),
                    "code_challenge": query.get("code_challenge", ""),
                }
                # The Gate reads this to assert which callback origin the
                # Gateway derived for this entry.
                _authorize_log.append(
                    {"redirect_uri": redirect_uri, "state": query.get("state", "")}
                )
                del _authorize_log[:-20]

            separator = "&" if "?" in redirect_uri else "?"
            params = urllib.parse.urlencode(
                {"code": code, "state": query.get("state", "")}
            )
            self._redirect(f"{redirect_uri}{separator}{params}")
            return

        if url.path == "/probe/authorize-log":
            with _lock:
                self._json({"entries": list(_authorize_log)})
            return

        self._json({"error": "not_found"}, status=404)

    def do_POST(self) -> None:  # noqa: N802 (BaseHTTPRequestHandler API)
        url = urllib.parse.urlparse(self.path)
        if url.path != "/token":
            self._json({"error": "not_found"}, status=404)
            return

        length = int(self.headers.get("content-length") or 0)
        form = {
            k: v[0]
            for k, v in urllib.parse.parse_qs(self.rfile.read(length).decode()).items()
        }

        with _lock:
            record = _codes.pop(form.get("code", ""), None)
        if record is None:
            self._json({"error": "invalid_grant"}, status=400)
            return
        if form.get("redirect_uri") != record["redirect_uri"]:
            self._json(
                {
                    "error": "invalid_grant",
                    "error_description": "redirect_uri mismatch",
                },
                status=400,
            )
            return

        # Real S256 verification so the Gateway's PKCE path is actually exercised.
        challenge = record["code_challenge"]
        if challenge:
            verifier = form.get("code_verifier", "")
            expected = _b64url(hashlib.sha256(verifier.encode()).digest())
            if not secrets.compare_digest(expected, challenge):
                self._json(
                    {"error": "invalid_grant", "error_description": "PKCE mismatch"},
                    status=400,
                )
                return

        now = int(time.time())
        claims = {
            "iss": self.issuer,
            "aud": self.client_id,
            "sub": SUBJECT,
            "iat": now,
            "exp": now + 300,
            "email": EMAIL,
            "email_verified": True,
            "name": "M0 OIDC User",
        }
        if record["nonce"]:
            claims["nonce"] = record["nonce"]

        id_token = jwt.encode(
            claims, _private_key, algorithm="RS256", headers={"kid": KEY_ID}
        )
        self._json(
            {
                "access_token": secrets.token_urlsafe(16),
                "token_type": "Bearer",
                "id_token": id_token,
            }
        )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8013)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--issuer", default=None)
    parser.add_argument("--client-id", default="deerflow-m0")
    parser.add_argument("--client-secret", default="m0-idp-secret")
    args = parser.parse_args()

    # The external gate keeps its original loopback defaults. Container ingress
    # supplies one identical public issuer for the browser and internal DNS.
    Handler.issuer = (args.issuer or f"http://127.0.0.1:{args.port}").rstrip("/")
    Handler.client_id = args.client_id
    Handler.client_secret = args.client_secret

    ThreadingHTTPServer((args.host, args.port), Handler).serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
