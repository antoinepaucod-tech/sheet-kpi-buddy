"""Tests régression SB B.2.3.C.2.B — scope `club_id` sur le gate `find_one`
de `dissociate_duo` (members.py L1152) + cartographie de la redondance future
du gate B.3-bis (L1163).

🚨 ANTI-TAUTOLOGIE B.3-bis 🚨
Le gate L1163 (`if member.get("club_id") != club_id_resolved: raise 404`)
referme DÉJÀ aujourd'hui le cas cross-club, mais via une vérification post-read.
Tester naïvement "cross-club → 404" donnerait un test GREEN d'emblée — non
discriminant pour le scope qu'on veut ajouter au `find_one` lui-même.

Stratégie retenue : tester la **LECTURE** (ce que retourne le `find_one`
et avec quel filter) plutôt que le code de sortie. Ainsi le RED est honnête :
    - Aujourd'hui : `find_one({"id": member_id})` (id-only) → mock filtre-aware
      retourne le doc cross-club → assertion RED.
    - Après patch C.2.B : `find_one({"id": member_id, "club_id": resolved})`
      → mock filtre-aware retourne None pour le doc cross-club → GREEN.
    - Et le gate B.3-bis L1163 deviendra dead-code par construction.

Contrat CIBLE après patch C.2.B :
    - `find_one` gate scopé `{"id": member_id, "club_id": club_id_resolved}`.
    - Ordre : resolve_club_id_or_fallback AVANT find_one.
    - Gate B.3-bis L1163 retiré (devenu structurellement inatteignable).
    - Writes W14/W15/W16 inchangés (déjà scopés depuis B.3+bis, anti-régression).
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from routers import members as mb


pytestmark = [pytest.mark.regression, pytest.mark.asyncio]


CLUB_A = "club-A-versoix"
CLUB_OTHER = "club-OTHER"
FALLBACK = "FALLBACK_VERSOIX"


def _doc_duo(**overrides):
    """Membre DUO primary minimal (club CLUB_OTHER par défaut)."""
    doc = {
        "id": "M1",
        "club_id": CLUB_OTHER,
        "is_duo": True,
        "duo_partner_id": "P1",
        "duo_primary": True,
        "name": "Member M1",
    }
    doc.update(overrides)
    return doc


def _make_db_mock(member_doc):
    """Mock `db.customer_members` avec `find_one` filtre-aware (sémantique Mongo) :
    retourne `member_doc` UNIQUEMENT si TOUTES les clés du filter matchent.
    Ce comportement est ce qui rend les tests discriminants : un gate non scopé
    (`{"id": ...}`) match toujours le doc, scopé (`{"id": ..., "club_id": ...}`)
    ne match pas cross-club.
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
    monkeypatch.setattr(
        mb,
        "resolve_club_id_or_fallback",
        lambda club_id, current_user, endpoint: club_id or FALLBACK,
    )
    monkeypatch.setattr(mb, "log_activity", AsyncMock())


# ════════════════════════════════════════════════════════════════════════════
#   Test 1 — RED ANTI-TAUTOLOGIQUE : le find_one gate doit retourner None
#   sur un doc cross-club, INDÉPENDAMMENT du gate B.3-bis L1163.
# ════════════════════════════════════════════════════════════════════════════


