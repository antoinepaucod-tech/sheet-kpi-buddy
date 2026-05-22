"""Tests régression Phase 5 Batch 1.B SB B.2 — défense en profondeur sur
`revert_payment_to_unpaid` (POST `/api/payments/{payment_id}/revert-to-unpaid`).

Objectifs sécurité multi-tenant :
  1. **Auth requise** : ajout de `Depends(get_current_user)` (no-auth aujourd'hui).
  2. **Scope club_id** sur les 3 opérations DB internes :
     - `find_one` initial (lookup doc + validation status="paid")
     - `update_one` (transition de statut)
     - `find_one` final (récupération doc à jour pour réponse)
  3. **Pas d'enumeration attack** : doc dans un autre club → 404 identique
     à "id absent partout".
  4. **Préservation du side-effect `warnings`** : la propriété "renvoie
     `member_archived` dans la réponse si le membre est archivé" (testée par
     `test_iteration72_sprint_b_filters.py:177-181`) DOIT continuer à passer.

Pattern défense en profondeur : fallback Versoix toléré ici (cohérent avec
B.1.1 delete_one) car le filter composite garantit qu'un fallback erroné
matche 0 doc.

0 mutation DB réelle (mocks AsyncMock pure — pattern Q5 PRD).
"""
from __future__ import annotations

import inspect
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from routers import payments as pm


pytestmark = [pytest.mark.regression, pytest.mark.asyncio]


# ──────────────────────────── Helpers locaux ─────────────────────────────


def _paid_doc(payment_id="pay-1", member_id="m-1", club_id="CLUB_A"):
    """Doc payment au statut 'paid' (éligible au revert)."""
    return {
        "id": payment_id,
        "member_id": member_id,
        "club_id": club_id,
        "status": "paid",
        "due_date": "2026-04-01",
        "amount": 50.0,
    }


def _make_db_for_revert(find_one_result, update_deleted_count=1):
    """Mock DB pour `revert_payment_to_unpaid`. `find_one` retourne la même
    valeur sur les 2 appels (initial + final) pour simplicité — suffisant car
    le test ne dépend pas de l'écart entre les 2 reads."""
    coll = MagicMock()
    coll.find_one = AsyncMock(return_value=find_one_result)
    coll.update_one = AsyncMock(return_value=MagicMock(modified_count=update_deleted_count))
    db = MagicMock()
    db.payments = coll
    return db, coll


def _call_kwargs(**extra):
    """Construit les kwargs adaptés à la signature courante de
    `revert_payment_to_unpaid` (pré-patch : `payment_id` seul ; post-patch :
    `payment_id`, `current_user`, `club_id`). Permet aux tests qui doivent
    rester GREEN à travers le patch (test 5) de fonctionner sans adaptation.
    """
    sig = inspect.signature(pm.revert_payment_to_unpaid)
    kwargs = {"payment_id": extra.pop("payment_id", "pay-1")}
    if "current_user" in sig.parameters:
        kwargs["current_user"] = extra.pop(
            "current_user", {"id": "u1", "email": "u@a.com"}
        )
    if "club_id" in sig.parameters:
        kwargs["club_id"] = extra.pop("club_id", "CLUB_A")
    return kwargs


# ════════════════════════════════════════════════════════════════════════════
#       Test 1 — Auth gating (introspection signature, RED véritable)
# ════════════════════════════════════════════════════════════════════════════


async def test_revert_to_unpaid_requires_auth():
    """L'endpoint DOIT exiger `Depends(get_current_user)`.

    RED tant que la signature n'inclut pas `current_user`.
    GREEN après patch (signature `(payment_id, current_user, club_id)`).
    """
    sig = inspect.signature(pm.revert_payment_to_unpaid)
    assert "current_user" in sig.parameters, (
        f"L'endpoint revert_payment_to_unpaid n'a pas de paramètre "
        f"`current_user` (no-auth). Params actuels : {list(sig.parameters)}"
    )


# ════════════════════════════════════════════════════════════════════════════
#       Test 2 — find_one scope club_id (RED véritable)
# ════════════════════════════════════════════════════════════════════════════


async def test_revert_to_unpaid_scopes_find_to_club_id(monkeypatch):
    """Le `find_one` initial DOIT inclure `club_id` dans son filter.

    RED avec code actuel (filter `{"id": payment_id}` seul).
    GREEN après patch (filter composite `{"id", "club_id": resolved}`).
    """
    db, coll = _make_db_for_revert(_paid_doc())
    monkeypatch.setattr(pm, "db", db)
    monkeypatch.setattr(
        pm,
        "resolve_club_id_or_fallback",
        lambda club_id, current_user, endpoint: "CLUB_A",
    )

    await pm.revert_payment_to_unpaid(**_call_kwargs())

    # 1er appel = find_one(filter, ...) — vérifier que club_id est présent
    first_find_call = coll.find_one.call_args_list[0]
    filter_dict = first_find_call.args[0] if first_find_call.args else first_find_call.kwargs.get("filter", {})
    assert "club_id" in filter_dict, (
        f"find_one initial appelé sans `club_id` : {filter_dict}"
    )
    assert filter_dict["club_id"] == "CLUB_A", (
        f"find_one initial avec mauvais club_id : {filter_dict}"
    )


