# backend/app/api/analytics.py
import logging
import os
import joblib
import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.ai_engine import (
    analyze_financial_news, 
    generate_portfolio_advice,
    generate_ml_forecast_explanation, 
    generate_low_confidence_forecast
)
from app.core.nepse_fetcher import get_live_prices
from app.models.user import User
from app.models.portfolio import Transaction
from app.schemas.portfolio_schema import TransactionTypeEnum
from app.schemas.analytics_schema import NewsAnalysisRequest, NewsAnalysisResponse

logger = logging.getLogger(__name__)

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODEL_PATH = os.path.join(BASE_DIR, "models", "nepse_rf_model.joblib")
SCALER_PATH = os.path.join(BASE_DIR, "models", "nepse_scaler.joblib")

rf_model = None
scaler = None
try:
    rf_model = joblib.load(MODEL_PATH)
    scaler = joblib.load(SCALER_PATH)
    logger.info("AI engine loaded successfully.")
except Exception:
    logger.warning("AI model files failed to load; /predict-trend will be unavailable.", exc_info=True)


class StockFeatures(BaseModel):
    Open: float = Field(..., gt=0)
    High: float = Field(..., gt=0)
    Low: float = Field(..., gt=0)
    Close: float = Field(..., gt=0)
    Volume: float = Field(..., ge=0)
    Turnover: float = Field(..., ge=0)
    Daily_Return: float
    Log_Return: float
    SMA_5: float = Field(..., gt=0)
    SMA_20: float = Field(..., gt=0)
    EMA_12: float = Field(..., gt=0)
    EMA_26: float = Field(..., gt=0)
    RSI_14: float = Field(..., ge=0, le=100)
    MACD: float
    MACD_Signal: float
    ATR_14: float = Field(..., ge=0)
    BB_Middle: float = Field(..., gt=0)
    BB_Upper: float = Field(..., gt=0)
    BB_Lower: float = Field(..., gt=0)
    OBV: float

    @model_validator(mode="after")
    def _check_price_consistency(self):
        if self.High < max(self.Open, self.Close, self.Low):
            raise ValueError("High must be >= Open, Close, and Low")
        if self.Low > min(self.Open, self.Close, self.High):
            raise ValueError("Low must be <= Open, Close, and High")
        if not (self.BB_Upper >= self.BB_Middle >= self.BB_Lower):
            raise ValueError("Bollinger Bands must satisfy BB_Upper >= BB_Middle >= BB_Lower")
        return self


class StockForecastResponse(BaseModel):
    symbol: str
    prediction: str
    confidence: str
    advice: str
    current_price: float  # Added this field so the frontend can display it
    historical_data: list


@router.get("/analyze-stock/{symbol}", response_model=StockForecastResponse)
async def analyze_stock(symbol: str, current_user: User = Depends(get_current_user)):
    symbol = symbol.upper().strip()
    csv_path = os.path.join(BASE_DIR, "raw_data", "nepse_100", f"{symbol}.csv")
    
    # 1. Accurately fetch the live price using your existing NEPSE fetcher
    live_prices = await get_live_prices()
    current_price = live_prices.get(symbol, 0.0)
    
    if not os.path.exists(csv_path):
        advice = generate_low_confidence_forecast(symbol)
        return StockForecastResponse(
            symbol=symbol,
            prediction="UNKNOWN",
            confidence="LOW (AI Only)",
            advice=advice,
            current_price=current_price,
            historical_data=[]
        )

    try:
        df = pd.read_csv(csv_path)
        df.rename(columns=lambda x: x.strip().capitalize(), inplace=True)
        
        # Native Pandas Calculations (No external TA libraries required)
        df['Daily_return'] = df['Close'].pct_change()
        df['Log_return'] = np.log(df['Close'] / df['Close'].shift(1))
        
        df['Sma_5'] = df['Close'].rolling(window=5).mean()
        df['Sma_20'] = df['Close'].rolling(window=20).mean()
        df['Ema_12'] = df['Close'].ewm(span=12, adjust=False).mean()
        df['Ema_26'] = df['Close'].ewm(span=26, adjust=False).mean()
        
        # MACD calculation
        df['Macd'] = df['Ema_12'] - df['Ema_26']
        df['Macd_signal'] = df['Macd'].ewm(span=9, adjust=False).mean()
        
        # RSI 14 calculation
        delta = df['Close'].diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        df['Rsi_14'] = 100 - (100 / (1 + rs))
        
        # Bollinger Bands calculation
        df['Bb_middle'] = df['Close'].rolling(window=20).mean()
        std = df['Close'].rolling(window=20).std()
        df['Bb_upper'] = df['Bb_middle'] + (std * 2)
        df['Bb_lower'] = df['Bb_middle'] - (std * 2)
        
        # ATR 14 calculation
        high_low = df['High'] - df['Low']
        high_close = np.abs(df['High'] - df['Close'].shift())
        low_close = np.abs(df['Low'] - df['Close'].shift())
        ranges = pd.concat([high_low, high_close, low_close], axis=1)
        true_range = ranges.max(axis=1)
        df['Atr_14'] = true_range.rolling(window=14).mean()
        
        # OBV calculation
        df['Obv'] = (np.sign(df['Close'].diff()) * df.get('Volume', 0)).fillna(0).cumsum()

        df.dropna(inplace=True)
        if df.empty:
            raise ValueError("Not enough historical data to calculate indicators.")

        latest = df.iloc[-1]
        
        features_array = np.array([[
            latest['Open'], latest['High'], latest['Low'], latest['Close'], 
            latest.get('Volume', 0), latest.get('Turnover', 0),
            latest['Daily_return'], latest['Log_return'],
            latest['Sma_5'], latest['Sma_20'], latest['Ema_12'], latest['Ema_26'],
            latest['Rsi_14'], latest['Macd'], latest['Macd_signal'],
            latest['Atr_14'], latest['Bb_middle'], latest['Bb_upper'], latest['Bb_lower'],
            latest['Obv']
        ]])

        if rf_model is None or scaler is None:
            raise HTTPException(status_code=503, detail="ML Model not loaded in memory.")
            
        scaled_features = scaler.transform(features_array)
        pred_val = rf_model.predict(scaled_features)[0]
        prediction = "UP" if pred_val == 1 else "DOWN"

        indicators_dict = {
            "RSI_14": latest['Rsi_14'],
            "MACD": latest['Macd'],
            "Close": latest['Close'],
            "Live_Price": current_price # Passing this so Gemini has context!
        }
        
        # 2. Gemini generates the text explanation using the technicals AND the live price
        advice = generate_ml_forecast_explanation(symbol, prediction, indicators_dict)
        chart_data = df.tail(250)[['Date', 'Close']].rename(columns={'Date': 'date', 'Close': 'close'}).to_dict('records')

        return StockForecastResponse(
            symbol=symbol,
            prediction=prediction,
            confidence="HIGH (ML + AI)",
            advice=advice,
            current_price=current_price,
            historical_data=chart_data
        )

    except Exception as e:
        logger.error(f"Error processing {symbol}: {e}")
        raise HTTPException(status_code=500, detail="Failed to process historical data for this symbol.")


