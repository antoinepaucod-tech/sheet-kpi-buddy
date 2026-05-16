"""Public-facing branding helpers for clubs.

`get_club_public_name(db, club_id)` — cascade pour les communications
member-facing (emails, factures, page unsubscribe) :
  1) clubs.public_name (champ optionnel, set par script migration)
  2) clubs.name (legacy, ex: "Transform Versoix")
  3) "HYBRID GYM" (fallback ultime, brand member-facing par défaut)

Aucune écriture. Aucune migration ici — juste de la lecture sécurisée.
"""
from __future__ import annotations

from typing import Optional

DEFAULT_PUBLIC_NAME = "HYBRID GYM"


async def get_club_public_name(db, club_id: Optional[str]) -> str:
    """Retourne le nom member-facing pour un club_id donné.

    Args:
        db: Motor AsyncIOMotorDatabase.
        club_id: id du club. Si None ou vide, retourne le fallback.

    Returns:
        String non vide (public_name → name → DEFAULT_PUBLIC_NAME).
    """
    if not club_id:
        return DEFAULT_PUBLIC_NAME
    doc = await db.clubs.find_one(
        {"id": club_id}, {"_id": 0, "public_name": 1, "name": 1}
    )
    if not doc:
        return DEFAULT_PUBLIC_NAME
    public = (doc.get("public_name") or "").strip()
    if public:
        return public
    legacy = (doc.get("name") or "").strip()
    if legacy:
        return legacy
    return DEFAULT_PUBLIC_NAME
