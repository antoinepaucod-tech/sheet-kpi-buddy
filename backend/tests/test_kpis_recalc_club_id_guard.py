"""Tests régression Phase 3 Batch 5 — défense en profondeur `club_id` sur
`routers/kpis.py::recalculate_month` et `routers/transactions.py::_auto_recalculate_kpis`.

Découverte audit ÉTAPE 0 :
  - kpis.py:71, kpis.py:119, ghl.py:180, ghl.py:478 → DÉJÀ patchés par
    Sprint Hardening 12/05 (mon audit Phase 2 avait fait des faux positifs).
  - kpis.py:570 et transactions.py:96 → 2 upserts vulnérables (le filter
    `{"month": M}` sans club_id matche cross-club ; le `$set` ne contient
    pas club_id donc upsert crée un orphelin).

Pattern adapté (cohérent Batch 4 rollover.py) : ces helpers ne reçoivent
pas de `current_user`, donc `club_id is None` → log warning + SKIP (vs
créer un orphelin ou polluer cross-club). C'est plus sûr que fallback
Versoix car ces helpers peuvent toucher accidentellement n'importe quel club.

Cas critique testé :
  - 2 clubs même month → l'upsert avec filter scopé garantit qu'ils restent
    séparés (preuve d'absence de bug cross-club).
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from routers import kpis as kpis_mod
from routers import transactions as tx_mod


pytestmark = [pytest.mark.regression, pytest.mark.asyncio]


class _CursorList:
    def __init__(self, docs):
        self._docs = list(docs)

    def sort(self, *_args, **_kwargs):
        return self

    async def to_list(self, _length=None):
        return list(self._docs)


# ════════════════════════════════════════════════════════════════════════════
#               recalculate_month (kpis.py:570 upsert)
# ════════════════════════════════════════════════════════════════════════════


def _make_kpi_db():
    """Mock DB minimal pour recalculate_month : capture les update_one calls."""
    calls: list[dict] = []

    async def _update(filter_q, update_q, upsert=False):
        calls.append({"filter": filter_q, "update": update_q, "upsert": upsert})
        return MagicMock(modified_count=1)

    kpis_coll = MagicMock()
    kpis_coll.find_one = AsyncMock(return_value={})  # no existing
    kpis_coll.update_one = AsyncMock(side_effect=_update)

    cats_coll = MagicMock()
    cats_coll.find = MagicMock(return_value=_CursorList([]))

    txs_coll = MagicMock()
    txs_coll.find = MagicMock(return_value=_CursorList([]))
    txs_coll.aggregate = MagicMock(return_value=_CursorList([]))

    members_coll = MagicMock()
    members_coll.find = MagicMock(return_value=_CursorList([]))
    members_coll.aggregate = MagicMock(return_value=_CursorList([]))
    members_coll.count_documents = AsyncMock(return_value=0)

    ghl_coll = MagicMock()
    ghl_coll.find = MagicMock(return_value=_CursorList([]))

    db = MagicMock()
    db.monthly_kpis = kpis_coll
    db.accounting_categories = cats_coll
    db.accounting_transactions = txs_coll
    db.customer_members = members_coll
    db.ghl_sales = ghl_coll
    return db, calls


async def test_recalculate_month_skips_when_club_id_is_none(monkeypatch, caplog):
    """club_id=None → skip + log structuré, AUCUN update_one."""
    db, calls = _make_kpi_db()
    monkeypatch.setattr(kpis_mod, "db", db)

    with caplog.at_level("WARNING"):
        result = await kpis_mod.recalculate_month("2026-06", club_id=None)

    assert result == {"error": "club_id required for recalculate"}
    assert calls == [], "Aucun update_one ne doit avoir lieu"
    matching = [r for r in caplog.records if "KPI_RECALC_MISSING_CLUB_ID" in r.message]
    assert len(matching) == 1
    assert "event=skip_recalculate_month" in matching[0].message


async def test_recalculate_month_includes_club_id_in_set(monkeypatch):
    """club_id valide → l'upsert filter ET le $set contiennent club_id."""
    db, calls = _make_kpi_db()
    monkeypatch.setattr(kpis_mod, "db", db)

    await kpis_mod.recalculate_month("2026-06", club_id="CLUB_VERSOIX")

    assert len(calls) == 1
    call = calls[0]
    assert call["upsert"] is True
    # Filter contient le club_id
    assert call["filter"].get("club_id") == "CLUB_VERSOIX"
    assert call["filter"].get("month") == "2026-06"
    # $set contient le club_id (anti-orphan)
    assert call["update"]["$set"].get("club_id") == "CLUB_VERSOIX"


