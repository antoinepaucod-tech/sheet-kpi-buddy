"""Alerts and Notifications routes"""
from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone, timedelta
import logging
import os

from core.config import db

router = APIRouter(tags=["alerts"])
logger = logging.getLogger(__name__)


@router.post("/notifications/send-reminder")
async def send_reminder_email(body: dict):
    import asyncio
    try:
        import resend
    except ImportError:
        raise HTTPException(status_code=500, detail="Email service not configured")

    api_key = os.environ.get("RESEND_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="RESEND_API_KEY not configured")

    resend.api_key = api_key
    sender_email = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")

    recipient = body.get("recipient_email")
    subject = body.get("subject")
    html_content = body.get("html_content")
    reminder_type = body.get("reminder_type")
    reference_id = body.get("reference_id")

    if not all([recipient, subject, html_content]):
        raise HTTPException(status_code=400, detail="recipient_email, subject, and html_content required")

    params = {"from": sender_email, "to": [recipient], "subject": subject, "html": html_content}

    try:
        email = await asyncio.to_thread(resend.Emails.send, params)
        if reminder_type == "payment" and reference_id:
            await db.payments.update_one(
                {"id": reference_id},
                {"$set": {"reminder_sent": True, "reminder_sent_at": datetime.now(timezone.utc).isoformat()}}
            )
        elif reminder_type == "followup" and reference_id:
            await db.member_followups.update_one(
                {"id": reference_id},
                {"$set": {"reminder_sent": True, "reminder_sent_at": datetime.now(timezone.utc).isoformat()}}
            )
        return {"status": "success", "message": f"Email sent to {recipient}", "email_id": email.get("id")}
    except Exception as e:
        logger.error(f"Failed to send email: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")


@router.get("/alerts/summary")
async def get_alerts_summary():
    today = datetime.now(timezone.utc).date()
    thirty_days = today + timedelta(days=30)

    late_payments = await db.payments.count_documents({
        "due_date": {"$lt": today.isoformat()},
        "status": {"$in": ["pending", "late"]}
    })
    missed_followups = await db.member_followups.count_documents({
        "followup_date": {"$lt": today.isoformat()},
        "status": {"$in": ["scheduled", "rescheduled"]}
    })

    members_list = await db.customer_members.find(
        {"$or": [{"exit_date": None}, {"exit_date": ""}, {"exit_date": {"$exists": False}}]}, {"_id": 0, "subscription_end_date": 1}
    ).to_list(1000)
    expiring_count = 0
    for m in members_list:
        if m.get("subscription_end_date"):
            try:
                end_date = datetime.fromisoformat(m["subscription_end_date"]).date()
                if today <= end_date <= thirty_days:
                    expiring_count += 1
            except (ValueError, TypeError):
                pass

    incomplete_onboarding = await db.customer_members.count_documents({
        "onboarding_completed": {"$ne": True},
        "$or": [{"exit_date": None}, {"exit_date": ""}, {"exit_date": {"$exists": False}}]
    })
    seven_days = today + timedelta(days=7)
    upcoming_followups = await db.member_followups.count_documents({
        "followup_date": {"$gte": today.isoformat(), "$lte": seven_days.isoformat()},
        "status": {"$in": ["scheduled", "rescheduled"]}
    })

    return {
        "late_payments": late_payments,
        "missed_followups": missed_followups,
        "expiring_subscriptions": expiring_count,
        "incomplete_onboarding": incomplete_onboarding,
        "upcoming_followups": upcoming_followups,
        "total_alerts": late_payments + missed_followups + expiring_count
    }
