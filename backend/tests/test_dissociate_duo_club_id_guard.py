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
    """Mock filtre-aware (sémantique Mongo) : find_one retourne `member_doc`
    UNIQUEMENT si toutes les clés du filter matchent. Aligné avec C.2.A/C.2.B
    où le scope se fait au niveau du `find_one` (filter composite) et non plus
    via un gate post-read.
    """
    async def _find_one_filtered(filter_dict, projection=None):
        for k, v in (filter_dict or {}).items():
            if member_doc.get(k) != v:
                return None
        return member_doc

    members_coll = MagicMock()
    members_coll.find_one = AsyncMock(side_effect=_find_one_filtered)
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
#   Test 2 — Cross-club gate : member d'un autre club → 404 silencieux,
#                              ZÉRO op DB déclenchée (ferme la fuite TRAP)
# ════════════════════════════════════════════════════════════════════════════


async def test_dissociate_duo_cross_club_raises_404_and_no_db_ops(monkeypatch):
    """🎯 GATE B.3-bis : si le membre cible appartient à un autre club que
    celui du requester, l'endpoint doit raise 404 (message identique au 404
    "Membre introuvable" pour no-enumeration leak) AVANT toute opération DB.

    Construction :
      - header X-Club-Id = CLUB_A
      - member retourné par find_one a club_id = CLUB_OTHER
      - Attendu : HTTPException 404 + 0 update_one + 0 update_many
        (preuve que la fuite via L1161 update_many reverse-lookup est fermée).
    """
    db = _make_db_mock(_existing_duo_member(club_id=CLUB_OTHER))
    _patch_common(monkeypatch, db)

    with pytest.raises(Exception) as exc_info:
        await mb.dissociate_duo(
            member_id="M1",
            club_id=CLUB_A,
            current_user={"id": "u1", "email": "u@a.com"},
        )

    # 404 attendu (HTTPException avec status_code 404)
    assert getattr(exc_info.value, "status_code", None) == 404, (
        f"Gate cross-club doit raise 404, got status={getattr(exc_info.value, 'status_code', None)} "
        f"detail={getattr(exc_info.value, 'detail', None)}"
    )
    # ZÉRO op DB : ni update_one, ni update_many (gate AVANT toute mutation).
    assert db.customer_members.update_one.call_count == 0, (
        f"Cross-club gate doit empêcher TOUT update_one, "
        f"got {db.customer_members.update_one.call_count} call(s). "
        f"Fuite TRAP non fermée."
    )
    assert db.customer_members.update_many.call_count == 0, (
        f"Cross-club gate doit empêcher update_many (reverse-lookup L1161), "
        f"got {db.customer_members.update_many.call_count} call(s). "
        f"Fuite TRAP non fermée."
    )


# ════════════════════════════════════════════════════════════════════════════
#   Test 3 — Gate placé AVANT le check is_duo (no info-leak sur cross-club)
# ════════════════════════════════════════════════════════════════════════════


async def test_dissociate_duo_cross_club_non_duo_raises_404_not_400(monkeypatch):
    """🎯 GATE PLACEMENT : un member cross-club non-DUO doit retourner 404
    (pas 400). Cela prouve que le gate cross-club s'exécute AVANT le check
    `is_duo`, ce qui ferme tout info-leak (un user du club A ne peut pas
    déterminer si un member id du club B est DUO ou non via le code de retour).
    """
    # Member cross-club ET non-DUO : si le check is_duo était devant le gate,
    # on retournerait 400 "n'est pas un DUO" → fuite d'information.
    db = _make_db_mock(_existing_duo_member(club_id=CLUB_OTHER, is_duo=False))
    _patch_common(monkeypatch, db)

    with pytest.raises(Exception) as exc_info:
        await mb.dissociate_duo(
            member_id="M1",
            club_id=CLUB_A,
            current_user={"id": "u1", "email": "u@a.com"},
        )

    status = getattr(exc_info.value, "status_code", None)
    assert status == 404, (
        f"Gate cross-club doit s'exécuter AVANT check is_duo : 404 attendu "
        f"(no info-leak), got {status}. Si 400, le gate est mal placé "
        f"(le code 400 révèle l'existence + la non-DUO-ness du member cross-club)."
    )
