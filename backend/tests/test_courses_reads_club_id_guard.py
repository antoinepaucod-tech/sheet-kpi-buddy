"""Tests régression SB B.2.3.C.3.H — scope `club_id` sur les 2 reads non-scopés
restants de `courses.py` :

  - L112 `GET /courses`                       handler `get_courses`
  - L326 `GET /courses/summary/{year}/{month}` handler `get_courses_summary`

État actuel (audit RO C.3.H) :
  - Signatures sans `current_user` (donc `resolve_club_id_or_fallback` non
    appelable) et helper `_cq(club_id)` à injection CONDITIONNELLE :
        def _cq(club_id, base=None):
            q = dict(base or {})
            if club_id:
                q["club_id"] = club_id
            return q
  - Si le header est absent (⇒ `get_club_id` retourne None / ""), `_cq`
    n'ajoute PAS `club_id` au filtre ⇒ `db.course_kpis.find(query)` part
    SANS scope ⇒ leak read cross-club horizontal.

Décision architecturale CIBLE (alignement avec GET /courses/{id} et
GET /course-types déjà sécurisés) :
  - Élargir signatures avec `current_user: dict = Depends(get_current_user)`.
  - `club_id_resolved = resolve_club_id_or_fallback(...)`.
  - Injection INCONDITIONNELLE `{"club_id": club_id_resolved}` dans le filter.

Tests RED attendus (sans modif handler) :
  - A1 `test_get_courses_no_header_leaks_other_club_docs` :
        get_courses(club_id=None) ⇒ _cq retourne {} ⇒ find sans club_id ⇒
        mock filtre-aware renvoie [VERSOIX, CLUB_B] ⇒ payload contient le
        doc TRAP CLUB_B ⇒ assert "absent" échoue ⇒ RED.
  - B1 `test_get_courses_summary_no_header_leaks_other_club_docs` :
        get_courses_summary(club_id=None) ⇒ find renvoie 2 docs ⇒
        total_courses==2 (au lieu de 1) ET course_name TRAP présent dans
        by_day ⇒ assert échouent ⇒ RED.

Tests GREEN dès maintenant (gardes anti-hardcode, rougiront au Pattern D) :
  - A2 `test_get_courses_header_club_b_returns_only_club_b_docs` :
        get_courses(club_id=CLUB_B) ⇒ _cq pose club_id=CLUB_B ⇒ mock filtre
        ⇒ payload = docs CLUB_B seuls. VERSOIX absent du payload.
  - B2 `test_get_courses_summary_header_club_b_returns_only_club_b_summary`:
        get_courses_summary(year, month, club_id=CLUB_B) ⇒ payload reflète
        CLUB_B seul. Au Pattern D (retrait du filtre), le mock renverra
        VERSOIX en plus ⇒ assert "VERSOIX absent" échouera ⇒ ROUGIRA.

Garanties :
  - CLUB_B ≠ DEFAULT_CLUB_ID (Versoix) : un UUID explicite distinct, sinon
    un hardcode `club_id_resolved = DEFAULT` passerait silencieusement.
  - Mock filtre-aware (sémantique Mongo) : si la clé `club_id` du filter
    est absente ⇒ on renvoie TOUS les docs (les 2 clubs). Si présente ⇒
    on renvoie seulement les docs matchant. Pas de 200/empty tautologique.
  - 0 touch Atlas. AsyncMock + MagicMock chain pour
    `find(...).sort(...).to_list(N)` et `find(...).to_list(N)`.
  - 0 modif `courses.py`, 0 modif `_cq`.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from routers import courses as co


pytestmark = [pytest.mark.regression, pytest.mark.asyncio]


# VERSOIX = DEFAULT_CLUB_ID (config.py:23) — c'est le fallback. Un hardcode
# `club_id_resolved = DEFAULT_CLUB_ID` filtrerait VERSOIX ⇒ on l'utilise
# comme doc "légitime" du club du requester quand on simule l'absence de
# header. CLUB_B est un UUID volontairement DIFFÉRENT pour piéger tout
# hardcode (sinon VERSOIX==CLUB_B et la fuite serait invisible).
VERSOIX = "0a327bf5-c759-49eb-87e4-551913f78bdb"
CLUB_B = "11111111-2222-3333-4444-555555555555"

YEAR = 2026
MONTH = 5


def _doc(course_id: str, club_id: str, course_name: str, day: str = "Lundi") -> dict:
    """Doc course_kpis minimal pour les tests."""
    return {
        "id": course_id,
        "club_id": club_id,
        "year": YEAR,
        "month": MONTH,
        "month_name": "Mai",
        "course_name": course_name,
        "day_of_week": day,
        "time_slot": "08:00",
        "max_capacity": 10,
        "week1_attendance": 0, "week2_attendance": 0, "week3_attendance": 0,
        "week4_attendance": 0, "week5_attendance": 0,
        "attendance_rate": 50,
        "monthly_expenses": 100,
    }


# Doc VERSOIX (le club "légitime" du requester quand on simule l'absence
# de header — fallback DEFAULT). course_name distinct pour assertions by_day.
DOC_VERSOIX = _doc("crs-versoix-1", VERSOIX, "Yoga-Versoix", day="Lundi")
# Doc CLUB_B (le club ADVERSE — TRAP cross-club). Si le payload le contient,
# c'est une fuite read horizontale.
DOC_TRAP_CLUB_B = _doc("crs-clubb-1", CLUB_B, "Crossfit-ClubB-TRAP", day="Mardi")


def _make_find_mock(all_docs: list[dict]):
    """Construit un mock `db.course_kpis.find(filter, projection)` filtre-aware
    (sémantique Mongo) qui chaîne `.sort(...)` et `.to_list(N)`.

    - find(filter, projection) → cursor MagicMock.
    - cursor.sort(...)         → renvoie le cursor lui-même (chaînable).
    - cursor.to_list(N)        → AsyncMock retournant les docs filtrés.

    Le filtrage applique TOUS les couples (k, v) du filter sur chaque doc.
    Si une clé du filter n'existe pas dans le doc OU si v != doc[k] ⇒ exclu.
    Si `club_id` absent du filter ⇒ aucun filtrage par club ⇒ tous les docs
    matchant le reste du filter sont renvoyés (les 2 clubs) ⇒ fuite simulée.
    """

    def _matches(doc: dict, filter_dict: dict) -> bool:
        for k, v in (filter_dict or {}).items():
            if doc.get(k) != v:
                return False
        return True

    def _find(filter_dict, projection=None):
        filtered = [d for d in all_docs if _matches(d, filter_dict)]
        cursor = MagicMock()
        # sort() retourne le cursor lui-même (chaînage Motor).
        cursor.sort = MagicMock(return_value=cursor)
        # to_list est awaitable et retourne la liste filtrée.
        cursor.to_list = AsyncMock(return_value=filtered)
        return cursor

    course_kpis = MagicMock()
    course_kpis.find = MagicMock(side_effect=_find)

    db = MagicMock()
    db.course_kpis = course_kpis
    return db


# ════════════════════════════════════════════════════════════════════════════
#   A — GET /courses  (handler `get_courses` L112)
# ════════════════════════════════════════════════════════════════════════════


async def test_get_courses_no_header_leaks_other_club_docs(monkeypatch):
    """🔴 A1 — Sans header (`club_id=None`), `_cq(None)` ne pose AUCUN filtre
    `club_id` ⇒ le mock filtre-aware renvoie les docs des 2 clubs (VERSOIX
    + CLUB_B) ⇒ le payload retourné contient le doc TRAP CLUB_B.

    Preuve comportementale (payload), pas d'introspection. RED tant que la
    signature actuelle laisse `_cq` injecter conditionnellement.
    """
    db = _make_find_mock([DOC_VERSOIX, DOC_TRAP_CLUB_B])
    monkeypatch.setattr(co, "db", db)

    payload = await co.get_courses(year=None, month=None, club_id=None)

    assert isinstance(payload, list), f"Attendu list, got {type(payload)}"

    # 🎯 Le doc TRAP du CLUB_B ne doit JAMAIS apparaître. Sinon = leak read.
    trap_ids = [d.get("id") for d in payload if d.get("club_id") == CLUB_B]
    assert not trap_ids, (
        f"GET /courses sans header expose des docs CLUB_B (TRAP). "
        f"trap_ids leakés = {trap_ids}. RED tant que `_cq(None)` ne pose "
        f"pas `club_id` ⇒ find renvoie cross-club."
    )

    # Aucun course_name CLUB_B ne doit transparaître.
    trap_names = [d.get("course_name") for d in payload if d.get("club_id") == CLUB_B]
    assert DOC_TRAP_CLUB_B["course_name"] not in trap_names, (
        f"GET /courses sans header expose le course_name TRAP "
        f"({DOC_TRAP_CLUB_B['course_name']!r}). Leak cross-club confirmé."
    )


async def test_get_courses_header_club_b_returns_only_club_b_docs(monkeypatch):
    """🟢 A2 (garde anti-hardcode, rougira au Pattern D) — Avec header
    `club_id=CLUB_B`, `_cq(CLUB_B)` pose `{"club_id": CLUB_B}` ⇒ le mock
    filtre-aware ne renvoie QUE les docs CLUB_B ⇒ VERSOIX absent du payload.

    Au Pattern D (retrait du filtre dans `_cq` ou dans le handler), le mock
    renverra les 2 docs ⇒ assert "VERSOIX absent" échouera ⇒ ce test
    rougira ⇒ prouve la non-tautologie du test A1.
    """
    db = _make_find_mock([DOC_VERSOIX, DOC_TRAP_CLUB_B])
    monkeypatch.setattr(co, "db", db)

    payload = await co.get_courses(year=None, month=None, club_id=CLUB_B)

    assert isinstance(payload, list)

    # Tous les docs renvoyés doivent appartenir à CLUB_B.
    clubs_seen = {d.get("club_id") for d in payload}
    assert clubs_seen == {CLUB_B}, (
        f"GET /courses avec header CLUB_B doit ne renvoyer QUE des docs "
        f"CLUB_B. clubs_seen = {clubs_seen}. Rougira au Pattern D."
    )

    # VERSOIX (le DEFAULT) doit être ABSENT — garde anti-hardcode.
    versoix_in_payload = [d for d in payload if d.get("club_id") == VERSOIX]
    assert not versoix_in_payload, (
        f"GET /courses avec header CLUB_B ne doit PAS contenir de doc "
        f"VERSOIX. Sinon = hardcode `club_id_resolved = DEFAULT_CLUB_ID` "
        f"masqué. leak = {versoix_in_payload}."
    )

    # Le doc CLUB_B attendu est bien présent (discriminance positive).
    ids = [d.get("id") for d in payload]
    assert DOC_TRAP_CLUB_B["id"] in ids, (
        f"GET /courses avec header CLUB_B doit contenir le doc CLUB_B "
        f"légitime ({DOC_TRAP_CLUB_B['id']}). ids = {ids}."
    )


# ════════════════════════════════════════════════════════════════════════════
#   B — GET /courses/summary/{year}/{month}  (handler `get_courses_summary` L326)
# ════════════════════════════════════════════════════════════════════════════


async def test_get_courses_summary_no_header_leaks_other_club_docs(monkeypatch):
    """🔴 B1 — Sans header (`club_id=None`), `_cq(None, {year, month})` pose
    seulement `{year, month}` (pas de club_id) ⇒ le mock renvoie les 2 docs
    matchant year/month (VERSOIX + CLUB_B) ⇒ `total_courses == 2` et le
    `course_name` TRAP apparaît dans `by_day`.

    Aggregation faite côté Python (pas de pipeline Mongo) ⇒ preuve sur
    le payload final (total_courses + by_day).
    """
    db = _make_find_mock([DOC_VERSOIX, DOC_TRAP_CLUB_B])
    monkeypatch.setattr(co, "db", db)

    payload = await co.get_courses_summary(year=YEAR, month=MONTH, club_id=None)

    assert isinstance(payload, dict), f"Attendu dict, got {type(payload)}"

    # 🎯 Avec scope correct, on devrait avoir 1 (seulement VERSOIX). Tel
    # quel, on récupère 2 ⇒ leak cross-club confirmé.
    assert payload.get("total_courses") == 1, (
        f"GET /courses/summary sans header doit retourner total_courses=1 "
        f"(VERSOIX seul). got total_courses={payload.get('total_courses')}. "
        f"RED tant que `_cq(None, ...)` ne pose pas `club_id`."
    )

    # Le course_name TRAP ne doit apparaître dans AUCUN by_day[*]["courses"].
    by_day = payload.get("by_day") or {}
    all_course_names = []
    for day_bucket in by_day.values():
        all_course_names.extend(day_bucket.get("courses", []))
    assert DOC_TRAP_CLUB_B["course_name"] not in all_course_names, (
        f"GET /courses/summary sans header expose le course_name TRAP "
        f"({DOC_TRAP_CLUB_B['course_name']!r}) dans by_day. "
        f"by_day courses = {all_course_names}. Leak cross-club confirmé."
    )


async def test_get_courses_summary_header_club_b_returns_only_club_b_summary(monkeypatch):
    """🟢 B2 (garde anti-hardcode, rougira au Pattern D) — Avec header
    `club_id=CLUB_B`, `_cq(CLUB_B, {year, month})` pose les 3 clés ⇒ mock
    renvoie seulement DOC_TRAP_CLUB_B ⇒ summary reflète CLUB_B seul,
    VERSOIX absent de `by_day`.
    """
    db = _make_find_mock([DOC_VERSOIX, DOC_TRAP_CLUB_B])
    monkeypatch.setattr(co, "db", db)

    payload = await co.get_courses_summary(year=YEAR, month=MONTH, club_id=CLUB_B)

    assert isinstance(payload, dict)

    # total_courses doit refléter CLUB_B seul (1 doc).
    assert payload.get("total_courses") == 1, (
        f"GET /courses/summary avec header CLUB_B doit retourner "
        f"total_courses=1. got {payload.get('total_courses')}."
    )

    # by_day ne doit contenir AUCUN course_name VERSOIX (garde anti-hardcode).
    by_day = payload.get("by_day") or {}
    all_course_names = []
    for day_bucket in by_day.values():
        all_course_names.extend(day_bucket.get("courses", []))
    assert DOC_VERSOIX["course_name"] not in all_course_names, (
        f"GET /courses/summary avec header CLUB_B ne doit PAS contenir le "
        f"course_name VERSOIX ({DOC_VERSOIX['course_name']!r}). by_day "
        f"courses = {all_course_names}. Hardcode DEFAULT masqué ?"
    )

    # Discriminance positive : le course_name CLUB_B est bien présent.
    assert DOC_TRAP_CLUB_B["course_name"] in all_course_names, (
        f"GET /courses/summary avec header CLUB_B doit contenir le "
        f"course_name CLUB_B légitime ({DOC_TRAP_CLUB_B['course_name']!r}). "
        f"by_day courses = {all_course_names}."
    )
