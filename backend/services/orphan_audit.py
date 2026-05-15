"""
Service Orphan Audit — Détection hebdomadaire des documents sans `club_id`.

Architecture :
  - run_orphan_audit() : analyse les 15 collections critiques (READ-ONLY)
  - send_audit_email() : envoie un rapport par email via Resend si orphelins détectés
  - Pattern Sprint Hardening : aucune mutation déclenchée, c'est un détecteur pur

Configuration via .env :
  - ORPHAN_AUDIT_RECIPIENT : destinataire email (défaut: antoine.paucod@the-coach.pro)
                              Si vide → kill switch, aucun email envoyé
  - RESEND_API_KEY         : clé API Resend (déjà configurée)
  - SENDER_EMAIL           : expéditeur (déjà configuré)
"""
import asyncio
import logging
import os
from datetime import datetime, timezone
from typing import Optional

import resend

from core.config import MONGO_URL, DB_NAME
from motor.motor_asyncio import AsyncIOMotorClient


logger = logging.getLogger(__name__)

COLLECTIONS = [
    "accounting_transactions", "payments", "coaches",
    "coach_replacements", "customer_members", "member_renewals",
    "weekly_trainings", "course_kpis", "activity_logs",
    "monthly_kpis", "annual_reviews", "challenge_participants",
    "ghl_sales", "ghl_syncs", "payment_schedules",
]

ORPHAN_FILTER = {"$or": [{"club_id": None}, {"club_id": {"$exists": False}}]}

DEFAULT_RECIPIENT = "antoine.paucod@the-coach.pro"
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")


