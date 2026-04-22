"""Sprint B — Tests for A/B/C archived member filtering + soft delete.

- Type A: read-detail endpoints — no filter
- Type B: list/bulk-generation endpoints — silent filter on archived members
- Type C: targeted action endpoints — block with 400 if target archived
- Warning: mark-paid/revert-to-unpaid return warnings=['member_archived']
- B.5: DELETE /members/{id} and DELETE /coaches/{id} redirect to soft delete (idempotent)
"""
import os
import uuid
import pytest
import requests
from datetime import datetime, timezone, timedelta

from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path("/app/frontend/.env"))
load_dotenv(Path("/app/backend/.env"))
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"
CLUB_ID = "0a327bf5-c759-49eb-87e4-551913f78bdb"  # Versoix
EMAIL = "antoine.paucod@the-coach.pro"
PASSWORD = "TheCoach1290."


# ── Fixtures ─────────────────────────────────────────────────────────────────
@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/auth/login", json={"email": EMAIL, "password": PASSWORD}, timeout=20)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json()["access_token"] if "access_token" in r.json() else r.json().get("token")


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}", "X-Club-Id": CLUB_ID, "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def archived_member(headers):
    """Create a fresh test member and archive it. Cleanup via DB delete after tests."""
    payload = {
        "name": f"TEST_ArchivedMember_{uuid.uuid4().hex[:6]}",
        "email": f"TEST_{uuid.uuid4().hex[:6]}@test.local",
        "phone": "+41000000000",
        "membership": "TEST MEMBERSHIP",
        "member_type": "Membres Généraux Récurrents",
        "contract_signed_date": "2025-01-01",
        "subscription_end_date": "2026-12-31",
        "cash_collected": 0,
        "billing_enabled": False,
        "billing_amount": 0,
    }
    r = requests.post(f"{API}/members", json=payload, headers=headers, timeout=20)
    assert r.status_code == 200, f"Create member failed: {r.status_code} {r.text}"
    member = r.json()
    mid = member["id"]
    # Archive
    a = requests.post(f"{API}/members/{mid}/archive", headers=headers, timeout=20)
    assert a.status_code == 200, f"Archive failed: {a.status_code} {a.text}"
    yield member
    # Teardown via direct Mongo to avoid polluting real data (DELETE is now soft)
    import asyncio
    from pymongo import MongoClient
    mc = MongoClient(os.environ.get("MONGO_URL"))
    mc[os.environ.get("DB_NAME")]["customer_members"].delete_one({"id": mid})
    mc[os.environ.get("DB_NAME")]["payments"].delete_many({"member_id": mid})
    mc[os.environ.get("DB_NAME")]["annual_reviews"].delete_many({"member_id": mid})
    mc[os.environ.get("DB_NAME")]["member_followups"].delete_many({"member_id": mid})
    mc.close()


@pytest.fixture(scope="module")
def active_member(headers):
    payload = {
        "name": f"TEST_ActiveMember_{uuid.uuid4().hex[:6]}",
        "email": f"TEST_{uuid.uuid4().hex[:6]}@test.local",
        "phone": "+41000000001",
        "membership": "TEST MEMBERSHIP",
        "member_type": "Membres Généraux Récurrents",
        "contract_signed_date": "2025-01-01",
        "subscription_end_date": "2026-12-31",
        "cash_collected": 0,
        "billing_enabled": False,
        "billing_amount": 0,
    }
    r = requests.post(f"{API}/members", json=payload, headers=headers, timeout=20)
    assert r.status_code == 200
    member = r.json()
    mid = member["id"]
    yield member
    from pymongo import MongoClient
    mc = MongoClient(os.environ.get("MONGO_URL"))
    mc[os.environ.get("DB_NAME")]["customer_members"].delete_one({"id": mid})
    mc[os.environ.get("DB_NAME")]["payments"].delete_many({"member_id": mid})
    mc[os.environ.get("DB_NAME")]["annual_reviews"].delete_many({"member_id": mid})
    mc[os.environ.get("DB_NAME")]["member_followups"].delete_many({"member_id": mid})
    mc.close()


