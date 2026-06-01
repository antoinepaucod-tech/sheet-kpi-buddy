"""Tests régression SB B.2.3.B.3 — scope `club_id` composite sur les 3 opérations
DB de `dissociate_duo` (members.py L1136-1169).

Décision architecturale (rappel A.2 + audit B.3) :
  - Les 3 ops sont scopées par le club du **requester** (header X-Club-Id résolu),
    JAMAIS par `member.club_id` du document cible.
  - L1155  update_one  {id: member_id,   club_id: club_id_resolved}
  - L1159  update_one  {id: partner_id,  club_id: club_id_resolved}
  - L1161  update_many {duo_partner_id: member_id, club_id: club_id_resolved}
            (conversion `update_one` → `update_many` : contrat sémantique
             "clear TOUS les reverse links" et non "le premier trouvé")

Signature CIBLE (vs signature actuelle `(member_id)` only) :
    async def dissociate_duo(
        member_id: str,
        club_id: Optional[str] = Depends(get_club_id),
        current_user: dict = Depends(get_current_user),
    )

Tests :
  - test_dissociate_duo_three_ops_scope_club_id_from_header
    → 3 asserts filtre (M1, P1, reverse) tous portent club_id="A" (header) ;
      la fonction retourne son dict normalement (isolation par filtre, pas par raise).
  - test_dissociate_duo_cross_club_uses_header_not_member_doc
    → member.club_id = "OTHER" mais header = "A". Les 3 filtres scopent "A".

État attendu sur code actuel : ROUGE (RED).
  - Soit TypeError (signature actuelle sans `club_id`/`current_user` kwargs)
  - Soit AssertionError ("club_id" absent du filter / call_args sur update_many vide
    car L1161 est aujourd'hui un update_one)

0 mutation DB réelle (mocks `AsyncMock` pure).
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from routers import members as mb


pytestmark = [pytest.mark.regression, pytest.mark.asyncio]


CLUB_A = "club-A-versoix"
CLUB_OTHER = "club-OTHER"


def _existing_duo_member(**overrides):
    """Member DUO primary minimal (retour du find_one amont)."""
    doc = {
        "id": "M1",
        "club_id": CLUB_A,
        "is_duo": True,
        "duo_partner_id": "P1",
        "duo_primary": True,
        "name": "Member M1",
    }
    doc.update(overrides)
    return doc


def _make_db_mock(member_doc):
    members_coll = MagicMock()
    members_coll.find_one = AsyncMock(return_value=member_doc)
    members_coll.update_one = AsyncMock(return_value=MagicMock(modified_count=1))
    members_coll.update_many = AsyncMock(return_value=MagicMock(modified_count=1))

    db = MagicMock()
    db.customer_members = members_coll
    return db


def _patch_common(monkeypatch, db):
    monkeypatch.setattr(mb, "db", db)
    # Resolver : priorise header (club_id arg) puis fallback Versoix sentinelle.
    # Cohérent avec real resolve_club_id_or_fallback (header > DEFAULT_CLUB_ID).
    monkeypatch.setattr(
        mb,
        "resolve_club_id_or_fallback",
        lambda club_id, current_user, endpoint: club_id or "FALLBACK_VERSOIX",
    )
    monkeypatch.setattr(mb, "log_activity", AsyncMock())


# ════════════════════════════════════════════════════════════════════════════
#   Test 1 — Les 3 ops sont scopées par le club du header (requester)
# ════════════════════════════════════════════════════════════════════════════


async def test_dissociate_duo_three_ops_scope_club_id_from_header(monkeypatch):
    """Les 3 ops DB de dissociate_duo doivent porter `club_id=CLUB_A` (header) :
      - L1155 update_one  : {"id": "M1", "club_id": "A"}
      - L1159 update_one  : {"id": "P1", "club_id": "A"}
      - L1161 update_many : {"duo_partner_id": "M1", "club_id": "A"}

    Isolation prouvée par le filtre. Aucun raise attendu : la fonction
    retourne son dict de réponse normalement.
    """
    db = _make_db_mock(_existing_duo_member(club_id=CLUB_A))
    _patch_common(monkeypatch, db)

    result = await mb.dissociate_duo(
        member_id="M1",
        club_id=CLUB_A,
        current_user={"id": "u1", "email": "u@a.com"},
    )

    # ─── Assert filtre #1 — L1155 update_one(member) ──────────────────────
    # RED si "club_id" retiré du filter par le patch métier.
    update_one_calls = db.customer_members.update_one.call_args_list
    assert len(update_one_calls) >= 2, (
        f"Attendu ≥2 update_one (member + partner), got {len(update_one_calls)}"
    )
    f1 = update_one_calls[0].args[0]
    assert f1.get("id") == "M1"
    assert f1.get("club_id") == CLUB_A, (
        f"L1155 update_one(member) filter sans `club_id` scopé : {f1}. "
        f"RED si club_id retiré du filter."
    )

    # ─── Assert filtre #2 — L1159 update_one(partner) ─────────────────────
    # RED si "club_id" retiré du filter sur le partner (cross-member).
    f2 = update_one_calls[1].args[0]
    assert f2.get("id") == "P1"
    assert f2.get("club_id") == CLUB_A, (
        f"L1159 update_one(partner) filter sans `club_id` scopé : {f2}. "
        f"RED si club_id retiré du filter (cross-member partner leak possible)."
    )

    # ─── Assert filtre #3 — L1161 update_many(reverse lookup) ─────────────
    # RED si conversion update_one→update_many non faite, ou club_id absent.
    update_many_calls = db.customer_members.update_many.call_args_list
    assert len(update_many_calls) == 1, (
        f"Attendu 1 update_many(reverse lookup), got {len(update_many_calls)}. "
        f"RED si L1161 reste un update_one au lieu d'update_many."
    )
    f3 = update_many_calls[0].args[0]
    assert f3.get("duo_partner_id") == "M1"
    assert f3.get("club_id") == CLUB_A, (
        f"L1161 update_many(reverse) filter sans `club_id` scopé : {f3}. "
        f"RED si club_id retiré du filter (reverse-lookup cross-club leak)."
    )

    # ─── Assert discriminance — return normal, isolation par filtre seule ─
    # Aucun raise. La fonction renvoie son dict de réponse.
    assert isinstance(result, dict)
    assert result.get("member_id") == "M1"
    assert result.get("partner_id") == "P1"


# ════════════════════════════════════════════════════════════════════════════
#   Test 2 — Cross-club : scope vient du HEADER, pas de member.club_id (A.2)
# ════════════════════════════════════════════════════════════════════════════


async def test_dissociate_duo_cross_club_uses_header_not_member_doc(monkeypatch):
    """🎯 INVARIANT A.2 : le scope ne provient JAMAIS du document cible.

    Construction :
      - header X-Club-Id = CLUB_A (requester)
      - member retourné par find_one a club_id = CLUB_OTHER (leak/orphan)
      - Les 3 filtres DB doivent scoper CLUB_A (header), PAS CLUB_OTHER (doc).

    Si le code utilise `member.get("club_id")` dans le resolver,
    les 3 filtres scoperont CLUB_OTHER → test RED → preuve violation A.2.
    """
    db = _make_db_mock(_existing_duo_member(club_id=CLUB_OTHER))
    _patch_common(monkeypatch, db)

    result = await mb.dissociate_duo(
        member_id="M1",
        club_id=CLUB_A,  # header
        current_user={"id": "u1", "email": "u@a.com"},
    )

    update_one_calls = db.customer_members.update_one.call_args_list
    update_many_calls = db.customer_members.update_many.call_args_list
    assert len(update_one_calls) >= 2
    assert len(update_many_calls) == 1

    f1 = update_one_calls[0].args[0]
    f2 = update_one_calls[1].args[0]
    f3 = update_many_calls[0].args[0]

    # Les 3 filtres scopent CLUB_A (header), pas CLUB_OTHER (doc).
    # RED si le code utilise member.club_id comme source de scope.
    assert f1.get("club_id") == CLUB_A
    assert f1.get("club_id") != CLUB_OTHER
    assert f2.get("club_id") == CLUB_A
    assert f2.get("club_id") != CLUB_OTHER
    assert f3.get("club_id") == CLUB_A
    assert f3.get("club_id") != CLUB_OTHER

    # Retour normal : isolation par filtre, pas par exception.
    assert isinstance(result, dict)
    assert result.get("member_id") == "M1"
