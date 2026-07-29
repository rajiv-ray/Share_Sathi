# backend/app/core/sector_resolver.py
import json
import logging
import os
import time
import requests

logger = logging.getLogger(__name__)

SECTOR_SOURCE_URL = "https://raw.githubusercontent.com/Shubhamnpk/yonepse/main/data/other/sector_codes.json"
CACHE_FILE_PATH = os.path.join(os.path.dirname(__file__), "resolved_sectors.json")

# Import the NEW Google GenAI SDK
try:
    from google import genai
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    if GEMINI_API_KEY:
        gemini_client = genai.Client(api_key=GEMINI_API_KEY)
    else:
        gemini_client = None
        logger.warning("GEMINI_API_KEY not found. AI classification disabled.")
except ImportError:
    gemini_client = None
    logger.warning("google-genai SDK not installed. AI classification disabled.")


class NepseSectorResolver:
    """
    Resolves a NEPSE ticker to its sector.
    
    1. Checks local persistent disk cache (resolved_sectors.json).
    2. Checks live master JSON list from GitHub.
    3. Checks hardcoded fallbacks and ticker rule heuristics.
    4. Batches unknown symbols into a SINGLE Gemini API request to avoid 429 rate limits.
    """

    def __init__(self):
        self._cache = {}
        self.last_hydrated_at = None

        self._fallback = {
            "NABIL": "Commercial Banks", "NICA": "Commercial Banks", "GBIME": "Commercial Banks",
            "UPPER": "Hydropower", "AHPC": "Hydropower", "NHPC": "Hydropower",
            "CBBL": "Microfinance", "NUBL": "Microfinance", "CIT": "Investment",
            "NTC": "Telecom", "SHIVM": "Manufacturing", "HDL": "Manufacturing",
            "ALICL": "Life Insurance", "NLIC": "Life Insurance",
            "NIFRA": "Investment", "CHDC": "Investment",
        }
        
        self.valid_sectors = [
            "Commercial Banks", "Development Banks", "Finance", "Hydropower",
            "Microfinance", "Life Insurance", "Non-Life Insurance", "Investment",
            "Manufacturing", "Telecom", "Others", "Unclassified/Other"
        ]

        # Step 1: Load persistent cache from disk on startup
        self._load_disk_cache()

    def _load_disk_cache(self):
        """Loads previously resolved sectors from disk so we don't re-query Gemini on restart."""
        if os.path.exists(CACHE_FILE_PATH):
            try:
                with open(CACHE_FILE_PATH, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, dict):
                        self._cache.update(data)
                        logger.info("Loaded %d resolved sectors from local disk cache.", len(data))
            except Exception as e:
                logger.warning("Could not load disk cache: %s", e)

    def _save_disk_cache(self):
        """Saves current cache to disk."""
        try:
            with open(CACHE_FILE_PATH, "w", encoding="utf-8") as f:
                json.dump(self._cache, f, indent=2)
        except Exception as e:
            logger.warning("Failed to save sector cache to disk: %s", e)

    def hydrate_cache(self) -> bool:
        """Attempts to refresh the sector map from the live source."""
        try:
            response = requests.get(SECTOR_SOURCE_URL, timeout=10)
            response.raise_for_status()
            data = response.json()
        except Exception:
            logger.warning(
                "Sector source unavailable; keeping existing cache of %d symbols.",
                len(self._cache),
            )
            return False

        if isinstance(data, dict) and data:
            new_cache = {
                symbol.upper().strip(): sector.strip()
                for symbol, sector in data.items()
                if isinstance(symbol, str) and isinstance(sector, str)
            }
            self._cache.update(new_cache)
            self._save_disk_cache()
            self.last_hydrated_at = time.time()
            logger.info("NEPSE sector master list hydrated: %d symbols.", len(self._cache))
            return True
        return False

    def _heuristic_classify(self, symbol: str) -> str | None:
        """Rule-based heuristic classifier for Nepalese ticker patterns to avoid unnecessary API calls."""
        sym = symbol.upper()
        if any(sym.endswith(x) or x in sym for x in ["HYDRO", "HEL", "HP", "HEP", "POWER"]):
            return "Hydropower"
        if any(sym.endswith(x) or x in sym for x in ["MICRO", "MF", "MFIL", "LAGHU", "BSL"]):
            return "Microfinance"
        if any(sym.endswith(x) or x in sym for x in ["INS", "LIC", "INSU"]):
            return "Life Insurance"
        if "BANK" in sym or sym.endswith("BL"):
            return "Development Banks"
        if "FIN" in sym:
            return "Finance"
        return None

    def _batch_classify_with_gemini(self, symbols: list[str]) -> dict[str, str]:
        """
        Classifies multiple unknown symbols in a SINGLE Gemini prompt to save quota.
        """
        if not gemini_client or not symbols:
            return {sym: "Unclassified/Other" for sym in symbols}

        symbols_str = ", ".join(symbols)
        prompt = (
            f"You are a financial expert on the Nepal Stock Exchange (NEPSE). "
            f"Classify each of the following stock symbols: [{symbols_str}] into EXACTLY ONE "
            f"of these valid sectors: {', '.join(self.valid_sectors)}. "
            f"Respond ONLY with a valid JSON object mapping each symbol to its sector. "
            f"Example format: {{\"DHEL\": \"Hydropower\", \"KAHL\": \"Hydropower\"}}"
        )

        try:
            response = gemini_client.models.generate_content(
                model='gemini-3.6-flash',
                contents=prompt
            )
            text = response.text.strip()
            # Clean markdown formatting if present
            if text.startswith("```json"):
                text = text.replace("```json", "").replace("```", "").strip()
            
            parsed = json.loads(text)
            results = {}
            for sym in symbols:
                sector = parsed.get(sym, "Unclassified/Other")
                if sector not in self.valid_sectors:
                    sector = "Unclassified/Other"
                results[sym] = sector
                logger.info("Gemini batch classified %s -> %s", sym, sector)
            return results
        except Exception as e:
            logger.error("Gemini API error during batch classification: %s", e)
            return {sym: self._heuristic_classify(sym) or "Unclassified/Other" for sym in symbols}

    def get_sector(self, symbol: str) -> str:
        """Returns the sector for a single symbol using cache, heuristics, or Gemini."""
        clean_symbol = symbol.upper().strip()

        if clean_symbol in self._cache:
            return self._cache[clean_symbol]

        if clean_symbol in self._fallback:
            return self._fallback[clean_symbol]

        # Try heuristic local rule matching
        heuristic = self._heuristic_classify(clean_symbol)
        if heuristic:
            self._cache[clean_symbol] = heuristic
            self._save_disk_cache()
            return heuristic

        # Query Gemini for the single unknown symbol
        batch_res = self._batch_classify_with_gemini([clean_symbol])
        sector = batch_res.get(clean_symbol, "Unclassified/Other")
        
        self._cache[clean_symbol] = sector
        self._save_disk_cache()
        return sector


sector_resolver = NepseSectorResolver()

def get_sector_for_symbol(symbol: str) -> str:
    return sector_resolver.get_sector(symbol)