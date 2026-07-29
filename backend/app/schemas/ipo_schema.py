from pydantic import BaseModel
from typing import List

class IPOCompany(BaseModel):
    id: int
    name: str
    scrip: str

class IPOCheckRequest(BaseModel):
    company_id: int
    boids: List[str]

class IPOCheckResult(BaseModel):
    boid: str
    success: bool
    message: str