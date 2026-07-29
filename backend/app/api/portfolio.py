from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.sector_resolver import sector_resolver
from app.core.nepse_fetcher import get_live_prices
from app.models.user import User
from app.models.portfolio import Transaction
from app.schemas.portfolio_schema import (
    TransactionCreate,
    TransactionResponse,
    TransactionTypeEnum,
    PortfolioHealthResponse,
    SectorAllocation,
    TransactionUpdate
)

router = APIRouter()

def _current_net_shares(db: Session, user_id: int, stock_symbol: str) -> int:
    """
    Net shares currently on record for this symbol, based on existing
    transactions. Used to block a SELL that exceeds what's on record.

    Note: this checks against the *current* total, not the balance as of
    the new transaction's date - a backdated SELL slotted between two
    existing BUYs won't be caught here. Full date-aware validation would
    mean replaying the whole ledger with the new entry inserted in place;
    this catches the common case (typo'd or duplicate SELL) cheaply.
    """
    bought = (
        db.query(func.coalesce(func.sum(Transaction.quantity), 0))
        .filter(
            Transaction.user_id == user_id,
            Transaction.stock_symbol == stock_symbol,
            Transaction.transaction_type == TransactionTypeEnum.BUY.value,
        )
        .scalar()
    )

    sold = (
        db.query(func.coalesce(func.sum(Transaction.quantity), 0))
        .filter(
            Transaction.user_id == user_id,
            Transaction.stock_symbol == stock_symbol,
            Transaction.transaction_type == TransactionTypeEnum.SELL.value,
        )
        .scalar()
    )

    return int(bought) - int(sold)


@router.post("/", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
def create_transaction(
    transaction: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if transaction.transaction_type == TransactionTypeEnum.SELL:
        net_shares = _current_net_shares(db, current_user.id, transaction.stock_symbol)
        if transaction.quantity > net_shares:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Cannot sell {transaction.quantity} shares of {transaction.stock_symbol} - "
                    f"you currently hold {net_shares}."
                ),
            )

    # Pydantic guarantees transaction_type validation and that stock_symbol is uppercase/stripped.
    new_transaction = Transaction(
        user_id=current_user.id,
        stock_symbol=transaction.stock_symbol,
        transaction_type=transaction.transaction_type,
        quantity=transaction.quantity,
        price=transaction.price,
        transaction_date=transaction.transaction_date
    )

    db.add(new_transaction)
    db.commit()
    db.refresh(new_transaction)
    return new_transaction


@router.get("/", response_model=List[TransactionResponse])
def get_user_transactions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Fetch only the transactions that belong to the logged-in user, oldest first.
    return (
        db.query(Transaction)
        .filter(Transaction.user_id == current_user.id)
        .order_by(Transaction.transaction_date, Transaction.id)
        .all()
    )

