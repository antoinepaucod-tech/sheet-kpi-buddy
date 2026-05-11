"""Sprint D Phase 3 (D.2 + D.3) — ISO weeks per month + copy-month preview/exec + new attendance_rate formula."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://member-archive-mgmt.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "antoine.paucod@the-coach.pro"
ADMIN_PASSWORD = "TheCoach1290."
VERSOIX_CLUB_ID = "0a327bf5-c759-49eb-87e4-551913f78bdb"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    # Login
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if r.status_code == 200:
        data = r.json()
        token = data.get("access_token") or data.get("token")
        if token:
            s.headers.update({"Authorization": f"Bearer {token}"})
    # Set club
    s.headers.update({"X-Club-Id": VERSOIX_CLUB_ID})
    return s


# ─── D.3 ISO weeks ───────────────────────────────────────────────────────────

class TestIsoWeeks:
    def test_march_2026_has_5_slots(self, session):
        r = session.get(f"{BASE_URL}/api/courses/iso-weeks/2026/3")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["year"] == 2026
        assert data["month"] == 3
        assert data["total_slots"] == 5
        mondays = [s["monday_date"] for s in data["slots"]]
        assert mondays == ["2026-03-02", "2026-03-09", "2026-03-16", "2026-03-23", "2026-03-30"]
        iso_weeks = [s["iso_week"] for s in data["slots"]]
        assert iso_weeks == [10, 11, 12, 13, 14]

    def test_april_2026_has_4_slots_excludes_w14(self, session):
        r = session.get(f"{BASE_URL}/api/courses/iso-weeks/2026/4")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["total_slots"] == 4
        mondays = [s["monday_date"] for s in data["slots"]]
        assert mondays == ["2026-04-06", "2026-04-13", "2026-04-20", "2026-04-27"]
        # Monday 2026-03-30 (W14) must NOT be included
        assert "2026-03-30" not in mondays
        iso_weeks = [s["iso_week"] for s in data["slots"]]
        assert iso_weeks == [15, 16, 17, 18]

    def test_may_2026_4_slots_w19_belongs_to_may(self, session):
        r = session.get(f"{BASE_URL}/api/courses/iso-weeks/2026/5")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["total_slots"] == 4
        mondays = [s["monday_date"] for s in data["slots"]]
        assert mondays == ["2026-05-04", "2026-05-11", "2026-05-18", "2026-05-25"]
        iso_weeks = [s["iso_week"] for s in data["slots"]]
        assert iso_weeks == [19, 20, 21, 22]

    def test_february_2026_has_4_slots(self, session):
        r = session.get(f"{BASE_URL}/api/courses/iso-weeks/2026/2")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["total_slots"] == 4

    def test_invalid_month_13(self, session):
        r = session.get(f"{BASE_URL}/api/courses/iso-weeks/2026/13")
        assert r.status_code == 400
        detail = r.json().get("detail", "")
        assert "Mois invalide" in detail


# ─── D.2 Copy-month preview/exec ─────────────────────────────────────────────

class TestCopyMonthPreview:
    def test_preview_returns_full_shape(self, session):
        r = session.post(
            f"{BASE_URL}/api/courses/copy-month/preview",
            json={"source_month": "2026-03", "dest_month": "2026-04"},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ["source", "dest", "source_count", "dest_count", "will_create", "will_overwrite", "will_keep"]:
            assert k in data, f"missing key {k}: {data}"
        assert isinstance(data["source_count"], int)
        assert isinstance(data["dest_count"], int)
        assert isinstance(data["will_create"], int)
        assert isinstance(data["will_overwrite"], int)
        assert isinstance(data["will_keep"], int)

    def test_preview_same_source_dest_returns_400(self, session):
        r = session.post(
            f"{BASE_URL}/api/courses/copy-month/preview",
            json={"source_month": "2026-03", "dest_month": "2026-03"},
        )
        assert r.status_code == 400
        assert "identiques" in r.json().get("detail", "").lower()

    def test_preview_invalid_format_returns_400(self, session):
        r = session.post(
            f"{BASE_URL}/api/courses/copy-month/preview",
            json={"source_month": "2026-13", "dest_month": "2026-04"},
        )
        assert r.status_code == 400


# ─── D.2 Copy-month execute (SAFE: source vide) ──────────────────────────────

class TestCopyMonthExec:
    def test_execute_empty_source_no_mutation(self, session):
        # Use a definitely-empty source month (2030-01) to avoid mutating prod
        r = session.post(
            f"{BASE_URL}/api/courses/copy-month",
            json={"source_month": "2030-01", "dest_month": "2030-02", "overwrite": True},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("created", 0) == 0
        assert data.get("overwritten", 0) == 0
        assert "Aucun cours" in data.get("message", "")

    def test_execute_same_source_dest_400(self, session):
        r = session.post(
            f"{BASE_URL}/api/courses/copy-month",
            json={"source_month": "2026-04", "dest_month": "2026-04", "overwrite": True},
        )
        assert r.status_code == 400


# ─── D.3 New attendance_rate formula (READ-ONLY validation) ─────────────────

class TestAttendanceRateFormula:
    def test_put_course_recomputes_with_new_formula(self, session):
        """Pick an existing course in past month (so all slots elapsed) and validate the formula.
        Strategy: fetch a course from 2026-03 (March), record original attendance_rate + weeks,
        send PUT with the SAME values, expect attendance_rate to remain consistent with formula:
        rate = sum(weekN_attendance for elapsed slots) / (max_capacity * len(elapsed_slots)) * 100.
        """
        # Get a March 2026 course
        r = session.get(f"{BASE_URL}/api/courses?year=2026&month=3")
        assert r.status_code == 200, r.text
        courses = r.json()
        if not courses:
            pytest.skip("No March 2026 courses to test")
        # Pick a course with max_capacity > 0
        course = next((c for c in courses if (c.get("max_capacity") or 0) > 0), None)
        if not course:
            pytest.skip("No course with max_capacity")

        course_id = course["id"]
        # PUT with same week values (no-op semantic, but recomputes rate)
        same_body = {
            "week1_attendance": course.get("week1_attendance") or 0,
        }
        r = session.put(f"{BASE_URL}/api/courses/{course_id}", json=same_body)
        assert r.status_code == 200, r.text
        updated = r.json()

        # Compute expected rate from updated doc using March 2026 slots (5 slots, all elapsed since today is Jan 2026? actually March 2026 is FUTURE today)
        # If month is in future, no slots elapsed → rate=0
        # If month is past, all slots elapsed → rate = sum/(cap*5)*100
        from datetime import date
        today = date.today()
        slots_resp = session.get(f"{BASE_URL}/api/courses/iso-weeks/2026/3").json()
        elapsed = [s for s in slots_resp["slots"] if date.fromisoformat(s["monday_date"]) <= today]
        cap = int(updated.get("max_capacity") or 0)
        if not elapsed or cap <= 0:
            expected = 0.0
        else:
            total = sum(int(updated.get(f"week{s['slot']}_attendance") or 0) for s in elapsed)
            expected = round((total / (cap * len(elapsed))) * 100, 1)

        assert abs(float(updated["attendance_rate"]) - expected) < 0.2, (
            f"Expected {expected}, got {updated['attendance_rate']} "
            f"(elapsed={len(elapsed)}, cap={cap})"
        )