async def test_dissociate_duo_gate_find_one_returns_none_on_cross_club_doc(monkeypatch):
    """🎯 RED non-tautologique — on inspecte le RÉSULTAT du find_one gate,
    pas le code de sortie HTTP.

    Aujourd'hui :
      - filter = {"id": member_id} (id-only)
      - mock filtre-aware : match {"id": "M1"} sur doc club B (id="M1") → matche
      - find_one retourne le doc cross-club → assertion RED
      - B.3-bis L1163 referme ensuite via raise 404, mais ce test ne regarde pas ça

    Après patch C.2.B :
      - filter = {"id": member_id, "club_id": club_id_resolved="A"}
      - mock filtre-aware : club_id mismatch ("OTHER" ≠ "A") → None
      - find_one retourne None → GREEN

    On capture le résultat du find_one via side_effect, puis on laisse le
    handler échouer (B.3-bis va raise 404 sur le doc actuel). Ce qui compte
    est ce qu'a retourné la lecture, pas le statut final.
    """
    doc_club_b = _doc_duo(club_id=CLUB_OTHER)
    db = _make_db_mock(doc_club_b)
    _patch_common(monkeypatch, db)

    # Wrapper capturant le résultat du PREMIER find_one (gate).
    captured: dict = {}
    original_side_effect = db.customer_members.find_one.side_effect

    async def _capturing(filter_dict, projection=None):
        result = await original_side_effect(filter_dict, projection)
        if "first_filter" not in captured:
            captured["first_filter"] = filter_dict
            captured["first_result"] = result
        return result

    db.customer_members.find_one = AsyncMock(side_effect=_capturing)

    # On exécute en absorbant l'éventuelle HTTPException (B.3-bis ou autre).
    try:
        await mb.dissociate_duo(
            member_id="M1",
            club_id=CLUB_A,
            current_user={"id": "u1", "email": "u@a.com"},
        )
    except Exception:
        pass  # On ne juge PAS le code de sortie — uniquement le résultat de la lecture.

    # ─── Assertion clé : le find_one gate ne doit PAS avoir retourné le doc
    #     cross-club. Cible la LECTURE, pas le code HTTP.
    assert captured.get("first_result") is None, (
        f"❌ RED : find_one gate (filter={captured.get('first_filter')!r}) a "
        f"retourné un doc cross-club {{id={doc_club_b['id']!r}, club_id={doc_club_b['club_id']!r}}} "
        f"alors que header X-Club-Id={CLUB_A!r}. "
        f"Aujourd'hui SEUL le gate B.3-bis L1163 ferme cette fuite. "
        f"Le scope doit être au niveau du `find_one` (filter composite "
        f"`{{id, club_id: resolved}}`) → après patch, ce résultat doit être None."
    )


# ════════════════════════════════════════════════════════════════════════════
#   Test 2 — RED ANTI-TAUTOLOGIQUE : équivalence no-enum prouvée par la LECTURE
#   cross-club existant ≡ fake-id : les deux find_one gates doivent retourner None.
# ════════════════════════════════════════════════════════════════════════════


async def test_dissociate_duo_no_enum_via_find_one_result_equivalence(monkeypatch):
    """🎯 RED non-tautologique — équivalence no-enum testée AU NIVEAU de la
    lecture, pas du code de sortie.

    Aujourd'hui (filter id-only) :
      - cross-club (id réel, club B) : find_one retourne le doc → NOT None.
      - fake-id (id inexistant)      : find_one retourne None.
      → asymétrie de la LECTURE → un attaquant ayant accès au pipeline DB
        pourrait distinguer les deux cas → RED.

    Après patch C.2.B (filter composite) :
      - cross-club : club_id mismatch → None.
      - fake-id    : id mismatch     → None.
      → symétrie parfaite au niveau de la LECTURE → GREEN.

    B.3-bis L1163 referme aujourd'hui l'asymétrie au niveau du statut HTTP,
    mais PAS au niveau de la lecture sous-jacente. Ce test cible la lecture.
    """
    # ─── Scénario A : doc cross-club réel ─────────────────────────────────
    doc_club_b = _doc_duo(club_id=CLUB_OTHER, id="M1")
    db_cross = _make_db_mock(doc_club_b)
    _patch_common(monkeypatch, db_cross)

    captured_cross: dict = {}
    orig_cross = db_cross.customer_members.find_one.side_effect

    async def _cap_cross(filter_dict, projection=None):
        result = await orig_cross(filter_dict, projection)
        captured_cross.setdefault("result", result)
        return result

    db_cross.customer_members.find_one = AsyncMock(side_effect=_cap_cross)

    try:
        await mb.dissociate_duo(
            member_id="M1",
            club_id=CLUB_A,
            current_user={"id": "u1", "email": "u@a.com"},
        )
    except Exception:
        pass

    # ─── Scénario B : id inexistant ─────────────────────────────────────
    # Même setup (doc club B en base) mais on requête un id différent.
    db_fake = _make_db_mock(doc_club_b)
    _patch_common(monkeypatch, db_fake)

    captured_fake: dict = {}
    orig_fake = db_fake.customer_members.find_one.side_effect

    async def _cap_fake(filter_dict, projection=None):
        result = await orig_fake(filter_dict, projection)
        captured_fake.setdefault("result", result)
        return result

    db_fake.customer_members.find_one = AsyncMock(side_effect=_cap_fake)

    try:
        await mb.dissociate_duo(
            member_id="MFAKE",
            club_id=CLUB_A,
            current_user={"id": "u1", "email": "u@a.com"},
        )
    except Exception:
        pass

    # ─── Assertion clé : SYMÉTRIE de la LECTURE entre les deux scénarios.
    # Aujourd'hui : cross-club result = doc (not None), fake result = None → asymétrie → RED.
    # Après patch : les deux = None → GREEN.
    assert captured_cross.get("result") is None and captured_fake.get("result") is None, (
        f"❌ RED — asymétrie de la lecture (fuite no-enum au niveau DB) :\n"
        f"  cross-club find_one → {captured_cross.get('result')!r}\n"
        f"  fake-id    find_one → {captured_fake.get('result')!r}\n"
        f"Les deux doivent retourner None (symétrie no-enum au niveau lecture). "
        f"Aujourd'hui le filter id-only fait matcher le doc cross-club mais pas "
        f"le fake-id → un attaquant DB-level distingue les deux cas. "
        f"B.3-bis L1163 ne ferme que le statut HTTP final, pas la lecture."
    )


