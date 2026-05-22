"""Tests régression Phase 5 Batch 1.B SB B.1 — défense en profondeur sur
les `delete_one` des 2 endpoints DELETE de `routers/payments.py` :
  - DELETE `/api/payment-schedules/{schedule_id}` (L62 post-B.3b)
  - DELETE `/api/payments/{payment_id}`           (L604 post-B.3b)

Objectifs sécurité multi-tenant :
  1. **Auth requise** : ajout de `Depends(get_current_user)` (no-auth aujourd'hui).
  2. **Scope club_id** : filter composite `{id + club_id}` sur `delete_one`
     pour éliminer le cross-club delete par id devinable.
  3. **Pas d'enumeration attack** : un id existant dans un autre club doit
     retourner exactement la même 404 que "id absent partout" (message
     identique).

Pattern défense en profondeur (Sprint Hardening) : fallback Versoix toléré
ici car le filter composite garantit qu'un fallback erroné matche 0 doc
(impossible de muter un autre tenant même par accident).

0 mutation DB réelle (mocks AsyncMock pure — pattern Q5 PRD).
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from routers import payments as pm


pytestmark = [pytest.mark.regression, pytest.mark.asyncio]


# ──────────────────────────── Helpers locaux ─────────────────────────────


def _make_db_with_delete_one_spy(coll_name: str, deleted_count: int = 1):
    """Mock DB avec spy sur `delete_one` de la collection donnée.

    `coll_name` ∈ {"payment_schedules", "payments"}.
    `deleted_count` simule le résultat Mongo (1 = doc supprimé, 0 = no match).
    """
    coll = MagicMock()
    coll.delete_one = AsyncMock(return_value=MagicMock(deleted_count=deleted_count))
    db = MagicMock()
    setattr(db, coll_name, coll)
    return db, coll


# ════════════════════════════════════════════════════════════════════════════
#         DELETE /api/payment-schedules/{schedule_id}  (3 tests)
# ════════════════════════════════════════════════════════════════════════════


async def test_delete_payment_schedule_requires_auth(monkeypatch):
    """L'endpoint DOIT exiger `Depends(get_current_user)`.

    On simule une dépendance auth qui raise 401 (token absent/invalide).
    Avec le code actuel (pas de Depends), l'appel passe sans auth.
    RED tant que la signature n'inclut pas current_user.
    """
    import inspect
    sig = inspect.signature(pm.delete_payment_schedule)
    assert "current_user" in sig.parameters, (
        f"L'endpoint delete_payment_schedule n'a pas de paramètre "
        f"`current_user` (no-auth). Params actuels : {list(sig.parameters)}"
    )


async def test_delete_payment_schedule_scopes_to_club_id(monkeypatch):
    """Le `delete_one` DOIT inclure `club_id` dans son filter.

    RED avec code actuel (`delete_one({"id": schedule_id})` seul).
    GREEN après patch (`delete_one({"id": schedule_id, "club_id": resolved_club_id})`).
    """
    db, coll = _make_db_with_delete_one_spy("payment_schedules", deleted_count=1)
    monkeypatch.setattr(pm, "db", db)
    monkeypatch.setattr(
        pm,
        "resolve_club_id_or_fallback",
        lambda club_id, current_user, endpoint: "CLUB_A",
    )

    await pm.delete_payment_schedule(
        schedule_id="sch-1",
        current_user={"id": "u1", "email": "u@a.com"},
        club_id="CLUB_A",
    )

    coll.delete_one.assert_called_once_with({"id": "sch-1", "club_id": "CLUB_A"})


async def test_delete_payment_schedule_cross_club_returns_404(monkeypatch):
    """Si l'id existe mais appartient à un AUTRE club (delete_one matche 0
    doc en raison du filter composite), l'endpoint DOIT retourner exactement
    la même 404 que pour "id absent partout" — pas d'enumeration attack.
    """
    db, coll = _make_db_with_delete_one_spy("payment_schedules", deleted_count=0)
    monkeypatch.setattr(pm, "db", db)
    monkeypatch.setattr(
        pm,
        "resolve_club_id_or_fallback",
        lambda club_id, current_user, endpoint: "CLUB_A",
    )

    with pytest.raises(HTTPException) as exc_info:
        await pm.delete_payment_schedule(
            schedule_id="sch-from-other-club",
            current_user={"id": "u1", "email": "u@a.com"},
            club_id="CLUB_A",
        )

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Planning de paiement introuvable"


# ════════════════════════════════════════════════════════════════════════════
#         DELETE /api/payments/{payment_id}  (2 tests)
# ════════════════════════════════════════════════════════════════════════════


async def test_delete_payment_requires_auth(monkeypatch):
    """L'endpoint DOIT exiger `Depends(get_current_user)`."""
    import inspect
    sig = inspect.signature(pm.delete_payment)
    assert "current_user" in sig.parameters, (
        f"L'endpoint delete_payment n'a pas de paramètre `current_user` "
        f"(no-auth). Params actuels : {list(sig.parameters)}"
    )


async def test_delete_payment_scopes_to_club_id(monkeypatch):
    """Le `delete_one` DOIT inclure `club_id` dans son filter."""
    db, coll = _make_db_with_delete_one_spy("payments", deleted_count=1)
    monkeypatch.setattr(pm, "db", db)
    monkeypatch.setattr(
        pm,
        "resolve_club_id_or_fallback",
        lambda club_id, current_user, endpoint: "CLUB_A",
    )

    await pm.delete_payment(
        payment_id="pay-1",
        current_user={"id": "u1", "email": "u@a.com"},
        club_id="CLUB_A",
    )

    coll.delete_one.assert_called_once_with({"id": "pay-1", "club_id": "CLUB_A"})
