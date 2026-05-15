"""
GHL Protection — Garde-fou anti zero-overwrite sur `/api/ghl/sync` (2026-05-12).

Si GHL retourne 0 opportunités MAIS que le doc monthly_kpis existant contient
déjà des données (leads/cash_collected/close > 0), on REFUSE l'update.

Cette fonction est isolée pour pouvoir être testée unitairement
(voir tests/test_ghl_sync_zero_overwrite.py).
"""
from typing import Optional


def should_skip_zero_overwrite(total_pipeline_opps: int, existing: Optional[dict]) -> bool:
    """Retourne True si l'update doit être SKIPPÉ pour préserver les données existantes.

    Conditions cumulatives :
      - total_pipeline_opps == 0 (GHL retourne aucune opp)
      - existing existe (doc déjà en base)
      - au moins UN des champs (leads, cash_collected, close) > 0 dans existing
    """
    if total_pipeline_opps != 0:
        return False
    if not existing:
        return False
    return (
        (existing.get("leads") or 0) > 0
        or (existing.get("cash_collected") or 0) > 0
        or (existing.get("close") or 0) > 0
    )
