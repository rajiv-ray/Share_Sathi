import httpx
import logging

logger = logging.getLogger(__name__)

CDSC_BASE_URL = "https://iporesult.cdsc.com.np/result"

# Standard browser headers to bypass CDSC's basic bot protection
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Origin": "https://iporesult.cdsc.com.np",
    "Referer": "https://iporesult.cdsc.com.np/",
}

async def get_active_ipos() -> list:
    """Fetches the list of companies whose IPO results are currently active."""
    url = f"{CDSC_BASE_URL}/companyShares/fileUploaded"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(url, headers=HEADERS)
            
            # If CDSC is down or returns HTML, this catches it safely
            response.raise_for_status()
            data = response.json()
            
            return data.get("body", [])
    except Exception as e:
        logger.error(f"Failed to fetch active IPOs from CDSC: {e}")
        return []

async def check_ipo_result(company_id: int, boid: str) -> dict:
    """Checks the IPO result for a specific BOID and Company ID."""
    url = f"{CDSC_BASE_URL}/result/check"
    payload = {"companyShareId": company_id, "boid": boid}
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(url, json=payload, headers=HEADERS)
            response.raise_for_status()
            data = response.json()
            
            return {
                "boid": boid,
                "success": data.get("success", False),
                "message": data.get("message", "Sorry, not allotted for the entered BOID.")
            }
    except Exception as e:
        logger.error(f"Failed to check IPO for BOID {boid}: {e}")
        return {
            "boid": boid,
            "success": False,
            "message": "Error connecting to CDSC server."
        }