# ════════════════════════════════════════════════════════════════════════════
#   Test 3 — Happy path intra-club préservé (anti-régression).
#   Après patch C.2.B, la dissociation intra-club doit toujours réussir.
# ════════════════════════════════════════════════════════════════════════════


async def test_dissociate_duo_intra_club_happy_path_preserved(monkeypatch):
    """🟢 Anti-régression : dissociation DUO intra-club fonctionne.

    Aujourd'hui : GREEN (find_one id-only matche, B.3-bis ne trip pas).
    Après patch : GREEN (find_one composite {id, club_id=A} matche le doc club A).

    Si ce test casse, c'est qu'on a sur-scopé ou cassé l'ordre resolve→find_one.
    """
    doc_club_a = _doc_duo(club_id=CLUB_A, id="M1", duo_partner_id="P1", is_duo=True, duo_primary=True)
    db = _make_db_mock(doc_club_a)
    _patch_common(monkeypatch, db)

    result = await mb.dissociate_duo(
        member_id="M1",
        club_id=CLUB_A,
        current_user={"id": "u1", "email": "u@a.com"},
    )

    assert isinstance(result, dict), f"Attendu dict de réponse, got {type(result)}"
    assert result.get("member_id") == "M1"
    assert result.get("partner_id") == "P1"


# ════════════════════════════════════════════════════════════════════════════
#   Test 4 — Anti-régression W15/W16 : writes secondaires partner + reverse
#   restent scopés `club_id_resolved` (acquis SB B.2.3.B.3+bis).
# ════════════════════════════════════════════════════════════════════════════


async def test_dissociate_duo_partner_and_reverse_writes_scoped_by_resolved(monkeypatch):
    """🟢 Anti-régression : W15 (update_one partner) et W16 (update_many reverse)
    DOIVENT inclure `club_id: club_id_resolved` dans leur filter, même après
    patch C.2.B (le scope du gate ne doit pas réintroduire de fuite ailleurs).
    """
    doc_club_a = _doc_duo(club_id=CLUB_A, id="M1", duo_partner_id="P1", is_duo=True, duo_primary=True)
    db = _make_db_mock(doc_club_a)
    _patch_common(monkeypatch, db)

    await mb.dissociate_duo(
        member_id="M1",
        club_id=CLUB_A,
        current_user={"id": "u1", "email": "u@a.com"},
    )

    update_one_calls = db.customer_members.update_one.call_args_list
    update_many_calls = db.customer_members.update_many.call_args_list

    # W14 : update_one member (déjà scopé depuis B.2.3.B.3).
    assert any(
        c.args[0].get("id") == "M1" and c.args[0].get("club_id") == CLUB_A
        for c in update_one_calls
    ), f"W14 update_one(member) doit être scopé club_id={CLUB_A}. Calls={update_one_calls}"

    # W15 : update_one partner.
    assert any(
        c.args[0].get("id") == "P1" and c.args[0].get("club_id") == CLUB_A
        for c in update_one_calls
    ), f"W15 update_one(partner) doit être scopé club_id={CLUB_A}. Calls={update_one_calls}"

    # W16 : update_many reverse-lookup.
    assert len(update_many_calls) == 1, (
        f"W16 update_many(reverse) attendu, got {len(update_many_calls)}. "
        f"Si 0 : régression du contrat update_many introduit en B.2.3.B.3+bis."
    )
    f_reverse = update_many_calls[0].args[0]
    assert f_reverse.get("duo_partner_id") == "M1"
    assert f_reverse.get("club_id") == CLUB_A, (
        f"W16 update_many(reverse) doit être scopé club_id={CLUB_A}. Filter={f_reverse}"
    )
