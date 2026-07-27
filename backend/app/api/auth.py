# backend/app/api/auth.py
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import (
    verify_password, 
    get_password_hash, 
    create_access_token, 
    get_current_user
)
from app.models.user import User
from app.schemas.user_schema import UserCreate, UserResponse

logger = logging.getLogger(__name__)

router = APIRouter()

# Used to keep /login's response time the same whether or not the email
# exists, so response timing can't be used to enumerate registered users.
_DUMMY_HASH = get_password_hash("this-is-not-a-real-password-used-only-to-equalize-timing")

# Pydantic schema for the BOID update request body
class BOIDUpdate(BaseModel):
    boid: str


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(user: UserCreate, db: Session = Depends(get_db)):
    # 1. Check if the email already exists
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    # 2. Hash the password and create the user
    hashed_password = get_password_hash(user.password)
    new_user = User(
        email=user.email,
        hashed_password=hashed_password,
        boid=user.boid
    )

    # 3. Save to database
    db.add(new_user)
    try:
        db.commit()
    except IntegrityError:
        # Most likely cause: boid is already registered to another account
        # (it's a unique column) and slipped past the email-only check above.
        db.rollback()
        logger.warning("Registration blocked by a unique-constraint conflict (email=%s)", user.email)
        raise HTTPException(status_code=400, detail="This BOID is already registered to another account.")
    db.refresh(new_user)

    return new_user


@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # OAuth2 uses 'username' by default, so we pass our email into it
    db_user = db.query(User).filter(User.email == form_data.username).first()

    # Always run a hash comparison, even when the email doesn't exist, against
    # a dummy hash. Otherwise a missing user returns instantly while a real
    # one takes as long as the hashing algorithm does - and that timing gap
    # is enough to enumerate registered emails even with an identical error
    # message on both paths.
    hashed_password = db_user.hashed_password if db_user else _DUMMY_HASH
    password_valid = verify_password(form_data.password, hashed_password)

    if not db_user or not password_valid:
        logger.info("Failed login attempt for username=%s", form_data.username)
        raise HTTPException(status_code=401, detail="Invalid Credentials")

    # Generate the token
    access_token = create_access_token(data={"sub": str(db_user.id)})

    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me")
def get_user_profile(current_user: User = Depends(get_current_user)):
    """Fetch the current user's profile data, including their BOID."""
    return {
        "email": current_user.email, 
        "boid": current_user.boid
    }


@router.put("/boid")
def update_user_boid(
    data: BOIDUpdate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """Save the user's BOID directly to the database."""
    current_user.boid = data.boid
    
    try:
        db.commit()
        db.refresh(current_user)
    except IntegrityError:
        # Handle the case where the user attempts to update their BOID to one 
        # that already belongs to another account.
        db.rollback()
        raise HTTPException(status_code=400, detail="This BOID is already registered to another account.")
        
    return {"status": "success", "boid": current_user.boid}