import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from cryptography.fernet import Fernet
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User

load_dotenv()

# Setup the password hashing engine (bcrypt)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT Configuration
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    # A hardcoded fallback here would mean anyone who has ever read this
    # source file - including in a public repo - could forge a valid login
    # token for any user_id, on any deployment that forgot to set this.
    # Failing loudly at startup is much safer than running "successfully"
    # in an insecure state. Generate one with: openssl rand -hex 32
    raise RuntimeError(
        "SECRET_KEY environment variable is not set. Add it to your .env file "
        "before starting the server (openssl rand -hex 32 to generate one)."
    )

# MeroShare Credentials Encryption Configuration
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")
if not ENCRYPTION_KEY:
    raise RuntimeError(
        "ENCRYPTION_KEY environment variable is not set. Add it to your .env file. "
        "Generate one by running: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
    )

cipher_suite = Fernet(ENCRYPTION_KEY)

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # Token lasts for 7 days


def encrypt_password(password: str) -> str:
    """Encrypts a plaintext password using symmetric AES encryption."""
    return cipher_suite.encrypt(password.encode()).decode()


def decrypt_password(encrypted_password: str) -> str:
    """Decrypts an encrypted password back to plaintext."""
    return cipher_suite.decrypt(encrypted_password.encode()).decode()


def verify_password(plain_password, hashed_password):
    """Checks if the typed password matches the scrambled one in the DB"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password):
    """Scrambles the password before saving to the DB"""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Generates the JWT login token"""
    to_encode = data.copy()
    # Previously hardcoded to 15 minutes here regardless of
    # ACCESS_TOKEN_EXPIRE_MINUTES above, and login() never passed
    # expires_delta - so despite the "7 days" comment, every token actually
    # expired in 15 minutes.
    expire = datetime.now(timezone.utc) + (
        expires_delta if expires_delta else timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


# This tells FastAPI (and the Swagger "Authorize" button) where to get a token
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        # 1. Decode the token
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")

        # 2. Ensure the ID actually exists in the token BEFORE casting to int
        if user_id is None:
            raise credentials_exception

        user_id = int(user_id)

    except (JWTError, ValueError, TypeError):
        # ValueError/TypeError covers a well-formed but tampered token whose
        # "sub" claim isn't a valid integer - previously this crashed with
        # an unhandled 500 instead of a clean 401.
        raise credentials_exception

    # 3. Find the user in the database (Done exactly ONCE, safely cast to integer)
    user = db.query(User).filter(User.id == user_id).first()

    # 4. Ensure the user hasn't been deleted from the database
    if user is None:
        raise credentials_exception

    return user