async def run_orphan_audit(db) -> dict:
    """Read-only audit. Returns {total_orphans, collections_affected, report:[...]}.
    Each item: {collection, null_count, total, sample_ids, newest_orphan_date}.
    """
    report = []
    total_orphans = 0
    for collection in COLLECTIONS:
        coll = db[collection]
        null_count = await coll.count_documents(ORPHAN_FILTER)
        total = await coll.count_documents({})
        if null_count > 0:
            sample = await coll.find(ORPHAN_FILTER, {"_id": 0}).limit(5).to_list(length=5)
            sample_ids = [doc.get("id") or "—" for doc in sample]
            dates = [str(d.get("created_at")) for d in sample if d.get("created_at")]
            newest = max(dates) if dates else None
            report.append({
                "collection": collection,
                "null_count": null_count,
                "total": total,
                "pct_orphan": round((null_count / max(total, 1)) * 100, 2),
                "sample_ids": sample_ids,
                "newest_orphan_date": newest,
            })
            total_orphans += null_count
    return {
        "total_orphans": total_orphans,
        "collections_affected": len(report),
        "report": report,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def _build_html(audit_result: dict) -> str:
    ts = audit_result["timestamp"][:19]
    total = audit_result["total_orphans"]
    n_coll = audit_result["collections_affected"]
    rows = audit_result["report"]

    if total == 0:
        body = (
            "<p style='font-size:14px;line-height:1.6;color:#fff;'>"
            "✅ <strong>Aucun document orphelin détecté.</strong><br>"
            f"15 collections critiques analysées. Tout est propre.<br>"
            f"<small style='color:#888'>Audit exécuté le {ts} UTC</small></p>"
        )
    else:
        table_rows = "".join(
            f"<tr><td style='padding:8px;border-bottom:1px solid #333'>{r['collection']}</td>"
            f"<td style='padding:8px;border-bottom:1px solid #333;text-align:right;color:#FF453A'><strong>{r['null_count']}</strong></td>"
            f"<td style='padding:8px;border-bottom:1px solid #333;text-align:right'>{r['total']}</td>"
            f"<td style='padding:8px;border-bottom:1px solid #333;text-align:right'>{r['pct_orphan']}%</td>"
            f"<td style='padding:8px;border-bottom:1px solid #333;color:#888;font-size:11px'>{(r['newest_orphan_date'] or '—')[:19]}</td></tr>"
            for r in rows
        )
        samples = "".join(
            f"<li style='margin-bottom:6px;color:#aaa;font-size:12px'><strong>{r['collection']}</strong>: {', '.join((sid or '—')[:8] for sid in r['sample_ids'])}</li>"
            for r in rows
        )
        body = (
            f"<p style='font-size:14px;line-height:1.6;color:#fff;'>"
            f"🚨 <strong>{total} document(s) orphelin(s)</strong> détecté(s) sur <strong>{n_coll} collection(s)</strong>.</p>"
            f"<table style='width:100%;border-collapse:collapse;margin:16px 0;'>"
            f"<thead><tr style='background:#111;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.5px'>"
            f"<th style='padding:8px;text-align:left'>Collection</th>"
            f"<th style='padding:8px;text-align:right'>Orphelins</th>"
            f"<th style='padding:8px;text-align:right'>Total</th>"
            f"<th style='padding:8px;text-align:right'>% Orphan</th>"
            f"<th style='padding:8px;text-align:left'>Plus récent</th></tr></thead>"
            f"<tbody>{table_rows}</tbody></table>"
            f"<h3 style='color:#fff;font-size:13px;margin-top:24px'>Échantillons (5 premiers IDs/collection) :</h3>"
            f"<ul style='padding-left:20px'>{samples}</ul>"
            f"<p style='font-size:13px;color:#aaa;margin-top:16px;padding-top:16px;border-top:1px solid #333;'>"
            f"<strong>Action recommandée</strong> : exécuter "
            f"<code style='background:#222;padding:2px 6px;border-radius:3px;color:#FF9F0A'>python scripts/migrate_orphan_club_id.py</code> "
            f"(dry-run) puis <code style='background:#222;padding:2px 6px;border-radius:3px;color:#FF9F0A'>--apply</code> après validation.</p>"
            f"<p style='font-size:11px;color:#666;'>Pattern Sprint Hardening — voir <code>/app/memory/SPRINT_HARDENING_REPORT.md</code><br>"
            f"Audit exécuté le {ts} UTC</p>"
        )

    return f"""
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:640px;margin:0 auto;background:#09090B;color:#fff;padding:0;">
      <div style="background:linear-gradient(135deg,#E11D48,#BE123C);padding:24px 32px;">
        <h1 style="margin:0;font-size:18px;color:#fff;letter-spacing:0.3px">🛡️ TRANSFORM — Audit hebdomadaire orphelins club_id</h1>
      </div>
      <div style="padding:32px;">
        {body}
      </div>
    </div>
    """


async def send_audit_email(audit_result: dict, force: bool = False) -> dict:
    """Send email via Resend. Returns {sent: bool, reason, ...}.
    - force=True envoie même si 0 orphelin (utilisé pour validation pipeline manuelle)
    - force=False (default) n'envoie que si total_orphans > 0 (CRON automatique)
    """
    # Kill switch : si la variable est définie ET vide → aucun email
    # Si la variable est absente → utiliser DEFAULT_RECIPIENT
    env_val = os.environ.get("ORPHAN_AUDIT_RECIPIENT")
    if env_val is None:
        recipient = DEFAULT_RECIPIENT
    else:
        recipient = env_val.strip()
    if not recipient:
        logger.info("WEEKLY_ORPHAN_AUDIT_KILL_SWITCH — ORPHAN_AUDIT_RECIPIENT vide, aucun email envoyé.")
        return {"sent": False, "reason": "recipient_empty_kill_switch"}

    if audit_result["total_orphans"] == 0 and not force:
        return {"sent": False, "reason": "no_orphans_no_force"}

    if not resend.api_key:
        resend.api_key = os.environ.get("RESEND_API_KEY", "")
    if not resend.api_key:
        logger.error("WEEKLY_ORPHAN_AUDIT_RESEND_KEY_MISSING")
        return {"sent": False, "reason": "resend_api_key_missing"}

    total = audit_result["total_orphans"]
    n_coll = audit_result["collections_affected"]
    date_str = audit_result["timestamp"][:10]
    if total > 0:
        subject = f"🚨 Orphelins club_id détectés - {total} docs sur {n_coll} collections - {date_str}"
    else:
        subject = f"✅ Audit orphelins club_id - 0 détecté - {date_str}"

    html = _build_html(audit_result)
    params = {"from": SENDER_EMAIL, "to": [recipient], "subject": subject, "html": html}
    try:
        result = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"WEEKLY_ORPHAN_AUDIT_EMAIL_SENT to={recipient} total={total} resend_id={result.get('id') if isinstance(result, dict) else result}")
        return {"sent": True, "recipient": recipient, "resend_id": (result.get("id") if isinstance(result, dict) else None)}
    except Exception as e:
        logger.error(f"WEEKLY_ORPHAN_AUDIT_EMAIL_FAILED: {e}")
        return {"sent": False, "reason": f"resend_error: {e}"}


async def run_weekly_orphan_audit(force_email: bool = False, db=None) -> dict:
    """Entry point used by both APScheduler and the manual admin endpoint.
    - force_email=True envoie l'email même si 0 orphelin (validation pipeline)
    - db=None : ouvre une connexion temporaire (cas standalone), sinon réutilise."""
    close_after = False
    client = None
    if db is None:
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        close_after = True

    try:
        audit_result = await run_orphan_audit(db)
        if audit_result["total_orphans"] == 0:
            logger.info(
                f"WEEKLY_ORPHAN_AUDIT_CLEAN timestamp={audit_result['timestamp']} "
                "total_orphans=0 collections_affected=0"
            )
        else:
            logger.warning(
                f"WEEKLY_ORPHAN_AUDIT_ALERT timestamp={audit_result['timestamp']} "
                f"total_orphans={audit_result['total_orphans']} "
                f"collections_affected={audit_result['collections_affected']} "
                f"collections={[r['collection'] for r in audit_result['report']]}"
            )
        email_result = await send_audit_email(audit_result, force=force_email)
        audit_result["email"] = email_result
        return audit_result
    finally:
        if close_after and client is not None:
            client.close()
