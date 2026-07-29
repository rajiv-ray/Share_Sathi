import httpx
import logging
import time
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

_PRICE_CACHE = {}
_LAST_FETCH_TIME = 0
CACHE_TTL = 300  # Cache prices for 5 minutes

async def get_live_prices():
    """
    Fetches live stock prices by securely scraping Merolagani.
    Returns a dictionary mapping stock symbols to their LTP.
    """
    global _PRICE_CACHE, _LAST_FETCH_TIME
    
    # Return cached prices if within TTL to keep the dashboard lightning fast
    if time.time() - _LAST_FETCH_TIME < CACHE_TTL and _PRICE_CACHE:
        return _PRICE_CACHE

    url = "https://merolagani.com/LatestMarket.aspx"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            # Merolagani houses its live prices in a table with the 'table-hover' class
            table = soup.find('table', class_='table-hover')
            
            prices = {}
            if table:
                tbody = table.find('tbody')
                if tbody:
                    for row in tbody.find_all('tr'):
                        cols = row.find_all('td')
                        if len(cols) >= 2:
                            symbol = cols[0].text.strip()
                            # Remove commas from thousands (e.g., 1,200.50 -> 1200.50)
                            ltp_text = cols[1].text.strip().replace(',', '')
                            try:
                                prices[symbol.upper()] = float(ltp_text)
                            except ValueError:
                                continue
            
            if prices:
                _PRICE_CACHE = prices
                _LAST_FETCH_TIME = time.time()
                logger.info(f"Successfully fetched {len(prices)} live prices from Merolagani.")
                
            return _PRICE_CACHE
            
    except Exception as e:
        logger.error(f"Live NEPSE price fetch failed: {e}")
        return _PRICE_CACHE