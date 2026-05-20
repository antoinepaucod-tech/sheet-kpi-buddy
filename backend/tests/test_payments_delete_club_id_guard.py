"""Tests régression Phase 5 Batch 1.A — défense en profondeur `club_id`
sur les `delete_many` de `POST /payments/sync-with-members`.

Cibles audit AST 2026-05-20 (multitenant_isolation_audit_20260520_082750.md) :
  - `routers/payments.py:119` — `payment_schedules.delete_many({})` 🔴 CATASTROPHIQUE
  - `routers/payments.py:145` — `payments.delete_many({"status": ...})` 🔴 CATASTROPHIQUE

Stratégie TDD :
  - Test 1+2 RED tant que la branche `else:` existe (delete_many sans club_id
    quand le header `X-Club-Id` est absent). On force le scénario en mockant
    `resolve_club_id_or_fallback` pour retourner un club_id non-Versoix et en
    appelant l'endpoint avec `club_id=None`.
  - Test 3 — safety net : si la résolution échoue (HTTPException), aucun
    delete ne doit s'exécuter.

0 mutation DB réelle (mocks AsyncMock pure — pattern Q5 PRD).
0 dépendance entre fichiers test (fixtures 100% locales).
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from routers import payments as pm


pytestmark = [pytest.mark.regression, pytest.mark.asyncio]


# ──────────────────────────── Helpers locaux ─────────────────────────────


class _CursorList:
    """Curseur Motor mocké : supporte `.to_list(N)` et `.sort(...).to_list(N)`."""

    def __init__(self, docs):
        self._docs = list(docs)

    def sort(self, *_args, **_kwargs):
        return self

    async def to_list(self, _length=None):
        return list(self._docs)


def _make_sync_db_with_delete_spies():
    """Mock DB pour `sync_payments_with_members` avec spies sur les delete_many."""
    ps_coll = MagicMock()
    ps_coll.insert_one = AsyncMock(return_value=MagicMock(inserted_id="x"))
    ps_coll.delete_many = AsyncMock(return_value=MagicMock(deleted_count=0))

    p_coll = MagicMock()
    p_coll.insert_one = AsyncMock(return_value=MagicMock(inserted_id="x"))
    p_coll.delete_many = AsyncMock(return_value=MagicMock(deleted_count=0))
    p_coll.find = MagicMock(return_value=_CursorList([]))  # aucun paid/cancelled

    members_coll = MagicMock()
    members_coll.find = MagicMock(return_value=_CursorList([]))  # aucun membre

    db = MagicMock()
    db.payment_schedules = ps_coll
    db.payments = p_coll
    db.customer_members = members_coll
    return db


# ════════════════════════════════════════════════════════════════════════════
#       RED → GREEN : delete_many DOIT scoper `club_id` (résolu)
# ════════════════════════════════════════════════════════════════════════════


async def test_sync_with_members_scopes_delete_payment_schedules(monkeypatch):
    """Branche fallback : header X-Club-Id absent, resolver retourne CLUB_A.
    Le `delete_many` sur `payment_schedules` DOIT être appelé exactement avec
    `{"club_id": "CLUB_A"}` — JAMAIS avec `{}`.

    RED avec code actuel (L119 = `delete_many({})`).
    GREEN après patch (usage uniforme `resolved_club_id`).
    """
    db = _make_sync_db_with_delete_spies()
    monkeypatch.setattr(pm, "db", db)
    monkeypatch.setattr(
        pm,
        "resolve_club_id_or_fallback",
        lambda club_id, current_user, endpoint: "CLUB_A",
    )

    await pm.sync_payments_with_members(
        club_id=None,
        current_user={"id": "u1", "email": "u@a.com"},
    )

    db.payment_schedules.delete_many.assert_called_once_with({"club_id": "CLUB_A"})


async def test_sync_with_members_scopes_delete_payments(monkeypatch):
    """Branche fallback : le `delete_many` sur `payments` DOIT inclure
    `club_id` + le filtre status. JAMAIS `{"status": {"$in": ...}}` seul.

    RED avec code actuel (L145 = pas de club_id).
    GREEN après patch.
    """
    db = _make_sync_db_with_delete_spies()
    monkeypatch.setattr(pm, "db", db)
    monkeypatch.setattr(
        pm,
        "resolve_club_id_or_fallback",
        lambda club_id, current_user, endpoint: "CLUB_A",
    )

    await pm.sync_payments_with_members(
        club_id=None,
        current_user={"id": "u1", "email": "u@a.com"},
    )

    db.payments.delete_many.assert_called_once_with(
        {"club_id": "CLUB_A", "status": {"$in": ["pending", "late"]}}
    )


# ════════════════════════════════════════════════════════════════════════════
#       Safety net : si resolver lève, AUCUN delete_many n'est exécuté
# ════════════════════════════════════════════════════════════════════════════


async def test_sync_with_members_never_calls_delete_without_club_id(monkeypatch):
    """Garde-fou : si pour une raison X la résolution lève (mode strict futur),
    aucun delete_many ne doit avoir été appelé. Protège contre tout retour
    accidentel à `delete_many({})`.
    """
    db = _make_sync_db_with_delete_spies()
    monkeypatch.setattr(pm, "db", db)

    def _raise(*_a, **_kw):
        raise HTTPException(status_code=400, detail="club_id manquant")

    monkeypatch.setattr(pm, "resolve_club_id_or_fallback", _raise)

    with pytest.raises(HTTPException):
        await pm.sync_payments_with_members(
            club_id=None,
            current_user={"id": "u1", "email": "u@a.com"},
        )

    db.payment_schedules.delete_many.assert_not_called()
    db.payments.delete_many.assert_not_called()
