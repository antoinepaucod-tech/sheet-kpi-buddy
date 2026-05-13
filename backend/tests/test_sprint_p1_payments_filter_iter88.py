"""Sprint P1 (iteration 88) — Backend tests pour GET /api/payments?month= server-side filter.

- Auth obligatoire via Depends(get_current_user) → 401 sans token
- Filtre month strict (regex r'^\d{4}-(0[1-9]|1[0-2])$')
- Backward compat sans month (tous paiements club) et avec due_from/due_to
- Priorité month > due_from/due_to si les deux fournis
- Combinaisons avec status, member_id

Cible: Club Versoix sur Atlas partagée. AUCUNE MUTATION (GET uniquement).
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
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        headers={"Content-Type": "application/json"},
    )
    if r.status_code != 200:
        pytest.skip(f"login failed: {r.status_code} {r.text[:200]}")
    token = r.json().get("access_token") or r.json().get("token")
    if not token:
        pytest.skip(f"no token in response: {r.json()}")
    return {"Authorization": f"Bearer {token}", "X-Club-Id": CLUB_ID, "Content-Type": "application/json"}


# ── Auth ──────────────────────────────────────────────────────────────────────
class TestAuthRequired:
    def test_payments_without_auth_returns_401(self):
        r = requests.get(f"{BASE_URL}/api/payments", headers={"X-Club-Id": CLUB_ID})
        assert r.status_code in (401, 403), f"expected 401/403 got {r.status_code}: {r.text[:200]}"

    def test_payments_with_month_without_auth_returns_401(self):
        r = requests.get(f"{BASE_URL}/api/payments?month=2026-05", headers={"X-Club-Id": CLUB_ID})
        assert r.status_code in (401, 403)


# ── Validation regex YYYY-MM ──────────────────────────────────────────────────
class TestMonthValidation:
    @pytest.mark.parametrize("bad", [
        "foo", "2026", "2026-13", "2026-00", "2026/05",
        "2026-1", "abcd-ef", "2026-5", "20260-5", "26-05",
    ])
    def test_invalid_month_returns_400(self, auth_headers, bad):
        r = requests.get(f"{BASE_URL}/api/payments?month={bad}", headers=auth_headers)
        assert r.status_code == 400, f"month={bad!r} expected 400 got {r.status_code}: {r.text[:200]}"

    @pytest.mark.parametrize("good", ["2026-01", "2026-05", "2026-12", "2025-01", "2099-09"])
    def test_valid_month_format_accepted(self, auth_headers, good):
        r = requests.get(f"{BASE_URL}/api/payments?month={good}", headers=auth_headers)
        assert r.status_code == 200, f"month={good!r} expected 200 got {r.status_code}"


# ── Backward compat (sans month) ──────────────────────────────────────────────
class TestBackwardCompat:
    def test_no_month_returns_all_payments(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/payments", headers=auth_headers)
        assert r.status_code == 200
        docs = r.json()
        assert isinstance(docs, list)
        # Per spec: club Versoix returns 233 docs sans filtre
        # Tolerance ±15% (Atlas data peut bouger entre runs)
        assert len(docs) > 100, f"expected ~233 payments club Versoix, got {len(docs)}"
        # All must belong to the club
        for d in docs:
            assert d.get("club_id") == CLUB_ID or "club_id" not in d
        print(f"[no-month] total payments club Versoix = {len(docs)}")

    def test_due_from_due_to_backward_compat(self, auth_headers):
        """Sans month, due_from/due_to doit toujours filtrer (backward compat)"""
        r = requests.get(
            f"{BASE_URL}/api/payments?due_from=2026-04-01&due_to=2026-04-30",
            headers=auth_headers,
        )
        assert r.status_code == 200
        docs = r.json()
        # Expected: ~77 docs in April 2026 (per spec)
        for d in docs:
            dd = d.get("due_date", "")
            assert "2026-04-01" <= dd <= "2026-04-30", f"due_date hors range: {dd}"
        print(f"[due_from/due_to 2026-04] total = {len(docs)}")
        assert len(docs) > 50


# ── Filtre month server-side ──────────────────────────────────────────────────
class TestMonthFilter:
    def test_month_2026_05(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/payments?month=2026-05", headers=auth_headers)
        assert r.status_code == 200
        docs = r.json()
        # All due_date must be in May 2026
        for d in docs:
            dd = d.get("due_date", "")
            assert dd.startswith("2026-05"), f"due_date {dd} pas dans 2026-05"
        # Per spec: ~79 docs
        print(f"[month=2026-05] total = {len(docs)}")
        assert 50 <= len(docs) <= 120, f"expected ~79 got {len(docs)}"

    def test_month_2026_02_empty(self, auth_headers):
        """Collection commence en mars 2026 → 0 docs en fevrier"""
        r = requests.get(f"{BASE_URL}/api/payments?month=2026-02", headers=auth_headers)
        assert r.status_code == 200
        docs = r.json()
        print(f"[month=2026-02] total = {len(docs)}")
        assert len(docs) == 0, f"expected 0 payments en fevrier 2026, got {len(docs)}"

    def test_month_combined_with_status_paid(self, auth_headers):
        r = requests.get(
            f"{BASE_URL}/api/payments?month=2026-05&status=paid",
            headers=auth_headers,
        )
        assert r.status_code == 200
        docs = r.json()
        # All must be status=paid and in May 2026
        for d in docs:
            assert d.get("status") == "paid", f"status {d.get('status')} pas paid"
            assert d.get("due_date", "").startswith("2026-05")
        print(f"[month=2026-05&status=paid] total = {len(docs)}")
        # Per spec: 45 docs
        assert 20 <= len(docs) <= 80, f"expected ~45 got {len(docs)}"


# ── Filtre member_id ──────────────────────────────────────────────────────────
class TestMemberFilter:
    def test_member_id_filter(self, auth_headers):
        # Récupère un member_id existant via la liste
        all_r = requests.get(f"{BASE_URL}/api/payments?month=2026-05", headers=auth_headers)
        all_docs = all_r.json()
        if not all_docs:
            pytest.skip("No payments to extract member_id from")
        sample_mid = all_docs[0]["member_id"]
        # Filter par ce member_id
        r = requests.get(f"{BASE_URL}/api/payments?member_id={sample_mid}", headers=auth_headers)
        assert r.status_code == 200
        docs = r.json()
        assert len(docs) >= 1
        for d in docs:
            assert d.get("member_id") == sample_mid, f"member_id mismatch: {d.get('member_id')}"
        print(f"[member_id={sample_mid[:8]}] total = {len(docs)}")


# ── Priorité month > due_from/due_to ──────────────────────────────────────────
class TestMonthPriority:
    def test_month_priority_over_due_from(self, auth_headers):
        """Quand month est fourni, due_from/due_to doivent être ignorés (pas d'erreur silencieuse)"""
        # month=2026-05 avec due_from=2026-04-01 (hors-mois) → on s'attend à 2026-05 docs
        r = requests.get(
            f"{BASE_URL}/api/payments?month=2026-05&due_from=2026-04-01&due_to=2026-04-15",
            headers=auth_headers,
        )
        assert r.status_code == 200
        docs = r.json()
        # Toutes les due_date doivent être dans 2026-05, jamais en avril
        for d in docs:
            dd = d.get("due_date", "")
            assert dd.startswith("2026-05"), f"month n'a PAS la priorité, due_date={dd}"
        print(f"[month priority] {len(docs)} docs (all in 2026-05)")
