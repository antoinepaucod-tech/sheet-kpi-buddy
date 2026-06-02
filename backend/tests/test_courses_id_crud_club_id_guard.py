"""Tests régression SB B.2.3.C.3.B — scope `club_id` sur les 3 endpoints
`/courses/{course_id}` (GET / PUT / DELETE) du router `courses.py`.

État actuel (audit C.3.A) :
  - L178  GET /courses/{course_id}  : signature `(course_id: str)` SANS
          Depends(get_club_id) ; L180 `find_one({"id": course_id})` non scopé.
  - L214  PUT /courses/{course_id}  : signature `(course_id, body)` SANS
          Depends(get_club_id) ; L216 + L228 + L229 trois ops course_kpis
          filtrant sur `{"id": course_id}` seul.
  - L232  DEL /courses/{course_id}  : signature `(course_id: str)` SANS
          Depends(get_club_id) ; L234 `delete_one({"id": course_id})` non scopé.

Risque cross-club catastrophique :
  - Un user du club A possédant un UUID `course_id` d'un cours du club B peut
    le lire (GET), le modifier (PUT) ou le supprimer (DELETE) sans restriction.
  - Aucune défense en profondeur côté filtre Mongo.

Décision architecturale CIBLE (invariant A.2 + audit C.2 généralisé) :
  - Chaque handler reçoit `club_id: Optional[str] = Depends(get_club_id)`.
  - Le `club_id_resolved` provient unilatéralement du header (resolver
    `resolve_club_id_or_fallback`), JAMAIS du document cible lu en base.
  - Les filtres composites Mongo deviennent : `{"id": course_id, "club_id": club_id_resolved}`.
  - Mismatch → find_one None → 404 / delete_one deleted_count=0 → 404.
  - Pour PUT, le 404 doit être levé au plus tôt (par le find_one préalable),
    et update_one DOIT contenir aussi le scope (défense en profondeur).

Tests (RED attendu sur code actuel) :
  - test_get_course_cross_club_returns_404
  - test_get_course_same_club_returns_doc            (discriminance)
  - test_put_course_cross_club_returns_404
  - test_put_course_same_club_update_one_filter_is_composite
  - test_delete_course_cross_club_returns_404
  - test_delete_course_same_club_delete_one_filter_is_composite

Mode RED attendu :
  - TypeError("unexpected keyword argument 'club_id'") sur les 3 handlers
    car aucun ne déclare aujourd'hui ce paramètre.
  - Si la signature était élargie sans patch des filtres, on aurait 200 au
    lieu de 404 (le filtre `{"id": ...}` matcherait cross-club).

0 mutation Atlas (AsyncMock pure).
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from routers import courses as co


pytestmark = [pytest.mark.regression, pytest.mark.asyncio]


CLUB_A = "club-A-versoix"
CLUB_OTHER = "club-OTHER-geneve"


def _course_doc(**overrides) -> dict:
    """Doc course_kpis minimal pour les tests."""
    doc = {
        "id": "C1",
        "club_id": CLUB_A,
        "year": 2026,
        "month": 5,
        "month_name": "Mai",
        "course_name": "Test Course",
        "day_of_week": "Lundi",
        "time_slot": "08:00",
        "max_capacity": 10,
        "week1_attendance": 0, "week2_attendance": 0, "week3_attendance": 0,
        "week4_attendance": 0, "week5_attendance": 0,
        "attendance_rate": 0,
        "monthly_expenses": 0,
    }
    doc.update(overrides)
    return doc


def _make_db_mock(course_doc: dict) -> MagicMock:
    """Mock filtre-aware (sémantique Mongo) : find_one retourne le doc
    UNIQUEMENT si TOUTES les clés du filter matchent le doc. Sinon None.
    delete_one renvoie deleted_count=1 si filter match, sinon 0.
    update_one renvoie modified_count=1 si filter match, sinon 0.

    Sans ce filtre-aware, on aurait des faux GREEN (find_one toujours
    return doc indépendamment du filter ⇒ test passerait même sans patch).
    """
    async def _find_one_filtered(filter_dict, projection=None):
        for k, v in (filter_dict or {}).items():
            if course_doc.get(k) != v:
                return None
        return course_doc

    async def _delete_one_filtered(filter_dict):
        for k, v in (filter_dict or {}).items():
            if course_doc.get(k) != v:
                return MagicMock(deleted_count=0)
        return MagicMock(deleted_count=1)

    async def _update_one_filtered(filter_dict, update_doc):
        for k, v in (filter_dict or {}).items():
            if course_doc.get(k) != v:
                return MagicMock(modified_count=0, matched_count=0)
        return MagicMock(modified_count=1, matched_count=1)

    course_kpis = MagicMock()
    course_kpis.find_one = AsyncMock(side_effect=_find_one_filtered)
    course_kpis.update_one = AsyncMock(side_effect=_update_one_filtered)
    course_kpis.delete_one = AsyncMock(side_effect=_delete_one_filtered)

    db = MagicMock()
    db.course_kpis = course_kpis
    return db


# ════════════════════════════════════════════════════════════════════════════
#   GET /courses/{course_id}
# ════════════════════════════════════════════════════════════════════════════


async def test_get_course_cross_club_returns_404(monkeypatch):
    """🎯 Un cours appartenant à CLUB_OTHER ne doit PAS être lisible par un
    requester scopé CLUB_A. Le handler doit raise 404.

    RED sur code actuel :
      - TypeError : la signature `get_course(course_id: str)` n'accepte pas
        `club_id`. Le seul moyen de scoper serait d'ajouter le kwarg ;
      - OU, si la signature était élargie sans patch du filtre L180,
        find_one({"id": course_id}) matcherait quand même cross-club ⇒ 200.
    """
    db = _make_db_mock(_course_doc(club_id=CLUB_OTHER))
    monkeypatch.setattr(co, "db", db)

    with pytest.raises(Exception) as exc_info:
        await co.get_course(course_id="C1", club_id=CLUB_A)

    assert getattr(exc_info.value, "status_code", None) == 404, (
        f"GET cross-club doit raise 404, got status="
        f"{getattr(exc_info.value, 'status_code', None)} "
        f"detail={getattr(exc_info.value, 'detail', None)}. "
        f"RED si le filter L180 reste {{id}} seul (cross-club leak)."
    )

    # Le filtre find_one doit contenir club_id=CLUB_A (scope header résolu).
    call_args = db.course_kpis.find_one.call_args
    assert call_args is not None, "find_one n'a pas été appelé"
    filter_dict = call_args.args[0]
    assert filter_dict.get("club_id") == CLUB_A, (
        f"GET find_one filter sans `club_id` scopé : {filter_dict}. "
        f"RED si L180 reste `{{id: course_id}}` sans club_id."
    )


async def test_get_course_same_club_returns_doc(monkeypatch):
    """🎯 Discriminance : un cours du même club que le requester doit être
    retourné normalement. Prouve la non-tautologie du test cross-club
    (un patch qui raise 404 partout passerait l'autre test mais pas celui-ci).
    """
    db = _make_db_mock(_course_doc(club_id=CLUB_A))
    monkeypatch.setattr(co, "db", db)

    result = await co.get_course(course_id="C1", club_id=CLUB_A)

    assert isinstance(result, dict), f"Attendu dict, got {type(result)}"
    assert result.get("id") == "C1"
    assert result.get("club_id") == CLUB_A


# ════════════════════════════════════════════════════════════════════════════
#   PUT /courses/{course_id}
# ════════════════════════════════════════════════════════════════════════════


async def test_put_course_cross_club_returns_404(monkeypatch):
    """🎯 Mutation cross-club bloquée par 404 du find_one préalable.
    Aucune update_one ne doit être déclenchée (gate AVANT mutation).

    RED sur code actuel :
      - TypeError : signature `update_course(course_id, body)` sans club_id.
      - OU 200 + update_one effectif si filter L216 reste `{id}` seul.
    """
    db = _make_db_mock(_course_doc(club_id=CLUB_OTHER))
    monkeypatch.setattr(co, "db", db)

    with pytest.raises(Exception) as exc_info:
        await co.update_course(
            course_id="C1",
            body={"max_capacity": 99},
            club_id=CLUB_A,
        )

    assert getattr(exc_info.value, "status_code", None) == 404, (
        f"PUT cross-club doit raise 404, got status="
        f"{getattr(exc_info.value, 'status_code', None)} "
        f"detail={getattr(exc_info.value, 'detail', None)}. "
        f"RED si le find_one L216 ne scope pas par club_id."
    )

    # Défense en profondeur : 0 update_one déclenché (gate AVANT mutation).
    assert db.course_kpis.update_one.call_count == 0, (
        f"PUT cross-club ne doit déclencher AUCUN update_one, "
        f"got {db.course_kpis.update_one.call_count} call(s). "
        f"Mutation cross-club catastrophique non bloquée."
    )


async def test_put_course_same_club_update_one_filter_is_composite(monkeypatch):
    """🎯 Défense en profondeur A.2 : même quand le find_one a déjà filtré
    par club_id, le filter du update_one DOIT contenir `club_id` (le scope
    ne doit jamais reposer sur la confiance d'une op précédente).

    RED sur code actuel : update_one L228 = `{"id": course_id}` ⇒ pas de
    club_id ⇒ assertion échoue.
    """
    db = _make_db_mock(_course_doc(club_id=CLUB_A))
    monkeypatch.setattr(co, "db", db)

    result = await co.update_course(
        course_id="C1",
        body={"max_capacity": 20},
        club_id=CLUB_A,
    )

    # update_one doit avoir été appelé exactement 1 fois.
    assert db.course_kpis.update_one.call_count == 1, (
        f"Attendu 1 update_one, got {db.course_kpis.update_one.call_count}"
    )

    # Filter composite : id + club_id (Pattern A.2 défense en profondeur).
    update_filter = db.course_kpis.update_one.call_args.args[0]
    assert update_filter.get("id") == "C1"
    assert update_filter.get("club_id") == CLUB_A, (
        f"PUT update_one filter sans `club_id` (défense en profondeur A.2 absente) : "
        f"{update_filter}. RED si L228 reste `{{id: course_id}}`."
    )

    # Discriminance : la fonction retourne bien le doc (non None).
    assert result is not None


# ════════════════════════════════════════════════════════════════════════════
#   DELETE /courses/{course_id}
# ════════════════════════════════════════════════════════════════════════════


async def test_delete_course_cross_club_returns_404(monkeypatch):
    """🎯 DELETE cross-club catastrophique bloqué. delete_one doit voir
    deleted_count=0 grâce au scope club_id dans le filter ⇒ 404.

    RED sur code actuel : delete_one L234 = `{"id": course_id}` (sans
    club_id) ⇒ mock retourne deleted_count=1 ⇒ 200 (suppression cross-club
    EFFECTIVE — leak data destructif).
    """
    db = _make_db_mock(_course_doc(club_id=CLUB_OTHER))
    monkeypatch.setattr(co, "db", db)

    with pytest.raises(Exception) as exc_info:
        await co.delete_course(course_id="C1", club_id=CLUB_A)

    assert getattr(exc_info.value, "status_code", None) == 404, (
        f"DELETE cross-club doit raise 404 (deleted_count=0 sur filter scopé), "
        f"got status={getattr(exc_info.value, 'status_code', None)} "
        f"detail={getattr(exc_info.value, 'detail', None)}. "
        f"RED si L234 reste `{{id: course_id}}` ⇒ deleted_count=1 ⇒ 200."
    )

    # Spy sur le filter de delete_one : doit contenir club_id=CLUB_A.
    call_args = db.course_kpis.delete_one.call_args
    assert call_args is not None, "delete_one n'a pas été appelé"
    delete_filter = call_args.args[0]
    assert delete_filter.get("club_id") == CLUB_A, (
        f"DELETE delete_one filter sans `club_id` scopé : {delete_filter}. "
        f"RED si L234 reste `{{id: course_id}}` (delete cross-club possible)."
    )


async def test_delete_course_same_club_delete_one_filter_is_composite(monkeypatch):
    """🎯 Discriminance : DELETE same-club fonctionne normalement, le filter
    delete_one contient `{id, club_id}`. Prouve que le patch ne raise pas
    systématiquement (sinon faux GREEN sur cross-club).
    """
    db = _make_db_mock(_course_doc(club_id=CLUB_A))
    monkeypatch.setattr(co, "db", db)

    result = await co.delete_course(course_id="C1", club_id=CLUB_A)

    # Doit retourner le dict de succès (pas raise).
    assert isinstance(result, dict)
    assert "message" in result or "deleted" in result or result, (
        f"DELETE same-club doit retourner un dict de succès, got {result}"
    )

    # Filter composite : id + club_id.
    delete_filter = db.course_kpis.delete_one.call_args.args[0]
    assert delete_filter.get("id") == "C1"
    assert delete_filter.get("club_id") == CLUB_A, (
        f"DELETE delete_one filter sans `club_id` : {delete_filter}. "
        f"RED si L234 reste `{{id: course_id}}`."
    )