@router.put("/{transaction_id}")
def update_transaction_price(
    transaction_id: int, 
    tx_update: TransactionUpdate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """Updates the execution price/WACC of a specific transaction."""
    tx = db.query(Transaction).filter(
        Transaction.id == transaction_id, 
        Transaction.user_id == current_user.id
    ).first()
    
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found.")
        
    tx.price = tx_update.price
    db.commit()
    
    return {"message": "Transaction price updated successfully."}

@router.get("/health", response_model=PortfolioHealthResponse)
async def get_portfolio_health(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Analyzes the user's current holdings and calculates a dynamic diversification health score
    along with real-time P/L metrics based on live NEPSE data.
    """
    transactions = (
        db.query(Transaction)
        .filter(Transaction.user_id == current_user.id)
        .order_by(Transaction.transaction_date, Transaction.id)
        .all()
    )

    if not transactions:
        return PortfolioHealthResponse(
            health_score=0,
            total_invested=0.0,
            current_value=0.0,
            total_profit=0.0,
            profit_percentage=0.0,
            allocations=[],
            warnings=["Your portfolio is empty."],
            recommendations=["Start by logging your first BUY transaction."]
        )

    # 2. Calculate Net Holdings (Shares Owned & Total Invested Capital)
    holdings = {}
    for tx in transactions:
        sym = tx.stock_symbol
        pos = holdings.setdefault(sym, {"shares": 0, "invested": 0.0})

        if tx.transaction_type == TransactionTypeEnum.BUY.value:
            pos["shares"] += tx.quantity
            pos["invested"] += (tx.quantity * tx.price)

        elif tx.transaction_type == TransactionTypeEnum.SELL:
            sell_qty = min(tx.quantity, pos["shares"])

            if pos["shares"] > 0:
                avg_cost = pos["invested"] / pos["shares"]
                pos["invested"] = max(0.0, pos["invested"] - (sell_qty * avg_cost))

            pos["shares"] -= sell_qty
            if pos["shares"] <= 0:
                pos["shares"] = 0
                pos["invested"] = 0.0

    # 3. Map to Sectors Dynamically and Calculate Base Allocations
    sector_totals = {}
    grand_total_invested = 0.0

    for sym, data in holdings.items():
        if data["shares"] > 0 and data["invested"] > 0:
            sector = sector_resolver.get_sector(sym)
            sector_totals[sector] = sector_totals.get(sector, 0.0) + data["invested"]
            grand_total_invested += data["invested"]

    if grand_total_invested == 0:
        return PortfolioHealthResponse(
            health_score=0, 
            total_invested=0.0, 
            current_value=0.0,
            total_profit=0.0,
            profit_percentage=0.0,
            allocations=[],
            warnings=["No active investments found."], 
            recommendations=["Buy some stocks."]
        )

    # 4. Fetch Live Prices and Calculate P/L
    live_prices = await get_live_prices()
    current_value = 0.0
    
    for sym, data in holdings.items():
        qty = data["shares"]
        if qty > 0:
            ltp = live_prices.get(sym, 0.0)
            if ltp > 0:
                current_value += (qty * ltp)
            else:
                # Failsafe: If NEPSE API is down or misses an unlisted IPO,
                # fallback to assuming it hasn't gained or lost value.
                current_value += data["invested"]

    total_profit = current_value - grand_total_invested
    profit_percentage = (total_profit / grand_total_invested * 100) if grand_total_invested > 0 else 0.0

    # 5. Generate Percentages & The Health Math
    allocations = []
    health_score = 100
    warnings = []
    recommendations = []

    # Check for Sector Concentration Risk
    for sector, val in sector_totals.items():
        pct = (val / grand_total_invested) * 100
        allocations.append(SectorAllocation(sector=sector, percentage=round(pct, 2), total_value=round(val, 2)))

        # PENALTY LOGIC: If a single sector holds more than 40% of the portfolio
        if pct > 40.0:
            penalty = int((pct - 40.0) * 1.5)  # The further past 40%, the steeper the penalty
            health_score -= penalty
            warnings.append(f"High risk detected: {round(pct, 1)}% of your money is concentrated in {sector}.")
            recommendations.append(f"Consider buying stocks outside of {sector} to balance your risk.")

    # 6. Finalize Score & Edge Cases
    health_score = max(10, min(100, health_score))  # Keep score strictly between 10 and 100

    if health_score >= 90:
        recommendations.append("Excellent diversification! Keep maintaining this balance.")
    elif len(sector_totals) == 1:
        warnings.append("Zero diversification. All your capital is in a single sector.")
        health_score = min(health_score, 40)  # Hard cap the score at 40 if they only own one sector

    # Sort allocations largest to smallest for the frontend charts
    allocations.sort(key=lambda x: x.percentage, reverse=True)

    return PortfolioHealthResponse(
        health_score=health_score,
        total_invested=round(grand_total_invested, 2),
        current_value=round(current_value, 2),
        total_profit=round(total_profit, 2),
        profit_percentage=round(profit_percentage, 2),
        allocations=allocations,
        warnings=warnings,
        recommendations=recommendations
    )