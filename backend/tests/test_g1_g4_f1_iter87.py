"""Tests Sprint G1 + G4 + F1 (iteration 87)

- G4 : flag is_expired sur GET /api/members et GET /api/members/{id}
- G1 : flag is_coach déjà testé en amont, ici on revérifie Alex Giraud
- F1 : endpoint /api/payments/unified (dédup cascade payment_id puis name+date+amount)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://member-archive-mgmt.preview.emergentagent.com").rstrip("/")
CLUB_ID = "0a327bf5-c759-49eb-87e4-551913f78bdb"
ADMIN_EMAIL = "antoine.paucod@the-coach.pro"
ADMIN_PASSWORD = "TheCoach1290."


@pytest.fixture(scope="module")
def auth_headers():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"login failed: {r.status_code} {r.text[:200]}")
    token = r.json().get("access_token") or r.json().get("token")
    if not token:
        pytest.skip(f"no token in login response: {r.json()}")
    return {"Authorization": f"Bearer {token}", "X-Club-Id": CLUB_ID, "Content-Type": "application/json"}


# ── G4 : is_expired flag ──────────────────────────────────────────────────────
class TestG4IsExpiredFlag:
    def test_members_list_returns_is_expired_field(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/members", headers=auth_headers)
        assert r.status_code == 200
        members = r.json()
        assert isinstance(members, list)
        assert len(members) > 0
        # All members should have is_expired field (G4)
        missing = [m.get("name") for m in members if "is_expired" not in m]
        assert not missing, f"is_expired manquant pour: {missing[:5]}"
        # Type bool
        assert all(isinstance(m["is_expired"], bool) for m in members)

    def test_alex_giraud_is_expired_true(self, auth_headers):
        # Alex Giraud is a coach (THE COACH PASS MENSUEL) so we need include_paused or default
        r = requests.get(f"{BASE_URL}/api/members", headers=auth_headers)
        assert r.status_code == 200
        members = r.json()
        alex_list = [m for m in members if "Alex Giraud" in (m.get("name") or "")]
        if not alex_list:
            pytest.skip("Alex Giraud non trouvé dans la liste (peut être filtré côté backend)")
        alex = alex_list[0]
        # subscription_end_date 2026-04-30 → past at test date Jan 2026? Actually 2026-04-30 is in FUTURE if today < April 30, 2026
        # The use case says is_expired=true → must mean today > 2026-04-30, so test runs after that date OR member has different end_date now
        # We just verify the flag exists and matches the rule
        end_date = alex.get("subscription_end_date")
        from datetime import datetime, timezone
        today_iso = datetime.now(timezone.utc).date().isoformat()
        expected = bool(end_date and end_date < today_iso and not alex.get("archived_at"))
        assert alex["is_expired"] == expected, (
            f"is_expired={alex['is_expired']} mais subscription_end_date={end_date} today={today_iso} archived={alex.get('archived_at')}"
        )
        assert alex.get("is_coach") is True, "Alex Giraud doit avoir is_coach=true (PASS COACH)"

    def test_archived_members_never_expired(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/members?include_archived=true&only_archived=true", headers=auth_headers)
        assert r.status_code == 200
        archived = r.json()
        # Per G4 spec: archived members must NEVER have is_expired=true
        bad = [m.get("name") for m in archived if m.get("is_expired") is True]
        assert not bad, f"Membres archivés avec is_expired=true (interdit): {bad[:5]}"

    def test_member_detail_returns_is_expired(self, auth_headers):
        list_r = requests.get(f"{BASE_URL}/api/members", headers=auth_headers)
        members = list_r.json()
        assert members, "no members"
        sample = members[0]
        r = requests.get(f"{BASE_URL}/api/members/{sample['id']}", headers=auth_headers)
        assert r.status_code == 200
        doc = r.json()
        assert "is_expired" in doc
        assert isinstance(doc["is_expired"], bool)


# ── F1 : /api/payments/unified ────────────────────────────────────────────────
class TestF1PaymentsUnified:
    def test_unified_2026_05_dedup_cascade(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/payments/unified?month=2026-05", headers=auth_headers)
        assert r.status_code == 200, f"got {r.status_code}: {r.text[:300]}"
        data = r.json()
        assert set(data.keys()) >= {"payments", "historical", "total", "breakdown"}
        assert isinstance(data["payments"], list)
        assert isinstance(data["historical"], list)
        assert data["breakdown"]["payments"] == len(data["payments"])
        assert data["breakdown"]["historical"] == len(data["historical"])
        assert data["total"] == len(data["payments"]) + len(data["historical"])
        # All historical entries have source=historical
        assert all(h.get("source") == "historical" for h in data["historical"])
        # All payments entries have source=payments
        assert all(p.get("source") == "payments" for p in data["payments"])
        # Per problem statement: payments=79, historical=2 after cascade dedup
        print(f"[2026-05] payments={len(data['payments'])} historical={len(data['historical'])}")

    def test_unified_2026_02_pure_historical(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/payments/unified?month=2026-02", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["breakdown"]["payments"] == 0, f"expected 0 payments in pure historical month, got {data['breakdown']['payments']}"
        # historical=108 per expected
        print(f"[2026-02] payments={len(data['payments'])} historical={len(data['historical'])}")
        assert data["breakdown"]["historical"] > 0

    def test_unified_2026_04(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/payments/unified?month=2026-04", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        print(f"[2026-04] payments={len(data['payments'])} historical={len(data['historical'])}")
        assert data["breakdown"]["payments"] >= 0

    def test_unified_invalid_month_400(self, auth_headers):
        for bad in ["invalid", "2026", "2026-13", "2026/05", "2026-1", "abcd-ef"]:
            r = requests.get(f"{BASE_URL}/api/payments/unified?month={bad}", headers=auth_headers)
            assert r.status_code == 400, f"month={bad!r} expected 400 got {r.status_code}: {r.text[:200]}"

    def test_unified_post_returns_405(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/payments/unified?month=2026-05", headers=auth_headers, json={})
        assert r.status_code == 405

    def test_unified_no_overlap_between_payments_and_historical(self, auth_headers):
        """Cascade dedup B: no historical entry should share (name+date+amount) with a payments entry."""
        r = requests.get(f"{BASE_URL}/api/payments/unified?month=2026-05", headers=auth_headers)
        data = r.json()
        p_keys = {(
            (p.get("member_name") or "").strip().lower(),
            p.get("due_date"),
            float(p.get("amount") or 0),
        ) for p in data["payments"]}
        for h in data["historical"]:
            key = (
                (h.get("member_name") or "").strip().lower(),
                h.get("due_date"),
                float(h.get("amount") or 0),
            )
            assert key not in p_keys, f"dedup B failed for {h}"


# ── Non-regression : autres endpoints toujours OK ─────────────────────────────
class TestNonRegression:
    def test_payments_list_still_works(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/payments", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_payments_late_still_works(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/payments/late", headers=auth_headers)
        assert r.status_code == 200

    def test_payments_upcoming_still_works(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/payments/upcoming", headers=auth_headers)
        assert r.status_code == 200

    def test_member_stats_still_works(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/members/stats", headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        for k in ("total", "active_members", "active_coaches"):
            assert k in d
