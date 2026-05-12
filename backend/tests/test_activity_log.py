"""Tests unitaires pour core/activity_log.log_activity (Sprint Hardening, 2026-05-12).

Mocks asynchrones de Motor pour valider la cascade :
    explicit_club_id > member.club_id > current_user.active_club_id > fallback Versoix.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock

from core.activity_log import log_activity
from core.config import DEFAULT_CLUB_ID


def _make_db(member_doc=None):
    """Construit un mock db avec :
    - db.customer_members.find_one(...)
    - db.activity_logs.insert_one(...)
    Retourne (db, captured_inserts: list).
    """
    captured = []

    members = MagicMock()
    members.find_one = AsyncMock(return_value=member_doc)

    logs = MagicMock()
    async def _capture(doc):
        captured.append(doc)
        return MagicMock(inserted_id="mock-id")
    logs.insert_one = AsyncMock(side_effect=_capture)

    db = MagicMock()
    db.customer_members = members
    db.activity_logs = logs
    return db, captured


@pytest.mark.asyncio
async def test_member_with_club_id_used():
    """Cas 1 : member_id valide avec club_id en base → utilisé."""
    db, captured = _make_db(member_doc={"club_id": "CLUB_ALPHA"})
    await log_activity(db, action="test_action", description="desc", member_id="m1")
    assert captured[0]["club_id"] == "CLUB_ALPHA"


@pytest.mark.asyncio
async def test_member_without_club_id_fallback_to_user():
    """Cas 2 : member orphelin (pas de club_id) → fallback sur current_user.active_club_id."""
    db, captured = _make_db(member_doc={"club_id": None})
    await log_activity(
        db,
        action="test",
        description="d",
        member_id="m1",
        current_user={"id": "u1", "email": "u@a.com", "active_club_id": "CLUB_USER"},
    )
    assert captured[0]["club_id"] == "CLUB_USER"
    assert captured[0]["created_by_user_id"] == "u1"
    assert captured[0]["created_by_email"] == "u@a.com"
    assert captured[0]["user_name"] == "u"  # email.split("@")[0]


@pytest.mark.asyncio
async def test_no_member_no_user_fallback_versoix():
    """Cas 3 : pas de member_id, pas de user → fallback Versoix + warning log."""
    db, captured = _make_db()
    await log_activity(db, action="cron_action", description="d")
    assert captured[0]["club_id"] == DEFAULT_CLUB_ID
    assert captured[0]["user_name"] == "Système"
    assert "created_by_user_id" not in captured[0]


@pytest.mark.asyncio
async def test_explicit_club_id_overrides_everything():
    """Cas 4 : explicit_club_id fourni → gagne sur member.club_id et user.active_club_id."""
    db, captured = _make_db(member_doc={"club_id": "CLUB_MEMBER"})
    await log_activity(
        db,
        action="t",
        description="d",
        member_id="m1",
        current_user={"id": "u1", "email": "u@a.com", "active_club_id": "CLUB_USER"},
        explicit_club_id="CLUB_EXPLICIT",
    )
    assert captured[0]["club_id"] == "CLUB_EXPLICIT"


@pytest.mark.asyncio
async def test_member_not_found_fallback_to_user():
    """Cas 5 : member_id fourni mais inconnu (find_one renvoie None) → fallback user."""
    db, captured = _make_db(member_doc=None)
    await log_activity(
        db,
        action="t",
        description="d",
        member_id="ghost",
        current_user={"id": "u1", "email": "u@a.com", "active_club_id": "CLUB_USER"},
    )
    assert captured[0]["club_id"] == "CLUB_USER"


@pytest.mark.asyncio
async def test_doc_shape_basic_fields():
    """Cas 6 : forme du doc inséré (id UUID, action, description, member_id, created_at ISO)."""
    db, captured = _make_db(member_doc={"club_id": "X"})
    await log_activity(db, action="my_action", description="my desc", member_id="m42")
    doc = captured[0]
    assert doc["action"] == "my_action"
    assert doc["description"] == "my desc"
    assert doc["member_id"] == "m42"
    assert len(doc["id"]) == 36  # UUID4 string
    # created_at ISO string with timezone
    assert "T" in doc["created_at"] and "+" in doc["created_at"]
