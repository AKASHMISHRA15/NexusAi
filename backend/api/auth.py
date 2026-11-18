"""Firebase-backed, single-use email OTP verification for NexusAI."""
import asyncio
import hashlib
import hmac
import secrets
import smtplib
import sqlite3
import ssl
import time
from email.message import EmailMessage
from pathlib import Path
from typing import Annotated

import firebase_admin
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth as firebase_auth, credentials
from pydantic import BaseModel, EmailStr, Field

from config.settings import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])
bearer = HTTPBearer(auto_error=False)
OTP_TTL = 300
RESEND_COOLDOWN = 60
MAX_SENDS = 5
RATE_WINDOW = 900


def _connection() -> sqlite3.Connection:
    conn = sqlite3.connect(Path(settings.data_dir) / "auth_otp.sqlite3")
    conn.row_factory = sqlite3.Row
    return conn


def initialize_auth_storage() -> None:
    with _connection() as conn:
        conn.execute("""CREATE TABLE IF NOT EXISTS email_otps (
            email TEXT PRIMARY KEY, otp_hash TEXT NOT NULL, expires_at INTEGER NOT NULL,
            last_sent_at INTEGER NOT NULL, window_started_at INTEGER NOT NULL,
            send_count INTEGER NOT NULL, failed_attempts INTEGER NOT NULL DEFAULT 0
        )""")


def _otp_secret() -> bytes:
    if not settings.otp_hmac_secret:
        raise HTTPException(503, "OTP service is not configured.")
    return settings.otp_hmac_secret.encode()


def _hash_otp(email: str, otp: str) -> str:
    return hmac.new(_otp_secret(), f"{email.lower()}:{otp}".encode(), hashlib.sha256).hexdigest()


def _firebase_ready() -> bool:
    if firebase_admin._apps:
        return True
    path = Path(settings.firebase_service_account_path or "")
    if not path.is_file():
        return False
    firebase_admin.initialize_app(credentials.Certificate(str(path)))
    return True


async def require_firebase_user(
    credentials_value: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]
) -> dict:
    if not credentials_value or credentials_value.scheme.lower() != "bearer":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing Firebase bearer token.")
    if not _firebase_ready():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Firebase Admin verification is not configured.")
    try:
        return firebase_auth.verify_id_token(credentials_value.credentials, check_revoked=True)
    except Exception:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired Firebase token.")


def _require_secure_transport(request: Request) -> None:
    # A Tauri desktop app uses loopback HTTP. Any non-loopback deployment must be HTTPS.
    local_hosts = {"127.0.0.1", "localhost", "::1"}
    proto = request.headers.get("x-forwarded-proto", request.url.scheme)
    if request.url.hostname not in local_hosts and proto != "https":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "HTTPS is required.")


def _send_mail(email: str, otp: str) -> None:
    if not all((settings.smtp_host, settings.smtp_user, settings.smtp_pass, settings.smtp_from)):
        raise RuntimeError("SMTP is not configured")
    message = EmailMessage()
    message["Subject"] = "Your Nexus AI verification code"
    message["From"] = settings.smtp_from
    message["To"] = email
    message.set_content(
        f"Your Nexus AI verification code is: {otp}\n\n"
        "This code expires in 5 minutes. Do not share it with anyone."
    )
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
        smtp.starttls(context=ssl.create_default_context())
        smtp.login(settings.smtp_user, settings.smtp_pass)
        smtp.send_message(message)


class SendOtpRequest(BaseModel):
    email: EmailStr
    mode: str = "login"  # "register" | "login"


class CheckEmailRequest(BaseModel):
    email: EmailStr
    mode: str  # "register" | "login"


class VerifyOtpRequest(BaseModel):
    email: EmailStr
    otp: str = Field(pattern=r"^\d{6}$")


@router.post("/check-email")
async def check_email(payload: CheckEmailRequest):
    """
    Check whether an email address exists in Firebase.
    - mode='register': returns 409 if email already registered
    - mode='login': returns 404 if email is not registered
    """
    if not _firebase_ready():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Firebase Admin is not configured.")
    email = payload.email.lower()
    user_exists = False
    try:
        firebase_auth.get_user_by_email(email)
        user_exists = True
    except firebase_auth.UserNotFoundError:
        user_exists = False

    if payload.mode == "register" and user_exists:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This email is already registered. Please sign in instead."
        )
    if payload.mode == "login" and not user_exists:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "No account found for this email. Please create an account."
        )
    return {"exists": user_exists, "mode": payload.mode}


