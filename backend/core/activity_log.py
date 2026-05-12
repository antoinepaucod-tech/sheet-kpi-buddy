"""Helper centralisé pour insérer dans la collection activity_logs.

Sprint Hardening club_id (2026-05-12) — hot-fix activity_logs.

Cascade de résolution du `club_id` :
  1. `explicit_club_id` si fourni (priorité absolue, override tout)
  2. `member.club_id` si `member_id` fourni et le membre existe
  3. `current_user.active_club_id` si user authentifié dispo
  4. fallback `DEFAULT_CLUB_ID` (Versoix) via `resolve_club_id_or_fallback` + warning log

Audit trail léger : si `current_user` est fourni, les champs
`created_by_user_id` et `created_by_email` sont injectés automatiquement.
"""

from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from core.club_id_guard import resolve_club_id_or_fallback


async def log_activity(
    db,
    action: str,
    description: str,
    member_id: Optional[str] = None,
    current_user: Optional[dict] = None,
    explicit_club_id: Optional[str] = None,
    user_name: Optional[str] = None,
) -> dict:
    """Insère un doc dans `activity_logs` avec garanties :
    - `club_id` toujours non vide (cascade + fallback)
    - `created_by_*` si user authentifié

    Args:
        db: instance Motor (AsyncIOMotorDatabase).
        action: code action court (ex: `"member_archived"`).
        description: texte lisible UI (ex: `"Membre archivé — Raison : test"`).
        member_id: id du membre concerné (peut être None pour actions non-membre).
        current_user: dict user authentifié (peut être None pour appels système).
        explicit_club_id: club_id forcé (priorité absolue, override la cascade).
        user_name: nom affiché. Par défaut: email user → fallback `"Système"`.

    Returns:
        Le doc inséré (sans `_id` Mongo, prêt à serializer en JSON).
    """
    # 1. Cascade club_id
    club_id: Optional[str] = explicit_club_id

    if not club_id and member_id is not None:
        member = await db.customer_members.find_one(
            {"id": member_id}, {"_id": 0, "club_id": 1}
        )
        if member:
            club_id = member.get("club_id")

    if not club_id and current_user:
        club_id = current_user.get("active_club_id")

    if not club_id:
        club_id = resolve_club_id_or_fallback(
            club_id=None,
            current_user=current_user,
            endpoint=f"log_activity:{action}",
        )

    # 2. user_name par défaut
    if not user_name:
        if current_user and current_user.get("email"):
            user_name = current_user["email"].split("@")[0]
        else:
            user_name = "Système"

    # 3. Construction du doc
    doc = {
        "id": str(uuid4()),
        "member_id": member_id,
        "action": action,
        "description": description,
        "club_id": club_id,
        "user_name": user_name,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    # 4. Audit trail léger
    if current_user:
        doc["created_by_user_id"] = current_user.get("id")
        doc["created_by_email"] = current_user.get("email")

    await db.activity_logs.insert_one(doc)
    doc.pop("_id", None)
    return doc
