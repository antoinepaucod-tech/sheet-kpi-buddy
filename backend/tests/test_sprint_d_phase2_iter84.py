"""
Sprint D Phase 2 — Pause Member + Engagement Widget
Tests PUT /api/members/{id}/pause, DELETE /api/members/{id}/pause,
GET /api/members listing on_pause/include_paused, GET /api/members/at-risk exclusion,
GET /api/members/{id} engagement_recent field, GET /api/onboarding/pending include_paused.
"""
import os
from datetime import date, timedelta
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
VERSOIX_CLUB_ID = "0a327bf5-c759-49eb-87e4-551913f78bdb"
MEMBER_ID = "05430a25-4976-4238-ad7b-c81b2c779967"  # Adrianna Zapata - HG actif

EMAIL = "antoine.paucod@the-coach.pro"
PASSWORD = "TheCoach1290."


@pytest.fixture(scope="session")
def auth_headers():
    for path in ["/api/auth/login", "/api/login"]:
        try:
            r = requests.post(f"{BASE_URL}{path}", json={"email": EMAIL, "password": PASSWORD}, timeout=15)
            if r.status_code == 200:
                data = r.json()
                token = data.get("token") or data.get("access_token") or (data.get("user") or {}).get("token")
                if token:
                    return {"Authorization": f"Bearer {token}", "X-Club-Id": VERSOIX_CLUB_ID}
        except Exception:
            continue
    return {"X-Club-Id": VERSOIX_CLUB_ID}


@pytest.fixture(autouse=True)
def cleanup_pause(auth_headers):
    """Always DELETE pause after each test to keep prod clean."""
    yield
    try:
        requests.delete(f"{BASE_URL}/api/members/{MEMBER_ID}/pause", headers=auth_headers, timeout=15)
    except Exception:
        pass


def _put_pause(headers, body):
    return requests.put(f"{BASE_URL}/api/members/{MEMBER_ID}/pause", headers=headers, json=body, timeout=15)


def _del_pause(headers, mid=MEMBER_ID):
    return requests.delete(f"{BASE_URL}/api/members/{mid}/pause", headers=headers, timeout=15)


def _get(path, headers, params=None):
    return requests.get(f"{BASE_URL}{path}", headers=headers, params=params, timeout=20)


