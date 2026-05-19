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
from collections import defaultdict
from datetime import datetime, timezone
from typing import Optional

import resend

from core.config import MONGO_URL, DB_NAME, DEFAULT_CLUB_ID
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

# Heuristique PIF identique au script scripts/audit_billing_without_schedule.py (18/05)
# Si revenu reçu (accounting_transactions) >= 80% du prix théorique → PIF probable,
# exclu de la liste d'orphelins (faux positif éliminé).
PIF_THRESHOLD_RATIO = 0.80
MAX_BILLING_ORPHANS_IN_EMAIL = 20


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


async def check_billing_without_schedule(db, club_id: str = DEFAULT_CLUB_ID) -> dict:
    """Read-only : détecte les membres `billing_enabled=True` sans `payment_schedule`
    actif, en réutilisant la logique du script `scripts/audit_billing_without_schedule.py`
    (livré 2026-05-18 dans la foulée de la remédiation Norman Pilller).

    Différence clé vs `services/billing_audit.py` :
      - Inclut les Coaches (Norman était un Coach, et l'audit qui l'avait détecté
        considérait ce cas)
      - Applique le filtre PIF (revenu reçu ≥ 80 % du prix théorique → faux positif
        éliminé)
      - Pas de filtre temporel sur `subscription_end_date` : on veut détecter toute
        nouvelle régression *future* dès qu'elle apparaît.

    Le digest hebdomadaire utilise cette fonction pour verrouiller la non-régression.

    Returns:
        {
            "total_billing_on": int,
            "orphan_count": int,
            "orphans": [{id, name, membership, billing_amount, monthly_estimated,
                         ref_date}] (capé à MAX_BILLING_ORPHANS_IN_EMAIL),
            "scanned_at": str ISO,
            "error": str (uniquement si exception attrapée)
        }

    En cas d'exception DB : log warning structuré et retourne payload vide pour
    NE PAS bloquer le digest principal (les autres checks doivent tourner).
    """
    try:
        # 1. Membres billing_enabled=True non archivés
        members = await db.customer_members.find(
            {"club_id": club_id, "billing_enabled": True, "archived_at": None},
            {"_id": 0},
        ).to_list(length=5000)

        # 2. Payment schedules actifs (index par member_id)
        ps_by_member = defaultdict(list)
        async for ps in db.payment_schedules.find(
            {"club_id": club_id, "is_active": True},
            {"_id": 0, "member_id": 1},
        ):
            mid = ps.get("member_id")
            if mid:
                ps_by_member[mid].append(ps)

        # 3. Membership types (lookup prix + duration + is_pif)
        mtypes = await db.membership_types.find(
            {"club_id": club_id}, {"_id": 0},
        ).to_list(length=500)
        mtypes_by_name = {t["name"]: t for t in mtypes if t.get("name")}

        # 4. Accounting transactions revenue agrégés par client_name (proxy member)
        revenue_by_name: dict = defaultdict(float)
        async for tx in db.accounting_transactions.find(
            {"club_id": club_id, "type": "revenue", "is_validated": True},
            {"_id": 0, "client_name": 1, "amount_received": 1, "amount": 1},
        ):
            cn = (tx.get("client_name") or "").strip()
            if not cn:
                continue
            amt = tx.get("amount_received") if tx.get("amount_received") is not None else tx.get("amount", 0)
            try:
                revenue_by_name[cn] += float(amt or 0)
            except (TypeError, ValueError):
                pass

        # 5. Cross-join : flag orphelins, filtre PIF probables
        orphans = []
        for m in members:
            mid = m.get("id")
            if not mid:
                continue
            if ps_by_member.get(mid):
                continue  # Schedule actif → OK, hors scope

            mt_name = m.get("membership") or ""
            mt = mtypes_by_name.get(mt_name, {})
            type_price = float(mt.get("price") or 0)
            type_duration_months = mt.get("duration_months") or 0
            is_pif_type = bool(mt.get("is_pif"))

            member_billing_amount = float(m.get("billing_amount") or 0)
            monthly = member_billing_amount if member_billing_amount > 0 else (
                (type_price / type_duration_months) if (type_price and type_duration_months) else 0
            )

            client_name = (m.get("name") or "").strip()
            revenue_received = revenue_by_name.get(client_name, 0.0)

            theoretical_total = (
                type_price if is_pif_type and type_price > 0
                else (monthly * type_duration_months if monthly and type_duration_months else 0)
            )

            # Heuristique PIF : revenu reçu couvre >= 80% du théorique → faux positif
            is_pif_probable = (
                theoretical_total > 0
                and revenue_received >= (PIF_THRESHOLD_RATIO * theoretical_total)
            )
            if is_pif_probable:
                continue

            ref_date = m.get("contract_signed_date") or (m.get("created_at") or "")[:10] or None
            orphans.append({
                "id": mid,
                "name": client_name,
                "membership": mt_name,
                "billing_amount": member_billing_amount,
                "monthly_estimated": round(monthly, 2),
                "ref_date": ref_date,
            })

        # Tri par monthly desc (plus gros impact en haut de l'email)
        orphans.sort(key=lambda r: r.get("monthly_estimated") or 0, reverse=True)

        return {
            "total_billing_on": len(members),
            "orphan_count": len(orphans),
            "orphans": orphans[:MAX_BILLING_ORPHANS_IN_EMAIL],
            "scanned_at": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as exc:  # pragma: no cover (best-effort, on ne bloque pas le digest)
        logger.warning(
            "WEEKLY_BILLING_WITHOUT_SCHEDULE_CHECK_FAILED "
            f"error={exc!r} club_id={club_id}"
        )
        return {
            "total_billing_on": 0,
            "orphan_count": 0,
            "orphans": [],
            "scanned_at": datetime.now(timezone.utc).isoformat(),
            "error": str(exc),
        }


def _build_html(audit_result: dict) -> str:
    ts = audit_result["timestamp"][:19]
    total = audit_result["total_orphans"]
    n_coll = audit_result["collections_affected"]
    rows = audit_result["report"]
    billing = audit_result.get("billing") or {}

    # === SECTION ORPHELINS ===
    if total == 0:
        orphans_body = (
            "<p style='font-size:14px;line-height:1.6;color:#fff;'>"
            "✅ <strong>Aucun document orphelin détecté.</strong><br>"
            "15 collections critiques analysées. Tout est propre.</p>"
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
        orphans_body = (
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
            f"<p style='font-size:13px;color:#aaa;margin-top:16px;'>"
            f"<strong>Action recommandée</strong> : exécuter "
            f"<code style='background:#222;padding:2px 6px;border-radius:3px;color:#FF9F0A'>python scripts/migrate_orphan_club_id.py</code> "
            f"(dry-run) puis <code style='background:#222;padding:2px 6px;border-radius:3px;color:#FF9F0A'>--apply</code> après validation.</p>"
        )

    # === SECTION BILLING ===
    billing_body = ""
    if billing:
        red_n = billing.get("red_count", 0)
        orange_n = billing.get("orange_count", 0)
        if red_n == 0 and orange_n == 0:
            billing_body = (
                "<p style='font-size:14px;line-height:1.6;color:#fff;margin-top:32px;padding-top:24px;border-top:1px solid #333;'>"
                "💳 <strong>Billing health</strong> — ✅ Tout est sain "
                f"(<span style='color:#888'>{billing.get('total_billing_on', 0)} membres `billing_enabled=true` scannés, 0 RED + 0 ORANGE</span>)"
                "</p>"
            )
        else:
            red_lost = billing.get("red_estimated_lost_revenue_chf", 0)
            def _fmt_lost(r):
                v = r.get('estimated_lost_revenue_chf')
                return f"{v:.0f} CHF" if v else "—"

            red_table = "".join(
                f"<tr><td style='padding:6px;border-bottom:1px solid #333'>{(r.get('name') or '—')[:25]}</td>"
                f"<td style='padding:6px;border-bottom:1px solid #333;font-size:11px;color:#aaa'>{(r.get('membership') or '—')[:30]}</td>"
                f"<td style='padding:6px;border-bottom:1px solid #333;text-align:right'>{r.get('months_active', 0)}</td>"
                f"<td style='padding:6px;border-bottom:1px solid #333;text-align:right;color:#FF453A'>{_fmt_lost(r)}</td></tr>"
                for r in billing.get("red_details", [])
            )
            orange_table = "".join(
                f"<tr><td style='padding:6px;border-bottom:1px solid #333'>{(r.get('name') or '—')[:25]}</td>"
                f"<td style='padding:6px;border-bottom:1px solid #333;font-size:11px;color:#aaa'>{(r.get('membership') or '—')[:30]}</td>"
                f"<td style='padding:6px;border-bottom:1px solid #333;text-align:right'>{r.get('n_payments', 0)}</td>"
                f"<td style='padding:6px;border-bottom:1px solid #333;text-align:right;color:#FF9F0A'>{r.get('sum_payments_chf', 0):.0f} CHF</td></tr>"
                for r in billing.get("orange_details", [])
            )
            red_section = (
                f"<h3 style='color:#FF453A;font-size:13px;margin-top:24px'>🔴 RED — {red_n} membre(s) sans schedule ni paiement (revenu manqué estimé : {red_lost:.0f} CHF)</h3>"
                f"<table style='width:100%;border-collapse:collapse;margin:8px 0 16px;'>"
                f"<thead><tr style='background:#111;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.5px'>"
                f"<th style='padding:6px;text-align:left'>Membre</th><th style='padding:6px;text-align:left'>Membership</th>"
                f"<th style='padding:6px;text-align:right'>Mois actifs</th><th style='padding:6px;text-align:right'>Lost</th></tr></thead>"
                f"<tbody>{red_table}</tbody></table>"
            ) if red_n > 0 else ""
            orange_section = (
                f"<h3 style='color:#FF9F0A;font-size:13px;margin-top:16px'>🟠 ORANGE — {orange_n} membre(s) sans schedule mais avec paiements manuels</h3>"
                f"<table style='width:100%;border-collapse:collapse;margin:8px 0 16px;'>"
                f"<thead><tr style='background:#111;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.5px'>"
                f"<th style='padding:6px;text-align:left'>Membre</th><th style='padding:6px;text-align:left'>Membership</th>"
                f"<th style='padding:6px;text-align:right'># Pmt</th><th style='padding:6px;text-align:right'>Sum</th></tr></thead>"
                f"<tbody>{orange_table}</tbody></table>"
            ) if orange_n > 0 else ""
            billing_body = (
                "<div style='margin-top:32px;padding-top:24px;border-top:1px solid #333;'>"
                f"<p style='font-size:14px;line-height:1.6;color:#fff;'>"
                f"💳 <strong>Billing health</strong> — 🚨 <strong>{red_n} RED + {orange_n} ORANGE</strong> détecté(s) "
                f"sur {billing.get('total_billing_on', 0)} membres scannés.</p>"
                f"{red_section}{orange_section}"
                f"<p style='font-size:12px;color:#aaa'>Détails complets via "
                f"<code style='background:#222;padding:2px 6px;border-radius:3px;color:#FF9F0A'>python -m scripts.audit_billing_without_schedules</code></p>"
                "</div>"
            )

    footer = (
        f"<p style='font-size:11px;color:#666;margin-top:32px;padding-top:16px;border-top:1px solid #333;'>"
        f"Pattern Sprint Hardening — voir <code>/app/memory/SPRINT_HARDENING_REPORT.md</code><br>"
        f"Audit exécuté le {ts} UTC</p>"
    )

    # === SECTION BILLING SANS PAYMENT_SCHEDULE (verrouillage post-Norman 18/05) ===
    bws = audit_result.get("billing_without_schedule") or {}
    bws_orphans = bws.get("orphans") or []
    bws_body = ""
    if bws_orphans:
        scanned = bws.get("total_billing_on", 0)
        rows_html = "".join(
            f"<tr><td style='padding:6px;border-bottom:1px solid #333'>{(o.get('name') or '—')[:30]}</td>"
            f"<td style='padding:6px;border-bottom:1px solid #333;font-size:11px;color:#aaa'>{(o.get('membership') or '—')[:32]}</td>"
            f"<td style='padding:6px;border-bottom:1px solid #333;text-align:right'>{(o.get('monthly_estimated') or 0):.0f} CHF/mo</td>"
            f"<td style='padding:6px;border-bottom:1px solid #333;text-align:right;color:#888;font-size:11px'>{(o.get('ref_date') or '—')}</td></tr>"
            for o in bws_orphans
        )
        bws_body = (
            "<div style='margin-top:32px;padding-top:24px;border-top:1px solid #333;'>"
            f"<p style='font-size:14px;line-height:1.6;color:#fff;'>"
            f"📋 <strong>Billing sans payment_schedule</strong> — 🚨 "
            f"<strong>{bws.get('orphan_count', 0)}</strong> orphelin(s) détecté(s) "
            f"sur {scanned} membres `billing_enabled=True` non archivés "
            f"(heuristique PIF ≥{int(PIF_THRESHOLD_RATIO * 100)}% appliquée).</p>"
            f"<table style='width:100%;border-collapse:collapse;margin:8px 0 16px;'>"
            f"<thead><tr style='background:#111;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.5px'>"
            f"<th style='padding:6px;text-align:left'>Membre</th>"
            f"<th style='padding:6px;text-align:left'>Membership</th>"
            f"<th style='padding:6px;text-align:right'>Monthly estimé</th>"
            f"<th style='padding:6px;text-align:left'>Ref. date</th></tr></thead>"
            f"<tbody>{rows_html}</tbody></table>"
            f"<p style='font-size:13px;color:#aaa;margin-top:8px;'>"
            f"<strong>Action recommandée</strong> : exécuter "
            f"<code style='background:#222;padding:2px 6px;border-radius:3px;color:#FF9F0A'>python scripts/audit_billing_without_schedule.py</code> "
            f"pour le détail + remédier au cas par cas (voir pattern Norman 18/05 : "
            f"<code style='background:#222;padding:2px 6px;border-radius:3px;color:#FF9F0A'>scripts/remediate_norman_payment_schedule.py</code>).</p>"
            "</div>"
        )

    return f"""
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:680px;margin:0 auto;background:#09090B;color:#fff;padding:0;">
      <div style="background:linear-gradient(135deg,#E11D48,#BE123C);padding:24px 32px;">
        <h1 style="margin:0;font-size:18px;color:#fff;letter-spacing:0.3px">🛡️ TRANSFORM — Tableau de bord santé prod (hebdo)</h1>
      </div>
      <div style="padding:32px;">
        {orphans_body}
        {billing_body}
        {bws_body}
        {footer}
      </div>
    </div>
    """


async def send_audit_email(audit_result: dict, force: bool = False) -> dict:
    """Send email via Resend. Returns {sent: bool, reason, ...}.
    - force=True envoie même si tout est sain (utilisé pour validation pipeline)
    - force=False (default) n'envoie que si total_orphans > 0 OU billing alert (CRON auto)
    """
    # Kill switch : si la variable est définie ET vide → aucun email
    env_val = os.environ.get("ORPHAN_AUDIT_RECIPIENT")
    if env_val is None:
        recipient = DEFAULT_RECIPIENT
    else:
        recipient = env_val.strip()
    if not recipient:
        logger.info("WEEKLY_ORPHAN_AUDIT_KILL_SWITCH — ORPHAN_AUDIT_RECIPIENT vide, aucun email envoyé.")
        return {"sent": False, "reason": "recipient_empty_kill_switch"}

    billing = audit_result.get("billing") or {}
    bws = audit_result.get("billing_without_schedule") or {}
    has_orphans = audit_result["total_orphans"] > 0
    has_billing_alert = (billing.get("red_count", 0) > 0) or (billing.get("orange_count", 0) > 0)
    has_bws_alert = (bws.get("orphan_count", 0) > 0)
    if not (has_orphans or has_billing_alert or has_bws_alert or force):
        return {"sent": False, "reason": "no_alert_no_force"}

    if not resend.api_key:
        resend.api_key = os.environ.get("RESEND_API_KEY", "")
    if not resend.api_key:
        logger.error("WEEKLY_ORPHAN_AUDIT_RESEND_KEY_MISSING")
        return {"sent": False, "reason": "resend_api_key_missing"}

    total = audit_result["total_orphans"]
    n_coll = audit_result["collections_affected"]
    date_str = audit_result["timestamp"][:10]
    red_n = billing.get("red_count", 0)
    orange_n = billing.get("orange_count", 0)
    bws_n = bws.get("orphan_count", 0)
    # Sujet adaptatif
    alerts = []
    if has_orphans:
        alerts.append(f"{total} orphelins")
    if has_billing_alert:
        alerts.append(f"{red_n} RED + {orange_n} ORANGE")
    if has_bws_alert:
        alerts.append(f"{bws_n} sans schedule")
    if alerts:
        subject = f"🚨 Santé prod TRANSFORM - {' / '.join(alerts)} - {date_str}"
    else:
        subject = f"✅ Santé prod TRANSFORM - Tout est sain - {date_str}"

    html = _build_html(audit_result)
    params = {"from": SENDER_EMAIL, "to": [recipient], "subject": subject, "html": html}
    try:
        result = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"WEEKLY_ORPHAN_AUDIT_EMAIL_SENT to={recipient} orphans={total} red={red_n} orange={orange_n} bws={bws_n} resend_id={result.get('id') if isinstance(result, dict) else result}")
        return {"sent": True, "recipient": recipient, "resend_id": (result.get("id") if isinstance(result, dict) else None)}
    except Exception as e:
        logger.error(f"WEEKLY_ORPHAN_AUDIT_EMAIL_FAILED: {e}")
        return {"sent": False, "reason": f"resend_error: {e}"}


async def run_weekly_orphan_audit(force_email: bool = False, db=None) -> dict:
    """Entry point used by both APScheduler and the manual admin endpoint.
    - force_email=True envoie l'email même si tout est sain (validation pipeline)
    - db=None : ouvre une connexion temporaire (cas standalone), sinon réutilise.

    Retourne un payload combiné {orphans audit + billing audit + email status}.
    """
    close_after = False
    client = None
    if db is None:
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        close_after = True

    try:
        audit_result = await run_orphan_audit(db)
        # Audit billing en complément (P2 — verrouille la régression PaymentSchedule)
        from services.billing_audit import run_billing_audit
        billing_result = await run_billing_audit(db)
        audit_result["billing"] = billing_result

        # Audit billing-sans-schedule (verrouillage post-Norman 18/05, inclut Coaches + filtre PIF)
        bws_result = await check_billing_without_schedule(db)
        audit_result["billing_without_schedule"] = bws_result

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

        if billing_result["red_count"] == 0 and billing_result["orange_count"] == 0:
            logger.info(
                f"WEEKLY_BILLING_AUDIT_CLEAN total_billing_on={billing_result['total_billing_on']} "
                "red=0 orange=0"
            )
        else:
            logger.warning(
                f"WEEKLY_BILLING_AUDIT_ALERT red={billing_result['red_count']} "
                f"orange={billing_result['orange_count']} "
                f"lost_revenue_chf={billing_result.get('red_estimated_lost_revenue_chf', 0)}"
            )

        if bws_result.get("orphan_count", 0) == 0:
            logger.info(
                f"WEEKLY_BILLING_WITHOUT_SCHEDULE_CLEAN total_billing_on={bws_result.get('total_billing_on', 0)} "
                "orphan_count=0"
            )
        else:
            logger.warning(
                f"WEEKLY_BILLING_WITHOUT_SCHEDULE_ALERT orphan_count={bws_result.get('orphan_count', 0)} "
                f"sample_names={[o.get('name') for o in bws_result.get('orphans', [])[:5]]}"
            )

        email_result = await send_audit_email(audit_result, force=force_email)
        audit_result["email"] = email_result
        return audit_result
    finally:
        if close_after and client is not None:
            client.close()
