"""Tests régression SB B.2.3.B.2.a — scope `club_id` composite sur 3 update_one
customer_members où `current_user` est déjà présent dans la signature :

  - L1188  archive_member  (POST /members/{id}/archive)
  - L1211  restore_member  (POST /members/{id}/restore)
  - L1407  update_member_onboarding  (PUT /members/{id}/onboarding)

Décision architecturale (rappel A.2) : le scope cascade prend le club du
user authentifié (header X-Club-Id), PAS le club du document leak (`existing.club_id`).

Pattern attendu après patch :
  - signature : ajout `club_id: Optional[str] = Depends(get_club_id)`
  - corps : `club_id_resolved = resolve_club_id_or_fallback(club_id, current_user, endpoint=...)`
  - filter : `{"id": member_id, "club_id": club_id_resolved}`

0 mutation DB réelle (mocks `AsyncMock` pure). 0 dépendance entre fichiers test.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from routers import members as mb


pytestmark = [pytest.mark.regression, pytest.mark.asyncio]


CLUB_VERSOIX = "0a327bf5-c759-49eb-87e4-551913f78bdb"
CLUB_OTHER = "FAKE_OTHER_CLUB_B2A"


def _existing_member(**overrides):
    doc = {
        "id": "mem-1",
        "club_id": CLUB_VERSOIX,
        "archived_at": None,
        "name": "Test Member",
        "onboarding_bsport": False,
        "onboarding_hubfit": False,
        "onboarding_nutrition": False,
        "questionnaire_coaching": False,
        "session_introduction": False,
        "onboarding_completed": False,
    }
    doc.update(overrides)
    return doc


def _make_db_mock(member_doc=None):
    members_coll = MagicMock()
    # find_one returns the member (1st call) then the post-update doc (subsequent)
    members_coll.find_one = AsyncMock(return_value=member_doc)
    members_coll.update_one = AsyncMock(return_value=MagicMock(modified_count=1))

    db = MagicMock()
    db.customer_members = members_coll
    return db


def _patch_common(monkeypatch, db):
    monkeypatch.setattr(mb, "db", db)
    monkeypatch.setattr(
        mb,
        "resolve_club_id_or_fallback",
        lambda club_id, current_user, endpoint: club_id or CLUB_VERSOIX,
    )
    monkeypatch.setattr(mb, "log_activity", AsyncMock())


def _update_filter(db):
    """Extrait le filter du premier update_one customer_members."""
    assert db.customer_members.update_one.called, "update_one customer_members non appelé"
    return db.customer_members.update_one.call_args.args[0]


# ════════════════════════════════════════════════════════════════════════════
#   archive_member L1188
# ════════════════════════════════════════════════════════════════════════════


async def test_archive_member_includes_club_id_filter(monkeypatch):
    """POST /members/{id}/archive : filter update_one DOIT scoper club_id (header)."""
    db = _make_db_mock(_existing_member())
    _patch_common(monkeypatch, db)

    await mb.archive_member(
        member_id="mem-1",
        body=None,
        club_id=CLUB_VERSOIX,
        current_user={"id": "u1", "email": "u@a.com"},
    )

    f = _update_filter(db)
    assert f.get("id") == "mem-1"
    assert "club_id" in f, f"archive_member filter sans `club_id` : {f}"
    assert f["club_id"] == CLUB_VERSOIX


async def test_archive_member_cross_club_does_not_leak(monkeypatch):
    """Header X-Club-Id Versoix mais existing.club_id = OTHER : filter scope sur
    le club du USER (header), pas du doc retourné par find_one.
    """
    db = _make_db_mock(_existing_member(club_id=CLUB_OTHER))
    _patch_common(monkeypatch, db)

    await mb.archive_member(
        member_id="mem-1",
        body=None,
        club_id=CLUB_VERSOIX,
        current_user={"id": "u1", "email": "u@a.com"},
    )

    f = _update_filter(db)
    assert f.get("club_id") == CLUB_VERSOIX, (
        f"Cross-club leak : filter aurait dû scoper sur {CLUB_VERSOIX} (header user) "
        f"mais a {f.get('club_id')}"
    )
    assert f.get("club_id") != CLUB_OTHER


# ════════════════════════════════════════════════════════════════════════════
#   restore_member L1211
# ════════════════════════════════════════════════════════════════════════════


async def test_restore_member_includes_club_id_filter(monkeypatch):
    """POST /members/{id}/restore : filter update_one DOIT scoper club_id (header)."""
    db = _make_db_mock(_existing_member(archived_at="2026-05-01T00:00:00+00:00"))
    _patch_common(monkeypatch, db)

    await mb.restore_member(
        member_id="mem-1",
        club_id=CLUB_VERSOIX,
        current_user={"id": "u1", "email": "u@a.com"},
    )

    f = _update_filter(db)
    assert f.get("id") == "mem-1"
    assert "club_id" in f, f"restore_member filter sans `club_id` : {f}"
    assert f["club_id"] == CLUB_VERSOIX


async def test_restore_member_cross_club_does_not_leak(monkeypatch):
    """Header Versoix mais existing.club_id = OTHER : scope reste sur header."""
    db = _make_db_mock(_existing_member(
        club_id=CLUB_OTHER,
        archived_at="2026-05-01T00:00:00+00:00",
    ))
    _patch_common(monkeypatch, db)

    await mb.restore_member(
        member_id="mem-1",
        club_id=CLUB_VERSOIX,
        current_user={"id": "u1", "email": "u@a.com"},
    )

    f = _update_filter(db)
    assert f.get("club_id") == CLUB_VERSOIX
    assert f.get("club_id") != CLUB_OTHER


# ════════════════════════════════════════════════════════════════════════════
#   update_member_onboarding L1407
# ════════════════════════════════════════════════════════════════════════════


async def test_update_member_onboarding_includes_club_id_filter(monkeypatch):
    """PUT /members/{id}/onboarding : filter update_one DOIT scoper club_id."""
    db = _make_db_mock(_existing_member())
    _patch_common(monkeypatch, db)

    await mb.update_member_onboarding(
        member_id="mem-1",
        body={"onboarding_bsport": True},
        club_id=CLUB_VERSOIX,
        current_user={"id": "u1", "email": "u@a.com"},
    )

    f = _update_filter(db)
    assert f.get("id") == "mem-1"
    assert "club_id" in f, f"update_member_onboarding filter sans `club_id` : {f}"
    assert f["club_id"] == CLUB_VERSOIX


async def test_update_member_onboarding_cross_club_does_not_leak(monkeypatch):
    """Header Versoix mais existing.club_id = OTHER : scope reste sur header."""
    db = _make_db_mock(_existing_member(club_id=CLUB_OTHER))
    _patch_common(monkeypatch, db)

    await mb.update_member_onboarding(
        member_id="mem-1",
        body={"onboarding_bsport": True},
        club_id=CLUB_VERSOIX,
        current_user={"id": "u1", "email": "u@a.com"},
    )

    f = _update_filter(db)
    assert f.get("club_id") == CLUB_VERSOIX
    assert f.get("club_id") != CLUB_OTHER
