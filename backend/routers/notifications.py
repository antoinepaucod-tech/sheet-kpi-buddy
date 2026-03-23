"""Email notification routes using Resend"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import asyncio
import logging
import os

import resend
from dotenv import load_dotenv

from core.config import db
from core.security import get_club_id

load_dotenv()
resend.api_key = os.environ.get("RESEND_API_KEY", "")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")

router = APIRouter(prefix="/notifications", tags=["notifications"])
logger = logging.getLogger(__name__)


def _cq(club_id, base=None):
    q = dict(base or {})
    if club_id:
        q["club_id"] = club_id
    return q


class EmailRequest(BaseModel):
    recipient_email: str
    subject: str
    html_content: str
    reminder_type: Optional[str] = None
    reference_id: Optional[str] = None


class BulkNotificationRequest(BaseModel):
    notification_type: str  # "payment_reminder", "review_reminder", "followup_reminder", "custom"
    subject: Optional[str] = None
    message: Optional[str] = None


# ── Email Templates ───────────────────────────────────────────────────────────

def base_template(club_name, title, body_html):
    return f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #09090B; color: #fff; padding: 0;">
      <div style="background: linear-gradient(135deg, #E11D48, #BE123C); padding: 24px 32px;">
        <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #fff;">{club_name}</h1>
      </div>
      <div style="padding: 32px;">
        <h2 style="margin: 0 0 16px 0; font-size: 18px; color: #fff;">{title}</h2>
        {body_html}
      </div>
      <div style="padding: 16px 32px; border-top: 1px solid #222; text-align: center;">
        <p style="margin: 0; font-size: 12px; color: #666;">TRANSFORM - {club_name}</p>
      </div>
    </div>
    """


def payment_reminder_template(club_name, member_name, amount, due_date):
    body = f"""
    <p style="color: #ccc; line-height: 1.6;">Bonjour <strong style="color: #fff;">{member_name}</strong>,</p>
    <p style="color: #ccc; line-height: 1.6;">Nous vous rappelons qu'un paiement est attendu :</p>
    <div style="background: #1C1C1E; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 3px solid #E11D48;">
      <p style="margin: 0 0 8px 0; color: #999; font-size: 13px;">Montant</p>
      <p style="margin: 0 0 12px 0; color: #fff; font-size: 24px; font-weight: 700;">{amount} CHF</p>
      <p style="margin: 0 0 4px 0; color: #999; font-size: 13px;">Date d'échéance</p>
      <p style="margin: 0; color: #F59E0B; font-weight: 600;">{due_date}</p>
    </div>
    <p style="color: #ccc; line-height: 1.6;">Merci de régulariser votre situation au plus vite.</p>
    <p style="color: #666; font-size: 13px; margin-top: 24px;">Cordialement,<br/><strong style="color: #999;">{club_name}</strong></p>
    """
    return base_template(club_name, "Rappel de paiement", body)


def review_reminder_template(club_name, member_name, review_date, review_type):
    type_labels = {
        "monthly": "mensuel", "quarterly": "trimestriel",
        "semi-annually": "semestriel", "annually": "annuel"
    }
    type_label = type_labels.get(review_type, "de suivi")
    body = f"""
    <p style="color: #ccc; line-height: 1.6;">Bonjour <strong style="color: #fff;">{member_name}</strong>,</p>
    <p style="color: #ccc; line-height: 1.6;">Votre bilan {type_label} est prévu prochainement :</p>
    <div style="background: #1C1C1E; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 3px solid #8B5CF6;">
      <p style="margin: 0 0 8px 0; color: #999; font-size: 13px;">Date du bilan</p>
      <p style="margin: 0 0 12px 0; color: #8B5CF6; font-size: 20px; font-weight: 700;">{review_date}</p>
      <p style="margin: 0 0 4px 0; color: #999; font-size: 13px;">Type</p>
      <p style="margin: 0; color: #fff; font-weight: 600;">Bilan {type_label}</p>
    </div>
    <p style="color: #ccc; line-height: 1.6;">Merci de prendre rendez-vous pour votre bilan en répondant directement à cet email ou en nous contactant.</p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="mailto:{SENDER_EMAIL}?subject=Rendez-vous bilan {type_label} - {member_name}" 
         style="display: inline-block; background: #8B5CF6; color: #fff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">
        Prendre rendez-vous
      </a>
    </div>
    <p style="color: #ccc; line-height: 1.6;">Préparez vos notes et objectifs pour cette session.</p>
    <p style="color: #666; font-size: 13px; margin-top: 24px;">Cordialement,<br/><strong style="color: #999;">{club_name}</strong></p>
    """
    return base_template(club_name, f"Bilan {type_label} à venir", body)


