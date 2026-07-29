from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import date
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.portfolio import Transaction, TransactionType
from app.schemas.meroshare_schema import MeroShareCredentials, MeroShareSyncResponse
from app.core.meroshare_bot import MeroShareBot

# Safe fallback if sector_resolver function name differs
try:
    from app.core.sector_resolver import get_sector_for_symbol
except ImportError:
    def get_sector_for_symbol(symbol: str) -> str:
        return "Others"

router = APIRouter()

@router.get("/capitals")
async def get_meroshare_capitals():
    """Fetches the list of all Depository Participants (DPs) from MeroShare."""
    bot = MeroShareBot()
    try:
        capitals = await bot.get_capitals()
        return capitals
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch DP list from MeroShare."
        )

@router.post("/sync", response_model=MeroShareSyncResponse)
async def sync_meroshare_portfolio(
    credentials: MeroShareCredentials,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Automates MeroShare login, fetches current portfolio holdings, 
    and syncs them into the user's transaction ledger.
    """
    bot = MeroShareBot()
    
    try:
        holdings = await bot.sync_account(
            dp_id=credentials.dp_id,
            username=credentials.username,
            password=credentials.password
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to communicate with MeroShare.")


    synced_count = 0
    today = date.today()

    for item in holdings:
        # Try to get the short script (NABIL). If it's an unlisted IPO, fallback to description.
        raw_symbol = item.get("script") or item.get("scriptDesc") or "UNKNOWN"
        
        # CRITICAL FIX: Remove spaces, uppercase it, and strictly truncate to 10 characters 
        # to prevent the PostgreSQL String(10) DataError crash.
        symbol = str(raw_symbol).replace(" ", "").upper()[:10]
        
        total_kitta = float(item.get("currentBalance", 0))
        ltp = float(item.get("lastTransactionPrice", 0))
        
        if total_kitta <= 0:
            continue

        user_txs = db.query(Transaction).filter(
            Transaction.user_id == current_user.id,
            Transaction.stock_symbol == symbol
        ).all()

        current_qty = sum(
            tx.quantity if tx.transaction_type == TransactionType.BUY else -tx.quantity 
            for tx in user_txs
        )

        diff = total_kitta - current_qty

        if diff != 0:
            tx_type = TransactionType.BUY if diff > 0 else TransactionType.SELL
            sync_tx = Transaction(
                user_id=current_user.id,
                stock_symbol=symbol,
                transaction_type=tx_type,
                quantity=int(abs(diff)),
                price=ltp if ltp > 0 else 100.0,
                transaction_date=today
            )
            db.add(sync_tx)
            synced_count += 1

    db.commit()

    return MeroShareSyncResponse(
        message="Successfully synchronized portfolio with MeroShare ledger.",
        total_scripts_synced=synced_count
    )