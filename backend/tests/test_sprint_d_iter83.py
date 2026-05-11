"""Sprint D Phase 1 — Tests for /api/members/at-risk endpoint (iter 83).

Covers:
- BACKEND Test 1: Default weeks=2 returns shape {period, total, members:[]}
- BACKEND Test 2: weeks=4 excludes OpenGym/Inconnu/Pret categories
- BACKEND Test 3: weeks=20 clamps to 12 max, returns 200
- BACKEND Test 4: weeks_without_session coherent, =999 if never trained
- BACKEND Test 5: sort by weeks_without_session DESC then name ASC
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://member-archive-mgmt.preview.emergentagent.com").rstrip("/")
VERSOIX_CLUB_ID = "0a327bf5-c759-49eb-87e4-551913f78bdb"

ADMIN_EMAIL = "antoine.paucod@the-coach.pro"
ADMIN_PASSWORD = "TheCoach1290."

EXCLUDED_CATS = {"OpenGym", "Inconnu", "Pret"}


@pytest.fixture(scope="module")
def auth_headers():
    s = requests.Session()
    # Try common login endpoints
    for path in ["/api/auth/login", "/api/login", "/api/users/login"]:
        try:
            r = s.post(f"{BASE_URL}{path}", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
            if r.status_code == 200:
                data = r.json()
                token = data.get("token") or data.get("access_token") or (data.get("user") or {}).get("token")
                if token:
                    return {"Authorization": f"Bearer {token}", "X-Club-Id": VERSOIX_CLUB_ID}
        except Exception:
            continue
    # Fallback: no auth, just club header (endpoint may be open in preview)
    return {"X-Club-Id": VERSOIX_CLUB_ID}


def _get(path, headers, params=None):
    return requests.get(f"{BASE_URL}{path}", headers=headers, params=params, timeout=30)


# Test 1 — default weeks=2 returns shape
def test_at_risk_default_shape(auth_headers):
    r = _get("/api/members/at-risk", auth_headers)
    assert r.status_code == 200, f"Status {r.status_code}: {r.text[:300]}"
    data = r.json()
    assert "period" in data
    assert "total" in data
    assert "members" in data
    assert isinstance(data["members"], list)
    assert data["period"]["weeks"] == 2
    assert isinstance(data["period"]["iso_weeks"], list)
    assert len(data["period"]["iso_weeks"]) == 2
    assert data["total"] == len(data["members"])
    print(f"Test 1 OK — total={data['total']} for weeks=2 (Versoix)")


# Test 2 — weeks=4 excludes OpenGym/Inconnu/Pret
def test_at_risk_excludes_categories(auth_headers):
    r = _get("/api/members/at-risk", auth_headers, params={"weeks": 4})
    assert r.status_code == 200
    data = r.json()
    assert data["period"]["weeks"] == 4
    assert len(data["period"]["iso_weeks"]) == 4
    for m in data["members"]:
        assert m["category"] not in EXCLUDED_CATS, f"Excluded category leaked: {m['category']} for {m.get('name')}"
    print(f"Test 2 OK — weeks=4 total={data['total']}, no excluded categories")


# Test 3 — weeks=20 clamps to 12
def test_at_risk_clamp_max(auth_headers):
    r = _get("/api/members/at-risk", auth_headers, params={"weeks": 20})
    assert r.status_code == 200
    data = r.json()
    assert data["period"]["weeks"] == 12, f"Expected clamp to 12, got {data['period']['weeks']}"
    assert len(data["period"]["iso_weeks"]) == 12
    print(f"Test 3 OK — weeks=20 clamped to 12, total={data['total']}")


# Test 3b — weeks=0 falls back to default 2 (because of `int(weeks or 2)`)
def test_at_risk_zero_defaults_to_two(auth_headers):
    r = _get("/api/members/at-risk", auth_headers, params={"weeks": 0})
    assert r.status_code == 200
    data = r.json()
    # weeks=0 is falsy → default 2 (current implementation behavior)
    assert data["period"]["weeks"] == 2
    print(f"Test 3b OK — weeks=0 defaults to 2 (intended fallback)")


# Test 4 — weeks_without_session coherent
def test_weeks_without_session_coherent(auth_headers):
    r = _get("/api/members/at-risk", auth_headers, params={"weeks": 2})
    assert r.status_code == 200
    data = r.json()
    sample = data["members"][:30]
    for m in sample:
        wno = m["weeks_without_session"]
        assert isinstance(wno, int)
        assert wno >= 0
        if m.get("last_session_iso_week") is None:
            assert wno == 999, f"Never-trained member should have 999, got {wno} for {m.get('name')}"
        else:
            assert wno < 999, f"Member with last_session should have wno<999"
    print(f"Test 4 OK — weeks_without_session coherent on {len(sample)} sample rows")


# Test 5 — sort order DESC by weeks_without_session, then name ASC
def test_sort_order(auth_headers):
    r = _get("/api/members/at-risk", auth_headers, params={"weeks": 2})
    assert r.status_code == 200
    data = r.json()
    members = data["members"]
    if len(members) < 2:
        pytest.skip("Not enough members to test sort")
    for i in range(len(members) - 1):
        a, b = members[i], members[i + 1]
        if a["weeks_without_session"] < b["weeks_without_session"]:
            pytest.fail(f"Sort DESC broken at idx {i}: {a['weeks_without_session']} < {b['weeks_without_session']}")
        if a["weeks_without_session"] == b["weeks_without_session"]:
            if a["name"].lower() > b["name"].lower():
                pytest.fail(f"Name ASC broken at idx {i}: '{a['name']}' > '{b['name']}'")
    print(f"Test 5 OK — sort verified on {len(members)} rows")


# Non-regression — basic endpoints still up
def test_non_regression_members_endpoint(auth_headers):
    r = _get("/api/members", auth_headers)
    assert r.status_code == 200, f"Members list broken: {r.status_code}"
    print(f"Non-reg OK — /api/members returns {r.status_code}")


def test_non_regression_categories_stats(auth_headers):
    r = _get("/api/members/categories/stats", auth_headers)
    assert r.status_code == 200, f"Categories stats broken: {r.status_code}"
    data = r.json()
    assert "total" in data
    print(f"Non-reg OK — categories stats total={data['total']}")
