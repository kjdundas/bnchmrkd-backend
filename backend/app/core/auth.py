"""
Authentication, entitlements, and rate limiting for API routes.

- require_user: verifies the Supabase JWT sent as `Authorization: Bearer <token>`.
  Needs SUPABASE_JWT_SECRET env var (Supabase Dashboard -> Settings -> API -> JWT secret).
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

import jwt
from fastapi import Header, HTTPException, Request, status
from fastapi import Depends

from app.core.database import get_db


# ──────────────────────────────────────────────────────────────────────────
# JWT verification
# ──────────────────────────────────────────────────────────────────────────

def _jwt_secret() -> str:
    secret = os.environ.get("SUPABASE_JWT_SECRET")
    if not secret:
        # Fail closed but with a clear operator-facing hint in logs.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication is not configured on the server.",
        )
    return secret


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
        claims = jwt.decode(
            token,
            _jwt_secret(),
            algorithms=["HS256"],
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
