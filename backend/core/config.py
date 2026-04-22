"""Core configuration and database connection"""
import os
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB Configuration
MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']

# JWT Configuration  
JWT_SECRET = os.environ.get('JWT_SECRET', 'kpibuddy-secret-key-change-in-production')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24 * 7  # 7 days

# CORS
CORS_ORIGINS = os.environ.get('CORS_ORIGINS', '*').split(',')

# Database client
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# French month names
MONTHS_FR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
             "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]

DAYS_FR = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]


# ── Archived filter helpers ──────────────────────────────────────────────────
ARCHIVED_FILTER = {"$or": [{"archived_at": None}, {"archived_at": {"$exists": False}}]}

def exclude_archived(query: dict) -> dict:
    """Add archived_at exclusion to a query dict (Type B filter). Safe with existing $or."""
    if "$or" in query or "$and" in query:
        existing_and = query.pop("$and", [])
        return {**query, "$and": existing_and + [ARCHIVED_FILTER]}
    return {**query, **ARCHIVED_FILTER}


async def check_member_not_archived(member_id: str) -> None:
    """Raise 400 if member is archived (Type C guard)."""
    from fastapi import HTTPException
    doc = await db.customer_members.find_one({"id": member_id}, {"_id": 0, "archived_at": 1, "name": 1})
    if doc and doc.get("archived_at"):
        raise HTTPException(status_code=400, detail=f"Action impossible : le membre '{doc.get('name', '')}' est archivé. Restaurez-le d'abord.")


async def get_member_archived_warning(member_id: str) -> list:
    """Return ['member_archived'] if member is archived, else [] (Ajustement 1 warning)."""
    doc = await db.customer_members.find_one({"id": member_id}, {"_id": 0, "archived_at": 1})
    if doc and doc.get("archived_at"):
        return ["member_archived"]
    return []
