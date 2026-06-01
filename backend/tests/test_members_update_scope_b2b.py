"""Tests régression SB B.2.3.B.2.b — scope `club_id` composite sur 3 update_one
customer_members SANS aucun Depends actuel (pause, remove-pause, delete) :

  - L668  set_member_pause           (PUT /members/{id}/pause)
  - L681  remove_member_pause        (DELETE /members/{id}/pause)
  - L1165 delete_member              (DELETE /members/{id})

Pattern attendu après patch :
  - signature : ajout `club_id: Optional[str] = Depends(get_club_id)`
                + `current_user: dict = Depends(get_current_user)`
  - corps : `club_id_resolved = resolve_club_id_or_fallback(
                club_id=club_id or existing.get("club_id"),
                current_user=current_user, endpoint=...)`
  - filter : `{"id": member_id, "club_id": club_id_resolved}`
  - projection find_one (pause/remove-pause) : ÉLARGIE à inclure "club_id": 1

Test discriminant non-Versoix : prouve que l'élargissement de la projection
est OBLIGATOIRE. Sans projection club_id, `existing.get("club_id") == None` →
resolver fallback Versoix → bug silencieux pour les membres d'un autre club.

0 mutation DB réelle (mocks `AsyncMock` pure).
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from routers import members as mb


pytestmark = [pytest.mark.regression, pytest.mark.asyncio]


CLUB_VERSOIX = "0a327bf5-c759-49eb-87e4-551913f78bdb"
CLUB_SERVETTE = "9bfdb209-066d-4d11-b195-a6b9533b8cb8"
CLUB_OTHER = "FAKE_OTHER_CLUB_B2B"


def _existing_member(**overrides):
    doc = {
        "id": "mem-1",
        "club_id": CLUB_VERSOIX,
        "archived_at": None,
        "name": "Test Member",
    }
    doc.update(overrides)
    return doc


def _make_db_mock(member_doc=None):
    members_coll = MagicMock()
    members_coll.find_one = AsyncMock(return_value=member_doc)
    members_coll.update_one = AsyncMock(return_value=MagicMock(modified_count=1))

    db = MagicMock()
    db.customer_members = members_coll
    return db


def _patch_common(monkeypatch, db):
    monkeypatch.setattr(mb, "db", db)
    # Mock du resolver : priorise header puis existing.club_id puis fallback Versoix.
    # Match comportement réel `resolve_club_id_or_fallback`.
    monkeypatch.setattr(
        mb,
        "resolve_club_id_or_fallback",
        lambda club_id, current_user, endpoint: club_id or CLUB_VERSOIX,
    )
    monkeypatch.setattr(mb, "log_activity", AsyncMock())


def _update_filter(db):
    assert db.customer_members.update_one.called, "update_one customer_members non appelé"
    return db.customer_members.update_one.call_args.args[0]


# ════════════════════════════════════════════════════════════════════════════
#   set_member_pause L668
# ════════════════════════════════════════════════════════════════════════════


async def test_pause_includes_club_id_filter(monkeypatch):
    """PUT /members/{id}/pause : filter update_one DOIT scoper club_id (header)."""
    db = _make_db_mock(_existing_member())
    _patch_common(monkeypatch, db)

    await mb.set_member_pause(
        member_id="mem-1",
        payload={"start_date": "2026-06-01"},
        club_id=CLUB_VERSOIX,
        current_user={"id": "u1", "email": "u@a.com"},
    )

    f = _update_filter(db)
    assert f.get("id") == "mem-1"
    assert "club_id" in f, f"set_member_pause filter sans `club_id` : {f}"
    assert f["club_id"] == CLUB_VERSOIX


async def test_pause_cross_club_does_not_leak(monkeypatch):
    """Header Versoix mais existing.club_id = OTHER : scope reste sur header."""
    db = _make_db_mock(_existing_member(club_id=CLUB_OTHER))
    _patch_common(monkeypatch, db)

    await mb.set_member_pause(
        member_id="mem-1",
        payload={"start_date": "2026-06-01"},
        club_id=CLUB_VERSOIX,
        current_user={"id": "u1", "email": "u@a.com"},
    )

    f = _update_filter(db)
    assert f.get("club_id") == CLUB_VERSOIX
    assert f.get("club_id") != CLUB_OTHER


async def test_pause_no_header_scopes_by_USER_not_doc(monkeypatch):
    """🎯 DISCRIMINANT INVARIANT A.2 : le scope `club_id` ne vient JAMAIS
    du document cible (`doc.get("club_id")`). Sans header X-Club-Id, le
    filter doit scoper sur le fallback resolver (Versoix), PAS sur le
    `doc.club_id` retourné par find_one.

    Construction :
      - PAS de header X-Club-Id (club_id=None)
      - doc.club_id = Servette
      - Resolver sans header → fallback Versoix
      - Filter attendu = `{id, club_id: Versoix}` → 0 match sur doc Servette
        → mutation cross-club bloquée par construction.

    Si le code utilise `doc.get("club_id")` en cascade resolver, le filter
    scope Servette → test fail (preuve qu'on utilise le doc, viol A.2).
    """
    db = _make_db_mock(_existing_member(club_id=CLUB_SERVETTE))
    _patch_common(monkeypatch, db)

    await mb.set_member_pause(
        member_id="mem-1",
        payload={"start_date": "2026-06-01"},
        club_id=None,  # ← pas de header
        current_user={"id": "u1", "email": "u@a.com"},
    )

    f = _update_filter(db)
    assert f.get("club_id") != CLUB_SERVETTE, (
        f"Violation A.2 : filter scope sur doc.club_id ({CLUB_SERVETTE}). "
        f"Le scope ne doit JAMAIS provenir du document cible."
    )
    assert f.get("club_id") == CLUB_VERSOIX, (
        f"Sans header, filter doit scoper sur le fallback resolver Versoix. "
        f"Got: {f.get('club_id')}"
    )


# ════════════════════════════════════════════════════════════════════════════
#   remove_member_pause L681
# ════════════════════════════════════════════════════════════════════════════


async def test_remove_pause_includes_club_id_filter(monkeypatch):
    """DELETE /members/{id}/pause : filter update_one DOIT scoper club_id."""
    db = _make_db_mock(_existing_member())
    _patch_common(monkeypatch, db)

    await mb.remove_member_pause(
        member_id="mem-1",
        club_id=CLUB_VERSOIX,
        current_user={"id": "u1", "email": "u@a.com"},
    )

    f = _update_filter(db)
    assert f.get("id") == "mem-1"
    assert "club_id" in f, f"remove_member_pause filter sans `club_id` : {f}"
    assert f["club_id"] == CLUB_VERSOIX


async def test_remove_pause_cross_club_does_not_leak(monkeypatch):
    """Header Versoix mais existing.club_id = OTHER : scope reste sur header."""
    db = _make_db_mock(_existing_member(club_id=CLUB_OTHER))
    _patch_common(monkeypatch, db)

    await mb.remove_member_pause(
        member_id="mem-1",
        club_id=CLUB_VERSOIX,
        current_user={"id": "u1", "email": "u@a.com"},
    )

    f = _update_filter(db)
    assert f.get("club_id") == CLUB_VERSOIX
    assert f.get("club_id") != CLUB_OTHER


async def test_remove_pause_no_header_scopes_by_USER_not_doc(monkeypatch):
    """🎯 DISCRIMINANT INVARIANT A.2 (idem pause) : scope ne provient JAMAIS du doc."""
    db = _make_db_mock(_existing_member(club_id=CLUB_SERVETTE))
    _patch_common(monkeypatch, db)

    await mb.remove_member_pause(
        member_id="mem-1",
        club_id=None,
        current_user={"id": "u1", "email": "u@a.com"},
    )

    f = _update_filter(db)
    assert f.get("club_id") != CLUB_SERVETTE, (
        f"Violation A.2 : filter scope sur doc.club_id ({CLUB_SERVETTE})."
    )
    assert f.get("club_id") == CLUB_VERSOIX, (
        f"Sans header, filter doit scoper sur le fallback resolver Versoix. "
        f"Got: {f.get('club_id')}"
    )


# ════════════════════════════════════════════════════════════════════════════
#   delete_member L1165
# ════════════════════════════════════════════════════════════════════════════


async def test_delete_member_includes_club_id_filter(monkeypatch):
    """DELETE /members/{id} (soft delete redirect) : filter update_one scope club_id."""
    db = _make_db_mock(_existing_member())
    _patch_common(monkeypatch, db)

    await mb.delete_member(
        member_id="mem-1",
        club_id=CLUB_VERSOIX,
        current_user={"id": "u1", "email": "u@a.com"},
    )

    f = _update_filter(db)
    assert f.get("id") == "mem-1"
    assert "club_id" in f, f"delete_member filter sans `club_id` : {f}"
    assert f["club_id"] == CLUB_VERSOIX


async def test_delete_member_cross_club_does_not_leak(monkeypatch):
    """Header Versoix mais existing.club_id = OTHER : scope reste sur header."""
    db = _make_db_mock(_existing_member(club_id=CLUB_OTHER))
    _patch_common(monkeypatch, db)

    await mb.delete_member(
        member_id="mem-1",
        club_id=CLUB_VERSOIX,
        current_user={"id": "u1", "email": "u@a.com"},
    )

    f = _update_filter(db)
    assert f.get("club_id") == CLUB_VERSOIX
    assert f.get("club_id") != CLUB_OTHER


async def test_delete_member_no_header_scopes_by_USER_not_doc(monkeypatch):
    """🎯 DISCRIMINANT INVARIANT A.2 : scope ne provient JAMAIS du doc."""
    db = _make_db_mock(_existing_member(club_id=CLUB_SERVETTE))
    _patch_common(monkeypatch, db)

    await mb.delete_member(
        member_id="mem-1",
        club_id=None,
        current_user={"id": "u1", "email": "u@a.com"},
    )

    f = _update_filter(db)
    assert f.get("club_id") != CLUB_SERVETTE, (
        f"Violation A.2 : filter scope sur doc.club_id ({CLUB_SERVETTE})."
    )
    assert f.get("club_id") == CLUB_VERSOIX, (
        f"Sans header, filter doit scoper sur le fallback resolver Versoix. "
        f"Got: {f.get('club_id')}"
    )
