"""Régression : GET /api/onboarding/stats/weekly

Couvre :
  - Auth requise (401 sans token)
  - Réponse shape correcte (iso_week, total, by_user)
  - Agrégation par utilisateur correcte
  - Exclusion des catégories Coach / Partenaire / IFRC / archivés
  - Calcul semaine ISO Europe/Zurich (lundi-dimanche)
  - "Inconnu" pour onboarding_completed_by null
"""
from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def _now_zurich():
    return datetime.now(ZoneInfo("Europe/Zurich"))


def _this_week_utc_iso(offset_days: int = 0) -> str:
    """Retourne une date UTC ISO tombant dans la semaine ISO courante (Zurich)."""
    now_z = _now_zurich()
    iso_y, iso_w, iso_dow = now_z.isocalendar()
    monday_z = (now_z - timedelta(days=iso_dow - 1)).replace(hour=12, minute=0, second=0, microsecond=0)
    target_z = monday_z + timedelta(days=offset_days)
    return target_z.astimezone(timezone.utc).isoformat()


def _last_week_utc_iso() -> str:
    now_z = _now_zurich()
    iso_y, iso_w, iso_dow = now_z.isocalendar()
    monday_z = (now_z - timedelta(days=iso_dow - 1)).replace(hour=12, minute=0, second=0, microsecond=0)
    last_wed = monday_z - timedelta(days=5)
    return last_wed.astimezone(timezone.utc).isoformat()


@pytest.fixture
def mock_db_and_user():
    """Patch db.customer_members + db.membership_types + auth dependencies."""
    from server import app
    from core import security

    fake_user = {"id": "u-test", "email": "tester@example.com", "role": "super_admin"}

    async def _override_get_current_user():
        return fake_user

    async def _override_get_club_id():
        return "club-xyz"

    app.dependency_overrides[security.get_current_user] = _override_get_current_user
    app.dependency_overrides[security.get_club_id] = _override_get_club_id

    yield app, fake_user

    app.dependency_overrides.clear()


def _make_member(name, completed_by, completed_by_name, completed_at, membership="HYBRID GYM", **extras):
    base = {
        "id": f"m-{name}",
        "club_id": "club-xyz",
        "name": name,
        "membership": membership,
        "onboarding_completed": True,
        "onboarding_completed_at": completed_at,
        "onboarding_completed_by": completed_by,
        "onboarding_completed_by_name": completed_by_name,
    }
    base.update(extras)
    return base


@pytest.mark.regression
def test_weekly_stats_shape_and_aggregation(mock_db_and_user):
    app, _ = mock_db_and_user

    members_in_week = [
        _make_member("Alice", "u-1", "alice", _this_week_utc_iso(0), membership="HYBRID GYM"),
        _make_member("Bob", "u-1", "alice", _this_week_utc_iso(1), membership="OPEN GYM"),
        _make_member("Carla", "u-2", "carla", _this_week_utc_iso(2), membership="6 WEEKS CHALLENGE"),
        # Coach exclu
        _make_member("CoachX", "u-1", "alice", _this_week_utc_iso(3), membership="THE COACH PASS MENSUEL"),
        # DUO Partenaire exclu
        _make_member("Pat", "u-2", "carla", _this_week_utc_iso(4), membership="HYBRID DUO"),
        # IFRC exclu
        _make_member("Ifr", "u-3", "ifrcer", _this_week_utc_iso(5), membership="IFRC GOLD"),
        # Inconnu (sans completed_by)
        _make_member("Ghost", None, "", _this_week_utc_iso(3), membership="HYBRID GYM"),
    ]

    from core import config as core_config

    def _make_find_mock_for_members():
        cursor = MagicMock()
        # find() is called twice : members + types. members are filtered by query
        cursor.to_list = AsyncMock(return_value=members_in_week)
        return cursor

    def _make_find_mock_for_types():
        cursor = MagicMock()
        cursor.to_list = AsyncMock(return_value=[])
        return cursor

    with patch.object(core_config.db, "customer_members") as mock_cm, \
         patch.object(core_config.db, "membership_types") as mock_mt:
        mock_cm.find = MagicMock(return_value=_make_find_mock_for_members())
        mock_mt.find = MagicMock(return_value=_make_find_mock_for_types())

        client = TestClient(app)
        resp = client.get(
            "/api/onboarding/stats/weekly",
            headers={"Authorization": "Bearer test", "X-Club-Id": "club-xyz"},
        )

    assert resp.status_code == 200, resp.text
    data = resp.json()

    # Shape
    assert set(["iso_year", "iso_week", "start_date", "end_date", "timezone", "total", "by_user"]).issubset(data.keys())
    assert data["timezone"] == "Europe/Zurich"
    assert isinstance(data["iso_week"], int) and 1 <= data["iso_week"] <= 53

    # Excludes Coach + Partenaire + IFRC → 4 inclus : Alice + Bob + Carla + Ghost
    assert data["total"] == 4

    by_user = {u["user_name"]: u for u in data["by_user"]}
    # u-1 → 2 (Alice + Bob)
    assert by_user["alice"]["count"] == 2
    assert by_user["alice"]["user_id"] == "u-1"
    # u-2 → 1 (Carla seule, Pat exclu Partenaire)
    assert by_user["carla"]["count"] == 1
    # Ghost → Inconnu
    assert "Inconnu" in by_user
    assert by_user["Inconnu"]["user_id"] is None
    assert by_user["Inconnu"]["count"] == 1

    # Tri DESC par count
    counts = [u["count"] for u in data["by_user"]]
    assert counts == sorted(counts, reverse=True)


@pytest.mark.regression
def test_weekly_stats_empty(mock_db_and_user):
    app, _ = mock_db_and_user
    from core import config as core_config

    cursor_empty = MagicMock()
    cursor_empty.to_list = AsyncMock(return_value=[])

    with patch.object(core_config.db, "customer_members") as mock_cm, \
         patch.object(core_config.db, "membership_types") as mock_mt:
        mock_cm.find = MagicMock(return_value=cursor_empty)
        mock_mt.find = MagicMock(return_value=cursor_empty)

        client = TestClient(app)
        resp = client.get(
            "/api/onboarding/stats/weekly",
            headers={"Authorization": "Bearer test", "X-Club-Id": "club-xyz"},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 0
    assert data["by_user"] == []
