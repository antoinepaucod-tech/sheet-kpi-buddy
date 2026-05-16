"""Core helpers for renewal reminder emails (Resend) + unsubscribe JWT.

Séparé de `routers/notifications.py` pour rester testable sans
contexte FastAPI (le router se contente de l'importer).
"""
from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Optional
from urllib.parse import quote

import jwt
import resend

from core.config import (
    JWT_ALGORITHM,
    RENEWAL_WHATSAPP_NUMBER,
    UNSUBSCRIBE_EXPIRATION_DAYS,
    UNSUBSCRIBE_SECRET,
)

logger = logging.getLogger(__name__)

SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
BACKEND_PUBLIC_URL = os.environ.get(
    "BACKEND_PUBLIC_URL", "https://member-archive-mgmt.preview.emergentagent.com"
)


# ── Unsubscribe JWT helpers ──────────────────────────────────────────────────

def build_unsubscribe_token(member_id: str) -> str:
    """JWT signé avec UNSUBSCRIBE_SECRET (distinct du JWT principal).

    Scope = "unsubscribe", expire après UNSUBSCRIBE_EXPIRATION_DAYS.
    """
    if not UNSUBSCRIBE_SECRET:
        raise RuntimeError("UNSUBSCRIBE_SECRET not configured")
    now = datetime.now(timezone.utc)
    payload = {
        "scope": "unsubscribe",
        "member_id": member_id,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=UNSUBSCRIBE_EXPIRATION_DAYS)).timestamp()),
    }
    return jwt.encode(payload, UNSUBSCRIBE_SECRET, algorithm=JWT_ALGORITHM)


def decode_unsubscribe_token(token: str) -> dict:
    """Décode + valide le scope. Lève jwt.PyJWTError sur invalide/expiré.

    Retourne le payload (dict) avec `member_id` extrait.
    """
    if not UNSUBSCRIBE_SECRET:
        raise RuntimeError("UNSUBSCRIBE_SECRET not configured")
    payload = jwt.decode(token, UNSUBSCRIBE_SECRET, algorithms=[JWT_ALGORITHM])
    if payload.get("scope") != "unsubscribe":
        raise jwt.InvalidTokenError("invalid_scope")
    if not payload.get("member_id"):
        raise jwt.InvalidTokenError("missing_member_id")
    return payload


def build_unsubscribe_url(member_id: str) -> str:
    token = build_unsubscribe_token(member_id)
    base = BACKEND_PUBLIC_URL.rstrip("/")
    return f"{base}/api/marketing/unsubscribe?token={token}"


def build_whatsapp_url(first_name: Optional[str] = None) -> str:
    text = "Salut ! Je veux renouveler mon abonnement 💪"
    return f"https://wa.me/{RENEWAL_WHATSAPP_NUMBER}?text={quote(text)}"


# ── Renewal reminder template ────────────────────────────────────────────────

def _first_name(full_name: str) -> str:
    if not full_name:
        return ""
    return full_name.strip().split(" ", 1)[0]


