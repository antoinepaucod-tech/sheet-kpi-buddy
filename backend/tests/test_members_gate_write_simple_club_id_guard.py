"""Tests régression SB B.2.3.C.2.A — scope `club_id` sur les 5 gates `find_one`
simples avant write dans `members.py` :

  - L651  set_member_pause       (PUT    /api/members/{id}/pause)
  - L701  remove_member_pause    (DELETE /api/members/{id}/pause)
  - L1204 delete_member          (DELETE /api/members/{id})
  - L1230 archive_member         (POST   /api/members/{id}/archive)
  - L1263 restore_member         (POST   /api/members/{id}/restore)

Contrat CIBLE après patch C.2.A (Invariant A.2 + No-enumeration leak) :
  - Le `find_one` "gate" doit être scopé `{"id": member_id, "club_id": club_id_resolved}`
    où `club_id_resolved` provient du **header** (puis fallback resolver), JAMAIS
    du doc lu en base.
  - Cross-club (member réel dans club B, header X-Club-Id = A) → 404 silencieux
    identique au cas "ID inexistant" → impossible de distinguer "n'existe pas"
    de "existe dans un autre club".

DISCRIMINANCE anti-énumération (assertions explicites) :
  - delete cross-club  : status ≠ 200 idempotent "Soft delete applied (already archived)"
  - archive cross-club : status ≠ 400 "Membre déjà archivé"
  - restore cross-club : status ≠ 400 "Membre déjà actif (non archivé)"
  - pause cross-club   : status ≠ 400 "Membre archivé"
  - unpause cross-club : status ≠ 200 "Pause annulée"

Construction RED :
  - Le mock `find_one` simule un state réel d'un membre dans CLUB_OTHER
    (présent en base, état choisi pour déclencher la branche discriminante
    actuellement observée). Ce n'est PAS un faux-RED par absence : le doc existe,
    le RED prouve que le gate n'est pas scopé par le club du requester.

État attendu sur code actuel (avant patch) : 5 tests RED.
  - pause/unpause/delete/archive/restore retournent 400/200 au lieu du 404 cible.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from routers import members as mb


pytestmark = [pytest.mark.regression, pytest.mark.asyncio]


CLUB_A = "club-A-versoix"
CLUB_OTHER = "club-OTHER"

# Sentinelle de fallback du resolver (cohérente avec les tests B.3-bis).
FALLBACK = "FALLBACK_VERSOIX"


def _doc(**overrides):
    """Membre minimal présent en base (club CLUB_OTHER par défaut)."""
    base = {
        "id": "M1",
        "club_id": CLUB_OTHER,
        "name": "Member M1",
        "email": "m1@other.com",
        "archived_at": None,
        "duo_partner_id": None,
        "is_duo": False,
    }
    base.update(overrides)
    return base


def _make_db_mock(member_doc):
    """Mock minimal de `db.customer_members` simulant la sémantique Mongo :
    `find_one(filter, ...)` ne retourne le doc QUE si TOUS les couples
    clé/valeur du filtre matchent. Dès qu'une clé du filtre diverge du doc
    (typiquement `club_id` cross-club), retourne None.

    C'est ce comportement filtre-aware qui rend les tests discriminants pour
    le scope : un gate non scopé (filter `{"id": ...}`) verra toujours le doc ;
    un gate scopé (`{"id": ..., "club_id": header}`) verra None cross-club.
    """
    async def _find_one_filtered(filter_dict, projection=None):
        for k, v in (filter_dict or {}).items():
            if member_doc.get(k) != v:
                return None
        return member_doc

    members_coll = MagicMock()
    members_coll.find_one = AsyncMock(side_effect=_find_one_filtered)
    members_coll.update_one = AsyncMock(return_value=MagicMock(modified_count=0))

    db = MagicMock()
    db.customer_members = members_coll
    return db


def _patch_common(monkeypatch, db):
    """Patch DB + resolver (header > fallback) + log_activity inert."""
    monkeypatch.setattr(mb, "db", db)
    monkeypatch.setattr(
        mb,
        "resolve_club_id_or_fallback",
        lambda club_id, current_user, endpoint: club_id or FALLBACK,
    )
    monkeypatch.setattr(mb, "log_activity", AsyncMock())


def _status_of(exc_info):
    return getattr(exc_info.value, "status_code", None)


def _detail_of(exc_info):
    return getattr(exc_info.value, "detail", None)


# ════════════════════════════════════════════════════════════════════════════
#   Gate #1 — set_member_pause (L651) cross-club
#   State : member dans CLUB_OTHER, ARCHIVÉ (déclenche la branche 400 actuelle)
#   Actuel : 400 "Membre archivé — restaurer avant de mettre en pause"
#   Cible  : 404 "Membre introuvable" (no-leak)
# ════════════════════════════════════════════════════════════════════════════


async def test_set_member_pause_cross_club_raises_404_not_400(monkeypatch):
    """🎯 RED : `set_member_pause` doit raise 404 sur member cross-club,
    PAS 400 "Membre archivé" (qui révèle l'état du doc dans un autre club).
    """
    # Doc club B, archivé → si gate non scopé, handler hit la branche L654 → 400.
    db = _make_db_mock(_doc(club_id=CLUB_OTHER, archived_at="2025-01-01T00:00:00+00:00"))
    _patch_common(monkeypatch, db)

    with pytest.raises(Exception) as exc_info:
        await mb.set_member_pause(
            member_id="M1",
            payload={"start_date": "2026-02-01"},
            club_id=CLUB_A,
            current_user={"id": "u1", "email": "u@a.com"},
        )

    status = _status_of(exc_info)
    detail = _detail_of(exc_info)
    assert status == 404, (
        f"Cross-club pause doit raise 404 (no-enum leak), "
        f"got status={status} detail={detail!r}. "
        f"RED si gate L651 non scopé : handler voit le doc cross-club archivé "
        f"et raise 400 'Membre archivé' → fuite d'info sur l'état du doc cross-club."
    )
    # Discriminance explicite : surtout PAS 400 archivé.
    assert detail != "Membre archivé — restaurer avant de mettre en pause", (
        f"Discriminance anti-énum violée : detail={detail!r} révèle l'état "
        f"`archived_at` d'un doc cross-club."
    )
    # ZÉRO update_one : gate doit fermer AVANT toute mutation.
    assert db.customer_members.update_one.call_count == 0, (
        f"Cross-club gate doit empêcher TOUT update_one, "
        f"got {db.customer_members.update_one.call_count}."
    )


# ════════════════════════════════════════════════════════════════════════════
#   Gate #2 — remove_member_pause (L701) cross-club
#   State : member dans CLUB_OTHER (peu importe pause/archived — pas de branche)
#   Actuel : 200 {"message": "Pause annulée", ...}
#   Cible  : 404 "Membre introuvable"
# ════════════════════════════════════════════════════════════════════════════


async def test_remove_member_pause_cross_club_raises_404_not_200(monkeypatch):
    """🎯 RED : `remove_member_pause` doit raise 404 sur member cross-club,
    PAS retourner 200 "Pause annulée" (qui valide l'existence cross-club).
    """
    db = _make_db_mock(_doc(club_id=CLUB_OTHER))
    _patch_common(monkeypatch, db)

    with pytest.raises(Exception) as exc_info:
        await mb.remove_member_pause(
            member_id="M1",
            club_id=CLUB_A,
            current_user={"id": "u1", "email": "u@a.com"},
        )

    status = _status_of(exc_info)
    detail = _detail_of(exc_info)
    assert status == 404, (
        f"Cross-club unpause doit raise 404 (no-enum leak), "
        f"got status={status} detail={detail!r}. "
        f"RED si gate L701 non scopé : handler retourne 200 'Pause annulée' "
        f"sur un member cross-club → fuite d'existence."
    )
    assert db.customer_members.update_one.call_count == 0, (
        f"Cross-club gate doit empêcher TOUT update_one, "
        f"got {db.customer_members.update_one.call_count}."
    )


# ════════════════════════════════════════════════════════════════════════════
#   Gate #3 — delete_member (L1204) cross-club
#   State : member dans CLUB_OTHER, DÉJÀ ARCHIVÉ (branche idempotente actuelle)
#   Actuel : 200 {"message": "Soft delete applied (already archived)", ...}
#   Cible  : 404 "Membre introuvable"
# ════════════════════════════════════════════════════════════════════════════


async def test_delete_member_cross_club_raises_404_not_200_idempotent(monkeypatch):
    """🎯 RED : `delete_member` doit raise 404 sur member cross-club,
    PAS retourner 200 idempotent "already archived" (qui révèle l'état cross-club).
    """
    # Doc club B, déjà archivé → branche idempotente L1207-1209 actuelle = 200.
    db = _make_db_mock(_doc(club_id=CLUB_OTHER, archived_at="2025-01-01T00:00:00+00:00"))
    _patch_common(monkeypatch, db)

    try:
        result = await mb.delete_member(
            member_id="M1",
            club_id=CLUB_A,
            current_user={"id": "u1", "email": "u@a.com"},
        )
        # Pas d'exception → 200 retourné → RED.
        pytest.fail(
            f"Cross-club delete doit raise 404, mais a retourné un dict 200 : "
            f"{result!r}. "
            f"RED : gate L1204 non scopé → handler hit la branche idempotente "
            f"et révèle l'état `archived_at` d'un doc cross-club."
        )
    except Exception as exc:
        # Si une HTTPException est levée, on attend 404.
        status = getattr(exc, "status_code", None)
        detail = getattr(exc, "detail", None)
        assert status == 404, (
            f"Cross-club delete doit raise 404, got status={status} detail={detail!r}."
        )
        # Et surtout pas un message d'idempotence cross-club.
        assert detail != "Soft delete applied (already archived)"


# ════════════════════════════════════════════════════════════════════════════
#   Gate #4 — archive_member (L1230) cross-club
#   State : member dans CLUB_OTHER, DÉJÀ ARCHIVÉ (branche 400 actuelle)
#   Actuel : 400 "Membre déjà archivé"
#   Cible  : 404 "Membre introuvable"
# ════════════════════════════════════════════════════════════════════════════


async def test_archive_member_cross_club_raises_404_not_400_already_archived(monkeypatch):
    """🎯 RED : `archive_member` doit raise 404 sur member cross-club,
    PAS 400 "Membre déjà archivé" (qui révèle l'état cross-club).
    """
    db = _make_db_mock(_doc(club_id=CLUB_OTHER, archived_at="2025-01-01T00:00:00+00:00"))
    _patch_common(monkeypatch, db)

    with pytest.raises(Exception) as exc_info:
        await mb.archive_member(
            member_id="M1",
            body=None,
            club_id=CLUB_A,
            current_user={"id": "u1", "email": "u@a.com"},
        )

    status = _status_of(exc_info)
    detail = _detail_of(exc_info)
    assert status == 404, (
        f"Cross-club archive doit raise 404 (no-enum leak), "
        f"got status={status} detail={detail!r}. "
        f"RED si gate L1230 non scopé : handler raise 400 'Membre déjà archivé' "
        f"sur un doc cross-club → fuite d'état."
    )
    # Discriminance explicite.
    assert detail != "Membre déjà archivé", (
        f"Discriminance anti-énum violée : detail={detail!r} révèle l'état "
        f"`archived_at` d'un doc cross-club."
    )
    assert db.customer_members.update_one.call_count == 0


# ════════════════════════════════════════════════════════════════════════════
#   Gate #5 — restore_member (L1263) cross-club
#   State : member dans CLUB_OTHER, NON ARCHIVÉ (branche 400 actuelle)
#   Actuel : 400 "Membre déjà actif (non archivé)"
#   Cible  : 404 "Membre introuvable"
# ════════════════════════════════════════════════════════════════════════════


async def test_restore_member_cross_club_raises_404_not_400_not_archived(monkeypatch):
    """🎯 RED : `restore_member` doit raise 404 sur member cross-club,
    PAS 400 "déjà actif (non archivé)" (qui révèle l'état cross-club).
    """
    # Doc club B, NON archivé → branche L1266-1267 = 400 "déjà actif".
    db = _make_db_mock(_doc(club_id=CLUB_OTHER, archived_at=None))
    _patch_common(monkeypatch, db)

    with pytest.raises(Exception) as exc_info:
        await mb.restore_member(
            member_id="M1",
            club_id=CLUB_A,
            current_user={"id": "u1", "email": "u@a.com"},
        )

    status = _status_of(exc_info)
    detail = _detail_of(exc_info)
    assert status == 404, (
        f"Cross-club restore doit raise 404 (no-enum leak), "
        f"got status={status} detail={detail!r}. "
        f"RED si gate L1263 non scopé : handler raise 400 'déjà actif' "
        f"sur un doc cross-club → fuite d'état."
    )
    assert detail != "Membre déjà actif (non archivé)", (
        f"Discriminance anti-énum violée : detail={detail!r} révèle l'état "
        f"`archived_at` d'un doc cross-club."
    )
    assert db.customer_members.update_one.call_count == 0
