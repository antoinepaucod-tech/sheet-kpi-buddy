"""Tests régression Phase 3 Batch 4 — défense en profondeur `club_id` sur
`routers/rollover.py` (`_ensure_kpi_exists` + `run_rollover_all_clubs`).

Cas spécial vs Batches 1-2-3 : ce code tourne dans un job APScheduler
quotidien 01:00 UTC, donc PAS de `current_user` disponible. Le pattern
guard est adapté : `club_id is None` → log structuré JSON + SKIP (au lieu
de fallback Versoix, pour éviter de polluer Versoix avec des KPIs
provenant d'un doc legacy mal configuré).

Bonus : on vérifie aussi l'ajout `created_at` / `updated_at` (l'orphelin
détecté Phase 1 avait `created_at=null`, signature directement liée au
dict d'insertion).
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from routers import rollover as ro


pytestmark = [pytest.mark.regression, pytest.mark.asyncio]


# ════════════════════════════════════════════════════════════════════════════
#                          _ensure_kpi_exists
# ════════════════════════════════════════════════════════════════════════════


async def test_ensure_kpi_exists_inserts_when_missing(monkeypatch):
    """club_id valide + aucun doc existant → insert avec created_at + updated_at."""
    inserted: list[dict] = []
    kpi_coll = MagicMock()
    kpi_coll.find_one = AsyncMock(return_value=None)

    async def _insert(d):
        inserted.append(d)
        return MagicMock(inserted_id="x")

    kpi_coll.insert_one = AsyncMock(side_effect=_insert)
    db = MagicMock(); db.monthly_kpis = kpi_coll
    monkeypatch.setattr(ro, "db", db)

    await ro._ensure_kpi_exists(2026, 6, club_id="CLUB_VALID")

    assert len(inserted) == 1
    doc = inserted[0]
    assert doc["club_id"] == "CLUB_VALID"
    assert doc["month"] == "2026-06"
    # Phase 3 Batch 4 bonus : traçabilité ajoutée
    assert "created_at" in doc and doc["created_at"], "created_at doit être posé"
    assert "updated_at" in doc and doc["updated_at"], "updated_at doit être posé"
    # Logique métier préservée
    assert doc["total_revenue"] == 0
    assert doc["churn_rate"] == 0


async def test_ensure_kpi_exists_skips_existing(monkeypatch):
    """Si un doc existe déjà pour ce month/club → pas d'insert (idempotent)."""
    inserted: list[dict] = []
    kpi_coll = MagicMock()
    kpi_coll.find_one = AsyncMock(return_value={"id": "existing", "month": "2026-06"})
    kpi_coll.insert_one = AsyncMock(side_effect=lambda d: inserted.append(d))
    db = MagicMock(); db.monthly_kpis = kpi_coll
    monkeypatch.setattr(ro, "db", db)

    await ro._ensure_kpi_exists(2026, 6, club_id="CLUB_VALID")
    assert inserted == []


async def test_ensure_kpi_exists_skip_when_club_id_is_none(monkeypatch, caplog):
    """Garde-fou : club_id None → log warning structuré + SKIP, pas d'insert."""
    inserted: list[dict] = []
    kpi_coll = MagicMock()
    kpi_coll.find_one = AsyncMock(return_value=None)
    kpi_coll.insert_one = AsyncMock(side_effect=lambda d: inserted.append(d))
    db = MagicMock(); db.monthly_kpis = kpi_coll
    monkeypatch.setattr(ro, "db", db)

    with caplog.at_level("WARNING"):
        result = await ro._ensure_kpi_exists(2026, 6, club_id=None)

    assert result is None, "Le helper doit return None quand club_id est falsy"
    assert inserted == [], "Aucun insert ne doit avoir lieu (vs créer orphelin)"
    # Log structuré attendu (event=skip_ensure_kpi)
    matching = [r for r in caplog.records if "ROLLOVER_MISSING_CLUB_ID" in r.message]
    assert len(matching) == 1
    assert "event=skip_ensure_kpi" in matching[0].message