def review_reminder_staff_template(club_name, member_name, member_email, member_phone, review_date, review_type, member_url):
    """Email sent to STAFF with CTA to open member profile"""
    type_labels = {
        "monthly": "mensuel", "quarterly": "trimestriel",
        "semi-annually": "semestriel", "annually": "annuel"
    }
    type_label = type_labels.get(review_type, "de suivi")
    body = f"""
    <p style="color: #ccc; line-height: 1.6;">Un bilan {type_label} est à planifier pour :</p>
    <div style="background: #1C1C1E; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 3px solid #8B5CF6;">
      <p style="margin: 0 0 8px 0; color: #8B5CF6; font-size: 18px; font-weight: 700;">{member_name}</p>
      <p style="margin: 0 0 4px 0; color: #999; font-size: 13px;">Email: <span style="color: #fff;">{member_email or 'Non renseigné'}</span></p>
      <p style="margin: 0 0 4px 0; color: #999; font-size: 13px;">Téléphone: <span style="color: #fff;">{member_phone or 'Non renseigné'}</span></p>
      <p style="margin: 0 0 4px 0; color: #999; font-size: 13px;">Date du bilan: <span style="color: #8B5CF6; font-weight: 600;">{review_date}</span></p>
      <p style="margin: 0; color: #999; font-size: 13px;">Type: <span style="color: #fff;">Bilan {type_label}</span></p>
    </div>
    <p style="color: #ccc; line-height: 1.6;">Contactez ce membre pour fixer un rendez-vous.</p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="{member_url}" 
         style="display: inline-block; background: #8B5CF6; color: #fff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">
        Voir la fiche du membre
      </a>
    </div>
    <p style="color: #666; font-size: 13px; margin-top: 24px;">— {club_name}</p>
    """
    return base_template(club_name, f"Bilan {type_label} à planifier", body)


def followup_reminder_template(club_name, member_name, followup_date, followup_type):
    body = f"""
    <p style="color: #ccc; line-height: 1.6;">Bonjour <strong style="color: #fff;">{member_name}</strong>,</p>
    <p style="color: #ccc; line-height: 1.6;">Un suivi est programmé pour vous :</p>
    <div style="background: #1C1C1E; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 3px solid #22C55E;">
      <p style="margin: 0 0 8px 0; color: #999; font-size: 13px;">Date du suivi</p>
      <p style="margin: 0 0 12px 0; color: #22C55E; font-size: 20px; font-weight: 700;">{followup_date}</p>
      <p style="margin: 0 0 4px 0; color: #999; font-size: 13px;">Type de suivi</p>
      <p style="margin: 0; color: #fff; font-weight: 600;">{followup_type}</p>
    </div>
    <p style="color: #666; font-size: 13px; margin-top: 24px;">Cordialement,<br/><strong style="color: #999;">{club_name}</strong></p>
    """
    return base_template(club_name, "Suivi programmé", body)


# ── Helper ────────────────────────────────────────────────────────────────────

async def get_club_name():
    settings = await db.club_settings.find_one({"id": "default"}, {"_id": 0})
    return settings.get("club_name", "Mon Club") if settings else "Mon Club"


async def send_email_async(to, subject, html):
    if not resend.api_key:
        raise HTTPException(status_code=500, detail="RESEND_API_KEY non configurée")
    params = {"from": SENDER_EMAIL, "to": [to], "subject": subject, "html": html}
    try:
        result = await asyncio.to_thread(resend.Emails.send, params)
        return result
    except Exception as e:
        logger.error(f"Email send failed to {to}: {e}")
        raise


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/send-email")
async def send_single_email(data: EmailRequest):
    """Send a single custom email"""
    result = await send_email_async(data.recipient_email, data.subject, data.html_content)

    # Track reminder if type provided
    if data.reminder_type == "payment" and data.reference_id:
        await db.payments.update_one(
            {"id": data.reference_id},
            {"$set": {"reminder_sent": True, "reminder_sent_at": datetime.now(timezone.utc).isoformat()}}
        )
    elif data.reminder_type == "followup" and data.reference_id:
        await db.member_followups.update_one(
            {"id": data.reference_id},
            {"$set": {"reminder_sent": True, "reminder_sent_at": datetime.now(timezone.utc).isoformat()}}
        )

    # Log notification
    await db.notification_logs.insert_one({
        "type": data.reminder_type or "custom",
        "recipient": data.recipient_email,
        "subject": data.subject,
        "reference_id": data.reference_id,
        "status": "sent",
        "sent_at": datetime.now(timezone.utc).isoformat(),
    })

    return {"status": "success", "message": f"Email envoyé à {data.recipient_email}", "email_id": result.get("id")}


@router.post("/send-payment-reminder/{payment_id}")
async def send_payment_reminder(payment_id: str):
    """Send payment reminder for a specific payment"""
    payment = await db.payments.find_one({"id": payment_id}, {"_id": 0})
    if not payment:
        raise HTTPException(status_code=404, detail="Paiement introuvable")

    member = await db.customer_members.find_one({"id": payment["member_id"]}, {"_id": 0})
    if not member or not member.get("email"):
        raise HTTPException(status_code=400, detail="Membre sans email")

    club_name = await get_club_name()
    html = payment_reminder_template(
        club_name, member["name"],
        payment.get("amount", 0),
        payment.get("due_date", "N/A")
    )
    subject = f"[{club_name}] Rappel de paiement - {payment.get('amount', 0)} CHF"

    await send_email_async(member["email"], subject, html)

    await db.payments.update_one(
        {"id": payment_id},
        {"$set": {"reminder_sent": True, "reminder_sent_at": datetime.now(timezone.utc).isoformat()}}
    )
    await db.notification_logs.insert_one({
        "type": "payment_reminder",
        "recipient": member["email"],
        "subject": subject,
        "reference_id": payment_id,
        "member_id": member["id"],
        "status": "sent",
        "sent_at": datetime.now(timezone.utc).isoformat(),
    })

    return {"status": "success", "message": f"Rappel envoyé à {member['name']} ({member['email']})"}