@router.post("/send-otp", status_code=status.HTTP_202_ACCEPTED)
async def send_otp(request: Request, payload: SendOtpRequest, user: dict = Depends(require_firebase_user)):
    _require_secure_transport(request)
    email, now = payload.email.lower(), int(time.time())
    if user.get("email", "").lower() != email:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "OTP email must match the authenticated user.")

    otp = f"{secrets.randbelow(1_000_000):06d}"
    with _connection() as conn:
        existing = conn.execute("SELECT * FROM email_otps WHERE email = ?", (email,)).fetchone()
        if existing and now - existing["last_sent_at"] < RESEND_COOLDOWN:
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Please wait before requesting another code.")
        sends = existing["send_count"] if existing and now - existing["window_started_at"] < RATE_WINDOW else 0
        if sends >= MAX_SENDS:
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many codes requested. Try again later.")
        window_started = existing["window_started_at"] if sends else now
        conn.execute("""INSERT INTO email_otps(email, otp_hash, expires_at, last_sent_at, window_started_at, send_count, failed_attempts)
            VALUES (?, ?, ?, ?, ?, ?, 0)
            ON CONFLICT(email) DO UPDATE SET otp_hash=excluded.otp_hash, expires_at=excluded.expires_at,
            last_sent_at=excluded.last_sent_at, window_started_at=excluded.window_started_at,
            send_count=excluded.send_count, failed_attempts=0""",
            (email, _hash_otp(email, otp), now + OTP_TTL, now, window_started, sends + 1))
    try:
        await asyncio.to_thread(_send_mail, email, otp)
    except Exception:
        with _connection() as conn:
            conn.execute("DELETE FROM email_otps WHERE email = ?", (email,))
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Unable to send verification email.")
    return {"accepted": True, "expires_in": OTP_TTL}


@router.post("/verify-otp")
async def verify_otp(request: Request, payload: VerifyOtpRequest, user: dict = Depends(require_firebase_user)):
    _require_secure_transport(request)
    email, now = payload.email.lower(), int(time.time())
    if user.get("email", "").lower() != email:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "OTP email must match the authenticated user.")
    with _connection() as conn:
        row = conn.execute("SELECT * FROM email_otps WHERE email = ?", (email,)).fetchone()
        if not row or row["expires_at"] <= now:
            conn.execute("DELETE FROM email_otps WHERE email = ?", (email,))
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "This verification code has expired.")
        if row["failed_attempts"] >= 5:
            conn.execute("DELETE FROM email_otps WHERE email = ?", (email,))
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many invalid attempts. Request a new code.")
        if not hmac.compare_digest(row["otp_hash"], _hash_otp(email, payload.otp)):
            conn.execute("UPDATE email_otps SET failed_attempts = failed_attempts + 1 WHERE email = ?", (email,))
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid verification code.")
        conn.execute("DELETE FROM email_otps WHERE email = ?", (email,))
    return {"verified": True, "uid": user["uid"], "email": email}


@router.post("/send-otp-passwordless", status_code=status.HTTP_202_ACCEPTED)
async def send_otp_passwordless(request: Request, payload: SendOtpRequest):
    _require_secure_transport(request)
    email, now = payload.email.lower(), int(time.time())

    otp = f"{secrets.randbelow(1_000_000):06d}"
    with _connection() as conn:
        existing = conn.execute("SELECT * FROM email_otps WHERE email = ?", (email,)).fetchone()
        if existing and now - existing["last_sent_at"] < RESEND_COOLDOWN:
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Please wait before requesting another code.")
        sends = existing["send_count"] if existing and now - existing["window_started_at"] < RATE_WINDOW else 0
        if sends >= MAX_SENDS:
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many codes requested. Try again later.")
        window_started = existing["window_started_at"] if sends else now
        conn.execute("""INSERT INTO email_otps(email, otp_hash, expires_at, last_sent_at, window_started_at, send_count, failed_attempts)
            VALUES (?, ?, ?, ?, ?, ?, 0)
            ON CONFLICT(email) DO UPDATE SET otp_hash=excluded.otp_hash, expires_at=excluded.expires_at,
            last_sent_at=excluded.last_sent_at, window_started_at=excluded.window_started_at,
            send_count=excluded.send_count, failed_attempts=0""",
            (email, _hash_otp(email, otp), now + OTP_TTL, now, window_started, sends + 1))
    try:
        await asyncio.to_thread(_send_mail, email, otp)
    except Exception:
        with _connection() as conn:
            conn.execute("DELETE FROM email_otps WHERE email = ?", (email,))
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Unable to send verification email.")
    return {"accepted": True, "expires_in": OTP_TTL}


@router.post("/verify-otp-passwordless")
async def verify_otp_passwordless(payload: VerifyOtpRequest):
    email, now = payload.email.lower(), int(time.time())

    with _connection() as conn:
        row = conn.execute("SELECT * FROM email_otps WHERE email = ?", (email,)).fetchone()
        if not row or row["expires_at"] <= now:
            conn.execute("DELETE FROM email_otps WHERE email = ?", (email,))
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "This verification code has expired.")
        if row["failed_attempts"] >= 5:
            conn.execute("DELETE FROM email_otps WHERE email = ?", (email,))
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many invalid attempts. Request a new code.")
        if not hmac.compare_digest(row["otp_hash"], _hash_otp(email, payload.otp)):
            conn.execute("UPDATE email_otps SET failed_attempts = failed_attempts + 1 WHERE email = ?", (email,))
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid verification code.")
        conn.execute("DELETE FROM email_otps WHERE email = ?", (email,))

    if not _firebase_ready():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Firebase Admin is not configured.")

    try:
        firebase_user = firebase_auth.get_user_by_email(email)
        uid = firebase_user.uid
    except firebase_auth.UserNotFoundError:
        new_user = firebase_auth.create_user(email=email, email_verified=True)
        uid = new_user.uid

    custom_token = firebase_auth.create_custom_token(uid)
    return {"verified": True, "custom_token": custom_token.decode("utf-8"), "email": email, "uid": uid}
