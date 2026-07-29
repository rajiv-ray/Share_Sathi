# backend/app/schemas/meroshare_schema.py
from pydantic import BaseModel

class MeroShareCredentials(BaseModel):
    dp_id: str
    username: str
    password: str

class MeroShareSyncResponse(BaseModel):
    message: str
    total_scripts_synced: int