@router.post("/send-review-reminder/{review_id}")
async def send_review_reminder(review_id: str):
    """Send review/bilan reminder to STAFF with link to member profile"""
    review = await db.annual_reviews.find_one({"id": review_id}, {"_id": 0})
    if not review:
        raise HTTPException(status_code=404, detail="Bilan introuvable")

    member = await db.customer_members.find_one({"id": review["member_id"]}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=400, detail="Membre introuvable")

    club_name = await get_club_name()
    review_type = review.get("review_type", "monthly")

    # Get staff email from settings or use sender email
    settings = await db.settings.find_one({}, {"_id": 0})
    staff_email = SENDER_EMAIL  # Send to the club's own email (staff)

    # Build CTA URL pointing to member profile in the app
    app_base_url = os.environ.get("FRONTEND_URL", "")
    if not app_base_url:
        # Try to infer from CORS or use a default
        app_base_url = "https://fast-onboard.preview.emergentagent.com"
    member_url = f"{app_base_url}/members?search={member.get('name', '').replace(' ', '+')}"

    html = review_reminder_staff_template(
        club_name, member["name"], member.get("email", ""),
        member.get("phone", ""), review["review_date"], review_type, member_url
    )
    subject = f"[{club_name}] Bilan à planifier - {member['name']}"

    await send_email_async(staff_email, subject, html)

    await db.notification_logs.insert_one({
        "type": "review_reminder",
        "recipient": staff_email,
        "subject": subject,
        "reference_id": review_id,
        "member_id": member["id"],
        "status": "sent",
        "sent_at": datetime.now(timezone.utc).isoformat(),
    })

    return {"status": "success", "message": f"Rappel envoyé à l'équipe pour le bilan de {member['name']}"}


@router.post("/send-bulk")
async def send_bulk_notifications(data: BulkNotificationRequest):
    """Send bulk notifications based on type"""
    club_name = await get_club_name()
    sent, failed = [], []

    if data.notification_type == "payment_reminder":
        today = datetime.now(timezone.utc).date()
        late_payments = await db.payments.find({
            "due_date": {"$lt": today.isoformat()},
            "status": {"$in": ["pending", "late"]},
            "reminder_sent": {"$ne": True}
        }, {"_id": 0}).to_list(200)

        for p in late_payments:
            member = await db.customer_members.find_one({"id": p["member_id"]}, {"_id": 0})
            if not member or not member.get("email"):
                continue
            html = payment_reminder_template(club_name, member["name"], p.get("amount", 0), p.get("due_date", ""))
            subject = f"[{club_name}] Rappel de paiement"
            try:
                await send_email_async(member["email"], subject, html)
                await db.payments.update_one({"id": p["id"]}, {"$set": {"reminder_sent": True, "reminder_sent_at": datetime.now(timezone.utc).isoformat()}})
                sent.append(member["name"])
            except Exception as e:
                failed.append({"member": member["name"], "error": str(e)})

    elif data.notification_type == "review_reminder":
        today = datetime.now(timezone.utc).date()
        week_later = today + timedelta(days=7)
        upcoming = await db.annual_reviews.find({
            "review_date": {"$gte": today.isoformat(), "$lte": week_later.isoformat()},
            "status": "scheduled"
        }, {"_id": 0}).to_list(100)

        staff_email = SENDER_EMAIL
        app_base_url = os.environ.get("FRONTEND_URL", "https://fast-onboard.preview.emergentagent.com")

        for r in upcoming:
            member = await db.customer_members.find_one({"id": r["member_id"]}, {"_id": 0})
            if not member:
                continue
            member_url = f"{app_base_url}/members?search={member.get('name', '').replace(' ', '+')}"
            html = review_reminder_staff_template(
                club_name, member["name"], member.get("email", ""),
                member.get("phone", ""), r["review_date"],
                r.get("review_type", "monthly"), member_url
            )
            subject = f"[{club_name}] Bilan à planifier - {member['name']}"
            try:
                await send_email_async(staff_email, subject, html)
                sent.append(member["name"])
            except Exception as e:
                failed.append({"member": member["name"], "error": str(e)})

    return {
        "message": f"{len(sent)} notification(s) envoyée(s), {len(failed)} échec(s)",
        "sent": sent,
        "failed": failed
    }


@router.get("/logs")
async def get_notification_logs(limit: int = 50):
    """Get recent notification logs"""
    return await db.notification_logs.find({}, {"_id": 0}).sort("sent_at", -1).to_list(limit)
