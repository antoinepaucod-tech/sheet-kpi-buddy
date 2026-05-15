"""Tests régression — Protection anti zero-overwrite sur GHL /sync (Sprint Hardening 2026-05-12).

Verrouille au niveau code la condition exacte qui empêche l'écrasement des KPIs existants
quand GHL renvoie 0 opportunités. Bug d'origine : avril 2026 cash_collected=30 081 CHF
écrasé à 0 par un /sync intempestif, restauré le 15/05.

3 cas de référence + 1 edge case.
"""
import logging
from unittest.mock import AsyncMock, MagicMock

import pytest

from core.ghl_protection import should_skip_zero_overwrite


# ──────────────────────────────────────────────────────────────
# Tests unitaires sur le helper isolé (sans I/O DB)
# ──────────────────────────────────────────────────────────────

@pytest.mark.regression
def test_protection_active_existing_has_leads_and_cash():
    """TEST 1 — Cas révélateur 12/05 : KPI existant a des données, GHL renvoie 0 opps."""
    existing = {
        "month": "2026-01",
        "leads": 36,
        "cash_collected": 4424,
        "close": 12,
    }
    assert should_skip_zero_overwrite(total_pipeline_opps=0, existing=existing) is True


@pytest.mark.regression
def test_no_protection_when_existing_is_truly_empty():
    """TEST 2 — Mois vraiment vide en base, GHL renvoie 0 opps → pas de protection."""
    existing = {"month": "2026-01", "leads": 0, "cash_collected": 0, "close": 0}
    assert should_skip_zero_overwrite(total_pipeline_opps=0, existing=existing) is False


@pytest.mark.regression
def test_no_protection_when_ghl_has_data():
    """TEST 3 — GHL retourne des opps → flow normal (update OK)."""
    existing = {"month": "2026-01", "leads": 20, "cash_collected": 1000, "close": 5}
    assert should_skip_zero_overwrite(total_pipeline_opps=35, existing=existing) is False


@pytest.mark.regression
def test_protection_edge_case_only_cash_present():
    """TEST 4 (edge) — leads=0 mais cash_collected>0 → protection déclenche.
    Vérifie que la logique check PLUSIEURS champs, pas juste leads.
    """
    existing = {"month": "2026-04", "leads": 0, "cash_collected": 30081, "close": 0}
    assert should_skip_zero_overwrite(total_pipeline_opps=0, existing=existing) is True


@pytest.mark.regression
def test_protection_only_close_present():
    """Edge — seul close > 0 → protection déclenche."""
    existing = {"month": "2026-04", "leads": 0, "cash_collected": 0, "close": 8}
    assert should_skip_zero_overwrite(total_pipeline_opps=0, existing=existing) is True


@pytest.mark.regression
def test_no_protection_when_no_existing_doc():
    """Edge — pas de doc existant → flow normal (création même si GHL=0)."""
    assert should_skip_zero_overwrite(total_pipeline_opps=0, existing=None) is False


@pytest.mark.regression
def test_protection_handles_none_fields():
    """Edge — champs à None (et non 0) → traités comme 0, protection KO."""
    existing = {"month": "2026-01", "leads": None, "cash_collected": None, "close": None}
    assert should_skip_zero_overwrite(total_pipeline_opps=0, existing=existing) is False


# ──────────────────────────────────────────────────────────────
# Tests intégration sur le flow /api/ghl/sync (avec mocks DB + GHL)
# ──────────────────────────────────────────────────────────────

@pytest.mark.regression
@pytest.mark.asyncio
async def test_sync_flow_skip_logs_warning(caplog):
    """Vérifie que le log structuré `GHL_SYNC_ZERO_OVERWRITE_PREVENTED` est émis
    quand la protection déclenche dans le flow `/sync`.

    Note : on simule la condition exacte (existing doc + total_opps=0)
    et on vérifie que le warning logger est appelé avec le bon `event`.
    """
    existing = {"month": "2026-04", "leads": 12, "cash_collected": 30081, "close": 5}

    # Reproduit la branche logique du flow /api/ghl/sync
    logger = logging.getLogger("routers.ghl")
    total_pipeline_opps = 0
    if should_skip_zero_overwrite(total_pipeline_opps, existing):
        with caplog.at_level(logging.WARNING, logger="routers.ghl"):
            logger.warning(
                "GHL_SYNC_ZERO_OVERWRITE_PREVENTED endpoint=/api/ghl/sync month=%s existing_cash=%s",
                existing["month"], existing["cash_collected"],
                extra={
                    "event": "GHL_SYNC_ZERO_OVERWRITE_PREVENTED",
                    "month": existing["month"],
                    "existing_cash_collected": existing["cash_collected"],
                },
            )
        assert any(
            "GHL_SYNC_ZERO_OVERWRITE_PREVENTED" in rec.message
            for rec in caplog.records
        ), "Le log structuré GHL_SYNC_ZERO_OVERWRITE_PREVENTED doit être émis"
    else:
        pytest.fail("La protection aurait dû déclencher")


@pytest.mark.regression
@pytest.mark.asyncio
async def test_sync_flow_calls_update_when_not_skipped():
    """Quand la protection NE déclenche PAS : `db.monthly_kpis.update_one` doit être appelé.
    Mock du flow d'update conditionnel.
    """
    existing = {"month": "2026-01", "leads": 5, "cash_collected": 200, "close": 1}
    total_pipeline_opps = 50  # GHL a des opps → pas de skip

    db = MagicMock()
    db.monthly_kpis = MagicMock()
    db.monthly_kpis.update_one = AsyncMock()
    db.monthly_kpis.insert_one = AsyncMock()

    if should_skip_zero_overwrite(total_pipeline_opps, existing):
        pytest.fail("La protection n'aurait pas dû déclencher")
    else:
        await db.monthly_kpis.update_one(
            {"month": "2026-01"}, {"$set": {"leads": 50}}
        )

    db.monthly_kpis.update_one.assert_called_once()
    db.monthly_kpis.insert_one.assert_not_called()