# ════════════════════════════════════════════════════════════════════════════
#       Test 3 — update_one scope club_id (RED véritable)
# ════════════════════════════════════════════════════════════════════════════


async def test_revert_to_unpaid_scopes_update_to_club_id(monkeypatch):
    """Le `update_one` DOIT inclure `club_id` dans son filter.

    RED avec code actuel (filter `{"id": payment_id}` seul).
    GREEN après patch.
    """
    db, coll = _make_db_for_revert(_paid_doc())
    monkeypatch.setattr(pm, "db", db)
    monkeypatch.setattr(
        pm,
        "resolve_club_id_or_fallback",
        lambda club_id, current_user, endpoint: "CLUB_A",
    )

    await pm.revert_payment_to_unpaid(**_call_kwargs())

    update_call = coll.update_one.call_args
    filter_dict = update_call.args[0] if update_call.args else update_call.kwargs.get("filter", {})
    assert "club_id" in filter_dict, (
        f"update_one appelé sans `club_id` : {filter_dict}"
    )
    assert filter_dict["club_id"] == "CLUB_A", (
        f"update_one avec mauvais club_id : {filter_dict}"
    )


# ════════════════════════════════════════════════════════════════════════════
#       Test 4 — Cross-club returns 404 identique (RED véritable)
# ════════════════════════════════════════════════════════════════════════════


async def test_revert_to_unpaid_cross_club_returns_404(monkeypatch):
    """Si l'id appartient à un autre club, le `find_one` avec filter
    composite DOIT retourner None → l'endpoint DOIT renvoyer la même 404
    que "id absent partout" (`"Paiement introuvable"`). Pas d'enumeration leak.

    Stratégie test : `find_one` mocké via `side_effect` inspectant le filter :
      - Si le filter contient `club_id` → return None (post-patch composite no-match)
      - Si le filter est par `id` seul → return doc cross-club (pre-patch leak)

    RED avec code actuel : find_one sans club_id → doc cross-club retourné →
    code continue (status="paid" passe la validation) → update_one s'exécute
    → 2e find_one renvoie le doc → return doc (200). PAS de 404 → test fail.
    GREEN après patch : find_one composite → None → 404 propre.
    """
    cross_club_doc = _paid_doc(payment_id="pay-from-other-club", club_id="CLUB_OTHER")

    def _find_one_side_effect(filter_dict, *args, **kwargs):
        # post-patch : filter composite {id, club_id} → None (mismatch)
        # pre-patch  : filter {id} seul → doc cross-club retourné (leak)
        if "club_id" in filter_dict:
            return None
        return cross_club_doc

    coll = MagicMock()
    coll.find_one = AsyncMock(side_effect=_find_one_side_effect)
    coll.update_one = AsyncMock(return_value=MagicMock(modified_count=1))
    db = MagicMock()
    db.payments = coll
    monkeypatch.setattr(pm, "db", db)
    monkeypatch.setattr(
        pm,
        "resolve_club_id_or_fallback",
        lambda club_id, current_user, endpoint: "CLUB_A",
    )

    with pytest.raises(HTTPException) as exc_info:
        await pm.revert_payment_to_unpaid(
            **_call_kwargs(payment_id="pay-from-other-club")
        )

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Paiement introuvable"


# ════════════════════════════════════════════════════════════════════════════
#       Test 5 — Préservation du side-effect `warnings` (GREEN intentionnel)
# ════════════════════════════════════════════════════════════════════════════


async def test_revert_to_unpaid_preserves_member_archived_warning(monkeypatch):
    """Non-régression : la propriété "renvoie `member_archived` dans la
    réponse si le membre est archivé" DOIT continuer à tenir à travers le
    patch B.1.B.2. Couvre le test e2e `test_iteration72_sprint_b_filters:177`.

    GREEN intentionnel dès l'écriture : la propriété est déjà vraie dans le
    code actuel (L660-661). Test conçu pour rester GREEN à travers le patch
    via `_call_kwargs()` adaptatif.
    """
    paid = _paid_doc()
    db, coll = _make_db_for_revert(paid)
    monkeypatch.setattr(pm, "db", db)
    monkeypatch.setattr(
        pm,
        "resolve_club_id_or_fallback",
        lambda club_id, current_user, endpoint: "CLUB_A",
    )
    # Mock get_member_archived_warning → simule membre archivé
    async def _archived_warning(_member_id):
        return ["member_archived"]

    monkeypatch.setattr(pm, "get_member_archived_warning", _archived_warning)

    result = await pm.revert_payment_to_unpaid(**_call_kwargs())

    assert "warnings" in result, (
        f"Réponse sans clé `warnings` : {result}"
    )
    assert "member_archived" in result["warnings"], (
        f"Warning `member_archived` absent : {result['warnings']}"
    )
