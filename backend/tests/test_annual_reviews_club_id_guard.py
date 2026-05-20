"""Tests régression Phase 3 Batch 1 — défense en profondeur `club_id` sur
`routers/annual_reviews.py` (`auto-generate` + `complete` + `skip`).

Patch livré 2026-05-19 après l'audit Phase 2 (les 3 inserts orphelins étaient
les origines de l'orphelin Christine Wambaa 15/05 + futurs).

Pattern de test :
  - 1) header `X-Club-Id` valide → doc inséré avec ce club_id
  - 2) sans header (super_admin / job CRON) → fallback DEFAULT_CLUB_ID + log warning
  - 3) cascade : si `existing.club_id` présent → utilisé en priorité (single
       source of truth, pattern payments.py:567 Sprint Hardening)

Aucune mutation DB réelle : on appelle directement les fonctions async des
endpoints avec des mocks Motor (`AsyncMock` + `MagicMock`).
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from core.config import DEFAULT_CLUB_ID
from routers import annual_reviews as ar


pytestmark = [pytest.mark.regression, pytest.mark.asyncio]


# ──────────────────────────── Helpers ────────────────────────────────────


class _CursorList:
    """Curseur Motor mocké supportant `.sort(...).to_list(N)`."""

    def __init__(self, docs):
        self._docs = list(docs)

    def sort(self, *_args, **_kwargs):
        return self

    async def to_list(self, _length=None):
        return list(self._docs)


def _make_db(*, existing_review=None, members=None, has_scheduled_existing=False):
    """Construit un mock DB minimal pour les 3 endpoints testés.

    Capture toutes les insertions sur `annual_reviews` dans `inserted`.
    """
    inserted: list[dict] = []

    annual_reviews = MagicMock()

    async def _insert(doc):
        inserted.append(doc)
        return MagicMock(inserted_id="mocked")

    annual_reviews.insert_one = AsyncMock(side_effect=_insert)
    # find_one peut être appelé plusieurs fois (existing review, has_scheduled, last_completed)
    # On retourne `existing_review` au 1er find_one, None aux suivants.
    find_one_calls = {"n": 0}

    async def _find_one(*_args, **_kwargs):
        find_one_calls["n"] += 1
        # Premier appel = existing review pour /complete et /skip
        if find_one_calls["n"] == 1 and existing_review is not None:
            return existing_review
        # Pour /auto-generate, le find_one cherche un scheduled existant
        if has_scheduled_existing:
            return {"id": "existing-scheduled"}
        return None

    annual_reviews.find_one = AsyncMock(side_effect=_find_one)
    annual_reviews.update_one = AsyncMock(return_value=MagicMock(modified_count=1))
    annual_reviews.find = MagicMock(return_value=_CursorList([]))

    customer_members = MagicMock()
    customer_members.find = MagicMock(return_value=_CursorList(members or []))
    customer_members.find_one = AsyncMock(
        return_value={"id": "m1", "review_frequency": "monthly"}
    )
    customer_members.update_one = AsyncMock(return_value=MagicMock(modified_count=1))

    db = MagicMock()
    db.annual_reviews = annual_reviews
    db.customer_members = customer_members
    return db, inserted


def _patch_db(monkeypatch, db):
    """Patch `routers.annual_reviews.db` ET `core.activity_log.log_activity`
    (l'endpoint /complete et /skip log une activity_log, on stub)."""
    monkeypatch.setattr(ar, "db", db)
    monkeypatch.setattr(ar, "log_activity", AsyncMock(return_value=None))
    # Phase 3 Bonus : create_review appelle check_member_not_archived → stub
    monkeypatch.setattr(ar, "check_member_not_archived", AsyncMock(return_value=None))


def _eligible_member(mid="m_eligible", name="Alice", contract="2026-01-01"):
    """Membre éligible pour auto-generate (bilan enabled, pas coach, pas hubfit)."""
    return {
        "id": mid,
        "name": name,
        "annual_review_enabled": True,
        "contract_signed_date": contract,
        "membership": "HYBRID FULL",
        "exit_date": None,
        "first_review_date": None,
        "review_frequency": "monthly",
    }


# ════════════════════════════════════════════════════════════════════════════
#                          AUTO-GENERATE  (3 cas)
# ════════════════════════════════════════════════════════════════════════════


async def test_auto_generate_uses_header_club_id(monkeypatch):
    db, inserted = _make_db(members=[_eligible_member()])
    _patch_db(monkeypatch, db)

    await ar.auto_generate_reviews(
        club_id="CLUB_HEADER_X",
        current_user={"id": "u1", "email": "u@a.com"},
    )

    assert len(inserted) == 1, "1 bilan devrait être inséré"
    assert inserted[0]["club_id"] == "CLUB_HEADER_X", (
        "Le club_id du header doit être propagé"
    )


async def test_auto_generate_fallback_to_default_when_no_header(monkeypatch, caplog):
    db, inserted = _make_db(members=[_eligible_member()])
    _patch_db(monkeypatch, db)

    with caplog.at_level("WARNING"):
        await ar.auto_generate_reviews(
            club_id=None,
            current_user={"id": "u-admin", "email": "antoine@example.com"},
        )

    assert inserted[0]["club_id"] == DEFAULT_CLUB_ID, (
        "Sans header X-Club-Id → fallback DEFAULT_CLUB_ID (Versoix)"
    )
    assert any("MISSING_CLUB_ID" in rec.message for rec in caplog.records), (
        "Le warning structuré MISSING_CLUB_ID doit être loggé"
    )


async def test_auto_generate_resolves_club_id_only_once(monkeypatch, caplog):
    """Avec N membres éligibles → 1 seul log warning (resolve hors boucle)."""
    members = [
        _eligible_member(mid=f"m{i}", name=f"User{i}", contract="2026-01-01")
        for i in range(3)
    ]
    db, inserted = _make_db(members=members)
    _patch_db(monkeypatch, db)

    with caplog.at_level("WARNING"):
        await ar.auto_generate_reviews(
            club_id=None,
            current_user={"id": "u1", "email": "x@a.com"},
        )

    assert len(inserted) == 3
    assert all(d["club_id"] == DEFAULT_CLUB_ID for d in inserted)
    missing_logs = [r for r in caplog.records if "MISSING_CLUB_ID" in r.message]
    assert len(missing_logs) == 1, (
        f"Un seul log MISSING_CLUB_ID attendu (resolve hors boucle), got {len(missing_logs)}"
    )


# ════════════════════════════════════════════════════════════════════════════
#                          COMPLETE  (3 cas)
# ════════════════════════════════════════════════════════════════════════════


async def test_complete_inherits_existing_club_id(monkeypatch):
    """Cascade : existing.club_id (single source) > header > fallback."""
    db, inserted = _make_db(existing_review={
        "id": "r1",
        "member_id": "m1",
        "club_id": "CLUB_FROM_EXISTING",
        "review_type": "monthly",
        "review_date": "2026-05-01",
    })
    _patch_db(monkeypatch, db)

    await ar.complete_review(
        review_id="r1",
        body={"weight_current": 70},
        club_id="CLUB_HEADER_OVERRIDE",  # devrait être IGNORÉ car existing.club_id présent
        current_user={"id": "u1", "email": "u@a.com"},
    )

    # 1 insert (next_review auto-scheduled)
    assert len(inserted) == 1
    assert inserted[0]["club_id"] == "CLUB_FROM_EXISTING", (
        "Le club_id de l'existing review doit gagner sur le header (single source)"
    )


async def test_complete_uses_header_when_existing_has_no_club_id(monkeypatch):
    """Si l'existing review est elle-même orpheline → cascade au header."""
    db, inserted = _make_db(existing_review={
        "id": "r1",
        "member_id": "m1",
        "club_id": None,  # orphan legacy
        "review_type": "monthly",
        "review_date": "2026-05-01",
    })
    _patch_db(monkeypatch, db)

    await ar.complete_review(
        review_id="r1",
        body={"weight_current": 70},
        club_id="CLUB_HEADER_VALID",
        current_user={"id": "u1", "email": "u@a.com"},
    )

    assert len(inserted) == 1
    assert inserted[0]["club_id"] == "CLUB_HEADER_VALID", (
        "Sans existing.club_id → utiliser le header"
    )


async def test_complete_fallback_versoix_when_nothing(monkeypatch, caplog):
    """existing orpheline + pas de header → fallback DEFAULT_CLUB_ID."""
    db, inserted = _make_db(existing_review={
        "id": "r1",
        "member_id": "m1",
        "club_id": None,
        "review_type": "monthly",
        "review_date": "2026-05-01",
    })
    _patch_db(monkeypatch, db)

    with caplog.at_level("WARNING"):
        await ar.complete_review(
            review_id="r1",
            body={"weight_current": 70},
            club_id=None,
            current_user={"id": "u1", "email": "u@a.com"},
        )

    assert inserted[0]["club_id"] == DEFAULT_CLUB_ID
    assert any("MISSING_CLUB_ID" in r.message for r in caplog.records)


# ════════════════════════════════════════════════════════════════════════════
#                          SKIP  (3 cas, mêmes principes)
# ════════════════════════════════════════════════════════════════════════════


async def test_skip_inherits_existing_club_id(monkeypatch):
    db, inserted = _make_db(existing_review={
        "id": "r1",
        "member_id": "m1",
        "club_id": "CLUB_FROM_EXISTING",
        "review_type": "monthly",
        "review_date": "2026-05-01",
    })
    _patch_db(monkeypatch, db)

    await ar.skip_review(
        review_id="r1",
        body={"reason": "Vacances"},
        club_id="CLUB_HEADER_OVERRIDE",
        current_user={"id": "u1", "email": "u@a.com"},
    )

    assert len(inserted) == 1
    assert inserted[0]["club_id"] == "CLUB_FROM_EXISTING"


async def test_skip_uses_header_when_existing_orphan(monkeypatch):
    db, inserted = _make_db(existing_review={
        "id": "r1",
        "member_id": "m1",
        "club_id": None,
        "review_type": "monthly",
        "review_date": "2026-05-01",
    })
    _patch_db(monkeypatch, db)

    await ar.skip_review(
        review_id="r1",
        body={},
        club_id="CLUB_HEADER_VALID",
        current_user={"id": "u1", "email": "u@a.com"},
    )

    assert inserted[0]["club_id"] == "CLUB_HEADER_VALID"


async def test_skip_fallback_versoix(monkeypatch, caplog):
    db, inserted = _make_db(existing_review={
        "id": "r1",
        "member_id": "m1",
        "club_id": None,
        "review_type": "monthly",
        "review_date": "2026-05-01",
    })
    _patch_db(monkeypatch, db)

    with caplog.at_level("WARNING"):
        await ar.skip_review(
            review_id="r1",
            body={},
            club_id=None,
            current_user={"id": "u1", "email": "u@a.com"},
        )

    assert inserted[0]["club_id"] == DEFAULT_CLUB_ID
    assert any("MISSING_CLUB_ID" in r.message for r in caplog.records)


# ════════════════════════════════════════════════════════════════════════════
#                  POST /annual-reviews (create_review CRUD)
#                  Phase 3 Bonus — 2026-05-19
# ════════════════════════════════════════════════════════════════════════════


async def test_create_review_uses_header_club_id(monkeypatch):
    """CRUD primaire : header X-Club-Id valide → propagation directe."""
    db, inserted = _make_db()
    _patch_db(monkeypatch, db)

    await ar.create_review(
        data=ar.AnnualReviewCreate(
            member_id="m1",
            review_date="2026-06-01",
            review_type="monthly",
        ),
        club_id="CLUB_HEADER",
        current_user={"id": "u1", "email": "u@a.com"},
    )

    assert len(inserted) == 1
    assert inserted[0]["club_id"] == "CLUB_HEADER"


async def test_create_review_fallback_versoix_no_header(monkeypatch, caplog):
    """CRUD primaire : pas de header → fallback DEFAULT_CLUB_ID + warning log."""
    db, inserted = _make_db()
    _patch_db(monkeypatch, db)

    with caplog.at_level("WARNING"):
        await ar.create_review(
            data=ar.AnnualReviewCreate(
                member_id="m1",
                review_date="2026-06-01",
                review_type="monthly",
            ),
            club_id=None,
            current_user={"id": "u1", "email": "u@a.com"},
        )

    assert inserted[0]["club_id"] == DEFAULT_CLUB_ID
    assert any("MISSING_CLUB_ID" in r.message for r in caplog.records)
