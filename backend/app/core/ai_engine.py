import json
import logging
import os

from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

logger = logging.getLogger(__name__)

VALID_SENTIMENTS = {"POSITIVE", "NEUTRAL", "NEGATIVE"}

# Configure the SDK using your secret API Key stored safely in the .env file
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Initialize the Client once at boot
ai_client = None
if GEMINI_API_KEY:
    ai_client = genai.Client(api_key=GEMINI_API_KEY)


def _fallback_response(reason: str) -> dict:
    logger.warning("analyze_financial_news falling back: %s", reason)
    return {
        "sentiment": "NEUTRAL",
        "summary": [
            "Gemini AI Engine could not produce a result for this article.",
            "This is an automated fallback, not an actual analysis.",
            "Check server logs for the underlying error.",
        ],
    }


def analyze_financial_news(news_content: str) -> dict:
    """
    Passes raw financial news to Gemini and forces a structured sentiment analysis JSON block.
    """
    if not ai_client:
        return _fallback_response("GEMINI_API_KEY is not configured or client failed to initialize")

    system_prompt = (
        "You are an expert financial analyst focusing on the Nepal Stock Exchange (NEPSE). "
        "Analyze the provided financial news text. You must respond ONLY with a raw JSON object. "
        "Do not wrap your response in markdown code blocks like ```json ... ```. Do not add conversational filler. "
        "The JSON object must match this exact structure: "
        "{\n"
        '  "sentiment": "POSITIVE" | "NEUTRAL" | "NEGATIVE",\n'
        '  "summary": ["Bullet point 1", "Bullet point 2", "Bullet point 3"]\n'
        "}\n"
        "Ensure the summary list contains exactly 3 concise, highly informative bullet points."
    )

    try:
        full_content = f"{system_prompt}\n\nNews Content to analyze:\n{news_content}"

        config = types.GenerateContentConfig(
            response_mime_type="application/json",
        )

        response = ai_client.models.generate_content(
            model="gemini-3.6-flash",
            contents=full_content,
            config=config,
        )

        parsed_data = json.loads(response.text.strip())

        if not isinstance(parsed_data, dict):
            raise ValueError(f"Expected a JSON object, got {type(parsed_data).__name__}")

        sentiment = str(parsed_data.get("sentiment", "")).upper().strip()
        if sentiment not in VALID_SENTIMENTS:
            logger.warning("Gemini returned an unrecognized sentiment: %r", parsed_data.get("sentiment"))
            sentiment = "NEUTRAL"

        summary = parsed_data.get("summary")
        if not isinstance(summary, list):
            summary = []
        summary = [str(item) for item in summary if isinstance(item, (str, int, float))]

        while len(summary) < 3:
            summary.append("No additional summary data provided by analyzer.")
        summary = summary[:3]

        return {"sentiment": sentiment, "summary": summary}

    except Exception as e:
        return _fallback_response(str(e))


def generate_portfolio_advice(portfolio_summary: str) -> str:
    """
    Sends the user's synced portfolio state to Gemini 3.6 Flash for personalized advice.
    """
    if not ai_client:
        logger.warning("generate_portfolio_advice falling back: GEMINI_API_KEY is not configured")
        return "AI advisory is currently unavailable due to missing API keys or client setup."

    prompt = f"""
You are an elite financial advisor specializing in the Nepal Stock Exchange (NEPSE).
Your client has provided their current portfolio summary, including their 
Average Purchase Price (WACC), Current Market Price (LTP), and Profit/Loss.

Portfolio Data:
{portfolio_summary}

Please provide a concise, highly actionable analysis. Include:
1. A brief overview of their current performance.
2. Specific risks they are facing (e.g., sector concentration, heavy losses in specific stocks).
3. Actionable next steps (e.g., averaging down, taking profits, holding).

Keep your tone professional, encouraging, and direct. Format with clear headings and bullet points.
"""

    try:
        response = ai_client.models.generate_content(
            model="gemini-3.6-flash",
            contents=prompt,
        )
        return response.text.strip()
    except Exception as e:
        logger.error(f"Gemini API error during portfolio analysis: {e}")
        return "Sorry, I am experiencing high traffic right now and couldn't analyze your portfolio. Please try again later."


def generate_ml_forecast_explanation(symbol: str, prediction: str, indicators: dict) -> str:
    """
    Asks Gemini to explain the Random Forest model's prediction in plain English.
    """
    if not ai_client:
        return f"The Machine Learning model forecasts a movement {prediction}, but the AI explainer is offline."

    prompt = f"""
    You are a technical analyst for NEPSE. Our Random Forest ML model just analyzed 
    the stock '{symbol}' and predicted the next trend will be: {prediction}.
    
    Here are the latest key indicators from the ML model:
    - RSI (14): {indicators.get('RSI_14', 0):.2f}
    - MACD: {indicators.get('MACD', 0):.2f}
    - Current Price: Rs {indicators.get('Close', 0):.2f}
    
    Write a short (3-4 sentences), punchy explanation for a retail investor about WHY the 
    model likely predicted '{prediction}' based on these indicators. Validate the ML model's choice.
    """
    try:
        response = ai_client.models.generate_content(model="gemini-3.6-flash", contents=prompt)
        return response.text.strip()
    except Exception:
        return f"The ML model predicts the stock will go {prediction} based on current structural patterns."


def generate_low_confidence_forecast(symbol: str) -> str:
    """
    Fallback for when a stock is NOT in the 100-company CSV database.
    """
    if not ai_client:
        return "Symbol not found in ML database, and AI fallback is offline."

    prompt = f"""
    A user requested a trend forecast for the NEPSE stock '{symbol}'. 
    This stock is NOT in our top-100 historical database, so we cannot run it through our ML model.
    
    Write a brief, highly cautionary 3-sentence response. 
    1. Acknowledge the stock.
    2. Explicitly state: "Because this stock is not in our 100-company historical database, this is a low-confidence projection."
    3. Provide whatever general recent context you know about this company or sector.
    """
    try:
        response = ai_client.models.generate_content(model="gemini-3.6-flash", contents=prompt)
        return response.text.strip()
    except Exception:
        return "This symbol is missing from our ML dataset. Insufficient data to generate a forecast."