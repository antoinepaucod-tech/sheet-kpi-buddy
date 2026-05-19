"""Tests régression Phase 3 Batch 3 — défense en profondeur `club_id` sur
`routers/payments.py`.

Endpoints patchés (3) :
  - POST /payment-schedules                    (L43)  — bug 🐛 confirmé hors orphelin observé
  - POST /payments/sync-with-members           (L81)  — 2 inserts fragiles 🟡 L137 + L225
  - POST /payments/generate/{year}/{month}     (L644) — 🐛 origine des 2 payments
                                                        Mauricio + Valentina 19/05 09:43

Pattern cohérent Batches 1+2 : `resolved_club_id` calculé 1x hors boucle
→ 1 seul log `MISSING_CLUB_ID` même si N membres traités.

0 mutation DB réelle (mocks AsyncMock pure).
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from core.config import DEFAULT_CLUB_ID
from routers import payments as pm


pytestmark = [pytest.mark.regression, pytest.mark.asyncio]


# ──────────────────────────── Helpers ────────────────────────────────────


class _CursorList:
    """Curseur Motor mocké : supporte `.to_list(N)` et `.sort(...).to_list(N)`."""

    def __init__(self, docs):
        self._docs = list(docs)

    def sort(self, *_args, **_kwargs):
        return self

    async def to_list(self, _length=None):
        return list(self._docs)


def _billing_member(mid="m1", name="Test", amount=156.0):
    return {
        "id": mid,
        "name": name,
        "billing_enabled": True,
        "billing_amount": amount,
        "billing_cycle_type": "monthly_day",
        "billing_cycle_value": 1,
        "billing_payment_method": "prelevement",
        "exit_date": None,
        "contract_signed_date": "2026-01-01",
        "duo_partner_id": None,
    }


# ════════════════════════════════════════════════════════════════════════════
#                      POST /payment-schedules  (3 cas)
# ════════════════════════════════════════════════════════════════════════════


async def test_create_payment_schedule_uses_header_club_id(monkeypatch):
    inserted: list[dict] = []
    schedules = MagicMock()

    async def _insert(d):
        inserted.append(d)
        return MagicMock(inserted_id="x")

    schedules.insert_one = AsyncMock(side_effect=_insert)
    db = MagicMock(); db.payment_schedules = schedules
    monkeypatch.setattr(pm, "db", db)

    data = pm.PaymentScheduleCreate(
        member_id="m1",
        amount=200.0,
        recurrence_type="monthly_day",
        recurrence_value=1,
        start_date="2026-06-01",
        payment_method="prelevement",
    )
    await pm.create_payment_schedule(
        data=data,
        club_id="CLUB_HEADER",
        current_user={"id": "u1", "email": "u@a.com"},
    )

    assert inserted[0]["club_id"] == "CLUB_HEADER"


async def test_create_payment_schedule_fallback_versoix(monkeypatch, caplog):
    inserted: list[dict] = []
    schedules = MagicMock()

    async def _insert(d):
        inserted.append(d)
        return MagicMock(inserted_id="x")

    schedules.insert_one = AsyncMock(side_effect=_insert)
    db = MagicMock(); db.payment_schedules = schedules
    monkeypatch.setattr(pm, "db", db)

    data = pm.PaymentScheduleCreate(
        member_id="m1",
        amount=200.0,
        recurrence_type="monthly_day",
        recurrence_value=1,
        start_date="2026-06-01",
        payment_method="prelevement",
    )
    with caplog.at_level("WARNING"):
        await pm.create_payment_schedule(
            data=data,
            club_id=None,
            current_user={"id": "u1", "email": "u@a.com"},
        )

    assert inserted[0]["club_id"] == DEFAULT_CLUB_ID
    assert any("MISSING_CLUB_ID" in r.message for r in caplog.records)


# ════════════════════════════════════════════════════════════════════════════
#                  POST /payments/generate/{year}/{month}
# ════════════════════════════════════════════════════════════════════════════


def _make_generate_db(members):
    """Mock DB pour generate_monthly_payments. Capture les inserts payments."""
    inserted: list[dict] = []
    payments_coll = MagicMock()
    payments_coll.find_one = AsyncMock(return_value=None)  # aucun payment existant

    async def _insert(d):
        inserted.append(d)
        return MagicMock(inserted_id="x")

    payments_coll.insert_one = AsyncMock(side_effect=_insert)

    members_coll = MagicMock()
    members_coll.find = MagicMock(return_value=_CursorList(members))

    db = MagicMock()
    db.payments = payments_coll
    db.customer_members = members_coll
    return db, inserted


async def test_generate_uses_header_club_id(monkeypatch):
    members = [_billing_member(mid="m1", name="Mauricio"),
               _billing_member(mid="m2", name="Valentina")]
    db, inserted = _make_generate_db(members)
    monkeypatch.setattr(pm, "db", db)

    await pm.generate_monthly_payments(
        year=2026, month=6,
        club_id="CLUB_HEADER_VERSOIX",
        current_user={"id": "u1", "email": "u@a.com"},
    )

    assert len(inserted) == 2, "2 payments doivent être créés"
    assert all(d["club_id"] == "CLUB_HEADER_VERSOIX" for d in inserted)


async def test_generate_fallback_single_log_for_N_members(monkeypatch, caplog):
    """Repro exacte du bug 19/05 (Mauricio + Valentina) :
    sans header → fallback Versoix + 1 SEUL warning log pour N inserts."""
    members = [_billing_member(mid=f"m{i}", name=f"User{i}") for i in range(3)]
    db, inserted = _make_generate_db(members)
    monkeypatch.setattr(pm, "db", db)

    with caplog.at_level("WARNING"):
        await pm.generate_monthly_payments(
            year=2026, month=6,
            club_id=None,
            current_user={"id": "u1", "email": "u@a.com"},
        )

    assert len(inserted) == 3
    assert all(d["club_id"] == DEFAULT_CLUB_ID for d in inserted)
    missing = [r for r in caplog.records if "MISSING_CLUB_ID" in r.message]
    assert len(missing) == 1, (
        f"1 seul log attendu (resolve hors boucle), got {len(missing)}"
    )


async def test_generate_skips_amount_zero(monkeypatch):
    """Backward compat : amount=0 toujours skippé (logique métier intacte)."""
    members = [
        _billing_member(mid="m1", name="With Amount", amount=156.0),
        _billing_member(mid="m2", name="Zero Amount", amount=0),
    ]
    db, inserted = _make_generate_db(members)
    monkeypatch.setattr(pm, "db", db)

    await pm.generate_monthly_payments(
        year=2026, month=6,
        club_id="CLUB_X",
        current_user={"id": "u1", "email": "u@a.com"},
    )

    assert len(inserted) == 1, "Le membre amount=0 doit être skippé"
    assert inserted[0]["member_name"] == "With Amount"


# ════════════════════════════════════════════════════════════════════════════
#                    POST /payments/sync-with-members
# ════════════════════════════════════════════════════════════════════════════


def _make_sync_db(members):
    """Mock DB pour sync_payments_with_members."""
    ps_inserted: list[dict] = []
    p_inserted: list[dict] = []

    async def _ps_insert(d):
        ps_inserted.append(d)
        return MagicMock(inserted_id="x")

    async def _p_insert(d):
        p_inserted.append(d)
        return MagicMock(inserted_id="x")

    ps_coll = MagicMock()
    ps_coll.insert_one = AsyncMock(side_effect=_ps_insert)
    ps_coll.delete_many = AsyncMock(return_value=MagicMock(deleted_count=0))

    p_coll = MagicMock()
    p_coll.insert_one = AsyncMock(side_effect=_p_insert)
    p_coll.delete_many = AsyncMock(return_value=MagicMock(deleted_count=0))
    p_coll.find = MagicMock(return_value=_CursorList([]))  # no existing paid

    members_coll = MagicMock()
    members_coll.find = MagicMock(return_value=_CursorList(members))

    db = MagicMock()
    db.payment_schedules = ps_coll
    db.payments = p_coll
    db.customer_members = members_coll
    return db, ps_inserted, p_inserted


async def test_sync_uses_header_club_id(monkeypatch):
    members = [_billing_member(mid="m1", name="A"),
               _billing_member(mid="m2", name="B")]
    db, ps_inserted, p_inserted = _make_sync_db(members)
    monkeypatch.setattr(pm, "db", db)

    await pm.sync_payments_with_members(
        club_id="CLUB_HEADER",
        current_user={"id": "u1", "email": "u@a.com"},
    )

    # 2 schedules (un par membre) + 2 payments (amount > 0)
    assert len(ps_inserted) == 2
    assert all(d["club_id"] == "CLUB_HEADER" for d in ps_inserted)
    assert len(p_inserted) == 2
    assert all(d["club_id"] == "CLUB_HEADER" for d in p_inserted)


async def test_sync_fallback_single_log_for_N_inserts(monkeypatch, caplog):
    """N membres → 4 inserts (2 schedules + 2 payments) → 1 SEUL log fallback."""
    members = [_billing_member(mid="m1"), _billing_member(mid="m2")]
    db, ps_inserted, p_inserted = _make_sync_db(members)
    monkeypatch.setattr(pm, "db", db)

    with caplog.at_level("WARNING"):
        await pm.sync_payments_with_members(
            club_id=None,
            current_user={"id": "u1", "email": "u@a.com"},
        )

    all_inserted = ps_inserted + p_inserted
    assert len(all_inserted) == 4
    assert all(d["club_id"] == DEFAULT_CLUB_ID for d in all_inserted)
    missing = [r for r in caplog.records if "MISSING_CLUB_ID" in r.message]
    assert len(missing) == 1, (
        f"1 seul log attendu (resolve hors boucle), got {len(missing)}"
    )