async def test_ensure_kpi_exists_skip_when_club_id_empty_string(monkeypatch, caplog):
    """Edge case : club_id="" doit déclencher le garde-fou aussi."""
    inserted: list[dict] = []
    kpi_coll = MagicMock()
    kpi_coll.find_one = AsyncMock(return_value=None)
    kpi_coll.insert_one = AsyncMock(side_effect=lambda d: inserted.append(d))
    db = MagicMock(); db.monthly_kpis = kpi_coll
    monkeypatch.setattr(ro, "db", db)

    with caplog.at_level("WARNING"):
        await ro._ensure_kpi_exists(2026, 6, club_id="")

    assert inserted == []
    assert any("ROLLOVER_MISSING_CLUB_ID" in r.message for r in caplog.records)


# ════════════════════════════════════════════════════════════════════════════
#                          run_rollover_all_clubs
# ════════════════════════════════════════════════════════════════════════════


class _CursorList:
    def __init__(self, docs):
        self._docs = list(docs)

    async def to_list(self, _length=None):
        return list(self._docs)


def _make_clubs_db(clubs):
    """Mock DB pour run_rollover_all_clubs. Retourne aussi processed_calls."""
    clubs_coll = MagicMock()
    clubs_coll.find = MagicMock(return_value=_CursorList(clubs))
    db = MagicMock(); db.clubs = clubs_coll
    return db


async def test_run_rollover_skips_clubs_without_id(monkeypatch, caplog):
    """Mix : 2 clubs OK + 1 legacy sans id → seuls les 2 OK sont processés.

    Vérifie l'ajout de la garde-fou Phase 3 Batch 4 dans `run_rollover_all_clubs`.
    """
    clubs = [
        {"id": "CLUB_VERSOIX", "name": "Versoix"},
        {"name": "Legacy without id"},          # ← doc legacy
        {"id": "CLUB_SACONNEX", "name": "Saconnex"},
    ]
    db = _make_clubs_db(clubs)
    monkeypatch.setattr(ro, "db", db)

    processed: list[str] = []

    async def _fake_run(club_id):
        processed.append(club_id)
        return {"club_id": club_id, "payments_created": 0,
                "recurring_transactions_created": 0, "late_payments_marked": 0}

    monkeypatch.setattr(ro, "run_monthly_rollover_for_club", _fake_run)
    # On stub aussi la sync Supabase pour ne pas crasher
    import routers.sync as sync_mod
    monkeypatch.setattr(sync_mod, "sync_all_clubs", AsyncMock(return_value=None))

    with caplog.at_level("WARNING"):
        results = await ro.run_rollover_all_clubs()

    assert processed == ["CLUB_VERSOIX", "CLUB_SACONNEX"]
    # 3 results : 2 succès + 1 skip avec error
    assert len(results) == 3
    skip_entry = next(r for r in results if r.get("club_id") is None)
    assert skip_entry["error"] == "legacy_club_doc_without_id"
    assert any(
        "ROLLOVER_MISSING_CLUB_ID" in r.message and "skip_legacy_club_doc" in r.message
        for r in caplog.records
    )


async def test_run_rollover_processes_all_when_clubs_clean(monkeypatch):
    """Cas nominal : 4/4 clubs OK (état Atlas confirmé par audit) → 4 processés."""
    clubs = [
        {"id": "C1", "name": "Versoix"},
        {"id": "C2", "name": "Saconnex"},
        {"id": "C3", "name": "Lausanne"},
        {"id": "C4", "name": "Geneva"},
    ]
    db = _make_clubs_db(clubs)
    monkeypatch.setattr(ro, "db", db)

    processed: list[str] = []

    async def _fake_run(club_id):
        processed.append(club_id)
        return {"club_id": club_id, "payments_created": 0,
                "recurring_transactions_created": 0, "late_payments_marked": 0}

    monkeypatch.setattr(ro, "run_monthly_rollover_for_club", _fake_run)
    import routers.sync as sync_mod
    monkeypatch.setattr(sync_mod, "sync_all_clubs", AsyncMock(return_value=None))

    results = await ro.run_rollover_all_clubs()

    assert processed == ["C1", "C2", "C3", "C4"]
    assert all(r.get("club_id") for r in results)
    assert all("error" not in r for r in results)
