"""Tests régression SB B.2.3.C.3.A.1 — scope `club_id` sur GET + POST
`/course-types` (raw header → resolved via `resolve_club_id_or_fallback`).

État actuel (audit C.3.A) :
  - L122 GET /course-types : signature `(club_id=Depends(get_club_id))`
        sans `current_user`. L125 `db.course_types.find(_cq(club_id), …)`
        → `_cq(None) == {}` ⇒ liste cross-club globale si header absent.
  - L128 POST /course-types : signature idem. Trois ops :
        L135 `find_one(_cq(club_id, {"name": name}))` → dedup non scopé.
        L141 `if club_id: doc["club_id"] = club_id` → doc orphelin si
        header absent (récidive CS1/F.2).

Décision architecturale CIBLE (invariant A.2, alignée C.3.B et CS1) :
  - Signatures élargies : `club_id` (raw header) + `current_user` (auth dep).
  - En tête de handler : `club_id_resolved = resolve_club_id_or_fallback(
        club_id, current_user, endpoint="/api/course-types …")`.
  - Tous les filtres et l'insert utilisent `club_id_resolved` (pas le raw).
  - `doc["club_id"] = club_id_resolved` (inconditionnel — ferme la fuite
    orphelin CS1/F.2).

Stratégie de test (header=None pour stresser le scope, AsyncMock pur) :
  - Resolver monkeypatché → fallback déterministe sur `current_user.active_club_id`
    (au lieu du DEFAULT_CLUB_ID hardcodé). Permet d'asserter que le doc
    inséré porte la valeur RÉSOLUE et non le raw header None.
  - `current_user = {"id": ..., "email": ..., "active_club_id": "club-X"}`.

État attendu sur code actuel : 4 × ROUGE.
  - Soit TypeError ("unexpected keyword argument 'current_user'") car la
    signature ne déclare pas encore le paramètre.
  - Soit AssertionError sur filter / doc une fois signature élargie sans
    patch des ops (filter sans club_id, doc sans club_id, doc.club_id is None).

0 mutation Atlas (mocks `AsyncMock` purs).
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from routers import courses as co


pytestmark = [pytest.mark.regression, pytest.mark.asyncio]


CLUB_X = "club-X-resolved-from-current-user"


def _user(active_club_id: str = CLUB_X) -> dict:
    return {
        "id": "user-1",
        "email": "user@example.com",
        "active_club_id": active_club_id,
    }


def _patch_resolver_via_user(monkeypatch) -> None:
    """Monkeypatche `resolve_club_id_or_fallback` (tel qu'importé dans
    `routers.courses`) pour qu'il retourne, quand `club_id` est None,
    `current_user["active_club_id"]`. Permet de discriminer raw-header (None)
    vs resolved (CLUB_X) dans les assertions.
    """
    def _fake_resolver(club_id, current_user, endpoint):
        if club_id:
            return club_id
        return (current_user or {}).get("active_club_id") or "FALLBACK_DEFAULT"

    monkeypatch.setattr(co, "resolve_club_id_or_fallback", _fake_resolver)


# ════════════════════════════════════════════════════════════════════════════
#   #2 — GET /course-types : list scopée même si header None (raw → resolved)
# ════════════════════════════════════════════════════════════════════════════


async def test_get_list_scoped_when_header_none(monkeypatch):
    """🎯 GET /course-types avec header X-Club-Id absent doit malgré tout
    scoper la liste sur le club du requester (resolved via current_user).

    RED actuel :
      - TypeError : signature `get_course_types(club_id=…)` n'accepte pas
        `current_user`. OU, si la signature était élargie sans patch L125,
        `_cq(None) == {}` ⇒ filter vide ⇒ liste cross-club ⇒ assertion FAIL.
    """
    # Mock chaîné find().sort().to_list() — on capture le filter passé à find().
    to_list_mock = AsyncMock(return_value=[])
    sort_mock = MagicMock()
    sort_mock.to_list = to_list_mock
    find_result = MagicMock()
    find_result.sort = MagicMock(return_value=sort_mock)
    course_types = MagicMock()
    course_types.find = MagicMock(return_value=find_result)

    db = MagicMock()
    db.course_types = course_types
    monkeypatch.setattr(co, "db", db)
    _patch_resolver_via_user(monkeypatch)

    await co.get_course_types(club_id=None, current_user=_user())

    assert course_types.find.call_count == 1, (
        f"Attendu 1 find sur course_types, got {course_types.find.call_count}"
    )
    filter_dict = course_types.find.call_args.args[0]
    assert filter_dict.get("club_id") == CLUB_X, (
        f"GET /course-types find filter sans `club_id` scopé : {filter_dict}. "
        f"RED si L125 reste `_cq(club_id)` (raw header None ⇒ filter vide)."
    )


# ════════════════════════════════════════════════════════════════════════════
#   #3 — POST /course-types : dedup scopée même si header None
# ════════════════════════════════════════════════════════════════════════════


async def test_post_dedup_scoped_when_header_none(monkeypatch):
    """🎯 POST /course-types avec header None doit dédupliquer sur le club
    résolu (pas globalement). RED si dedup actuel = `_cq(None, {name})` ⇒
    `{name}` seul ⇒ false-positive global ou false-negative cross-club.
    """
    course_types = MagicMock()
    course_types.find_one = AsyncMock(return_value=None)  # pas de duplicate
    course_types.insert_one = AsyncMock()
    db = MagicMock()
    db.course_types = course_types
    monkeypatch.setattr(co, "db", db)
    _patch_resolver_via_user(monkeypatch)

    await co.create_course_type(
        data={"name": "Hyrox Power"},
        club_id=None,
        current_user=_user(),
    )

    assert course_types.find_one.call_count == 1, (
        f"Attendu 1 find_one (dedup), got {course_types.find_one.call_count}"
    )
    dedup_filter = course_types.find_one.call_args.args[0]
    assert dedup_filter.get("name") == "Hyrox Power"
    assert dedup_filter.get("club_id") == CLUB_X, (
        f"POST /course-types dedup find_one filter sans `club_id` scopé : "
        f"{dedup_filter}. RED si L135 reste `_cq(club_id, {{name}})` (raw "
        f"header None ⇒ dedup globale)."
    )


# ════════════════════════════════════════════════════════════════════════════
#   #4 — POST /course-types : insert NE DOIT PAS être orphelin (CS1/F.2)
# ════════════════════════════════════════════════════════════════════════════


async def test_post_insert_no_orphan(monkeypatch):
    """🎯 POST /course-types avec header None doit insérer un doc avec
    `club_id` POSÉ (resolved), JAMAIS sans la clé. Récidive CS1/F.2 à fermer.

    RED actuel :
      - TypeError (signature) ; OU si signature élargie sans patch L141,
        `if club_id: doc["club_id"] = club_id` ⇒ `doc` SANS clé `club_id`
        car raw header None ⇒ orphelin garanti.
    """
    course_types = MagicMock()
    course_types.find_one = AsyncMock(return_value=None)  # pas de duplicate
    course_types.insert_one = AsyncMock()
    db = MagicMock()
    db.course_types = course_types
    monkeypatch.setattr(co, "db", db)
    _patch_resolver_via_user(monkeypatch)

    await co.create_course_type(
        data={"name": "Hyrox Power"},
        club_id=None,
        current_user=_user(),
    )

    assert course_types.insert_one.call_count == 1, (
        f"Attendu 1 insert_one, got {course_types.insert_one.call_count}"
    )
    inserted_doc = course_types.insert_one.call_args.args[0]
    assert "club_id" in inserted_doc, (
        f"POST /course-types insert_one doc SANS clé `club_id` (orphelin "
        f"CS1/F.2 récidive) : {inserted_doc}. RED si L141 reste "
        f"`if club_id: doc[\"club_id\"] = club_id` (raw header None ⇒ orphelin)."
    )


# ════════════════════════════════════════════════════════════════════════════
#   #4 bis — POST /course-types : insert utilise RESOLVED, pas raw header
# ════════════════════════════════════════════════════════════════════════════


async def test_post_insert_uses_resolved_not_raw(monkeypatch):
    """🎯 Pattern distinct du test précédent : la valeur posée sur
    `doc["club_id"]` doit être le RESOLVED (CLUB_X), pas le raw header
    (None) ni un fallback hardcodé. Prouve que le handler appelle bien
    le resolver et utilise son retour, conformément à l'invariant A.2.

    RED actuel :
      - TypeError (signature) ; OU si signature élargie sans appel
        explicite à `resolve_club_id_or_fallback`, doc.club_id == None ou
        != CLUB_X.
    """
    course_types = MagicMock()
    course_types.find_one = AsyncMock(return_value=None)
    course_types.insert_one = AsyncMock()
    db = MagicMock()
    db.course_types = course_types
    monkeypatch.setattr(co, "db", db)
    _patch_resolver_via_user(monkeypatch)

    await co.create_course_type(
        data={"name": "Hyrox Power"},
        club_id=None,
        current_user=_user(active_club_id=CLUB_X),
    )

    inserted_doc = course_types.insert_one.call_args.args[0]
    assert inserted_doc.get("club_id") == CLUB_X, (
        f"POST /course-types insert_one doc[\"club_id\"] != RESOLVED. "
        f"Attendu={CLUB_X}, observé={inserted_doc.get('club_id')!r}. "
        f"RED si L141 utilise le raw `club_id` (header None) au lieu de "
        f"`club_id_resolved` (via resolve_club_id_or_fallback)."
    )
