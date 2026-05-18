"""Email templates resolver + Jinja2 sandboxed renderer.

Lecture seule sur Atlas (find_one + sort).

Pattern d'utilisation depuis un router :

    from core.email_templates import render_with_fallback

    rendered = await render_with_fallback(
        db,
        template_key="renewal_reminder",
        club_id=resolved_club_id,
        context={"first_name": "Alex", "unsubscribe_url": "...", ...},
        fallback_fn=lambda ctx: _renewal_reminder_fallback_v3(ctx),
    )
    # rendered.subject / rendered.html / rendered.text
    # rendered.used_fallback indique si le fallback a été utilisé
"""
from __future__ import annotations

import json
import logging
from typing import Any, Awaitable, Callable, Optional

from jinja2 import StrictUndefined
from jinja2.exceptions import TemplateError, UndefinedError
from jinja2.sandbox import SandboxedEnvironment

from models.email_templates import RenderedEmail

logger = logging.getLogger(__name__)

# Sandbox env : autoescape activé pour HTML, undefined strict → render échoue
# si une variable manque dans le context (au lieu de "" silencieux).
_jinja_env = SandboxedEnvironment(
    autoescape=True,
    undefined=StrictUndefined,
    trim_blocks=False,
    lstrip_blocks=False,
)


async def get_template(
    db,
    template_key: str,
    club_id: Optional[str] = None,
) -> Optional[dict]:
    """Cascade resolver : club_id spécifique > global, version DESC, is_active=true.

    Args:
        db: Motor AsyncIOMotorDatabase.
        template_key: ex "renewal_reminder".
        club_id: UUID du club (None = chercher uniquement le global).

    Returns:
        Dict du template (sans `_id`) ou None si rien trouvé.
    """
    # 1) Match spécifique club_id
    if club_id:
        specific = await db.email_templates.find_one(
            {"template_key": template_key, "club_id": club_id, "is_active": True},
            {"_id": 0},
            sort=[("version", -1)],
        )
        if specific:
            return specific
    # 2) Fallback global (club_id = None)
    global_tpl = await db.email_templates.find_one(
        {"template_key": template_key, "club_id": None, "is_active": True},
        {"_id": 0},
        sort=[("version", -1)],
    )
    return global_tpl


def render_template(template: dict, context: dict) -> dict:
    """Rend subject + html + text via Jinja2 sandboxé.

    Args:
        template: doc EmailTemplate (avec subject/html_body/text_body).
        context: variables disponibles côté template.

    Returns:
        {"subject": str, "html": str, "text": str}

    Raises:
        UndefinedError: variable manquante dans le context.
        TemplateError: erreur de syntaxe Jinja2.
    """
    subject_tpl = _jinja_env.from_string(template.get("subject", ""))
    html_tpl = _jinja_env.from_string(template.get("html_body", ""))
    text_tpl = _jinja_env.from_string(template.get("text_body", "") or "")
    return {
        "subject": subject_tpl.render(**context),
        "html": html_tpl.render(**context),
        "text": text_tpl.render(**context),
    }


async def render_with_fallback(
    db,
    template_key: str,
    club_id: Optional[str],
    context: dict,
    fallback_fn: Callable[[dict], dict],
) -> RenderedEmail:
    """Tente render DB, sinon fallback (V3 hardcodé). Toujours log structuré JSON sur fallback.

    `fallback_fn(context)` doit retourner {"subject": str, "html": str, "text": str}.
    """
    tpl = await get_template(db, template_key, club_id)
    if tpl is None:
        reason = "template_not_found_in_db"
        logger.warning(json.dumps({
            "event": "email_template_fallback_used",
            "template_key": template_key,
            "club_id": club_id,
            "reason": reason,
        }))
        rendered = fallback_fn(context)
        return RenderedEmail(
            subject=rendered["subject"],
            html=rendered["html"],
            text=rendered.get("text", ""),
            template_id=None,
            used_fallback=True,
            fallback_reason=reason,
        )

    try:
        rendered = render_template(tpl, context)
        return RenderedEmail(
            subject=rendered["subject"],
            html=rendered["html"],
            text=rendered["text"],
            template_id=tpl.get("id"),
            used_fallback=False,
        )
    except (UndefinedError, TemplateError) as e:
        reason = f"render_error: {type(e).__name__}: {str(e)[:200]}"
        logger.warning(json.dumps({
            "event": "email_template_fallback_used",
            "template_key": template_key,
            "club_id": club_id,
            "template_id": tpl.get("id"),
            "version": tpl.get("version"),
            "reason": reason,
        }))
        rendered = fallback_fn(context)
        return RenderedEmail(
            subject=rendered["subject"],
            html=rendered["html"],
            text=rendered.get("text", ""),
            template_id=tpl.get("id"),
            used_fallback=True,
            fallback_reason=reason,
        )


async def ensure_indexes(db) -> None:
    """Index composite pour cascade resolver. Idempotent (createIndex safe).

    À appeler une fois au startup (server.py) OU lors du seed.
    """
    await db.email_templates.create_index(
        [("template_key", 1), ("club_id", 1), ("is_active", 1), ("version", -1)],
        name="email_templates_resolver_idx",
    )
