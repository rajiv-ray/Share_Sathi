# backend/app/core/ai_engine.py
import json
import logging
import os

from dotenv import load_dotenv
# Use the new SDK imports
from google import genai
from google.genai import types

load_dotenv()

logger = logging.getLogger(__name__)

VALID_SENTIMENTS = {"POSITIVE", "NEUTRAL", "NEGATIVE"}

# Configure the SDK using your secret API Key stored safely in the .env file
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Initialize the new Client
ai_client = None
if GEMINI_API_KEY:
    # We initialize the client once at boot. 
    ai_client = genai.Client(api_key=GEMINI_API_KEY)


def _fallback_response(reason: str) -> dict:
    # Details go to the server log, not the client - the previous
    # "unconfigured" fallback put the exact missing env var name in the
    # response body, which is more than an end user needs to see.
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

    # Define a strict system instruction to turn Gemini into a financial data tool
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
        # Combine instructions and content
        full_content = f"{system_prompt}\n\nNews Content to analyze:\n{news_content}"

        # In the new SDK, generation config rules (like JSON enforcement) go into a types object
        config = types.GenerateContentConfig(
            response_mime_type="application/json",
        )

        # Generate the content using the new client structure
        response = ai_client.models.generate_content(
            model="gemini-3.6-flash",
            contents=full_content,
            config=config,
        )

        # Parse text into a structured Python dictionary
        parsed_data = json.loads(response.text.strip())

        if not isinstance(parsed_data, dict):
            raise ValueError(f"Expected a JSON object, got {type(parsed_data).__name__}")

        # Guardrails: normalize the model's output to exactly what
        # NewsAnalysisResponse (and its SentimentEnum) expects, rather than
        # trusting the LLM to follow the prompt precisely every time. If
        # sentiment/summary come back malformed, FastAPI's response
        # validation rejects the response with an unhandled 500 - and by
        # then this function has already returned, so the caller's
        # try/except in analytics.py can't catch it. Better to never let a
        # bad shape leave this function in the first place.
        sentiment = str(parsed_data.get("sentiment", "")).upper().strip()
        if sentiment not in VALID_SENTIMENTS:
            logger.warning("Gemini returned an unrecognized sentiment: %r", parsed_data.get("sentiment"))
            sentiment = "NEUTRAL"

        summary = parsed_data.get("summary")
        if not isinstance(summary, list):
            summary = []
        summary = [str(item) for item in summary if isinstance(item, (str, int, float))]

        # Force exactly 3 array items if the model shortchanged or over-indexed the list
        while len(summary) < 3:
            summary.append("No additional summary data provided by analyzer.")
        summary = summary[:3]

        return {"sentiment": sentiment, "summary": summary}

    except Exception as e:
        # Graceful fallback so a broken network request or bad parsing step doesn't blow up your backend
        return _fallback_response(str(e))