async def test_recalculate_month_two_clubs_same_month_remain_separate(monkeypatch):
    """Test critique cross-club : 2 clubs sur le même mois → 2 upserts
    avec filter scopé chacun, garantissant qu'ils créent/maintiennent
    2 docs distincts (pas de match cross-club accidentel)."""
    db, calls = _make_kpi_db()
    monkeypatch.setattr(kpis_mod, "db", db)

    await kpis_mod.recalculate_month("2026-06", club_id="CLUB_A")
    await kpis_mod.recalculate_month("2026-06", club_id="CLUB_B")

    assert len(calls) == 2
    filters = [c["filter"] for c in calls]
    assert filters[0] == {"club_id": "CLUB_A", "month": "2026-06"}
    assert filters[1] == {"club_id": "CLUB_B", "month": "2026-06"}
    # Les deux $set portent leur propre club_id (pas de fuite)
    assert calls[0]["update"]["$set"]["club_id"] == "CLUB_A"
    assert calls[1]["update"]["$set"]["club_id"] == "CLUB_B"


# ════════════════════════════════════════════════════════════════════════════
#         _auto_recalculate_kpis (transactions.py:96 upsert)
# ════════════════════════════════════════════════════════════════════════════


def _make_tx_db():
    calls: list[dict] = []

    async def _update(filter_q, update_q, upsert=False):
        calls.append({"filter": filter_q, "update": update_q, "upsert": upsert})
        return MagicMock(modified_count=1)

    kpis_coll = MagicMock()
    kpis_coll.find_one = AsyncMock(return_value={})
    kpis_coll.update_one = AsyncMock(side_effect=_update)

    cats_coll = MagicMock()
    cats_coll.find = MagicMock(return_value=_CursorList([]))

    txs_coll = MagicMock()
    txs_coll.find = MagicMock(return_value=_CursorList([]))

    members_coll = MagicMock()
    members_coll.count_documents = AsyncMock(return_value=0)

    db = MagicMock()
    db.monthly_kpis = kpis_coll
    db.accounting_categories = cats_coll
    db.accounting_transactions = txs_coll
    db.customer_members = members_coll
    return db, calls


async def test_auto_recalculate_skips_when_club_id_is_none(monkeypatch, caplog):
    db, calls = _make_tx_db()
    monkeypatch.setattr(tx_mod, "db", db)

    with caplog.at_level("WARNING"):
        await tx_mod._auto_recalculate_kpis("2026-06-15", club_id=None)

    assert calls == [], "Aucun upsert sans club_id"
    matching = [r for r in caplog.records if "KPI_AUTO_RECALC_MISSING_CLUB_ID" in r.message]
    assert len(matching) == 1


async def test_auto_recalculate_includes_club_id_in_set(monkeypatch):
    db, calls = _make_tx_db()
    monkeypatch.setattr(tx_mod, "db", db)

    await tx_mod._auto_recalculate_kpis("2026-06-15", club_id="CLUB_VERSOIX")

    assert len(calls) == 1
    call = calls[0]
    assert call["upsert"] is True
    assert call["filter"].get("club_id") == "CLUB_VERSOIX"
    assert call["filter"].get("month") == "2026-06"
    assert call["update"]["$set"].get("club_id") == "CLUB_VERSOIX"


async def test_auto_recalculate_skips_short_date(monkeypatch):
    """Backward compat : date < 7 chars → return tôt (logique existante)."""
    db, calls = _make_tx_db()
    monkeypatch.setattr(tx_mod, "db", db)

    await tx_mod._auto_recalculate_kpis("", club_id="CLUB_VERSOIX")
    await tx_mod._auto_recalculate_kpis("abc", club_id="CLUB_VERSOIX")

    assert calls == [], "Aucun upsert pour date invalide"
