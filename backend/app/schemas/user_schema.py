# backend/app/schemas/user_schema.py
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


# Make sure this exact name is here!
class UserCreate(BaseModel):
    email: EmailStr
    # max_length=72 matches bcrypt's limit (the common choice with passlib) -
    # anything past that is silently truncated rather than actually hashed.
    # Drop it if security.py uses a different algorithm without that limit.
    password: str = Field(..., min_length=8, max_length=72)
    boid: Optional[str] = Field(default=None, min_length=16, max_length=16)

    @field_validator('boid')
    @classmethod
    def boid_must_be_numeric(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.isdigit():
            raise ValueError("boid must be exactly 16 digits")
        return v


class UserResponse(BaseModel):
    id: int
    email: EmailStr
    boid: Optional[str] = None

    class Config:
        from_attributes = True