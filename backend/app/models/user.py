# backend/app/models/user.py
from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.core.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    
    # Storing the 16-digit BOID as a string to preserve leading zeros
    boid = Column(String(16), unique=True, index=True, nullable=True)

    # MeroShare Saved Credentials (password securely encrypted)
    meroshare_dp_id = Column(String, nullable=True)
    meroshare_username = Column(String, nullable=True)
    meroshare_password = Column(String, nullable=True)

    # Establish the one-to-many relationship with the Transaction table
    transactions = relationship("Transaction", back_populates="owner", cascade="all, delete-orphan")