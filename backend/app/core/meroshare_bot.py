import httpx
import logging

logger = logging.getLogger(__name__)

class MeroShareBot:
    def __init__(self):
        self.base_url = "https://backend.cdsc.com.np/api"
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            "Accept": "application/json, text/plain, */*",
            "Content-Type": "application/json",
            "Origin": "https://meroshare.cdsc.com.np",
            "Referer": "https://meroshare.cdsc.com.np/"
        }

    async def get_capitals(self):
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{self.base_url}/meroShare/capital/", headers=self.headers)
            response.raise_for_status()
            return response.json()

    async def login(self, dp_id: str, username: str, password: str):
        payload = {
            "clientId": dp_id,
            "username": username,
            "password": password
        }
        async with httpx.AsyncClient() as client:
            response = await client.post(f"{self.base_url}/meroShare/auth/", json=payload, headers=self.headers)
            
            if response.status_code != 200:
                logger.error(f"MeroShare Login Failed: {response.text}")
                raise ValueError("Invalid MeroShare credentials or DP ID.")
            
            token = response.headers.get("Authorization")
            if not token:
                raise ValueError("Authorization token not found in response.")
            return token

    async def get_own_details(self, token: str):
        headers = self.headers.copy()
        headers["Authorization"] = token
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{self.base_url}/meroShare/ownDetail/", headers=headers)
            response.raise_for_status()
            return response.json()

    async def get_portfolio_holdings(self, token: str, demat: str, client_code: str):
        headers = self.headers.copy()
        headers["Authorization"] = token
        
        payload = {
            "sortBy": "script",
            "demat": [demat],
            "clientCode": client_code,  # Fixed: using the correct client code
            "page": 1,
            "size": 500,
            "sortAsc": True
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(f"{self.base_url}/meroShareView/myPortfolio/", json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
            return data.get("meroShareMyPortfolio", [])

    async def sync_account(self, dp_id: str, username: str, password: str):
        try:
            token = await self.login(dp_id, username, password)
            user_details = await self.get_own_details(token)
            
            demat = user_details.get("demat")
            client_code = user_details.get("clientCode") # Fixed: extracting client code
            
            if not demat or not client_code:
                raise ValueError("Could not locate Demat or Client Code linked to this user.")
                
            holdings = await self.get_portfolio_holdings(token, demat, client_code)
            return holdings
        except Exception as e:
            logger.error(f"MeroShare Sync Error: {str(e)}")
            raise e