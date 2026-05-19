"""Tests régression Phase 3 Batch 2 — défense en profondeur `club_id` sur
`routers/challenges.py` (`add_participant` + cascade 6 bilans hebdo +
`auto-generate-bilans`).

Patch livré 2026-05-19 après Phase 2 trace (origine : challenge_participant
Julia De Pietro 19/05 + multiplicateur x6 sur annual_reviews cascade).

Pattern de test (cohérent avec Batch 1 annual_reviews) :
  - 1) header `X-Club-Id` valide → doc inséré avec ce club_id
  - 2) sans header → fallback DEFAULT_CLUB_ID + 1 SEUL log warning
       (même avec N inserts cascade)
  - 3) cascade : si `challenge.club_id` (parent) présent → utilisé en priorité

Aucune mutation DB réelle : on appelle directement les fonctions async des
endpoints avec mocks Motor (`AsyncMock` + `MagicMock`).
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from core.config import DEFAULT_CLUB_ID
from routers import challenges as ch


pytestmark = [pytest.mark.regression, pytest.mark.asyncio]


# ──────────────────────────── Helpers ────────────────────────────────────


class _CursorList:
    """Curseur Motor mocké : supporte .sort(...).to_list(N)."""

    def __init__(self, docs):
        self._docs = list(docs)

    def sort(self, *_args, **_kwargs):
        return self

    async def to_list(self, _length=None):
        return list(self._docs)


def _make_participant_db(*, challenge_doc, existing_participant=False):
    """Mock DB pour `add_challenge_participant`. Capture :
      - inserts sur `challenge_participants` (1)
      - inserts sur `annual_reviews` (jusqu'à 6 bilans hebdo cascade)
    """
    cp_inserted: list[dict] = []
    ar_inserted: list[dict] = []

    challenges = MagicMock()
    challenges.find_one = AsyncMock(return_value=challenge_doc)

    cp_coll = MagicMock()
    cp_coll.find_one = AsyncMock(
        return_value={"id": "exists"} if existing_participant else None
    )

    async def _cp_insert(doc):
        cp_inserted.append(doc)
        return MagicMock(inserted_id="cp-mock")

    cp_coll.insert_one = AsyncMock(side_effect=_cp_insert)

    ar_coll = MagicMock()
    ar_coll.find_one = AsyncMock(return_value=None)  # aucun bilan existant

    async def _ar_insert(doc):
        ar_inserted.append(doc)
        return MagicMock(inserted_id="ar-mock")

    ar_coll.insert_one = AsyncMock(side_effect=_ar_insert)

    members = MagicMock()
    members.find_one = AsyncMock(return_value={"id": "m1", "name": "Test Member"})
    members.update_one = AsyncMock(return_value=MagicMock(modified_count=1))

    db = MagicMock()
    db.six_weeks_challenges = challenges
    db.challenge_participants = cp_coll
    db.annual_reviews = ar_coll
    db.customer_members = members
    return db, cp_inserted, ar_inserted


def _make_auto_generate_db(*, eligible_members, challenges=None):
    """Mock DB pour `auto_generate_bilans`."""
    ar_inserted: list[dict] = []

    ar_coll = MagicMock()
    ar_coll.find_one = AsyncMock(return_value=None)  # aucun bilan existant

    async def _ar_insert(doc):
        ar_inserted.append(doc)
        return MagicMock(inserted_id="mock")

    ar_coll.insert_one = AsyncMock(side_effect=_ar_insert)

    members = MagicMock()
    members.find = MagicMock(return_value=_CursorList(eligible_members))

    six_weeks = MagicMock()
    six_weeks.find = MagicMock(return_value=_CursorList(challenges or []))

    cp_coll = MagicMock()
    cp_coll.find = MagicMock(return_value=_CursorList([]))

    db = MagicMock()
    db.annual_reviews = ar_coll
    db.customer_members = members
    db.six_weeks_challenges = six_weeks
    db.challenge_participants = cp_coll
    return db, ar_inserted


def _patch_db(monkeypatch, db):
    monkeypatch.setattr(ch, "db", db)
    # check_member_not_archived est utilisé dans add_participant
    monkeypatch.setattr(ch, "check_member_not_archived", AsyncMock(return_value=None))


def _participant_payload():
    """ChallengeParticipantCreate minimal valide."""
    return ch.ChallengeParticipantCreate(
        challenge_id="ch1",
        member_id="m1",
        member_name="Test Member",
    )


# ════════════════════════════════════════════════════════════════════════════
#               add_challenge_participant + cascade x6 bilans
# ════════════════════════════════════════════════════════════════════════════


async def test_participant_inherits_challenge_club_id(monkeypatch):
    """Cascade : challenge.club_id (parent single source) > header > fallback."""
    db, cp_inserted, ar_inserted = _make_participant_db(
        challenge_doc={
            "id": "ch1",
            "club_id": "CLUB_FROM_CHALLENGE",
            "start_date": "2026-05-01T00:00:00",
            "name": "Spring Challenge",
        }
    )
    _patch_db(monkeypatch, db)

    await ch.add_challenge_participant(
        challenge_id="ch1",
        data=_participant_payload(),
        club_id="CLUB_HEADER_OVERRIDE",  # ignoré car challenge.club_id prend
        current_user={"id": "u1", "email": "u@a.com"},
    )

    assert len(cp_inserted) == 1
    assert cp_inserted[0]["club_id"] == "CLUB_FROM_CHALLENGE"
    assert len(ar_inserted) == 6, "6 bilans hebdo cascade attendus"
    assert all(d["club_id"] == "CLUB_FROM_CHALLENGE" for d in ar_inserted), (
        "Tous les bilans cascade doivent porter le club_id du challenge"
    )


async def test_participant_uses_header_when_challenge_orphan(monkeypatch):
    """Si le challenge parent est lui-même orphelin → cascade au header."""
    db, cp_inserted, ar_inserted = _make_participant_db(
        challenge_doc={
            "id": "ch1",
            "club_id": None,  # parent orphan legacy
            "start_date": "2026-05-01T00:00:00",
            "name": "Test",
        }
    )
    _patch_db(monkeypatch, db)

    await ch.add_challenge_participant(
        challenge_id="ch1",
        data=_participant_payload(),
        club_id="CLUB_HEADER_VALID",
        current_user={"id": "u1", "email": "u@a.com"},
    )

    assert cp_inserted[0]["club_id"] == "CLUB_HEADER_VALID"
    assert len(ar_inserted) == 6
    assert all(d["club_id"] == "CLUB_HEADER_VALID" for d in ar_inserted)


async def test_participant_fallback_versoix_emits_single_log(monkeypatch, caplog):
    """Pas de challenge.club_id, pas de header → fallback Versoix + 1 SEUL log.

    Vérifie l'optimisation cascade : `resolved_club_id` calculé 1x hors boucle
    → 1 warning unique, même pour les 7 inserts (1 participant + 6 bilans).
    """
    db, cp_inserted, ar_inserted = _make_participant_db(
        challenge_doc={
            "id": "ch1",
            "club_id": None,
            "start_date": "2026-05-01T00:00:00",
            "name": "Test",
        }
    )
    _patch_db(monkeypatch, db)

    with caplog.at_level("WARNING"):
        await ch.add_challenge_participant(
            challenge_id="ch1",
            data=_participant_payload(),
            club_id=None,
            current_user={"id": "u1", "email": "u@a.com"},
        )

    # Tous les inserts portent DEFAULT_CLUB_ID
    assert cp_inserted[0]["club_id"] == DEFAULT_CLUB_ID
    assert all(d["club_id"] == DEFAULT_CLUB_ID for d in ar_inserted)
    # 1 SEUL log MISSING_CLUB_ID (pas 7)
    missing_logs = [r for r in caplog.records if "MISSING_CLUB_ID" in r.message]
    assert len(missing_logs) == 1, (
        f"1 seul log attendu (resolve hors boucle), got {len(missing_logs)}"
    )


# ════════════════════════════════════════════════════════════════════════════
#                          auto_generate_bilans
# ════════════════════════════════════════════════════════════════════════════


async def test_auto_generate_bilans_uses_header_club_id(monkeypatch):
    members = [
        {"id": "m1", "name": "A", "bilan_frequency": "monthly"},
        {"id": "m2", "name": "B", "bilan_frequency": "monthly"},
    ]
    db, ar_inserted = _make_auto_generate_db(eligible_members=members)
    _patch_db(monkeypatch, db)

    await ch.auto_generate_bilans(
        club_id="CLUB_HEADER",
        current_user={"id": "u1", "email": "u@a.com"},
    )

    assert len(ar_inserted) == 2
    assert all(d["club_id"] == "CLUB_HEADER" for d in ar_inserted)


async def test_auto_generate_bilans_fallback_single_log(monkeypatch, caplog):
    """N membres → 1 SEUL log fallback (resolve hors boucle)."""
    members = [
        {"id": f"m{i}", "name": f"User{i}", "bilan_frequency": "monthly"}
        for i in range(4)
    ]
    db, ar_inserted = _make_auto_generate_db(eligible_members=members)
    _patch_db(monkeypatch, db)

    with caplog.at_level("WARNING"):
        await ch.auto_generate_bilans(
            club_id=None,
            current_user={"id": "u1", "email": "u@a.com"},
        )

    assert len(ar_inserted) == 4
    assert all(d["club_id"] == DEFAULT_CLUB_ID for d in ar_inserted)
    missing_logs = [r for r in caplog.records if "MISSING_CLUB_ID" in r.message]
    assert len(missing_logs) == 1, (
        f"1 seul log attendu (resolve hors boucle), got {len(missing_logs)}"
    )
