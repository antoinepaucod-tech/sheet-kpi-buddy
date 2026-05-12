"""Helper de défense en profondeur pour la propagation du club_id.

Sprint Hardening club_id (2026-05-12) — mode soft 24-48h.

Utilisation:
    from core.club_id_guard import resolve_club_id_or_fallback

    club_id = resolve_club_id_or_fallback(
        club_id=club_id_from_header,
        current_user=current_user,
        endpoint="/api/ghl/confirm-sale",
    )
    doc["club_id"] = club_id  # injecté après model_dump()

Bascule en mode dur (400 strict) à la demande, voir DEFAULT_CLUB_ID dans config.
"""

import json
import logging
from datetime import datetime, timezone
from typing import Optional

from core.config import DEFAULT_CLUB_ID

logger = logging.getLogger(__name__)


def resolve_club_id_or_fallback(
    club_id: Optional[str],
    current_user: Optional[dict],
    endpoint: str,
) -> str:
    """Retourne le club_id reçu, ou tombe sur DEFAULT_CLUB_ID + warning log structuré.

    Args:
        club_id: valeur de l'en-tête X-Club-Id (peut être None ou vide).
        current_user: dict du user authentifié (peut être None pour endpoints publics).
        endpoint: chemin de l'endpoint appelant (pour traçabilité dans les logs).

    Returns:
        Un club_id non vide (soit celui reçu, soit DEFAULT_CLUB_ID).
    """
    if club_id:
        return club_id

    log_payload = {
        "event": "MISSING_CLUB_ID",
        "endpoint": endpoint,
        "user_id": (current_user or {}).get("id"),
        "user_email": (current_user or {}).get("email"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "fallback_used": DEFAULT_CLUB_ID,
    }
    # Message lisible + JSON in-line pour grep/jq facile
    logger.warning(
        "MISSING_CLUB_ID endpoint=%s user=%s fallback=%s | %s",
        endpoint,
        log_payload["user_email"] or "anonymous",
        DEFAULT_CLUB_ID,
        json.dumps(log_payload, separators=(",", ":")),
        extra=log_payload,
    )
    return DEFAULT_CLUB_ID
