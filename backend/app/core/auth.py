"""
Authentication, entitlements, and rate limiting for API routes.

- require_user: verifies the Supabase JWT sent as `Authorization: Bearer <token>`.

  Supabase signs access tokens one of two ways, and a project can move between
  them, so both are supported here:

    ES256 / RS256  the modern asymmetric signing keys. Verified against the
                   project's public JWKS, which needs only SUPABASE_URL — a
                   public value, not a secret.
    HS256          the legacy shared secret. Verified against
                   SUPABASE_JWT_SECRET (Dashboard -> Settings -> API -> JWT secret).

  This used to hardcode algorithms=["HS256"], which meant a project on
  asymmetric keys could never authenticate no matter what secret was set — the
  operator-visible symptom being a 503 that turns into a 401 the moment the
  "missing" secret is supplied.

  The algorithm named in the token header selects the KEY SOURCE, and the two
  can never cross: a symmetric secret is never used to verify an asymmetric
  token, and a JWKS public key is never used to verify an HS256 one. That
  pairing is what stops the classic algorithm-confusion attack, where a token
  is re-signed as HS256 using the public key as the shared secret.
- require_pro: require_user + the user's plan in user_profiles must be 'pro'.
  Returns 402 so the frontend can show an upgrade prompt.
- rate_limit: lightweight in-process sliding-window limiter, keyed by user id
  when authenticated, else by client IP (respects X-Forwarded-For on Railway).
"""

from __future__ import annotations

import os
import time
import threading
from collections import defaultdict, deque
from typing import Any

import jwt
from fastapi import Header, HTTPException, Request, status
from fastapi import Depends

from app.core.database import get_db


# ──────────────────────────────────────────────────────────────────────────
# JWT verification
# ──────────────────────────────────────────────────────────────────────────

# Only these. `alg: none` and anything unlisted is rejected before a key is
# ever looked up.
_SYMMETRIC_ALGS = ("HS256", "HS384", "HS512")
_ASYMMETRIC_ALGS = ("ES256", "RS256", "ES384", "RS384", "ES512", "RS512")

_jwks_client = None
_jwks_lock = threading.Lock()


def _jwt_secret() -> str:
    secret = os.environ.get("SUPABASE_JWT_SECRET")
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "This project signs tokens with the legacy JWT secret, but "
                "SUPABASE_JWT_SECRET is not set on the server."
            ),
        )
    return secret


def _get_jwks_client():
    """Cached JWKS client for the project's public signing keys.

    SUPABASE_URL is the public project URL (https://<ref>.supabase.co) — the
    same one the app already ships in its client bundle. It is not a secret,
    which is rather the point of asymmetric verification.
    """
    global _jwks_client
    if _jwks_client is not None:
        return _jwks_client

    base = (os.environ.get("SUPABASE_URL") or "").strip().rstrip("/")
    if not base:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "This project signs tokens with asymmetric keys, but "
                "SUPABASE_URL is not set on the server."
            ),
        )
    with _jwks_lock:
        if _jwks_client is None:
            from jwt import PyJWKClient
            _jwks_client = PyJWKClient(
                f"{base}/auth/v1/.well-known/jwks.json",
                cache_keys=True,
                # Keys rotate rarely; refetching per request would put a
                # network round trip in front of every authenticated call.
                lifespan=600,
            )
    return _jwks_client


async def require_user(authorization: str | None = Header(None)) -> dict:
    """Verify the Supabase access token and return its claims."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sign in required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization.split(" ", 1)[1].strip()
    try:
        alg = str(jwt.get_unverified_header(token).get("alg") or "")
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session token.",
        )

    if alg in _SYMMETRIC_ALGS:
        key: Any = _jwt_secret()
    elif alg in _ASYMMETRIC_ALGS:
        key = _get_jwks_client().get_signing_key_from_jwt(token).key
    else:
        # Includes "none" and anything we do not recognise.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unsupported token signature.",
        )

    try:
        claims = jwt.decode(
            token,
            key,
            # The single algorithm the header named, already checked against
            # the allowlist above and paired with the matching key source.
            algorithms=[alg],
            audience="authenticated",
            options={"require": ["exp", "sub"]},
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired — please sign in again.",
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session token.",
        )
    if claims.get("role") != "authenticated":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sign in required.",
        )
    return claims


# ──────────────────────────────────────────────────────────────────────────
# Plan entitlement (paywall)
# ──────────────────────────────────────────────────────────────────────────

async def require_pro(claims: dict = Depends(require_user)) -> dict:
    """Allow only users whose user_profiles.plan is 'pro'."""
    user_id = claims.get("sub")
    plan = "free"
    with get_db() as (conn, cur):
        cur.execute("SELECT plan FROM user_profiles WHERE id = %s", [user_id])
        row = cur.fetchone()
        if row and row.get("plan"):
            plan = row["plan"]
    if plan != "pro":
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="The AI Scanner is a Pro feature. Upgrade to Pro to scan result sheets.",
        )
    claims["plan"] = plan
    return claims


# ──────────────────────────────────────────────────────────────────────────
# Rate limiting (in-process sliding window)
# ──────────────────────────────────────────────────────────────────────────

_buckets: dict[str, deque] = defaultdict(deque)
_lock = threading.Lock()


def _client_key(request: Request) -> str:
    """Prefer the authenticated user id; fall back to client IP."""
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        try:
            # Unverified decode is fine here — it's only a bucket key; the
            # actual auth check happens in require_user.
            claims = jwt.decode(auth.split(" ", 1)[1], options={"verify_signature": False})
            if claims.get("sub"):
                return f"user:{claims['sub']}"
        except jwt.InvalidTokenError:
            pass
    fwd = request.headers.get("x-forwarded-for", "")
    ip = fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "unknown")
    return f"ip:{ip}"


def rate_limit(name: str, max_calls: int, window_seconds: int):
    """
    Build a FastAPI dependency enforcing `max_calls` per `window_seconds`
    per user/IP for the route(s) it is attached to.
    """

    async def dependency(request: Request) -> None:
        key = f"{name}:{_client_key(request)}"
        now = time.monotonic()
        with _lock:
            q = _buckets[key]
            while q and q[0] <= now - window_seconds:
                q.popleft()
            if len(q) >= max_calls:
                retry_in = int(q[0] + window_seconds - now) + 1
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many requests — please slow down.",
                    headers={"Retry-After": str(retry_in)},
                )
            q.append(now)

    return dependency
