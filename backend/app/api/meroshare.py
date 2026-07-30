# backend/app/api/meroshare.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import date
from app.core.database import get_db
from app.core.security import get_current_user, encrypt_password, decrypt_password
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

async def _process_sync(dp_id: str, username: str, password: str, db: Session, current_user: User) -> MeroShareSyncResponse:
    """
    Internal helper function to automate MeroShare login, fetch current 
    portfolio holdings, and sync them into the user's transaction ledger.
    """
    bot = MeroShareBot()
    
    try:
        holdings = await bot.sync_account(
            dp_id=dp_id,
            username=username,
            password=password
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


@router.get("/status")
def get_meroshare_status(current_user: User = Depends(get_current_user)):
    """Check if the user has securely saved MeroShare credentials."""
    has_saved = bool(current_user.meroshare_username and current_user.meroshare_password)
    return {
        "has_saved_credentials": has_saved, 
        "dp_id": current_user.meroshare_dp_id, 
        "username": current_user.meroshare_username
    }


@router.post("/save-and-sync", response_model=MeroShareSyncResponse)
async def save_and_sync(
    credentials: MeroShareCredentials,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Saves encrypted credentials and performs the first sync."""
    # 1. Encrypt and save to DB
    current_user.meroshare_dp_id = credentials.dp_id
    current_user.meroshare_username = credentials.username
    current_user.meroshare_password = encrypt_password(credentials.password)
    db.commit()
    
    # 2. Perform sync
    return await _process_sync(credentials.dp_id, credentials.username, credentials.password, db, current_user)


@router.post("/sync-saved", response_model=MeroShareSyncResponse)
async def sync_from_saved(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Syncs using the credentials securely saved in the database."""
    if not current_user.meroshare_password:
        raise HTTPException(status_code=400, detail="No saved credentials found.")
        
    # Decrypt password into memory
    try:
        raw_password = decrypt_password(current_user.meroshare_password)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to decrypt stored credentials.")
    
    # Perform sync
    return await _process_sync(current_user.meroshare_dp_id, current_user.meroshare_username, raw_password, db, current_user)


@router.delete("/clear")
def clear_credentials(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Deletes the saved credentials from the database."""
    current_user.meroshare_dp_id = None
    current_user.meroshare_username = None
    current_user.meroshare_password = None
    db.commit()
    return {"message": "Credentials successfully cleared."}