def renewal_reminder_template(
    member_name: str,
    unsubscribe_url: str,
    whatsapp_url: str,
    club_name: str = "HYBRID GYM",
) -> tuple[str, str]:
    """Retourne (subject, html). Branding TRANSFORM dark + accent #F97316.

    Polices : Bebas Neue (titre), DM Sans (corps). Fallback system-ui.
    """
    first = _first_name(member_name) or "champion"
    subject = f"{first}, on ne t'a pas vu cette semaine 👀"

    bebas = "'Bebas Neue', 'Impact', 'Inter', -apple-system, sans-serif"
    dmsans = "'DM Sans', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
    # Palette Hybrid Gym dark (validée 2026-05-16)
    accent = "#F97316"
    bg = "#09090B"           # noir-bleu profond
    bg_card = "#111113"      # carte interne, démarcation subtile
    text_main = "#FFFFFF"    # titres
    text_sec = "#E5E7EB"     # body lisible sur dark
    text_muted = "#9CA3AF"   # secondaire / footer
    border = "#2C2C2E"       # séparateur subtle

    html = f"""<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark light">
  <meta name="supported-color-schemes" content="dark light">
  <title>{subject}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    /* Gmail mobile dark-mode override : Gmail wrappe certaines couleurs dans [data-ogsc]/[data-ogsb]
       quand il auto-light-mode-ifies un email dark. On force nos hex pour annuler l'inversion. */
    [data-ogsc] .tf-bg, [data-ogsb] .tf-bg {{ background: {bg} !important; background-color: {bg} !important; }}
    [data-ogsc] .tf-card, [data-ogsb] .tf-card {{ background: {bg_card} !important; background-color: {bg_card} !important; }}
    [data-ogsc] .tf-text-main {{ color: {text_main} !important; }}
    [data-ogsc] .tf-text-sec {{ color: {text_sec} !important; }}
    [data-ogsc] .tf-text-muted {{ color: {text_muted} !important; }}
    [data-ogsc] .tf-accent {{ color: {accent} !important; }}
    [data-ogsc] .tf-cta {{ background: {accent} !important; background-color: {accent} !important; color: #FFFFFF !important; }}
    /* Système OS dark mode (Apple Mail, ProtonMail), déjà OK mais on consolide */
    @media (prefers-color-scheme: dark) {{
      .tf-bg {{ background: {bg} !important; background-color: {bg} !important; }}
      .tf-card {{ background: {bg_card} !important; background-color: {bg_card} !important; }}
    }}
  </style>
</head>
<body class="tf-bg" bgcolor="{bg}" style="margin:0 !important;padding:0 !important;background:{bg} !important;background-color:{bg} !important;font-family:{dmsans};color:{text_main} !important;-webkit-font-smoothing:antialiased;">
  <!--[if mso]>
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" bgcolor="{bg}"><tr><td bgcolor="{bg}">
  <![endif]-->
  <table role="presentation" class="tf-bg" cellspacing="0" cellpadding="0" border="0" width="100%" bgcolor="{bg}" style="background:{bg};background:linear-gradient(180deg, {bg} 0%, #0D0D0F 100%);background-color:{bg} !important;padding:32px 16px;">
    <tr>
      <td align="center" class="tf-bg" bgcolor="{bg}" style="background:{bg} !important;background-color:{bg} !important;">
        <table role="presentation" class="tf-card" cellspacing="0" cellpadding="0" border="0" width="560" bgcolor="{bg_card}" style="max-width:560px;background:{bg_card} !important;background-color:{bg_card} !important;border:1px solid {border};border-radius:14px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td class="tf-card" bgcolor="{bg_card}" style="padding:28px 32px 18px;border-bottom:1px solid {border};background:{bg_card} !important;background-color:{bg_card} !important;">
              <div class="tf-accent" style="font-family:{dmsans};font-size:10px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:{accent} !important;margin-bottom:8px;">
                {club_name} · Ton coach
              </div>
              <h1 class="tf-text-main" style="margin:0;font-family:{bebas};font-size:42px;line-height:1;letter-spacing:0.02em;color:{text_main} !important;">
                {first.upper()}, ON NE T'A PAS VU CETTE SEMAINE
              </h1>
              <div class="tf-text-muted" style="margin-top:10px;font-family:{dmsans};font-size:11px;font-style:italic;color:{text_muted} !important;letter-spacing:0.05em;">
                Train Without Limits
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td class="tf-card" bgcolor="{bg_card}" style="padding:28px 32px 8px;font-family:{dmsans};background:{bg_card} !important;background-color:{bg_card} !important;">
              <p class="tf-text-sec" style="margin:0 0 14px;font-size:15px;line-height:1.65;color:{text_sec} !important;">
                Salut <strong class="tf-text-main" style="color:{text_main} !important;">{first}</strong>,
              </p>
              <p class="tf-text-sec" style="margin:0 0 14px;font-size:15px;line-height:1.65;color:{text_sec} !important;">
                Ton abonnement vient d'arriver à échéance et on s'est rendu compte qu'on ne t'avait pas vu ces derniers jours.
                On voulait juste prendre des nouvelles. Pas de pression, juste savoir si tout va bien de ton côté.
              </p>
              <p class="tf-text-sec" style="margin:0 0 22px;font-size:15px;line-height:1.65;color:{text_sec} !important;">
                Si t'as envie de remettre les chaussures et qu'on continue ensemble, on serait ravi de te revoir.
                Le plus simple : un petit message WhatsApp et on s'occupe du reste.
              </p>

              <!-- WhatsApp CTA -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding:6px 0 24px;">
                    <a class="tf-cta" href="{whatsapp_url}"
                       style="display:inline-block;background:{accent} !important;background-color:{accent} !important;color:#FFFFFF !important;text-decoration:none;font-family:{dmsans};font-size:15px;font-weight:700;letter-spacing:0.02em;padding:14px 28px;border-radius:10px;">
                      💬 Renouveler en 30 secondes
                    </a>
                    <div class="tf-text-muted" style="margin-top:10px;font-family:{dmsans};font-size:12px;color:{text_muted} !important;">
                      Discussion directe sur WhatsApp · +41 77 496 66 26
                    </div>
                  </td>
                </tr>
              </table>

              <p class="tf-text-muted" style="margin:0 0 14px;font-size:13px;line-height:1.6;color:{text_muted} !important;">
                Et si t'as besoin d'une pause, c'est OK aussi. On reste là quand t'es prêt(e) à revenir.
              </p>
              <p class="tf-text-sec" style="margin:0 0 6px;font-size:14px;line-height:1.6;color:{text_sec} !important;">
                À très vite,
              </p>
              <p class="tf-text-main" style="margin:0 0 4px;font-family:{bebas};font-size:22px;letter-spacing:0.04em;color:{text_main} !important;">
                L'ÉQUIPE {club_name.upper()}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="tf-card" bgcolor="{bg_card}" style="padding:18px 32px 24px;border-top:1px solid {border};background:{bg_card} !important;background-color:{bg_card} !important;font-family:{dmsans};font-size:11px;line-height:1.5;color:{text_muted} !important;">
              <span class="tf-text-muted" style="color:{text_muted} !important;">
                Tu reçois ce message parce que tu fais partie de la communauté {club_name}.
                Si tu ne souhaites plus recevoir nos relances,
                <a class="tf-accent" href="{unsubscribe_url}" style="color:{accent} !important;text-decoration:underline;">
                  clique ici pour te désinscrire
                </a>.
              </span>
            </td>
          </tr>
        </table>

        <div class="tf-text-muted" style="margin-top:14px;font-family:{dmsans};font-size:11px;color:{text_muted} !important;">
          {club_name} · Genève · contact@thecoachswitzerland.ch
        </div>
      </td>
    </tr>
  </table>
  <!--[if mso]>
  </td></tr></table>
  <![endif]-->
</body>
</html>"""
    return subject, html


# ── Send helper ──────────────────────────────────────────────────────────────

async def send_renewal_reminder(
    *,
    to_email: str,
    member_name: str,
    member_id: str,
    club_name: str = "HYBRID GYM",
) -> dict:
    """Envoie 1 email de relance. Retourne {sent: bool, ...}.

    Lève sur erreur réseau / API key manquante ; le router catche par membre.
    """
    if not resend.api_key:
        resend.api_key = os.environ.get("RESEND_API_KEY", "")
    if not resend.api_key:
        raise RuntimeError("RESEND_API_KEY not configured")

    unsubscribe_url = build_unsubscribe_url(member_id)
    whatsapp_url = build_whatsapp_url(_first_name(member_name))
    subject, html = renewal_reminder_template(
        member_name=member_name,
        unsubscribe_url=unsubscribe_url,
        whatsapp_url=whatsapp_url,
        club_name=club_name,
    )
    params = {"from": SENDER_EMAIL, "to": [to_email], "subject": subject, "html": html}
    result = await asyncio.to_thread(resend.Emails.send, params)
    resend_id = result.get("id") if isinstance(result, dict) else None
    return {"sent": True, "resend_id": resend_id, "subject": subject}
