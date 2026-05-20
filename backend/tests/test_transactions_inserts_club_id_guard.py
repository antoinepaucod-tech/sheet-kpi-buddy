"""Tests régression Phase 3 Batch 6 — défense en profondeur `club_id` sur
les 11 inserts de `routers/transactions.py` (pattern legacy `if club_id`
remplacé par `resolve_club_id_or_fallback` partout, y compris les 4 inserts
qui n'avaient AUCUN club_id du tout).

Endpoints patchés :
  - POST   /transactions             (L147 + cascade rec L175)
  - PUT    /transactions/{id}        (L231 cascade rec create)
  - DELETE /transactions/{id}        (L268 excluded insert)
  - POST   /transactions/bulk        (L288)
  - POST   /categories               (L307)
  - DELETE /excluded/{id}            (L358 restore)
  - POST   /recurring-transactions   (L444)
  - POST   /recurring-transactions/generate/{year}/{month}  (L499)
  - POST   /recurring-validations    (L556)
  - PUT    /transactions/update-monthly-amount              (L685)

Pattern uniforme : 3 cas par endpoint clé (header valide / fallback Versoix /
cascade existing). Test boucle bulk : 1 SEUL log pour N inserts.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from core.config import DEFAULT_CLUB_ID
from routers import transactions as tx_mod


pytestmark = [pytest.mark.regression, pytest.mark.asyncio]


# ────────────────────── Helpers ──────────────────────────────────────────


class _CursorList:
    def __init__(self, docs):
        self._docs = list(docs)

    def sort(self, *_args, **_kwargs):
        return self

    def skip(self, _n):
        return self

    def limit(self, _n):
        return self

    async def to_list(self, _length=None):
        return list(self._docs)


def _make_db(*, existing_tx=None, existing_excl=None, existing_rec=None,
             active_recurring=None):
    """Mock DB minimal couvrant les besoins des 11 endpoints."""
    tx_inserts: list[dict] = []
    rec_inserts: list[dict] = []
    excl_inserts: list[dict] = []
    cat_inserts: list[dict] = []
    val_inserts: list[dict] = []

    txs = MagicMock()
    txs.find_one = AsyncMock(return_value=existing_tx)
    txs.find = MagicMock(return_value=_CursorList([]))
    txs.update_one = AsyncMock(return_value=MagicMock(modified_count=1))
    txs.delete_one = AsyncMock(return_value=MagicMock(deleted_count=1))
    txs.aggregate = MagicMock(return_value=_CursorList([]))

    async def _tx_insert(d):
        tx_inserts.append(d)
        return MagicMock(inserted_id="tx-mock")

    txs.insert_one = AsyncMock(side_effect=_tx_insert)

    recs = MagicMock()
    recs.find_one = AsyncMock(return_value=existing_rec)
    recs.find = MagicMock(return_value=_CursorList(active_recurring or []))
    recs.delete_one = AsyncMock(return_value=MagicMock(deleted_count=1))

    async def _rec_insert(d):
        rec_inserts.append(d)
        return MagicMock(inserted_id="rec-mock")

    recs.insert_one = AsyncMock(side_effect=_rec_insert)

    excl = MagicMock()
    excl.find_one = AsyncMock(return_value=existing_excl)
    excl.find = MagicMock(return_value=_CursorList([]))
    excl.delete_one = AsyncMock(return_value=MagicMock(deleted_count=1))

    async def _excl_insert(d):
        excl_inserts.append(d)
        return MagicMock(inserted_id="excl-mock")

    excl.insert_one = AsyncMock(side_effect=_excl_insert)

    cats = MagicMock()
    cats.find = MagicMock(return_value=_CursorList([]))
    cats.find_one = AsyncMock(return_value={"name": "TestCat", "type": "expense"})

    async def _cat_insert(d):
        cat_inserts.append(d)
        return MagicMock(inserted_id="cat-mock")

    cats.insert_one = AsyncMock(side_effect=_cat_insert)

    vals = MagicMock()
    vals.find_one = AsyncMock(return_value=None)

    async def _val_insert(d):
        val_inserts.append(d)
        return MagicMock(inserted_id="val-mock")

    vals.insert_one = AsyncMock(side_effect=_val_insert)

    members = MagicMock()
    members.find = MagicMock(return_value=_CursorList([]))
    members.count_documents = AsyncMock(return_value=0)
    members.aggregate = MagicMock(return_value=_CursorList([]))

    kpis = MagicMock()
    kpis.find_one = AsyncMock(return_value={})
    kpis.update_one = AsyncMock(return_value=MagicMock(modified_count=1))

    db = MagicMock()
    db.accounting_transactions = txs
    db.recurring_transactions = recs
    db.excluded_recurring_expenses = excl
    db.accounting_categories = cats
    db.recurring_validations = vals
    db.customer_members = members
    db.monthly_kpis = kpis
    return db, {
        "tx": tx_inserts, "rec": rec_inserts,
        "excl": excl_inserts, "cat": cat_inserts, "val": val_inserts,
    }


def _patch(monkeypatch, db):
    monkeypatch.setattr(tx_mod, "db", db)
    # Stub helper recalculate pour éviter side effects
    monkeypatch.setattr(tx_mod, "_auto_recalculate_kpis", AsyncMock(return_value=None))


def _tx_create_payload():
    return tx_mod.TransactionCreate(
        date="2026-06-15",
        description="Test tx",
        amount=100.0,
        type="expense",
        category="TestCat",
    )


# ════════════════════════════════════════════════════════════════════════════
#                          POST /transactions
# ════════════════════════════════════════════════════════════════════════════


async def test_create_transaction_uses_header_club_id(monkeypatch):
    db, captured = _make_db()
    _patch(monkeypatch, db)

    await tx_mod.create_transaction(
        data=_tx_create_payload(),
        club_id="CLUB_HEADER",
        current_user={"id": "u1", "email": "u@a.com"},
    )

    assert len(captured["tx"]) == 1
    assert captured["tx"][0]["club_id"] == "CLUB_HEADER"


async def test_create_transaction_fallback_versoix(monkeypatch, caplog):
    db, captured = _make_db()
    _patch(monkeypatch, db)

    with caplog.at_level("WARNING"):
        await tx_mod.create_transaction(
            data=_tx_create_payload(),
            club_id=None,
            current_user={"id": "u1", "email": "u@a.com"},
        )

    assert captured["tx"][0]["club_id"] == DEFAULT_CLUB_ID
    assert any("MISSING_CLUB_ID" in r.message for r in caplog.records)


# ════════════════════════════════════════════════════════════════════════════
#                          POST /categories
# ════════════════════════════════════════════════════════════════════════════


async def test_create_category_uses_header_club_id(monkeypatch):
    db, captured = _make_db()
    _patch(monkeypatch, db)

    await tx_mod.create_category(
        data=tx_mod.CategoryCreate(name="TestCat", type="expense"),
        club_id="CLUB_HEADER",
        current_user={"id": "u1", "email": "u@a.com"},
    )

    assert captured["cat"][0]["club_id"] == "CLUB_HEADER"


async def test_create_category_fallback(monkeypatch):
    db, captured = _make_db()
    _patch(monkeypatch, db)

    await tx_mod.create_category(
        data=tx_mod.CategoryCreate(name="TestCat", type="expense"),
        club_id=None,
        current_user={"id": "u1", "email": "u@a.com"},
    )

    assert captured["cat"][0]["club_id"] == DEFAULT_CLUB_ID


# ════════════════════════════════════════════════════════════════════════════
#                  POST /transactions/bulk  (test perf cascade)
# ════════════════════════════════════════════════════════════════════════════


async def test_bulk_fallback_single_log_for_N(monkeypatch, caplog):
    """N transactions → 1 SEUL log MISSING_CLUB_ID (resolve 1x hors boucle)."""
    db, captured = _make_db()
    _patch(monkeypatch, db)

    payloads = [_tx_create_payload() for _ in range(4)]

    with caplog.at_level("WARNING"):
        await tx_mod.bulk_import_transactions(
            transactions=payloads,
            club_id=None,
            current_user={"id": "u1", "email": "u@a.com"},
        )

    assert len(captured["tx"]) == 4
    assert all(d["club_id"] == DEFAULT_CLUB_ID for d in captured["tx"])
    missing = [r for r in caplog.records if "MISSING_CLUB_ID" in r.message]
    assert len(missing) == 1, f"1 seul log attendu, got {len(missing)}"


# ════════════════════════════════════════════════════════════════════════════
#                  DELETE /transactions/{id}  (excluded cascade)
# ════════════════════════════════════════════════════════════════════════════


async def test_delete_transaction_creates_excluded_with_club_id(monkeypatch):
    """Suppression d'une tx récurrente → excluded créé avec club_id de la tx (cascade)."""
    existing_tx = {
        "id": "tx1", "club_id": "CLUB_FROM_TX",
        "category": "Loyer", "description": "Local",
        "amount": 1000, "type": "expense", "date": "2026-06-15",
    }
    existing_rec = {"id": "rec1", "category": "Loyer", "description": "Local"}
    db, captured = _make_db(existing_tx=existing_tx, existing_rec=existing_rec)
    _patch(monkeypatch, db)

    await tx_mod.delete_transaction(
        transaction_id="tx1",
        club_id="CLUB_HEADER_IGNORED",
        current_user={"id": "u1", "email": "u@a.com"},
    )

    assert len(captured["excl"]) == 1
    assert captured["excl"][0]["club_id"] == "CLUB_FROM_TX", (
        "L'excluded doit hériter du club_id de la tx (cascade single source)"
    )


