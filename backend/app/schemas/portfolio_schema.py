# backend/app/schemas/portfolio_schema.py
from pydantic import BaseModel, Field, field_validator
from datetime import date, datetime
from typing import List

# Reuse the same enum the database uses instead of keeping a second,
# hand-synced copy here - two definitions of "BUY"/"SELL" are two places
# that can quietly drift apart if one gets updated and the other doesn't.
from app.models.portfolio import TransactionType as TransactionTypeEnum

# 2. The Base Schema: Holds everything shared between creating and reading
class TransactionBase(BaseModel):
    stock_symbol: str = Field(..., min_length=1, max_length=10, description="The stock ticker symbol")
    transaction_type: TransactionTypeEnum
    quantity: int = Field(..., gt=0, description="Number of shares must be strictly greater than 0")
    price: float = Field(..., gt=0, description="Price per share must be strictly greater than 0")
    transaction_date: date

    # Automatically clean up the symbol (e.g., "  nabil " becomes "NABIL")
    @field_validator('stock_symbol')
    @classmethod
    def uppercase_symbol(cls, v: str) -> str:
        cleaned = v.upper().strip()
        if not cleaned:
            raise ValueError("stock_symbol cannot be empty")
        return cleaned

    # A future-dated trade would break the chronological replay the health
    # endpoint relies on for cost-basis math, so reject it up front.
    @field_validator('transaction_date')
    @classmethod
    def not_in_future(cls, v: date) -> date:
        if v > date.today():
            raise ValueError("transaction_date cannot be in the future")
        return v

# 3. The Create Schema: Used exactly when the React app sends a POST request
class TransactionCreate(TransactionBase):
    pass  # It inherits everything from TransactionBase, nothing extra needed!

# 4. The Response Schema: Used when sending data back to the React app
class TransactionResponse(TransactionBase):
    id: int
    user_id: int
    created_at: datetime  # Include the timestamp we added to the DB model

    # This tells Pydantic to read data directly from the SQLAlchemy ORM model
    class Config:
        from_attributes = True

# 5. Portfolio Health Schemas
class SectorAllocation(BaseModel):
    sector: str
    percentage: float
    total_value: float

class PortfolioHealthResponse(BaseModel):
    health_score: int
    total_invested: float
    current_value: float
    total_profit: float
    profit_percentage: float
    allocations: List[SectorAllocation]
    warnings: List[str]
    recommendations: List[str]

class TransactionUpdate(BaseModel):
    price: float