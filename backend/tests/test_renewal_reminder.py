"""Régression : POST /api/members/bulk-renewal-reminder + GET /api/marketing/unsubscribe.

Couvre :
  - 401 sans auth sur bulk endpoint
  - 200 avec auth + mail mocké (succès)
  - Cooldown 7j → skipped_cooldown
  - marketing_opt_out=true → skipped_opt_out
  - not_expired → skipped_not_expired
  - no_email → skipped_no_email
  - Unsubscribe token valide → flag passé en DB
  - Unsubscribe token expiré → HTML 400
"""
from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Force UNSUBSCRIBE_SECRET avant import (sinon les helpers JWT lèvent RuntimeError)
os.environ.setdefault("UNSUBSCRIBE_SECRET", "test_unsubscribe_secret_for_pytest")


def _today() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _yesterday() -> str:
    return (datetime.now(timezone.utc).date() - timedelta(days=1)).isoformat()


def _tomorrow() -> str:
    return (datetime.now(timezone.utc).date() + timedelta(days=1)).isoformat()


def _make_expired_member(mid, name, email, **extras):
    base = {
        "id": mid,
        "name": name,
        "email": email,
        "club_id": "club-xyz",
        "membership": "HYBRID GYM",
        "subscription_end_date": _yesterday(),  # expired
        "archived_at": None,
    }
    base.update(extras)
    return base


@pytest.fixture
def app_with_overrides():
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


@pytest.fixture
def patched_db(app_with_overrides):
    """Patch tous les accès Mongo + send_renewal_reminder."""
    from core import config as core_config

    update_calls = []
    insert_calls = []

    members_in_db: dict[str, dict] = {}

    def _set_members(members: list[dict]):
        members_in_db.clear()
        for m in members:
            members_in_db[m["id"]] = dict(m)

    async def _find_cm_to_list(*_args, **_kwargs):
        # Filtre par "id": {"$in": [...]} et club_id
        q = mock_find_cm.last_query or {}
        ids = (q.get("id") or {}).get("$in") or []
        club = q.get("club_id")
        out = []
        for mid in ids:
            m = members_in_db.get(mid)
            if m and m.get("club_id") == club:
                out.append({k: v for k, v in m.items() if k != "_id"})
        return out

    def _find_cm(query, projection=None):
        mock_find_cm.last_query = query
        cur = MagicMock()
        cur.to_list = AsyncMock(side_effect=_find_cm_to_list)
        return cur

    async def _update_one_cm(filt, update):
        mid = filt.get("id")
        m = members_in_db.get(mid)
        if not m:
            return MagicMock(matched_count=0)
        if "$set" in update:
            m.update(update["$set"])
        if "$inc" in update:
            for k, v in update["$inc"].items():
                m[k] = m.get(k, 0) + v
        update_calls.append({"filter": filt, "update": update})
        return MagicMock(matched_count=1)

    async def _find_one_cm(filt, projection=None):
        mid = filt.get("id")
        m = members_in_db.get(mid)
        return dict(m) if m else None

    async def _find_one_club(filt, projection=None):
        return {"id": filt.get("id"), "name": "Hybrid Gym Geneva"}

    async def _activity_insert(doc):
        insert_calls.append(doc)
        return MagicMock(inserted_id="x")

    mock_find_cm = MagicMock()
    mock_find_cm.last_query = None
    mock_find_cm.side_effect = _find_cm

    with patch.object(core_config.db, "customer_members") as mock_cm, \
         patch.object(core_config.db, "clubs") as mock_clubs, \
         patch.object(core_config.db, "activity_logs") as mock_al:
        mock_cm.find = mock_find_cm
        mock_cm.update_one = AsyncMock(side_effect=_update_one_cm)
        mock_cm.find_one = AsyncMock(side_effect=_find_one_cm)
        mock_clubs.find_one = AsyncMock(side_effect=_find_one_club)
        mock_al.insert_one = AsyncMock(side_effect=_activity_insert)

        # Patch send_renewal_reminder : succès silencieux par défaut
        with patch("routers.members.send_renewal_reminder", new=AsyncMock(return_value={"sent": True, "resend_id": "fake_id_123"})) as mock_send:
            yield {
                "set_members": _set_members,
                "members_in_db": members_in_db,
                "update_calls": update_calls,
                "insert_calls": insert_calls,
                "mock_send": mock_send,
            }