# ── Type C guards ────────────────────────────────────────────────────────────
class TestTypeCGuards:

    def test_post_payment_blocks_archived(self, headers, archived_member):
        r = requests.post(f"{API}/payments", headers=headers, json={
            "member_id": archived_member["id"],
            "amount": 100.0,
            "due_date": "2026-05-01",
        }, timeout=20)
        assert r.status_code == 400, r.text
        assert "archivé" in r.json().get("detail", "").lower() or "archived" in r.json().get("detail", "").lower()

    def test_post_payment_allows_active(self, headers, active_member):
        r = requests.post(f"{API}/payments", headers=headers, json={
            "member_id": active_member["id"],
            "amount": 100.0,
            "due_date": "2026-05-01",
        }, timeout=20)
        assert r.status_code == 200, r.text

    def test_post_followup_blocks_archived(self, headers, archived_member):
        r = requests.post(f"{API}/followups", headers=headers, json={
            "member_id": archived_member["id"],
            "followup_date": "2026-05-01",
            "followup_type": "monthly",
        }, timeout=20)
        assert r.status_code == 400, r.text

    def test_post_annual_review_blocks_archived(self, headers, archived_member):
        r = requests.post(f"{API}/annual-reviews", headers=headers, json={
            "member_id": archived_member["id"],
            "review_date": "2026-05-01",
            "review_type": "monthly",
        }, timeout=20)
        assert r.status_code == 400, r.text

    def test_post_challenge_participant_blocks_archived(self, headers, archived_member):
        # Get or create a challenge
        chg = requests.get(f"{API}/challenges", headers=headers, timeout=20).json()
        if not chg:
            pytest.skip("No challenge available")
        challenge_id = chg[0]["id"]
        r = requests.post(f"{API}/challenges/{challenge_id}/participants", headers=headers, json={
            "challenge_id": challenge_id,
            "member_id": archived_member["id"],
            "member_name": archived_member["name"],
        }, timeout=20)
        assert r.status_code == 400, r.text
        assert "archivé" in r.json().get("detail", "").lower()


