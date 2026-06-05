"""Tests régression SB B.2.3.C.3.J — scope `club_id` sur
`POST /courses/copy-month/preview` (L407-438) et
`POST /courses/copy-month` (L441-532) du router `courses.py`.

État actuel (audit C.3 reste) :
  - Signature `copy_month_preview(body, club_id=Depends(get_club_id))` sans
    `current_user`. 2 ops `find` raw-header sur course_kpis (L416, L419).
  - Signature `copy_month(body, club_id=Depends(get_club_id))` idem. 4 ops :
    L462 find source raw   ← _cq(club_id, {year, month}) raw header
    L471 find dest raw     ← idem
    L500 update_one cascade ← `{id: existing["id"]}` 🔴 VIOLATION A.2 (filter
                              sans club_id ; défense en profondeur absente
                              même si find L471 est scopé en GREEN — pendant
                              exact de la cascade course-types L169)
    L516 insert_one boucle ← `if club_id: doc["club_id"] = club_id` (raw,
                              conditionnel) 🔴 récidive F.2/CS1 si header None

Décision architecturale CIBLE (alignée C.3.A/I) :
  - Signature : ajout `current_user: dict = Depends(get_current_user)`.
  - 1 seul `club_id_resolved = resolve_club_id_or_fallback(...)`.
  - find L416/L419/L462/L471 : `_cq(club_id_resolved, …)` (scope resolved).
  - update_one L500 : filter composite `{"id": existing["id"], "club_id": club_id_resolved}`.
  - insert L516 : `doc["club_id"] = club_id_resolved` INCONDITIONNEL après model_dump.

Tests :
  - test_preview_reads_scoped_when_header_none           → L416 + L419
  - test_copy_month_reads_scoped_when_header_none        → L462 + L471
  - test_copy_month_update_one_filter_composite_TRAP_A2  → L500 + TRAP cross-club
  - test_copy_month_insert_no_orphan_uses_resolved       → L516 + F.2/CS1 + TRAP source

État RED attendu : TypeError (signature `current_user`) OU AssertionError
ciblée (filter / doc sans `club_id` ou avec mauvaise valeur). PAS de TypeError
exotique. 0 mutation Atlas (AsyncMock pure).
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from routers import courses as co


pytestmark = [pytest.mark.regression, pytest.mark.asyncio]


VERSOIX_HEADER = "0a327bf5-c759-49eb-87e4-551913f78bdb"  # = DEFAULT_CLUB_ID
DEFAULT_CLUB_ID = "0a327bf5-c759-49eb-87e4-551913f78bdb"
SOURCE_X = "SOURCE_X-cross-club-trap"


def _user(active_club_id: str = VERSOIX_HEADER) -> dict:
    return {"id": "u-1", "email": "u@example.com", "active_club_id": active_club_id}


def _patch_resolver_priority_header(monkeypatch) -> None:
    """Resolver patché : header > active_club_id > DEFAULT_CLUB_ID."""
    def _fake(club_id, current_user, endpoint):
        if club_id:
            return club_id
        return (current_user or {}).get("active_club_id") or DEFAULT_CLUB_ID
    monkeypatch.setattr(co, "resolve_club_id_or_fallback", _fake)


def _chain_find_iter(*result_lists) -> MagicMock:
    """Construit un find MagicMock dont les appels successifs renvoient
    chacun un cursor avec to_list = result_lists[i]. (find().to_list()).
    """
    cursors = []
    for result_list in result_lists:
        to_list_mock = AsyncMock(return_value=result_list)
        cursor = MagicMock()
        cursor.to_list = to_list_mock
        cursors.append(cursor)
    return MagicMock(side_effect=cursors)


def _course(**overrides) -> dict:
    """Doc course_kpis minimal."""
    doc = {
        "id": "src-1",
        "year": 2026,
        "month": 5,
        "course_name": "Hyrox",
        "day_of_week": "Lundi",
        "time_slot": "08:00",
        "instructor": None,
        "max_capacity": 10,
        "monthly_expenses": 0,
        "club_id": VERSOIX_HEADER,
    }
    doc.update(overrides)
    return doc


# ════════════════════════════════════════════════════════════════════════════
#   TEST 1 — copy_month_preview L416 + L419 scopés via resolved
# ════════════════════════════════════════════════════════════════════════════


async def test_preview_reads_scoped_when_header_none(monkeypatch):
    """🎯 copy_month/preview : header None → resolver fallback. Les 2 finds
    DOIVENT contenir `club_id == DEFAULT_CLUB_ID`. RED : `_cq(None, …)` ⇒
    `{year, month}` seul.
    """
    course_kpis = MagicMock()
    course_kpis.find = _chain_find_iter([], [])  # source vide / dest vide OK pour preview
    db = MagicMock()
    db.course_kpis = course_kpis
    monkeypatch.setattr(co, "db", db)
    _patch_resolver_priority_header(monkeypatch)

    await co.copy_month_preview(
        body={"source_month": "2026-05", "dest_month": "2026-06"},
        club_id=None,
        current_user={"id": "u-1", "email": "u@example.com"},  # pas d'active_club_id ⇒ fallback DEFAULT
    )

    assert course_kpis.find.call_count == 2, (
        f"Attendu 2 find (L416 source + L419 dest), got {course_kpis.find.call_count}"
    )
    f_source = course_kpis.find.call_args_list[0].args[0]
    f_dest = course_kpis.find.call_args_list[1].args[0]
    for label, f in [("L416 source", f_source), ("L419 dest", f_dest)]:
        assert f.get("club_id") == DEFAULT_CLUB_ID, (
            f"copy_month_preview {label} filter `club_id`={f.get('club_id')!r}, "
            f"attendu {DEFAULT_CLUB_ID!r} (fallback resolver). "
            f"Filter observé : {f}"
        )


# ════════════════════════════════════════════════════════════════════════════
#   TEST 2 — copy_month L462 + L471 scopés via resolved
# ════════════════════════════════════════════════════════════════════════════


async def test_copy_month_reads_scoped_when_header_none(monkeypatch):
    """🎯 copy_month (mutant) : header None → resolver fallback. Les 2 finds
    L462 + L471 DOIVENT porter `club_id`.

    Source non-vide (sinon early-return L466), dest vide → branche insert
    pour 1 source, mais sans dest_courses match → 1 insert (sans crash).
    """
    course_kpis = MagicMock()
    course_kpis.find = _chain_find_iter(
        [_course(club_id=DEFAULT_CLUB_ID, id="src-key1", day_of_week="Lundi", course_name="Hyrox")],  # source L462
        [],  # dest L471 vide → insert branch
    )
    course_kpis.insert_one = AsyncMock()
    db = MagicMock()
    db.course_kpis = course_kpis
    monkeypatch.setattr(co, "db", db)
    _patch_resolver_priority_header(monkeypatch)

    await co.copy_month(
        body={"source_month": "2026-05", "dest_month": "2026-06", "overwrite": True},
        club_id=None,
        current_user={"id": "u-1", "email": "u@example.com"},
    )

    assert course_kpis.find.call_count == 2, (
        f"Attendu 2 find (L462 source + L471 dest), got {course_kpis.find.call_count}"
    )
    f_source = course_kpis.find.call_args_list[0].args[0]
    f_dest = course_kpis.find.call_args_list[1].args[0]
    for label, f in [("L462 source", f_source), ("L471 dest", f_dest)]:
        assert f.get("club_id") == DEFAULT_CLUB_ID, (
            f"copy_month {label} filter `club_id`={f.get('club_id')!r}, "
            f"attendu {DEFAULT_CLUB_ID!r} (fallback resolver). "
            f"Filter observé : {f}"
        )


# ════════════════════════════════════════════════════════════════════════════
#   TEST 3 — copy_month update_one L500 : filter composite + TRAP A.2
# ════════════════════════════════════════════════════════════════════════════


async def test_copy_month_update_one_filter_composite_TRAP_A2(monkeypatch):
    """🎯 PATTERN B (invariant A.2) sur la cascade `update_one` L500.

    Setup TRAP cross-club :
      - header = VERSOIX (resolved → VERSOIX)
      - source[0] et dest[0] partagent la même clé dedup (Lundi, 08:00, Hyrox)
        ⇒ branche overwrite
      - dest[0] porte volontairement `club_id="SOURCE_X-cross-club-trap"`
        (≠ header) — simule un doc dest cross-club fuité dans la fenêtre
        si le find L471 venait à être mal scopé (défense en profondeur).

    Le filter de `update_one` DOIT contenir `{"id": "dest-1", "club_id":
    VERSOIX_HEADER}` — JAMAIS `{"id": "dest-1"}` seul (RED actuel L500),
    JAMAIS `{"id": "dest-1", "club_id": "SOURCE_X-..."}` (TRAP : un patch
    naïf dérivant de `existing["club_id"]` casserait A.2).
    """
    same_key = {"day_of_week": "Lundi", "time_slot": "08:00", "course_name": "Hyrox"}
    course_kpis = MagicMock()
    course_kpis.find = _chain_find_iter(
        [_course(id="src-key1", **same_key)],                             # source
        [_course(id="dest-1", club_id=SOURCE_X, **same_key)],             # dest cross-club TRAP
    )
    course_kpis.update_one = AsyncMock(return_value=MagicMock(matched_count=1, modified_count=1))
    course_kpis.insert_one = AsyncMock()
    db = MagicMock()
    db.course_kpis = course_kpis
    monkeypatch.setattr(co, "db", db)
    _patch_resolver_priority_header(monkeypatch)

    await co.copy_month(
        body={"source_month": "2026-05", "dest_month": "2026-06", "overwrite": True},
        club_id=VERSOIX_HEADER,
        current_user=_user(),
    )

    assert course_kpis.update_one.call_count == 1, (
        f"Attendu 1 update_one (branche overwrite), got "
        f"{course_kpis.update_one.call_count}"
    )
    update_filter = course_kpis.update_one.call_args.args[0]
    assert update_filter.get("id") == "dest-1"
    observed_club = update_filter.get("club_id")
    assert observed_club == VERSOIX_HEADER, (
        f"copy_month L500 update_one filter `club_id`={observed_club!r}, "
        f"attendu {VERSOIX_HEADER!r} (resolved via header). "
        f"Si =={SOURCE_X!r}, le patch dérive de `existing.club_id` "
        f"(TRAP A.2 cassée). Si None ou absent, défense en profondeur absente. "
        f"Filter complet : {update_filter}"
    )


# ════════════════════════════════════════════════════════════════════════════
#   TEST 4 — copy_month insert L516 : F.2/CS1 + TRAP source
# ════════════════════════════════════════════════════════════════════════════


async def test_copy_month_insert_no_orphan_uses_resolved(monkeypatch):
    """🎯 BRANCHE INSERT L516 — F.2/CS1 (header None ⇒ orphelin garanti).

    Setup :
      - header = None ⇒ resolver fallback DEFAULT_CLUB_ID (Versoix).
      - source[0] porte `club_id=SOURCE_X-cross-club-trap` (TRAP discriminance :
        un patch incorrect copiant `source["club_id"]` poserait SOURCE_X).
      - dest vide ⇒ pas de clé matchée ⇒ branche insert.

    Le doc inséré DOIT porter `club_id=DEFAULT_CLUB_ID`, JAMAIS None
    (orphelin actuel), JAMAIS SOURCE_X (TRAP A.2 cascade).
    """
    source_doc = _course(
        id="src-key2",
        club_id=SOURCE_X,
        day_of_week="Mardi",
        time_slot="09:00",
        course_name="Yoga",
    )
    course_kpis = MagicMock()
    course_kpis.find = _chain_find_iter([source_doc], [])
    course_kpis.update_one = AsyncMock()
    course_kpis.insert_one = AsyncMock()
    db = MagicMock()
    db.course_kpis = course_kpis
    monkeypatch.setattr(co, "db", db)
    _patch_resolver_priority_header(monkeypatch)

    await co.copy_month(
        body={"source_month": "2026-05", "dest_month": "2026-06", "overwrite": True},
        club_id=None,  # ← F.2/CS1
        current_user={"id": "u-1", "email": "u@example.com"},  # pas d'active_club_id ⇒ fallback DEFAULT
    )

    assert course_kpis.update_one.call_count == 0, (
        f"BRANCHE INSERT attendue (dest vide), pas update. "
        f"update_one.call_count={course_kpis.update_one.call_count}"
    )
    assert course_kpis.insert_one.call_count == 1, (
        f"Attendu 1 insert_one (branche else L502-517), got "
        f"{course_kpis.insert_one.call_count}"
    )
    inserted_doc = course_kpis.insert_one.call_args.args[0]
    assert "club_id" in inserted_doc, (
        f"copy_month L516 insert_one doc SANS clé `club_id` (F.2/CS1 orphelin "
        f"si header None). RED si `if club_id: doc[\"club_id\"] = club_id` "
        f"reste conditionnel (header None ⇒ pas de clé)."
    )
    observed_club = inserted_doc.get("club_id")
    assert observed_club == DEFAULT_CLUB_ID, (
        f"copy_month L516 insert_one doc[\"club_id\"]={observed_club!r}, "
        f"attendu {DEFAULT_CLUB_ID!r} (fallback resolver). "
        f"Si =={SOURCE_X!r}, le patch dérive de `source.club_id` "
        f"(TRAP A.2 cassée — pendant de la cascade A.2). Si None, orphelin maintenu."
    )
