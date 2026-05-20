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
    """Header `X-Club-Id` présent (CLUB_A). Le `delete_many` sur
    `payment_schedules` DOIT être appelé exactement avec
    `{"club_id": "CLUB_A"}` — JAMAIS avec `{}`.

    Post-Option B : le guard L96 raise 400 si header absent, donc on teste
    ici le chemin nominal (header fourni).

    Discriminance vérifiée par mutation manuelle (SB2.3.4).
    """
    db = _make_sync_db_with_delete_spies()
    monkeypatch.setattr(pm, "db", db)

    await pm.sync_payments_with_members(
        club_id="CLUB_A",
        current_user={"id": "user-1", "active_club_id": "CLUB_A", "email": "u@a.com"},
    )

    db.payment_schedules.delete_many.assert_called_once_with({"club_id": "CLUB_A"})


async def test_sync_with_members_scopes_delete_payments(monkeypatch):
    """Header présent (CLUB_A). Le `delete_many` sur `payments` DOIT inclure
    `club_id` + le filtre status. JAMAIS `{"status": {"$in": ...}}` seul.

    Discriminance vérifiée par mutation manuelle (SB2.3.4).
    """
    db = _make_sync_db_with_delete_spies()
    monkeypatch.setattr(pm, "db", db)

    await pm.sync_payments_with_members(
        club_id="CLUB_A",
        current_user={"id": "user-1", "active_club_id": "CLUB_A", "email": "u@a.com"},
    )

    db.payments.delete_many.assert_called_once_with(
        {"club_id": "CLUB_A", "status": {"$in": ["pending", "late"]}}
    )


# ════════════════════════════════════════════════════════════════════════════
#       Invariant structurel : TOUT delete_many DOIT contenir un club_id non-vide
# ════════════════════════════════════════════════════════════════════════════


async def test_sync_with_members_delete_filters_always_contain_club_id(monkeypatch):
    """Invariant structurel multi-tenant : sur le chemin nominal (header
    présent), CHAQUE appel à `delete_many` sur `payment_schedules` et
    `payments` doit contenir une clé `club_id` non-vide dans son filtre.

    Protège contre tout retour accidentel à `delete_many({})` ou à un filtre
    sans `club_id` (cross-club wipe).

    Discriminance vérifiée par mutation manuelle (SB2.3.4).
    """
    db = _make_sync_db_with_delete_spies()
    monkeypatch.setattr(pm, "db", db)

    await pm.sync_payments_with_members(
        club_id="CLUB_A",
        current_user={"id": "user-1", "active_club_id": "CLUB_A", "email": "u@a.com"},
    )

    all_delete_calls = (
        list(db.payment_schedules.delete_many.call_args_list)
        + list(db.payments.delete_many.call_args_list)
    )
    assert all_delete_calls, "Au moins un delete_many doit être appelé"

    for call in all_delete_calls:
        # `call.args[0]` = premier arg positionnel = filter dict Mongo
        filter_dict = call.args[0] if call.args else call.kwargs.get("filter", {})
        assert "club_id" in filter_dict, (
            f"delete_many appelé sans clé `club_id` : {filter_dict}"
        )
        assert filter_dict["club_id"], (
            f"delete_many appelé avec `club_id` vide/falsy : {filter_dict}"
        )



# ════════════════════════════════════════════════════════════════════════════
#   Option B (hardening strict) : pas de fallback Versoix sur op delete.
#   Header `X-Club-Id` explicitement requis sur sync-with-members.
# ════════════════════════════════════════════════════════════════════════════


async def test_sync_with_members_raises_400_without_club_id_header(monkeypatch):
    """Garantie Option B (Phase 5 Batch 1.A hardening) : sur une opération
    delete cross-tenant à fort impact, on N'AUTORISE PAS le fallback
    silencieux vers `DEFAULT_CLUB_ID` (Versoix). Le header `X-Club-Id` doit
    être présent, sinon HTTPException 400.

    Élimine le risque de wipe silencieux du club Versoix par un appel
    super_admin sans header.

    RED avant patch (le code actuel résout via `resolve_club_id_or_fallback`
    et exécute les deletes sur Versoix).
    GREEN après patch (guard `if not club_id: raise HTTPException(400)` avant
    le resolver).
    """
    db = _make_sync_db_with_delete_spies()
    monkeypatch.setattr(pm, "db", db)

    with pytest.raises(HTTPException) as exc_info:
        await pm.sync_payments_with_members(
            club_id=None,  # header X-Club-Id absent
            current_user={"id": "user-1", "email": "u@a.com"},
        )

    assert exc_info.value.status_code == 400
    assert "X-Club-Id" in exc_info.value.detail

    # Critique : AUCUN delete ne doit avoir été appelé avant le raise.
    db.payment_schedules.delete_many.assert_not_called()
    db.payments.delete_many.assert_not_called()