# ── BULK RENEWAL REMINDER ────────────────────────────────────────────────────

@pytest.mark.regression
def test_bulk_renewal_requires_auth():
    """401 sans Bearer token."""
    from server import app

    # Pas d'override → exigence get_current_user s'applique réellement
    client = TestClient(app)
    resp = client.post(
        "/api/members/bulk-renewal-reminder",
        json={"member_ids": ["m1"]},
    )
    assert resp.status_code in (401, 403), f"Expected 401/403, got {resp.status_code}"


@pytest.mark.regression
def test_bulk_renewal_happy_path(app_with_overrides, patched_db):
    app, _ = app_with_overrides
    patched_db["set_members"]([
        _make_expired_member("m1", "Alice Dupont", "alice@example.com"),
        _make_expired_member("m2", "Bob Martin", "bob@example.com"),
    ])

    client = TestClient(app)
    resp = client.post(
        "/api/members/bulk-renewal-reminder",
        json={"member_ids": ["m1", "m2"]},
        headers={"Authorization": "Bearer test", "X-Club-Id": "club-xyz"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["sent"] == 2
    assert data["skipped_cooldown"] == 0
    assert data["failed"] == 0

    # Check counters incremented
    assert patched_db["members_in_db"]["m1"]["renewal_reminder_count"] == 1
    assert patched_db["members_in_db"]["m2"]["renewal_reminder_count"] == 1
    assert patched_db["members_in_db"]["m1"]["last_renewal_reminder_at"] is not None

    # send_renewal_reminder appelé 2 fois
    assert patched_db["mock_send"].call_count == 2

    # 1 seul activity_log global (pas 1 par membre)
    assert len(patched_db["insert_calls"]) == 1
    assert patched_db["insert_calls"][0]["action"] == "bulk_renewal_reminder_sent"


@pytest.mark.regression
def test_bulk_renewal_cooldown_skips(app_with_overrides, patched_db):
    app, _ = app_with_overrides
    # last_renewal_reminder_at = il y a 2j → dans la fenêtre cooldown 7j
    recent_iso = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
    patched_db["set_members"]([
        _make_expired_member("m1", "Alice", "alice@example.com", last_renewal_reminder_at=recent_iso, renewal_reminder_count=1),
    ])

    client = TestClient(app)
    resp = client.post(
        "/api/members/bulk-renewal-reminder",
        json={"member_ids": ["m1"]},
        headers={"Authorization": "Bearer test", "X-Club-Id": "club-xyz"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["sent"] == 0
    assert data["skipped_cooldown"] == 1
    # send_renewal_reminder PAS appelé
    assert patched_db["mock_send"].call_count == 0
    # Counter pas incrémenté
    assert patched_db["members_in_db"]["m1"]["renewal_reminder_count"] == 1


@pytest.mark.regression
def test_bulk_renewal_opt_out_skips(app_with_overrides, patched_db):
    app, _ = app_with_overrides
    patched_db["set_members"]([
        _make_expired_member("m1", "Alice", "alice@example.com", marketing_opt_out=True),
    ])

    client = TestClient(app)
    resp = client.post(
        "/api/members/bulk-renewal-reminder",
        json={"member_ids": ["m1"]},
        headers={"Authorization": "Bearer test", "X-Club-Id": "club-xyz"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["sent"] == 0
    assert data["skipped_opt_out"] == 1
    assert patched_db["mock_send"].call_count == 0


@pytest.mark.regression
def test_bulk_renewal_not_expired_skips(app_with_overrides, patched_db):
    app, _ = app_with_overrides
    # subscription_end_date dans le futur → not expired
    patched_db["set_members"]([
        _make_expired_member("m1", "Alice", "alice@example.com", subscription_end_date=_tomorrow()),
    ])

    client = TestClient(app)
    resp = client.post(
        "/api/members/bulk-renewal-reminder",
        json={"member_ids": ["m1"]},
        headers={"Authorization": "Bearer test", "X-Club-Id": "club-xyz"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["sent"] == 0
    assert data["skipped_not_expired"] == 1


@pytest.mark.regression
def test_bulk_renewal_no_email_skips(app_with_overrides, patched_db):
    app, _ = app_with_overrides
    patched_db["set_members"]([
        _make_expired_member("m1", "NoEmail", None),
    ])
    client = TestClient(app)
    resp = client.post(
        "/api/members/bulk-renewal-reminder",
        json={"member_ids": ["m1"]},
        headers={"Authorization": "Bearer test", "X-Club-Id": "club-xyz"},
    )
    assert resp.status_code == 200
    assert resp.json()["skipped_no_email"] == 1


@pytest.mark.regression
def test_bulk_renewal_caps_at_50(app_with_overrides, patched_db):
    app, _ = app_with_overrides
    client = TestClient(app)
    resp = client.post(
        "/api/members/bulk-renewal-reminder",
        json={"member_ids": [f"m{i}" for i in range(51)]},
        headers={"Authorization": "Bearer test", "X-Club-Id": "club-xyz"},
    )
    assert resp.status_code == 400
    assert "50" in resp.json()["detail"]


# ── UNSUBSCRIBE ──────────────────────────────────────────────────────────────

@pytest.mark.regression
def test_unsubscribe_valid_token(app_with_overrides, patched_db):
    """Token JWT signé valide → membre marqué opt_out + page success 200."""
    app, _ = app_with_overrides
    from core.notifications import build_unsubscribe_token

    patched_db["set_members"]([
        _make_expired_member("m1", "Alice", "alice@example.com"),
    ])
    token = build_unsubscribe_token("m1")

    client = TestClient(app)
    resp = client.get(f"/api/marketing/unsubscribe?token={token}")
    assert resp.status_code == 200
    assert "Désinscription confirmée" in resp.text
    # Flag passé en DB
    assert patched_db["members_in_db"]["m1"]["marketing_opt_out"] is True


@pytest.mark.regression
def test_unsubscribe_expired_token(app_with_overrides):
    """Token expiré → page error 400."""
    app, _ = app_with_overrides
    import jwt
    from core.config import JWT_ALGORITHM

    # Forge un token expiré directement (sans passer par build_unsubscribe_token qui force exp futur)
    expired_payload = {
        "scope": "unsubscribe",
        "member_id": "m1",
        "iat": int((datetime.now(timezone.utc) - timedelta(days=40)).timestamp()),
        "exp": int((datetime.now(timezone.utc) - timedelta(days=10)).timestamp()),
    }
    token = jwt.encode(expired_payload, os.environ["UNSUBSCRIBE_SECRET"], algorithm=JWT_ALGORITHM)

    client = TestClient(app)
    resp = client.get(f"/api/marketing/unsubscribe?token={token}")
    assert resp.status_code == 400
    assert "expiré" in resp.text.lower() or "expired" in resp.text.lower()


@pytest.mark.regression
def test_unsubscribe_invalid_token(app_with_overrides):
    """Token random → page error 400."""
    app, _ = app_with_overrides
    client = TestClient(app)
    resp = client.get("/api/marketing/unsubscribe?token=garbage_invalid_token_xyz")
    assert resp.status_code == 400
    assert "invalide" in resp.text.lower() or "invalid" in resp.text.lower()