@router.post("/predict-trend")
def predict_trend(data: StockFeatures, current_user: User = Depends(get_current_user)):
    if rf_model is None or scaler is None:
        raise HTTPException(status_code=503, detail="The prediction model is not currently available.")
    try:
        features_array = np.array([[
            data.Open, data.High, data.Low, data.Close, data.Volume, data.Turnover,
            data.Daily_Return, data.Log_Return, data.SMA_5, data.SMA_20,
            data.EMA_12, data.EMA_26, data.RSI_14, data.MACD, data.MACD_Signal,
            data.ATR_14, data.BB_Middle, data.BB_Upper, data.BB_Lower, data.OBV
        ]])
        scaled_features = scaler.transform(features_array)
        prediction = rf_model.predict(scaled_features)[0]
        trend = "UP" if prediction == 1 else "DOWN"
        return {
            "status": "success",
            "prediction": trend,
            "message": f"Based on structural indicators, the model forecasts a movement {trend}.",
        }
    except Exception:
        logger.exception("predict-trend failed for user %s", current_user.id)
        raise HTTPException(status_code=500, detail="Failed to generate a prediction.")


@router.post("/analyze-news", response_model=NewsAnalysisResponse)
def post_analyze_news(payload: NewsAnalysisRequest, current_user: User = Depends(get_current_user)):
    try:
        return analyze_financial_news(payload.news_text)
    except Exception:
        logger.exception("analyze-news failed for user %s", current_user.id)
        raise HTTPException(status_code=502, detail="Failed to analyze this article right now.")


@router.get("/portfolio-advice")
async def get_ai_portfolio_advice(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    transactions = db.query(Transaction).filter(Transaction.user_id == current_user.id).order_by(Transaction.transaction_date, Transaction.id).all()
    if not transactions:
        return {"advice": "Your portfolio is currently empty. Log some trades or sync with MeroShare to get personalized AI advice!"}

    holdings = {}
    for tx in transactions:
        sym = tx.stock_symbol
        pos = holdings.setdefault(sym, {"shares": 0, "invested": 0.0})
        if tx.transaction_type == TransactionTypeEnum.BUY.value:
            pos["shares"] += tx.quantity
            pos["invested"] += (tx.quantity * tx.price)
        elif tx.transaction_type == TransactionTypeEnum.SELL.value:
            sell_qty = min(tx.quantity, pos["shares"])
            if pos["shares"] > 0:
                avg_cost = pos["invested"] / pos["shares"]
                pos["invested"] = max(0.0, pos["invested"] - (sell_qty * avg_cost))
            pos["shares"] -= sell_qty
            if pos["shares"] <= 0:
                pos["shares"] = 0
                pos["invested"] = 0.0

    live_prices = await get_live_prices()
    summary_lines = []
    total_invested = 0.0
    current_value = 0.0

    for sym, data in holdings.items():
        qty = data["shares"]
        if qty > 0:
            ltp = live_prices.get(sym, 0.0)
            invested = data["invested"]
            wacc = invested / qty
            val = qty * ltp if ltp > 0 else invested
            pl = val - invested
            pl_pct = (pl / invested * 100) if invested > 0 else 0
            total_invested += invested
            current_value += val
            summary_lines.append(f"- {sym}: {qty} shares | WACC: Rs {wacc:.2f} | LTP: Rs {ltp:.2f} | P/L: Rs {pl:.2f} ({pl_pct:.2f}%)")

    if not summary_lines:
        return {"advice": "You have no active holdings to analyze."}

    grand_pl = current_value - total_invested
    grand_pl_pct = (grand_pl / total_invested * 100) if total_invested > 0 else 0
    portfolio_text = (
        f"Total Invested: Rs {total_invested:.2f}\n"
        f"Current Value: Rs {current_value:.2f}\n"
        f"Overall P/L: Rs {grand_pl:.2f} ({grand_pl_pct:.2f}%)\n\n"
        f"Individual Holdings:\n" + "\n".join(summary_lines)
    )

    advice = generate_portfolio_advice(portfolio_text)
    return {"advice": advice}