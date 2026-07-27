# backend/app/api/analytics.py
import logging
import os

import joblib
import numpy as np
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, model_validator

from app.core.ai_engine import analyze_financial_news
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.analytics_schema import NewsAnalysisRequest, NewsAnalysisResponse

logger = logging.getLogger(__name__)

router = APIRouter()

# 1. Safely navigate up the directory tree: api -> app -> backend -> models
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODEL_PATH = os.path.join(BASE_DIR, "models", "nepse_rf_model.joblib")
SCALER_PATH = os.path.join(BASE_DIR, "models", "nepse_scaler.joblib")

# 2. Load the AI Model and Scaler into memory when the server starts.
# This is deliberately best-effort: a missing or corrupt model file (or a
# scikit-learn version mismatch between training and serving - a very
# common real-world failure, and NOT a FileNotFoundError) shouldn't take
# down auth, portfolio, or IPO features just because analytics can't load.
# Only /predict-trend degrades if this fails.
rf_model = None
scaler = None
try:
    rf_model = joblib.load(MODEL_PATH)
    scaler = joblib.load(SCALER_PATH)
    logger.info("AI engine loaded successfully.")
except Exception:
    logger.warning("AI model files failed to load; /predict-trend will be unavailable.", exc_info=True)


# 3. Define the exact incoming data structure matching your 20 columns
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
        # Standard OHLC + Bollinger Band invariants. Catches malformed or
        # mismatched candle data before it reaches the model, rather than
        # letting the model silently produce a confident-looking prediction
        # on nonsense input.
        if self.High < max(self.Open, self.Close, self.Low):
            raise ValueError("High must be >= Open, Close, and Low")
        if self.Low > min(self.Open, self.Close, self.High):
            raise ValueError("Low must be <= Open, Close, and High")
        if not (self.BB_Upper >= self.BB_Middle >= self.BB_Lower):
            raise ValueError("Bollinger Bands must satisfy BB_Upper >= BB_Middle >= BB_Lower")
        return self


@router.post("/predict-trend")
def predict_trend(data: StockFeatures, current_user: User = Depends(get_current_user)):
    # NOTE: auth added here for consistency with every other endpoint in the
    # app (analyze-news, portfolio, ipo). Remove the dependency if this is
    # meant to be public/unauthenticated on purpose.
    if rf_model is None or scaler is None:
        raise HTTPException(status_code=503, detail="The prediction model is not currently available.")

    try:
        # Convert the JSON payload into a Numpy Array for Scikit-Learn
        features_array = np.array([[
            data.Open, data.High, data.Low, data.Close, data.Volume, data.Turnover,
            data.Daily_Return, data.Log_Return, data.SMA_5, data.SMA_20,
            data.EMA_12, data.EMA_26, data.RSI_14, data.MACD, data.MACD_Signal,
            data.ATR_14, data.BB_Middle, data.BB_Upper, data.BB_Lower, data.OBV
        ]])

        # Scale the data using the exact same rules as training
        scaled_features = scaler.transform(features_array)

        # Ask the AI for a prediction (0 = Down, 1 = Up)
        prediction = rf_model.predict(scaled_features)[0]
        trend = "UP" if prediction == 1 else "DOWN"

        return {
            "status": "success",
            "prediction": trend,
            "message": f"Based on structural indicators, the model forecasts a movement {trend}.",
        }
    except Exception:
        # Don't leak raw exception text (library internals, file paths) to
        # the client - log it server-side and return a generic message.
        logger.exception("predict-trend failed for user %s", current_user.id)
        raise HTTPException(status_code=500, detail="Failed to generate a prediction from the current inputs.")


@router.post("/analyze-news", response_model=NewsAnalysisResponse)
def post_analyze_news(
    payload: NewsAnalysisRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Ingests a text article, processes it via Gemini AI, and returns a 3-bullet summary with structural sentiment tags.
    """
    try:
        return analyze_financial_news(payload.news_text)
    except Exception:
        logger.exception("analyze-news failed for user %s", current_user.id)
        raise HTTPException(status_code=502, detail="Failed to analyze this article right now. Please try again.")