# backend/app/models/portfolio.py
import enum
from sqlalchemy import Column, Integer, String, Float, ForeignKey, Date, DateTime, Enum, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

# 1. Define a strict Enum to prevent typos in the database
class TransactionType(str, enum.Enum):
    BUY = "BUY"
    SELL = "SELL"

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)

    # Cascade delete ensures if a user deletes their account, their transactions disappear too
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Examples: NABIL, NICA, UPPER (Indexed for faster searching)
    stock_symbol = Column(String(10), index=True, nullable=False)

    # Strictly enforced to be either 'BUY' or 'SELL'
    transaction_type = Column(Enum(TransactionType), nullable=False)

    quantity = Column(Integer, nullable=False)

    # Stores the execution price
    price = Column(Float, nullable=False)

    # The actual date the user bought/sold the stock
    transaction_date = Column(Date, nullable=False)

    # Automatically logs exactly when this record was created in the database
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # 2. Establish a two-way relationship with the User model
    owner = relationship("User", back_populates="transactions")

    # Every query this app makes against transactions filters by user_id,
    # usually together with stock_symbol (portfolio health, oversell check)
    # - a composite index keeps those fast as the table grows.
    # NOTE: Base.metadata.create_all() only creates brand-new tables, so on
    # an existing database this index won't appear automatically on next
    # startup - you'll need an Alembic migration (or a manual CREATE INDEX).
    __table_args__ = (
        Index("ix_transactions_user_symbol", "user_id", "stock_symbol"),
    )