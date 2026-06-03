"""Tests régression SB B.2.3.C.3.A.2 — scope `club_id` sur PUT
`/course-types/{type_id}` (4 ops course_types/course_kpis).

État actuel (audit C.3.A) :
  - L145 PUT signature `(type_id, data, club_id=Depends(get_club_id))`
        sans `current_user`. 4 ops :
        L152 #5 find_one  {id: type_id}                ← read target NON scopé (A.2)
        L161 #6 find_one  _cq(club_id, {name, id:$ne}) ← dedup raw-header
        L166 #7 update_one {id: type_id}               ← mutation NON scopée (A.2)
        L169 #8 update_many course_kpis {course_name}  ← cascade CATASTROPHIQUE
                                                          (renomme TOUS clubs)

  - Conditions : #6/#7/#8 sous `if old_name != new_name` (early-return L157-158).
    Tous les tests qui veulent les couvrir DOIVENT faire un VRAI rename.

Décision architecturale CIBLE :
  - Signature élargie `(type_id, data, club_id, current_user)`.
  - Resolver `club_id_resolved = resolve_club_id_or_fallback(...)`.
  - **Invariant A.2** : `club_id_resolved` issu du HEADER (priorité) puis
    fallback `current_user`. JAMAIS de `existing.get("club_id")` pour scoper
    une mutation (sinon rouvre la fuite Pattern A.2 sur la cascade #8).
  - #5 find_one  filter {id: type_id, club_id: club_id_resolved}
  - #6 find_one  filter {name: new_name, id: {$ne: type_id}, club_id: club_id_resolved}
  - #7 update_one filter {id: type_id, club_id: club_id_resolved}
  - #8 update_many filter {course_name: old_name, club_id: club_id_resolved}
    (PAS existing.club_id — c'est précisément l'invariant A.2 sur cascade).

Setup tests :
  - Header `club_id="club-A"` (présent) + `current_user.active_club_id="club-B"`.
  - Resolver patché priorise le header → resolved="club-A".
  - `existing` retourné par #5 a `club_id="club-OTHER"` (pour prouver que la
    cascade #8 ne dérive PAS de `existing.club_id`).
  - Rename forcé : `new_name="Hyrox Power"` ≠ `old_name="Hyrox"` → traverse
    bien #6, #7, #8.

État RED attendu : 6× TypeError (`current_user` pas en signature). Une fois
GREEN, Pattern D les ramènera en AssertionError (preuve non-tautologie).

0 mutation Atlas (AsyncMock pure).
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from routers import courses as co


pytestmark = [pytest.mark.regression, pytest.mark.asyncio]


CLUB_A_HEADER = "club-A-from-header"
CLUB_B_USER = "club-B-from-current-user"
CLUB_OTHER_DOC = "club-OTHER-from-existing-doc"
TYPE_ID = "T1"
OLD_NAME = "Hyrox"
NEW_NAME = "Hyrox Power"


def _user(active_club_id: str = CLUB_B_USER) -> dict:
    return {
        "id": "user-1",
        "email": "user@example.com",
        "active_club_id": active_club_id,
    }


def _patch_resolver_header_priority(monkeypatch) -> None:
    """Resolver patché : priorise le header (cohérent avec la prod), puis
    fallback `current_user.active_club_id`. Permet d'asserter que le scope
    vient du header (CLUB_A) et NON de `current_user` (CLUB_B) ni de
    `existing.club_id` (CLUB_OTHER).
    """
    def _fake_resolver(club_id, current_user, endpoint):
        if club_id:
            return club_id
        return (current_user or {}).get("active_club_id") or "FALLBACK_DEFAULT"

    monkeypatch.setattr(co, "resolve_club_id_or_fallback", _fake_resolver)


def _build_db_mock_for_rename() -> MagicMock:
    """Mock setup pour PUT en mode RENAME :
      - find_one  appelle séquentielles : [target #5, dedup_None #6]
      - update_one (#7) AsyncMock matched_count=1
      - update_many (#8 sur course_kpis) AsyncMock modified_count=1
    Le `existing` retourné a `club_id=CLUB_OTHER` pour prouver A.2.
    """
    course_types = MagicMock()
    course_types.find_one = AsyncMock(side_effect=[
        # #5 read target (intentionnellement cross-club pour test A.2)
        {"id": TYPE_ID, "name": OLD_NAME, "club_id": CLUB_OTHER_DOC},
        # #6 dedup new_name (pas de duplicate)
        None,
    ])
    course_types.update_one = AsyncMock(
        return_value=MagicMock(matched_count=1, modified_count=1)
    )

    course_kpis = MagicMock()
    course_kpis.update_many = AsyncMock(
        return_value=MagicMock(matched_count=42, modified_count=42)
    )

    db = MagicMock()
    db.course_types = course_types
    db.course_kpis = course_kpis
    return db


# ════════════════════════════════════════════════════════════════════════════
#   #5 — read target scopé (filter {id, club_id}, fix violation A.2)
# ════════════════════════════════════════════════════════════════════════════


async def test_put_read_target_scoped(monkeypatch):
    """🎯 #5 L152 doit lire le target avec un filtre composite `{id, club_id}`.

    RED actuel : signature ne prend pas `current_user` (TypeError) ; OU
    si signature élargie sans patch L152, filter = `{id: type_id}` seul
    ⇒ assertion `club_id` FAIL.
    """
    db = _build_db_mock_for_rename()
    monkeypatch.setattr(co, "db", db)
    _patch_resolver_header_priority(monkeypatch)

    await co.update_course_type(
        type_id=TYPE_ID,
        data={"name": NEW_NAME},
        club_id=CLUB_A_HEADER,
        current_user=_user(),
    )

    # 1er find_one = #5 read target
    first_call = db.course_types.find_one.call_args_list[0]
    target_filter = first_call.args[0]
    assert target_filter.get("id") == TYPE_ID
    assert target_filter.get("club_id") == CLUB_A_HEADER, (
        f"PUT #5 read target filter sans `club_id` scopé : {target_filter}. "
        f"RED si L152 reste `{{id: type_id}}` (A.2 ouvert)."
    )


# ════════════════════════════════════════════════════════════════════════════
#   #6 — dedup new_name scopé (filter {name, id:$ne, club_id})
# ════════════════════════════════════════════════════════════════════════════


async def test_put_dedup_scoped_on_rename(monkeypatch):
    """🎯 #6 L161 dedup sur new_name doit scoper par `club_id` (resolved).

    Le test FORCE un rename (NEW_NAME ≠ OLD_NAME) pour franchir l'early-return
    L157-158 qui shortcuiterait sinon le bloc.

    RED actuel : `_cq(club_id, {name, id:$ne})` ⇒ raw header utilisé tel
    quel (incohérent en l'absence de resolver). Une fois GREEN, doit devenir
    `{name, id:$ne, club_id: club_id_resolved}`.
    """
    db = _build_db_mock_for_rename()
    monkeypatch.setattr(co, "db", db)
    _patch_resolver_header_priority(monkeypatch)

    await co.update_course_type(
        type_id=TYPE_ID,
        data={"name": NEW_NAME},
        club_id=CLUB_A_HEADER,
        current_user=_user(),
    )

    # 2e find_one = #6 dedup
    assert db.course_types.find_one.call_count == 2, (
        f"PUT en rename doit appeler 2 find_one (target + dedup), "
        f"got {db.course_types.find_one.call_count}. "
        f"RED si #6 court-circuité par early-return."
    )
    dedup_filter = db.course_types.find_one.call_args_list[1].args[0]
    assert dedup_filter.get("name") == NEW_NAME
    assert dedup_filter.get("id") == {"$ne": TYPE_ID}
    assert dedup_filter.get("club_id") == CLUB_A_HEADER, (
        f"PUT #6 dedup find_one filter sans `club_id` scopé : {dedup_filter}. "
        f"RED si L161 reste `_cq(club_id, {{name, id:$ne}})` (raw header sans resolver)."
    )


# ════════════════════════════════════════════════════════════════════════════
#   #7 — update_one rename type scopé (filter {id, club_id}, A.2)
# ════════════════════════════════════════════════════════════════════════════


async def test_put_update_one_scoped(monkeypatch):
    """🎯 #7 L166 update_one DOIT contenir `club_id` (résolu) dans son filter
    de défense en profondeur (invariant A.2 : un user du club B ne doit pas
    pouvoir renommer un type du club A en connaissant son UUID).

    RED actuel : filter `{id: type_id}` seul ⇒ assertion FAIL.
    """
    db = _build_db_mock_for_rename()
    monkeypatch.setattr(co, "db", db)
    _patch_resolver_header_priority(monkeypatch)

    await co.update_course_type(
        type_id=TYPE_ID,
        data={"name": NEW_NAME},
        club_id=CLUB_A_HEADER,
        current_user=_user(),
    )

    assert db.course_types.update_one.call_count == 1, (
        f"Attendu 1 update_one (rename type), got "
        f"{db.course_types.update_one.call_count}"
    )
    update_filter = db.course_types.update_one.call_args.args[0]
    assert update_filter.get("id") == TYPE_ID
    assert update_filter.get("club_id") == CLUB_A_HEADER, (
        f"PUT #7 update_one filter sans `club_id` scopé : {update_filter}. "
        f"RED si L166 reste `{{id: type_id}}` (A.2 ouvert sur mutation)."
    )


# ════════════════════════════════════════════════════════════════════════════
#   #8 — CASCADE update_many course_kpis scopée (filter {course_name, club_id})
# ════════════════════════════════════════════════════════════════════════════


async def test_put_cascade_scoped(monkeypatch):
    """🎯 #8 L169 cascade update_many doit scoper `course_name=old_name` par
    `club_id` (résolu) — CATASTROPHIQUE actuellement, renomme tous les clubs
    ayant un cours du même nom (ex: "Hyrox" partagé entre Versoix/Genève).

    RED actuel : filter `{course_name: old_name}` seul ⇒ assertion FAIL.
    """
    db = _build_db_mock_for_rename()
    monkeypatch.setattr(co, "db", db)
    _patch_resolver_header_priority(monkeypatch)

    await co.update_course_type(
        type_id=TYPE_ID,
        data={"name": NEW_NAME},
        club_id=CLUB_A_HEADER,
        current_user=_user(),
    )

    assert db.course_kpis.update_many.call_count == 1, (
        f"Attendu 1 update_many sur course_kpis, got "
        f"{db.course_kpis.update_many.call_count}"
    )
    cascade_filter = db.course_kpis.update_many.call_args.args[0]
    assert cascade_filter.get("course_name") == OLD_NAME
    assert cascade_filter.get("club_id") == CLUB_A_HEADER, (
        f"PUT #8 CASCADE update_many filter sans `club_id` scopé : "
        f"{cascade_filter}. RED si L169 reste `{{course_name: old_name}}` "
        f"(rename global cross-club CATASTROPHIQUE)."
    )


# ════════════════════════════════════════════════════════════════════════════
#   #8 vs #7 — cohérence resolved : même club_id sur update_one et cascade
# ════════════════════════════════════════════════════════════════════════════


async def test_put_cascade_resolved_equals_parent(monkeypatch):
    """🎯 Méta-leçon #12 : la cascade #8 DOIT utiliser le MÊME `club_id_resolved`
    que le `update_one` parent #7 (issu du resolver, donc du header). Ne JAMAIS
    dériver de `existing.club_id` (cross-club doc lu).

    Si l'implémentation Greene cascade=existing.club_id, le test FAIL car
    cascade.club_id == CLUB_OTHER_DOC (≠ CLUB_A_HEADER).
    """
    db = _build_db_mock_for_rename()
    monkeypatch.setattr(co, "db", db)
    _patch_resolver_header_priority(monkeypatch)

    await co.update_course_type(
        type_id=TYPE_ID,
        data={"name": NEW_NAME},
        club_id=CLUB_A_HEADER,
        current_user=_user(),
    )

    update_one_club = (
        db.course_types.update_one.call_args.args[0].get("club_id")
    )
    cascade_club = (
        db.course_kpis.update_many.call_args.args[0].get("club_id")
    )
    assert update_one_club == cascade_club, (
        f"PUT cascade #8 club_id ({cascade_club!r}) doit être identique au "
        f"update_one #7 club_id ({update_one_club!r}). RED si l'un dérive "
        f"de `existing.club_id` (cross-club, A.2 cassé)."
    )
    assert cascade_club == CLUB_A_HEADER, (
        f"PUT cascade #8 club_id={cascade_club!r} ≠ CLUB_A_HEADER. "
        f"Si =={CLUB_OTHER_DOC!r}, A.2 cassé via dérivation de `existing`. "
        f"Si =={CLUB_B_USER!r}, le resolver ignore le header (priorité cassée)."
    )


# ════════════════════════════════════════════════════════════════════════════
#   HEADER PRIORITY — le scope vient du header, jamais du doc cible
# ════════════════════════════════════════════════════════════════════════════


async def test_put_header_wins(monkeypatch):
    """🎯 Invariant A.2 explicite : avec header=CLUB_A, user=CLUB_B,
    existing.club_id=CLUB_OTHER, le scope résolu DOIT être CLUB_A sur les 4 ops.

    RED actuel : signature TypeError ; ou si signature élargie sans patch,
    aucune des 4 ops ne porte CLUB_A.
    """
    db = _build_db_mock_for_rename()
    monkeypatch.setattr(co, "db", db)
    _patch_resolver_header_priority(monkeypatch)

    await co.update_course_type(
        type_id=TYPE_ID,
        data={"name": NEW_NAME},
        club_id=CLUB_A_HEADER,
        current_user=_user(),
    )

    # Récupère les 4 filtres
    f_read = db.course_types.find_one.call_args_list[0].args[0]
    f_dedup = db.course_types.find_one.call_args_list[1].args[0]
    f_update = db.course_types.update_one.call_args.args[0]
    f_cascade = db.course_kpis.update_many.call_args.args[0]

    for label, f in [
        ("read #5", f_read),
        ("dedup #6", f_dedup),
        ("update_one #7", f_update),
        ("cascade #8", f_cascade),
    ]:
        observed = f.get("club_id")
        assert observed == CLUB_A_HEADER, (
            f"PUT {label} : club_id observé={observed!r}, attendu={CLUB_A_HEADER!r}. "
            f"Si =={CLUB_B_USER!r}, le header ne prime pas sur current_user. "
            f"Si =={CLUB_OTHER_DOC!r}, A.2 cassé (scope dérive du doc lu). "
            f"Si None, scope absent du filter."
        )