# ════════════════════════════════════════════════════════════════════════════
#                  POST /recurring-transactions
# ════════════════════════════════════════════════════════════════════════════


async def test_create_recurring_transaction_uses_header(monkeypatch):
    db, captured = _make_db()
    _patch(monkeypatch, db)

    await tx_mod.create_recurring_transaction(
        data=tx_mod.RecurringTransactionCreate(
            type="expense", category="Loyer", description="Local",
            amount=1000, recurrence_day=1,
        ),
        club_id="CLUB_HEADER",
        current_user={"id": "u1", "email": "u@a.com"},
    )

    assert captured["rec"][0]["club_id"] == "CLUB_HEADER"


# ════════════════════════════════════════════════════════════════════════════
#                  POST /recurring-validations  (cascade rec)
# ════════════════════════════════════════════════════════════════════════════


async def test_validate_recurring_inherits_rec_club_id(monkeypatch):
    existing_rec = {
        "id": "rec1", "category": "X", "description": "Y",
        "amount": 100, "type": "expense", "club_id": "CLUB_FROM_REC",
    }
    db, captured = _make_db(existing_rec=existing_rec)
    _patch(monkeypatch, db)

    await tx_mod.validate_recurring(
        body={"recurring_id": "rec1", "month": "2026-06"},
        club_id="CLUB_HEADER_IGNORED",
        current_user={"id": "u1", "email": "u@a.com"},
    )

    assert captured["val"][0]["club_id"] == "CLUB_FROM_REC", (
        "La validation hérite du club_id de la recurring (cascade)"
    )


