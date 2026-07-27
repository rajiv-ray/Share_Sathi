# backend/app/schemas/analytics_schema.py
from enum import Enum
from typing import List

from pydantic import BaseModel, Field


class SentimentEnum(str, Enum):
    POSITIVE = "POSITIVE"
    NEUTRAL = "NEUTRAL"
    NEGATIVE = "NEGATIVE"


# Input payload schema
class NewsAnalysisRequest(BaseModel):
    news_text: str = Field(
        ...,
        min_length=20,
        max_length=20000,
        description="The raw Nepalese financial news text to analyze.",
    )


# Output payload schema
class NewsAnalysisResponse(BaseModel):
    # Was a free-form str - if analyze_financial_news ever returns something
    # other than exactly one of these three, you now get a clear validation
    # error instead of an unexpected value silently reaching the frontend.
    sentiment: SentimentEnum = Field(..., description="Overall news sentiment.")
    summary: List[str] = Field(
        ..., min_length=3, max_length=3, description="Exactly three bullet-point summaries."
    )