"""Public marketing routes — no auth required.

Currently:
  - GET /api/marketing/unsubscribe?token=...   (RGPD unsubscribe, JWT signé)
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

import jwt
from fastapi import APIRouter, Query
from fastapi.responses import HTMLResponse

from core.config import db
from core.notifications import decode_unsubscribe_token

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/marketing", tags=["marketing"])


def _html_page(*, title: str, body_html: str, success: bool) -> HTMLResponse:
    accent = "#F97316" if success else "#FF453A"
    status_code = 200 if success else 400
    html = f"""<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title} · TRANSFORM</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#09090B;min-height:100vh;font-family:'DM Sans',system-ui,sans-serif;color:#fff;display:flex;align-items:center;justify-content:center;">
  <div style="max-width:520px;margin:24px;padding:36px;background:#18181B;border:1px solid rgba(255,255,255,0.08);border-radius:16px;text-align:center;">
    <div style="font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:{accent};margin-bottom:10px;">
      TRANSFORM · RGPD
    </div>
    <h1 style="margin:0 0 18px;font-family:'Bebas Neue',Impact,sans-serif;font-size:42px;line-height:1;letter-spacing:0.02em;color:#fff;">
      {title}
    </h1>
    <div style="font-size:15px;line-height:1.65;color:rgba(235,235,245,0.65);">
      {body_html}
    </div>
    <div style="margin-top:28px;font-size:11px;color:rgba(235,235,245,0.35);">
      TRANSFORM · Genève · contact@thecoachswitzerland.ch
    </div>
  </div>
</body>
</html>"""
    return HTMLResponse(content=html, status_code=status_code)


@router.get("/unsubscribe")
async def unsubscribe(token: str = Query(..., min_length=10)):
    """Désinscription publique RGPD. Set `marketing_opt_out=true` sur le membre.

    Token JWT signé avec UNSUBSCRIBE_SECRET (scope=unsubscribe, exp 30j).
    """
    try:
        payload = decode_unsubscribe_token(token)
    except jwt.ExpiredSignatureError:
        logger.warning("MARKETING_UNSUBSCRIBE_EXPIRED_TOKEN")
        return _html_page(
            title="Lien expiré",
            body_html=(
                "Ce lien de désinscription a expiré (validité 30 jours). "
                "Contacte-nous à <a href='mailto:contact@thecoachswitzerland.ch' "
                "style='color:#F97316;'>contact@thecoachswitzerland.ch</a> "
                "pour qu'on traite ta demande manuellement."
            ),
            success=False,
        )
    except (jwt.InvalidTokenError, RuntimeError) as e:
        logger.warning(f"MARKETING_UNSUBSCRIBE_INVALID_TOKEN reason={e}")
        return _html_page(
            title="Lien invalide",
            body_html="Ce lien de désinscription est invalide ou corrompu.",
            success=False,
        )

    member_id = payload.get("member_id")
    member = await db.customer_members.find_one({"id": member_id}, {"_id": 0, "id": 1, "name": 1, "marketing_opt_out": 1})
    if not member:
        logger.warning(f"MARKETING_UNSUBSCRIBE_MEMBER_NOT_FOUND member_id={member_id}")
        return _html_page(
            title="Membre introuvable",
            body_html="Nous n'avons pas pu trouver ton profil. Merci de nous écrire directement.",
            success=False,
        )

    if member.get("marketing_opt_out"):
        return _html_page(
            title="Déjà désinscrit",
            body_html=(
                f"Ta désinscription était déjà enregistrée. "
                f"Tu ne recevras plus de relances de notre part. À bientôt 👋"
            ),
            success=True,
        )

    now_iso = datetime.now(timezone.utc).isoformat()
    await db.customer_members.update_one(
        {"id": member_id},
        {"$set": {"marketing_opt_out": True, "marketing_opt_out_at": now_iso, "updated_at": now_iso}},
    )
    logger.info(f"MARKETING_UNSUBSCRIBED member_id={member_id} name={member.get('name')}")
    return _html_page(
        title="Désinscription confirmée",
        body_html=(
            "C'est noté — tu ne recevras plus nos relances de renouvellement. "
            "Si jamais tu changes d'avis, tu peux toujours nous contacter directement. "
            "Bonne continuation 💪"
        ),
        success=True,
    )