async def test_validate_recurring_fallback_when_rec_orphan(monkeypatch):
    existing_rec = {
        "id": "rec1", "category": "X", "description": "Y",
        "amount": 100, "type": "expense", "club_id": None,
    }
    db, captured = _make_db(existing_rec=existing_rec)
    _patch(monkeypatch, db)

    await tx_mod.validate_recurring(
        body={"recurring_id": "rec1", "month": "2026-06"},
        club_id="CLUB_HEADER",
        current_user={"id": "u1", "email": "u@a.com"},
    )

    assert captured["val"][0]["club_id"] == "CLUB_HEADER"


# ════════════════════════════════════════════════════════════════════════════
#                  POST /recurring-transactions/generate/{Y}/{M}
# ════════════════════════════════════════════════════════════════════════════


async def test_generate_monthly_transactions_uses_header(monkeypatch):
    active = [
        {"id": "r1", "category": "Loyer", "description": "Local",
         "amount": 1000, "type": "expense", "recurrence_day": 1},
        {"id": "r2", "category": "Salaire", "description": "Coach",
         "amount": 2000, "type": "expense", "recurrence_day": 15},
    ]
    db, captured = _make_db(active_recurring=active)
    _patch(monkeypatch, db)

    await tx_mod.generate_monthly_transactions(
        year=2026, month=6,
        club_id="CLUB_HEADER",
        current_user={"id": "u1", "email": "u@a.com"},
    )

    assert len(captured["tx"]) == 2
    assert all(d["club_id"] == "CLUB_HEADER" for d in captured["tx"])


async def test_generate_monthly_transactions_fallback_single_log(monkeypatch, caplog):
    """N=3 inserts → 1 SEUL log (resolve hors boucle)."""
    active = [
        {"id": f"r{i}", "category": f"Cat{i}", "description": f"Desc{i}",
         "amount": 100, "type": "expense", "recurrence_day": 1}
        for i in range(3)
    ]
    db, captured = _make_db(active_recurring=active)
    _patch(monkeypatch, db)

    with caplog.at_level("WARNING"):
        await tx_mod.generate_monthly_transactions(
            year=2026, month=6,
            club_id=None,
            current_user={"id": "u1", "email": "u@a.com"},
        )

    assert len(captured["tx"]) == 3
    assert all(d["club_id"] == DEFAULT_CLUB_ID for d in captured["tx"])
    missing = [r for r in caplog.records if "MISSING_CLUB_ID" in r.message]
    assert len(missing) == 1
