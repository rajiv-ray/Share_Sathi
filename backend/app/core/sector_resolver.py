# backend/app/core/sector_resolver.py
import logging
import time

import requests

logger = logging.getLogger(__name__)

SECTOR_SOURCE_URL = "https://raw.githubusercontent.com/Shubhamnpk/yonepse/main/data/other/sector_codes.json"


class NepseSectorResolver:
    """
    Resolves a NEPSE ticker to its sector.

    The data comes from a community-maintained JSON file, not an official
    NEPSE/SEBON feed - treat it as best-effort: it can go stale, go
    offline, or change shape without warning. hydrate_cache() is written
    to be defensive about all three. It never raises, because it also runs
    inside the app's startup lifespan, and an uncaught exception there
    would take the whole API down rather than just degrading sector data.
    """

    def __init__(self):
        self._cache = {}
        self.last_hydrated_at = None

        # Small hardcoded fallback for the very first boot, before any live
        # fetch has ever succeeded.
        self._fallback = {
            "NABIL": "Commercial Banks", "NICA": "Commercial Banks", "GBIME": "Commercial Banks",
            "UPPER": "Hydropower", "AHPC": "Hydropower", "NHPC": "Hydropower",
            "CBBL": "Microfinance", "NUBL": "Microfinance", "CIT": "Investment",
            "NTC": "Telecom", "SHIVM": "Manufacturing", "HDL": "Manufacturing",
            "ALICL": "Life Insurance", "NLIC": "Life Insurance",
            "NIFRA": "Investment", "CHDC": "Investment",
        }

    def hydrate_cache(self) -> bool:
        """
        Attempts to refresh the sector map from the live source.

        Returns True on a successful refresh, False if it fell back to
        keeping the existing cache. A failed or malformed fetch never wipes
        out a previously good cache - it just leaves it as-is and logs why.
        """
        try:
            response = requests.get(SECTOR_SOURCE_URL, timeout=10)
            response.raise_for_status()
            data = response.json()
        except Exception:
            logger.warning(
                "Sector source unavailable; keeping existing cache of %d symbols.",
                len(self._cache),
                exc_info=True,
            )
            return False

        if not isinstance(data, dict) or not data:
            logger.warning(
                "Sector source returned an unexpected shape (%s); keeping existing cache.",
                type(data).__name__,
            )
            return False

        new_cache = {
            symbol.upper().strip(): sector.strip()
            for symbol, sector in data.items()
            if isinstance(symbol, str) and isinstance(sector, str)
        }

        if not new_cache:
            logger.warning("Sector source returned no usable entries; keeping existing cache.")
            return False

        self._cache = new_cache
        self.last_hydrated_at = time.time()
        logger.info("NEPSE sector master list hydrated: %d symbols.", len(self._cache))
        return True

    def get_sector(self, symbol: str) -> str:
        """
        Returns the sector for any given symbol.
        Checks the live cache first, then the fallback, then returns 'Unclassified/Other'.
        """
        clean_symbol = symbol.upper().strip()

        if clean_symbol in self._cache:
            return self._cache[clean_symbol]

        if clean_symbol in self._fallback:
            return self._fallback[clean_symbol]

        return "Unclassified/Other"


# Create a single global instance to be used across the app
sector_resolver = NepseSectorResolver()