import os
import time

import requests
from fastapi import APIRouter, Depends, HTTPException, Header
from jose import jwt
from jose.exceptions import JOSEError
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models

router = APIRouter(prefix="/auth", tags=["auth"])

CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY", "")
CLERK_FRONTEND_API = os.getenv("CLERK_FRONTEND_API", "flying-midge-48.clerk.accounts.dev")
CLERK_ISSUER = f"https://{CLERK_FRONTEND_API}"
CLERK_JWKS_URL = f"{CLERK_ISSUER}/.well-known/jwks.json"

# In-memory JWKS cache: Clerk's signing keys rarely rotate, so fetching them on every
# request would be wasteful and adds a network hop to every authenticated call.
_jwks_cache: dict = {"keys_by_kid": {}, "fetched_at": 0.0}
_JWKS_TTL_SECONDS = 3600


def _get_jwk(kid: str) -> dict | None:
    now = time.time()
    if kid not in _jwks_cache["keys_by_kid"] or (now - _jwks_cache["fetched_at"]) > _JWKS_TTL_SECONDS:
        resp = requests.get(CLERK_JWKS_URL, timeout=10)
        resp.raise_for_status()
        keys = resp.json().get("keys", [])
        _jwks_cache["keys_by_kid"] = {k["kid"]: k for k in keys}
        _jwks_cache["fetched_at"] = now
    return _jwks_cache["keys_by_kid"].get(kid)


def verify_clerk_token(token: str) -> dict:
    try:
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")
        jwk = _get_jwk(kid) if kid else None
        if not jwk:
            raise HTTPException(401, "Invalid token: unknown signing key")
        claims = jwt.decode(
            token,
            jwk,
            algorithms=["RS256"],
            issuer=CLERK_ISSUER,
            options={"verify_aud": False},
        )
        return claims
    except HTTPException:
        raise
    except (JOSEError, requests.RequestException) as e:
        raise HTTPException(401, f"Invalid or expired token: {str(e)}")


def _fetch_clerk_profile(clerk_user_id: str) -> dict:
    resp = requests.get(
        f"https://api.clerk.com/v1/users/{clerk_user_id}",
        headers={"Authorization": f"Bearer {CLERK_SECRET_KEY}"},
        timeout=10,
    )
    if resp.status_code != 200:
        raise HTTPException(401, "Could not fetch user profile from Clerk")
    return resp.json()


def get_or_create_user_from_clerk(clerk_user_id: str, db: Session) -> models.User:
    user = db.query(models.User).filter(models.User.clerk_user_id == clerk_user_id).first()
    if user:
        return user

    # Session tokens don't carry email unless a custom Clerk JWT template is configured -
    # fetch the profile from Clerk's Backend API instead (only happens once, on first sight
    # of a new Clerk user id).
    profile = _fetch_clerk_profile(clerk_user_id)
    emails = profile.get("email_addresses") or []
    primary_email_id = profile.get("primary_email_address_id")
    email = next((e["email_address"] for e in emails if e.get("id") == primary_email_id), None)
    email = email or (emails[0]["email_address"] if emails else None)
    if not email:
        raise HTTPException(400, "Email not provided by Clerk")

    name = " ".join(filter(None, [profile.get("first_name"), profile.get("last_name")])) or email.split("@")[0]
    avatar_url = profile.get("image_url")

    # Link, don't orphan: reuse an existing local account with the same email (e.g. from
    # earlier auth-provider testing on this project) instead of creating a disconnected
    # duplicate that starts with none of that account's data.
    user = db.query(models.User).filter(models.User.email == email).first()
    if user:
        user.clerk_user_id = clerk_user_id
        db.commit()
        db.refresh(user)
        return user

    user = models.User(
        email=email,
        password_hash="__CLERK_AUTH__",
        name=name,
        role="HR Recruiter",
        avatar_url=avatar_url,
        clerk_user_id=clerk_user_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_current_user(
    authorization: str | None = Header(None),
    db: Session = Depends(get_db),
) -> models.User:
    # Header(None) instead of Header(...): a missing header must fail as a clean,
    # frontend-catchable 401 "not signed in" - a required Header(...) makes FastAPI's
    # own validation reject the request with a raw 422 before this function even runs.
    if not authorization:
        raise HTTPException(401, "Not authenticated")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(401, "Invalid authorization header")

    claims = verify_clerk_token(token)
    clerk_user_id = claims.get("sub")
    if not clerk_user_id:
        raise HTTPException(401, "Invalid token payload")
    return get_or_create_user_from_clerk(clerk_user_id, db)
