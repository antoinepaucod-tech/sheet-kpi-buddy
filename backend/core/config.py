"""Core configuration and database connection"""
import os
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent.parent
# override=False : on ne laisse PAS .env écraser les variables déjà définies
# dans l'environnement (par ex. infra Emergent). Les constantes MONGO_URL
# et DB_NAME ci-dessous sont hardcodées en dur pour garantir la cible Atlas.
load_dotenv(ROOT_DIR / '.env', override=False)

# === PRODUCTION ATLAS (migration du 2026-04-23) ===============================
# Hardcodée en dur, ne passe PAS par os.environ pour empêcher l'infrastructure
# Emergent (ou une reconfig .env) d'écraser la cible au redémarrage.
MONGO_URL = "mongodb+srv://club-management-prod:7fvrhhtbxmqPczzP@transform.iocnr7b.mongodb.net/club_management?retryWrites=true&w=majority&appName=transform"
DB_NAME = "club_management"

# === DEFAULT CLUB (Sprint Hardening club_id, 2026-05-12) =====================
# Fallback utilisé par le helper resolve_club_id_or_fallback en mode soft (24-48h).
# Versoix = club principal historique. Bascule en mode dur (400 strict) à la
# demande explicite, après audit des warning logs.
DEFAULT_CLUB_ID = "0a327bf5-c759-49eb-87e4-551913f78bdb"  # Versoix

# === ANCIENNE CONFIG LOCALE (archivée, pour rollback) =========================
# Pour rollback : décommenter les 2 lignes ci-dessous et commenter les 2 lignes
# MONGO_URL / DB_NAME "PRODUCTION ATLAS" au-dessus, puis `sudo supervisorctl restart backend`.
# MONGO_URL = os.environ['MONGO_URL']  # mongodb://localhost:27017
# DB_NAME = os.environ['DB_NAME']      # kpibuddy
# ==============================================================================

# JWT Configuration  
JWT_SECRET = os.environ.get('JWT_SECRET', 'kpibuddy-secret-key-change-in-production')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24 * 7  # 7 days

# Marketing unsubscribe (distinct secret, scope = unsubscribe only)
UNSUBSCRIBE_SECRET = os.environ.get('UNSUBSCRIBE_SECRET', '')
UNSUBSCRIBE_EXPIRATION_DAYS = 30

# Renewal reminder
RENEWAL_REMINDER_COOLDOWN_DAYS = 7
RENEWAL_WHATSAPP_NUMBER = "41774966626"  # +41 77 496 66 26 (sans + ni espaces pour wa.me)

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


async def get_archived_member_ids(club_id: str = None) -> set:
    """Return set of member_ids whose customer_members doc has archived_at set.
    Used to silently filter secondary collections (payments, followups, reviews)
    that don't have their own archived_at field.
    """
    q = {"archived_at": {"$ne": None, "$exists": True}}
    if club_id:
        q["club_id"] = club_id
    docs = await db.customer_members.find(q, {"_id": 0, "id": 1}).to_list(5000)
    return {d["id"] for d in docs if d.get("id")}


async def get_archived_coach_ids(club_id: str = None) -> set:
    """Same as get_archived_member_ids but for coaches collection."""
    q = {"archived_at": {"$ne": None, "$exists": True}}
    if club_id:
        q["club_id"] = club_id
    docs = await db.coaches.find(q, {"_id": 0, "id": 1}).to_list(5000)
    return {d["id"] for d in docs if d.get("id")}