# ─── TEST 1 — PUT /pause active (start<=today<=end) ──────────────────────────
def test_put_pause_active_returns_on_pause_true(auth_headers):
    today = date.today()
    start = (today - timedelta(days=1)).isoformat()
    end = (today + timedelta(days=7)).isoformat()
    r = _put_pause(auth_headers, {"start_date": start, "end_date": end, "reason": "Test vacances"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("on_pause") is True
    assert data.get("pause_start_date") == start
    assert data.get("pause_end_date") == end
    assert data.get("pause_reason") == "Test vacances"


# ─── TEST 3 — PUT /pause sans start_date → 400 ───────────────────────────────
def test_put_pause_missing_start_date_returns_400(auth_headers):
    r = _put_pause(auth_headers, {"end_date": "2026-12-31"})
    assert r.status_code == 400
    assert "start_date" in r.text.lower()


# ─── TEST 4 — PUT /pause end_date < start_date → 400 ─────────────────────────
def test_put_pause_end_before_start_returns_400(auth_headers):
    r = _put_pause(auth_headers, {"start_date": "2026-06-01", "end_date": "2026-05-01"})
    assert r.status_code == 400


# ─── TEST 5 — Pause future (start in future) : on_pause=false, persiste ─────
def test_put_pause_future_on_pause_false_but_persisted(auth_headers):
    today = date.today()
    start = (today + timedelta(days=10)).isoformat()
    end = (today + timedelta(days=20)).isoformat()
    r = _put_pause(auth_headers, {"start_date": start, "end_date": end, "reason": "Future"})
    assert r.status_code == 200
    data = r.json()
    assert data.get("on_pause") is False
    assert data.get("pause_start_date") == start
    assert data.get("pause_end_date") == end

    # Verify also in GET /api/members/{id}
    g = _get(f"/api/members/{MEMBER_ID}", auth_headers)
    assert g.status_code == 200
    gd = g.json()
    assert gd.get("on_pause") is False
    assert gd.get("pause_start_date") == start


# ─── TEST 6 — Pause active : GET listing exclude vs include ────────────────
def test_listing_excludes_paused_by_default_includes_with_flag(auth_headers):
    today = date.today()
    start = (today - timedelta(days=1)).isoformat()
    end = (today + timedelta(days=7)).isoformat()
    r = _put_pause(auth_headers, {"start_date": start, "end_date": end, "reason": "Test listing"})
    assert r.status_code == 200

    # Default — paused EXCLUDED
    r1 = _get("/api/members", auth_headers)
    assert r1.status_code == 200
    ids1 = {m["id"] for m in r1.json()}
    assert MEMBER_ID not in ids1, "Paused member must NOT appear in default listing"

    # include_paused=true — INCLUDED with on_pause=true
    r2 = _get("/api/members", auth_headers, params={"include_paused": "true"})
    assert r2.status_code == 200
    members = r2.json()
    target = next((m for m in members if m["id"] == MEMBER_ID), None)
    assert target is not None, "Paused member must appear when include_paused=true"
    assert target.get("on_pause") is True


# ─── TEST 7 — GET /api/members/at-risk EXCLUT paused ────────────────────────
def test_at_risk_excludes_paused_member(auth_headers):
    today = date.today()
    start = (today - timedelta(days=1)).isoformat()
    end = (today + timedelta(days=14)).isoformat()
    r = _put_pause(auth_headers, {"start_date": start, "end_date": end})
    assert r.status_code == 200

    ar = _get("/api/members/at-risk", auth_headers, params={"weeks": 4})
    assert ar.status_code == 200
    ids = {m["id"] for m in ar.json().get("members", [])}
    assert MEMBER_ID not in ids, "Paused member must NOT appear in at-risk"


# ─── TEST 8 — DELETE /pause clears fields ───────────────────────────────────
def test_delete_pause_clears_fields(auth_headers):
    today = date.today()
    start = today.isoformat()
    end = (today + timedelta(days=5)).isoformat()
    p = _put_pause(auth_headers, {"start_date": start, "end_date": end, "reason": "x"})
    assert p.status_code == 200

    d = _del_pause(auth_headers)
    assert d.status_code == 200

    g = _get(f"/api/members/{MEMBER_ID}", auth_headers)
    assert g.status_code == 200
    data = g.json()
    assert data.get("on_pause") is False
    assert data.get("pause_start_date") in (None, "")
    assert data.get("pause_end_date") in (None, "")
    assert data.get("pause_reason") in (None, "")


# ─── TEST 9 — GET /api/members/{id} engagement_recent shape ─────────────────
def test_engagement_recent_shape(auth_headers):
    g = _get(f"/api/members/{MEMBER_ID}", auth_headers)
    assert g.status_code == 200
    data = g.json()
    eng = data.get("engagement_recent")
    assert eng is not None, "engagement_recent must be present for active HG member"
    assert eng["status"] in {"engaged", "moderate", "at_risk", "on_pause", "not_tracked"}
    assert isinstance(eng["sessions_last_4_weeks"], int)
    assert eng["sessions_last_4_weeks"] >= 0
    assert "last_session_date" in eng
    assert "last_session_iso_week" in eng

    # Logic: 0=at_risk, 1-2=moderate, >=3=engaged (assuming HG tracked category)
    n = eng["sessions_last_4_weeks"]
    if eng.get("category") not in {"OpenGym", "Inconnu", "Pret"} and not data.get("on_pause"):
        if n == 0:
            assert eng["status"] == "at_risk"
        elif n <= 2:
            assert eng["status"] == "moderate"
        else:
            assert eng["status"] == "engaged"


# ─── TEST 10 — Membre en pause → engagement_recent.status='on_pause' ────────
def test_engagement_on_pause_priority(auth_headers):
    today = date.today()
    start = (today - timedelta(days=1)).isoformat()
    end = (today + timedelta(days=7)).isoformat()
    r = _put_pause(auth_headers, {"start_date": start, "end_date": end})
    assert r.status_code == 200

    g = _get(f"/api/members/{MEMBER_ID}", auth_headers)
    assert g.status_code == 200
    data = g.json()
    assert data.get("on_pause") is True
    eng = data.get("engagement_recent")
    assert eng is not None
    assert eng["status"] == "on_pause", f"Expected on_pause priority, got {eng['status']}"


# ─── TEST 11 — Membre OpenGym/Inconnu/Pret → not_tracked ────────────────────
def test_engagement_not_tracked_for_excluded_categories(auth_headers):
    # Find an OpenGym/Inconnu/Pret member in Versoix
    cats = _get("/api/members/categories", auth_headers)
    assert cats.status_code == 200
    cat_map = cats.json()
    target_id = None
    for mid, info in cat_map.items():
        if info.get("category") in {"OpenGym", "Inconnu", "Pret"}:
            target_id = mid
            break
    if not target_id:
        pytest.skip("No OpenGym/Inconnu/Pret member found in Versoix to validate")

    g = _get(f"/api/members/{target_id}", auth_headers)
    assert g.status_code == 200
    eng = g.json().get("engagement_recent")
    assert eng is not None
    assert eng["status"] == "not_tracked"
    assert eng["category"] in {"OpenGym", "Inconnu", "Pret"}


# ─── TEST 13 — Onboarding pending include_paused ────────────────────────────
def test_onboarding_pending_include_paused(auth_headers):
    today = date.today()
    start = (today - timedelta(days=1)).isoformat()
    end = (today + timedelta(days=7)).isoformat()

    # Find a member in pending onboarding to pause
    r0 = _get("/api/onboarding/pending", auth_headers)
    assert r0.status_code == 200
    pending = r0.json()
    if not pending:
        pytest.skip("No pending onboarding members in Versoix")
    target = pending[0]["id"]

    # Pause that member
    p = requests.put(f"{BASE_URL}/api/members/{target}/pause", headers=auth_headers,
                     json={"start_date": start, "end_date": end}, timeout=15)
    assert p.status_code == 200

    try:
        # Default — paused excluded
        r1 = _get("/api/onboarding/pending", auth_headers)
        assert r1.status_code == 200
        ids1 = {m["id"] for m in r1.json()}
        assert target not in ids1, "Paused member must NOT appear in onboarding pending default"

        # include_paused=true — included with on_pause flag
        r2 = _get("/api/onboarding/pending", auth_headers, params={"include_paused": "true"})
        assert r2.status_code == 200
        members = r2.json()
        match = next((m for m in members if m["id"] == target), None)
        assert match is not None, "Paused member must appear when include_paused=true"
        assert match.get("on_pause") is True
    finally:
        requests.delete(f"{BASE_URL}/api/members/{target}/pause", headers=auth_headers, timeout=15)