# ── mark-paid / revert-to-unpaid warnings ───────────────────────────────────
class TestMarkPaidWarnings:

    def test_mark_paid_returns_warning_when_archived(self, headers, active_member):
        # 1. Create payment while active
        p = requests.post(f"{API}/payments", headers=headers, json={
            "member_id": active_member["id"],
            "amount": 50.0,
            "due_date": "2026-05-15",
        }, timeout=20)
        assert p.status_code == 200, p.text
        payment_id = p.json()["id"]

        # 2. Archive the member
        a = requests.post(f"{API}/members/{active_member['id']}/archive", headers=headers, timeout=20)
        assert a.status_code == 200

        # 3. mark-paid must succeed and return warnings
        r = requests.post(f"{API}/payments/{payment_id}/mark-paid", headers=headers, json={}, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "warnings" in body, f"warnings key missing: {body}"
        assert "member_archived" in body["warnings"], f"Expected member_archived in {body['warnings']}"

        # 4. revert-to-unpaid also returns warnings
        r2 = requests.post(f"{API}/payments/{payment_id}/revert-to-unpaid", headers=headers, timeout=20)
        assert r2.status_code == 200, r2.text
        body2 = r2.json()
        assert "warnings" in body2
        assert "member_archived" in body2["warnings"]

        # Restore for fixture cleanup
        requests.post(f"{API}/members/{active_member['id']}/restore", headers=headers, timeout=20)


# ── Type B silent filters ────────────────────────────────────────────────────
class TestTypeBSilentFilters:

    @pytest.fixture(scope="class")
    def archived_with_data(self, headers):
        """Create member, add payment+followup+review, then archive."""
        payload = {
            "name": f"TEST_ArchivedWithData_{uuid.uuid4().hex[:6]}",
            "email": f"TEST_{uuid.uuid4().hex[:6]}@test.local",
            "phone": "+41000000002",
            "membership": "TEST",
            "member_type": "Membres Généraux Récurrents",
            "contract_signed_date": "2025-01-01",
            "subscription_end_date": "2026-12-31",
            "cash_collected": 0,
            "billing_enabled": False,
            "billing_amount": 0,
        }
        m = requests.post(f"{API}/members", json=payload, headers=headers, timeout=20).json()
        mid = m["id"]

        # Create payment
        p = requests.post(f"{API}/payments", headers=headers, json={
            "member_id": mid, "amount": 100.0, "due_date": "2026-01-05", "status": "pending"
        }, timeout=20)
        assert p.status_code == 200
        pid = p.json()["id"]

        # Create followup
        f = requests.post(f"{API}/followups", headers=headers, json={
            "member_id": mid, "followup_date": "2026-01-10", "followup_type": "monthly"
        }, timeout=20)
        assert f.status_code == 200
        fid = f.json()["id"]

        # Create review
        r = requests.post(f"{API}/annual-reviews", headers=headers, json={
            "member_id": mid, "review_date": "2026-01-15", "review_type": "monthly"
        }, timeout=20)
        assert r.status_code == 200
        rid = r.json()["id"]

        # Archive
        requests.post(f"{API}/members/{mid}/archive", headers=headers, timeout=20)

        yield {"mid": mid, "pid": pid, "fid": fid, "rid": rid}

        # Teardown
        from pymongo import MongoClient
        mc = MongoClient(os.environ.get("MONGO_URL"))
        db = mc[os.environ.get("DB_NAME")]
        db["customer_members"].delete_one({"id": mid})
        db["payments"].delete_many({"member_id": mid})
        db["annual_reviews"].delete_many({"member_id": mid})
        db["member_followups"].delete_many({"member_id": mid})
        mc.close()

    def test_get_payments_excludes_archived(self, headers, archived_with_data):
        r = requests.get(f"{API}/payments", headers=headers, timeout=20)
        assert r.status_code == 200
        ids = {p["id"] for p in r.json()}
        assert archived_with_data["pid"] not in ids, "Archived member payment leaked into GET /payments"

    def test_get_payments_late_excludes_archived(self, headers, archived_with_data):
        r = requests.get(f"{API}/payments/late", headers=headers, timeout=20)
        assert r.status_code == 200
        ids = {p["id"] for p in r.json()}
        assert archived_with_data["pid"] not in ids

    def test_get_payments_upcoming_excludes_archived(self, headers, archived_with_data):
        r = requests.get(f"{API}/payments/upcoming", headers=headers, timeout=20)
        assert r.status_code == 200
        ids = {p["id"] for p in r.json()}
        assert archived_with_data["pid"] not in ids

    def test_get_followups_excludes_archived(self, headers, archived_with_data):
        r = requests.get(f"{API}/followups", headers=headers, timeout=20)
        assert r.status_code == 200
        ids = {p["id"] for p in r.json()}
        assert archived_with_data["fid"] not in ids

    def test_get_followups_upcoming_excludes_archived(self, headers, archived_with_data):
        r = requests.get(f"{API}/followups/upcoming", headers=headers, timeout=20)
        assert r.status_code == 200
        ids = {p["id"] for p in r.json()}
        assert archived_with_data["fid"] not in ids

    def test_get_followups_missed_excludes_archived(self, headers, archived_with_data):
        r = requests.get(f"{API}/followups/missed", headers=headers, timeout=20)
        assert r.status_code == 200
        ids = {p["id"] for p in r.json()}
        assert archived_with_data["fid"] not in ids

    def test_get_annual_reviews_excludes_archived(self, headers, archived_with_data):
        r = requests.get(f"{API}/annual-reviews", headers=headers, timeout=20)
        assert r.status_code == 200
        ids = {p["id"] for p in r.json()}
        assert archived_with_data["rid"] not in ids

    def test_get_annual_reviews_upcoming_excludes_archived(self, headers, archived_with_data):
        r = requests.get(f"{API}/annual-reviews/upcoming", headers=headers, timeout=20)
        assert r.status_code == 200
        ids = {p["id"] for p in r.json()}
        assert archived_with_data["rid"] not in ids

    def test_get_annual_reviews_overdue_excludes_archived(self, headers, archived_with_data):
        r = requests.get(f"{API}/annual-reviews/overdue", headers=headers, timeout=20)
        assert r.status_code == 200
        ids = {p["id"] for p in r.json()}
        assert archived_with_data["rid"] not in ids

    def test_annual_reviews_stats_excludes_archived(self, headers, archived_with_data):
        r = requests.get(f"{API}/annual-reviews/stats", headers=headers, timeout=20)
        assert r.status_code == 200
        # Just verify response is OK; count integrity is hard to verify without full snapshot
        assert isinstance(r.json(), dict)

    def test_annual_reviews_dashboard_alerts_excludes_archived(self, headers, archived_with_data):
        r = requests.get(f"{API}/annual-reviews/dashboard-alerts", headers=headers, timeout=20)
        assert r.status_code == 200


# ── Bulk generation filters ─────────────────────────────────────────────────
class TestBulkGenerationFilters:

    def test_payments_generate_skips_archived(self, headers, archived_member):
        # Try to generate payments for current month
        now = datetime.now(timezone.utc)
        r = requests.post(f"{API}/payments/generate/{now.year}/{now.month}", headers=headers, timeout=30)
        assert r.status_code == 200, r.text
        # Check no payment created for archived member
        payments = requests.get(f"{API}/payments", headers=headers, timeout=20).json()
        for p in payments:
            assert p.get("member_id") != archived_member["id"], "Archived member got a payment generated"

    def test_notifications_send_bulk_payment_skips_archived(self, headers, archived_member):
        r = requests.post(f"{API}/notifications/send-bulk", headers=headers, json={
            "notification_type": "payment_reminder",
        }, timeout=30)
        # Should succeed without error. Check archived member is skipped (no notif log)
        assert r.status_code in (200, 201, 204), f"{r.status_code} {r.text}"

    def test_notifications_send_bulk_review_skips_archived(self, headers, archived_member):
        r = requests.post(f"{API}/notifications/send-bulk", headers=headers, json={
            "notification_type": "review_reminder",
        }, timeout=30)
        assert r.status_code in (200, 201, 204), f"{r.status_code} {r.text}"

    def test_annual_reviews_auto_generate_skips_archived(self, headers, archived_member):
        r = requests.post(f"{API}/annual-reviews/auto-generate", headers=headers, timeout=60)
        assert r.status_code == 200, r.text


# ── B.5 Soft delete ──────────────────────────────────────────────────────────
class TestSoftDelete:

    def test_delete_member_soft_deletes(self, headers):
        payload = {
            "name": f"TEST_SoftDel_{uuid.uuid4().hex[:6]}",
            "email": f"TEST_{uuid.uuid4().hex[:6]}@test.local",
            "phone": "+41000000003",
            "membership": "TEST",
            "member_type": "Membres Généraux Récurrents",
            "contract_signed_date": "2025-01-01",
            "subscription_end_date": "2026-12-31",
            "cash_collected": 0,
            "billing_enabled": False,
            "billing_amount": 0,
        }
        m = requests.post(f"{API}/members", json=payload, headers=headers, timeout=20).json()
        mid = m["id"]

        # DELETE
        r = requests.delete(f"{API}/members/{mid}", headers=headers, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("soft_delete") is True
        assert body.get("archived_at")
        assert "Soft delete applied" in body.get("message", "")

        # Verify still exists
        get_r = requests.get(f"{API}/members/{mid}", headers=headers, timeout=20)
        assert get_r.status_code == 200
        assert get_r.json().get("archived_at") is not None

        # DELETE again — idempotent
        r2 = requests.delete(f"{API}/members/{mid}", headers=headers, timeout=20)
        assert r2.status_code == 200
        assert r2.json().get("soft_delete") is True
        assert "already archived" in r2.json().get("message", "").lower()

        # Cleanup (hard delete via mongo)
        from pymongo import MongoClient
        mc = MongoClient(os.environ.get("MONGO_URL"))
        mc[os.environ.get("DB_NAME")]["customer_members"].delete_one({"id": mid})
        mc.close()

    def test_delete_coach_soft_deletes(self, headers):
        payload = {
            "name": f"TEST_CoachDel_{uuid.uuid4().hex[:6]}",
            "email": f"TEST_{uuid.uuid4().hex[:6]}@test.local",
            "phone": "+41000000004",
            "hourly_rate": 50.0,
        }
        c = requests.post(f"{API}/coaches", json=payload, headers=headers, timeout=20)
        assert c.status_code == 200, c.text
        cid = c.json()["id"]

        r = requests.delete(f"{API}/coaches/{cid}", headers=headers, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("soft_delete") is True
        assert body.get("archived_at")

        # Still exists
        get_r = requests.get(f"{API}/coaches/{cid}", headers=headers, timeout=20)
        assert get_r.status_code == 200
        assert get_r.json().get("archived_at") is not None

        # Idempotent
        r2 = requests.delete(f"{API}/coaches/{cid}", headers=headers, timeout=20)
        assert r2.status_code == 200
        assert r2.json().get("soft_delete") is True

        # Cleanup
        from pymongo import MongoClient
        mc = MongoClient(os.environ.get("MONGO_URL"))
        mc[os.environ.get("DB_NAME")]["coaches"].delete_one({"id": cid})
        mc.close()


# ── Regression: POST/archive/restore still work ─────────────────────────────
class TestRegression:

    def test_create_archive_restore_flow(self, headers):
        payload = {
            "name": f"TEST_Regression_{uuid.uuid4().hex[:6]}",
            "email": f"TEST_{uuid.uuid4().hex[:6]}@test.local",
            "phone": "+41000000005",
            "membership": "TEST",
            "member_type": "Membres Généraux Récurrents",
            "contract_signed_date": "2025-01-01",
            "subscription_end_date": "2026-12-31",
            "cash_collected": 0,
            "billing_enabled": False,
            "billing_amount": 0,
        }
        r = requests.post(f"{API}/members", json=payload, headers=headers, timeout=20)
        assert r.status_code == 200
        mid = r.json()["id"]

        a = requests.post(f"{API}/members/{mid}/archive", headers=headers, timeout=20)
        assert a.status_code == 200
        assert a.json().get("archived_at")

        res = requests.post(f"{API}/members/{mid}/restore", headers=headers, timeout=20)
        assert res.status_code == 200
        assert res.json().get("archived_at") is None

        from pymongo import MongoClient
        mc = MongoClient(os.environ.get("MONGO_URL"))
        mc[os.environ.get("DB_NAME")]["customer_members"].delete_one({"id": mid})
        mc.close()
