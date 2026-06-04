"""Tests régression SB B.2.3.C.3.I — scope `club_id` sur
`POST /courses/copy-planning/{year}/{month}` (courses.py L334-379).

État actuel (audit C.3 reste) :
  - Signature : `(year, month, club_id=Depends(get_club_id))` sans `current_user`.
  - L341 `find(_cq(club_id, {year, month}), …)` ← existing dest, raw header
  - L348 `find(_cq(club_id, {prev_year, prev_month}), …)` ← source prev_month, raw header
  - L370-371 boucle `doc = new_course.model_dump()` PUIS `insert_one(doc)`
    ❌ AUCUN `doc["club_id"]` posé — même pas conditionnellement
    🔴🔴 récidive type CS1/F.2 maximale : orphelin GARANTI à chaque copy_planning

Décision architecturale CIBLE (alignée C.3.A/F) :
  - Signature : ajouter `current_user: dict = Depends(get_current_user)`.
  - En tête : `club_id_resolved = resolve_club_id_or_fallback(...)`.
  - L341 + L348 : filter composite `{year, month, club_id: club_id_resolved}`.
  - L370-371 : `doc["club_id"] = club_id_resolved` AVANT `insert_one(doc)`
    (pattern Sprint A explicite, comme L616/L595 post-C.3.F).

Tests RED :
  - test_copy_planning_insert_carries_resolved_club_id
       → doc inséré contient `club_id` (clé présente + valeur == resolved)
  - test_copy_planning_insert_uses_resolved_not_source_club_id (TRAP/DISCRIMINANCE)
       → source doc a `club_id="SOURCE_X"` (volontairement ≠ header) ;
         doc inséré DOIT porter `club_id=VERSOIX_HEADER`, JAMAIS "SOURCE_X".
  - test_copy_planning_reads_scoped_when_header_none
       → header None → filter `find` contient `club_id=DEFAULT_CLUB_ID`
         (fallback resolver), pas filter vide. Couvre L341 + L348.

État RED attendu : TypeError (signature `current_user`) OU AssertionError
(filtre / doc sans `club_id`). 0 mutation Atlas (AsyncMock pure).
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from routers import courses as co


pytestmark = [pytest.mark.regression, pytest.mark.asyncio]


VERSOIX_HEADER = "0a327bf5-c759-49eb-87e4-551913f78bdb"  # = DEFAULT_CLUB_ID
SOURCE_X = "SOURCE_X-other-club-trap"
DEFAULT_CLUB_ID = "0a327bf5-c759-49eb-87e4-551913f78bdb"


def _user() -> dict:
    return {"id": "u-1", "email": "u@example.com", "active_club_id": VERSOIX_HEADER}


def _patch_resolver_priority_header(monkeypatch) -> None:
    """Resolver : header > active_club_id > DEFAULT_CLUB_ID."""
    def _fake(club_id, current_user, endpoint):
        if club_id:
            return club_id
        return (current_user or {}).get("active_club_id") or DEFAULT_CLUB_ID
    monkeypatch.setattr(co, "resolve_club_id_or_fallback", _fake)


def _source_course_doc(**overrides) -> dict:
    """Doc course_kpis source — porte volontairement club_id=SOURCE_X pour
    discriminance TRAP : il NE doit JAMAIS finir dans le doc inséré.
    """
    doc = {
        "id": "src-course-1",
        "year": 2026,
        "month": 5,
        "month_name": "Mai",
        "course_name": "Hyrox Power",
        "day_of_week": "Lundi",
        "time_slot": "08:00",
        "instructor_id": None,
        "instructor_name": "",
        "coach_id": None,
        "max_capacity": 10,
        "monthly_expenses": 0,
        "club_id": SOURCE_X,  # ← TRAP
    }
    doc.update(overrides)
    return doc


def _build_db_mock(existing_dest: list, prev_courses: list) -> MagicMock:
    """Drive le handler L334-379 :
      - L341 find dest_month → existing_dest (vide pour traverser le check)
      - L348 find prev_month → prev_courses (≥1 pour traverser la boucle)
      - L371 insert_one(doc) AsyncMock spy
    """
    def _chain(result_list):
        to_list_mock = AsyncMock(return_value=result_list)
        find_result = MagicMock()
        find_result.to_list = to_list_mock
        return MagicMock(return_value=find_result)

    course_kpis = MagicMock()
    # find_one séquentiel : 1er = dest (L341), 2e = prev (L348)
    course_kpis.find = MagicMock(side_effect=[
        _chain(existing_dest)(),  # call L341
        _chain(prev_courses)(),   # call L348
    ])
    course_kpis.insert_one = AsyncMock()

    db = MagicMock()
    db.course_kpis = course_kpis
    return db


# ════════════════════════════════════════════════════════════════════════════
#   TEST 1 — Insert porte club_id == resolved (no orphan)
# ════════════════════════════════════════════════════════════════════════════


async def test_copy_planning_insert_carries_resolved_club_id(monkeypatch):
    """🎯 L370-371 : doc inséré DOIT poser `club_id` (clé présente + valeur
    == resolved). RED actuel : aucun `doc["club_id"] = …` dans la boucle
    L353-373 ⇒ orphelin garanti.
    """
    db = _build_db_mock(
        existing_dest=[],
        prev_courses=[_source_course_doc()],
    )
    monkeypatch.setattr(co, "db", db)
    _patch_resolver_priority_header(monkeypatch)

    await co.copy_planning_from_previous_month(
        year=2026,
        month=6,
        club_id=VERSOIX_HEADER,
        current_user=_user(),
    )

    assert db.course_kpis.insert_one.call_count == 1, (
        f"Attendu 1 insert_one (1 course source), got "
        f"{db.course_kpis.insert_one.call_count}"
    )
    inserted_doc = db.course_kpis.insert_one.call_args.args[0]
    assert "club_id" in inserted_doc, (
        f"copy-planning L371 insert_one doc SANS clé `club_id` (orphelin "
        f"GARANTI, récidive type CS1/F.2 maximale) : "
        f"{ {k: inserted_doc.get(k) for k in ['id', 'year', 'month', 'course_name', 'club_id']} }. "
        f"RED si aucun `doc[\"club_id\"] = club_id_resolved` avant insert_one."
    )
    assert inserted_doc.get("club_id") == VERSOIX_HEADER, (
        f"copy-planning L371 insert_one doc[\"club_id\"]="
        f"{inserted_doc.get('club_id')!r} ≠ {VERSOIX_HEADER!r} (resolved). "
        f"RED si la valeur n'est pas le club_id résolu via "
        f"`resolve_club_id_or_fallback`."
    )


# ════════════════════════════════════════════════════════════════════════════
#   TEST 2 — TRAP/DISCRIMINANCE : NE PAS hériter de existing.club_id
# ════════════════════════════════════════════════════════════════════════════


async def test_copy_planning_insert_uses_resolved_not_source_club_id(monkeypatch):
    """🎯 Invariant A.2 sur cascade : le doc source porte `club_id=SOURCE_X`
    (volontairement ≠ header). Le doc inséré DOIT porter `club_id=VERSOIX_HEADER`
    (resolved), JAMAIS `SOURCE_X` (traîné par `course.get(…)` ou model_dump).

    Sans patch, l'insert L371 sera orphelin → club_id absent → assertion FAIL.
    Avec un patch incorrect (e.g. `doc["club_id"] = course["club_id"]`),
    le doc inséré aurait `SOURCE_X` → assertion FAIL aussi.
    Seul un patch utilisant `club_id_resolved` (header) passera.
    """
    db = _build_db_mock(
        existing_dest=[],
        prev_courses=[_source_course_doc(club_id=SOURCE_X)],
    )
    monkeypatch.setattr(co, "db", db)
    _patch_resolver_priority_header(monkeypatch)

    await co.copy_planning_from_previous_month(
        year=2026,
        month=6,
        club_id=VERSOIX_HEADER,
        current_user=_user(),
    )

    inserted_doc = db.course_kpis.insert_one.call_args.args[0]
    observed_club = inserted_doc.get("club_id")
    assert observed_club == VERSOIX_HEADER, (
        f"copy-planning L371 doc[\"club_id\"]={observed_club!r}. "
        f"Attendu {VERSOIX_HEADER!r} (resolved header). "
        f"Si =={SOURCE_X!r}, le patch dérive de `existing.club_id` "
        f"(cascade A.2 cassée — pendant exact de la cascade course-types L169 "
        f"qu'on a fixée en C.3.A.2). Si None, orphelin maintenu."
    )


# ════════════════════════════════════════════════════════════════════════════
#   TEST 3 — Reads scopés quand header None (fallback DEFAULT_CLUB_ID)
# ════════════════════════════════════════════════════════════════════════════


async def test_copy_planning_reads_scoped_when_header_none(monkeypatch):
    """🎯 L341 + L348 : avec header None, le resolver fait fallback sur
    DEFAULT_CLUB_ID. Les 2 filtres `find` DOIVENT contenir `club_id ==
    DEFAULT_CLUB_ID`, JAMAIS filter vide.

    RED actuel : `_cq(None, {year, month})` ⇒ `{year, month}` seul (pas de
    club_id) ⇒ list cross-club globale.
    """
    db = _build_db_mock(
        existing_dest=[],
        prev_courses=[_source_course_doc()],
    )
    monkeypatch.setattr(co, "db", db)
    _patch_resolver_priority_header(monkeypatch)

    await co.copy_planning_from_previous_month(
        year=2026,
        month=6,
        club_id=None,  # ← header absent
        current_user={"id": "u-1", "email": "u@example.com"},  # pas d'active_club_id ⇒ fallback DEFAULT
    )

    # 2 finds attendus : L341 (dest) + L348 (prev)
    assert db.course_kpis.find.call_count == 2, (
        f"Attendu 2 find sur course_kpis (L341 dest + L348 prev), got "
        f"{db.course_kpis.find.call_count}"
    )
    f_dest = db.course_kpis.find.call_args_list[0].args[0]
    f_prev = db.course_kpis.find.call_args_list[1].args[0]
    for label, f in [("L341 dest", f_dest), ("L348 prev", f_prev)]:
        observed = f.get("club_id")
        assert observed == DEFAULT_CLUB_ID, (
            f"copy-planning {label} find filter `club_id`={observed!r}, "
            f"attendu {DEFAULT_CLUB_ID!r} (fallback resolver). "
            f"Si None ou absent, scope absent (cross-club leak). "
            f"Filter complet observé : {f}"
        )
