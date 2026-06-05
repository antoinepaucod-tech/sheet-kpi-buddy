"""Tests régression SB B.2.3.C.3.G — scope `club_id` sur
`POST /courses` (L233-242, insert single) et `POST /courses/bulk`
(L245-258, insert boucle).

État actuel (audit C.3 reste, vérifié RO corps-entier méta #13) :
  - `create_course` L233 : signature `(data, club_id=Depends(get_club_id))`
    sans `current_user`. 1 op DB : L240 `insert_one(doc)` avec source
    `club_id` raw-header conditionnelle (`if club_id: doc["club_id"] = club_id`).
  - `bulk_create_courses` L245 : signature `(courses_data, club_id=…)` sans
    `current_user`. 1 op DB en boucle : L255 `insert_one(doc)` idem
    pattern conditionnel (par item dans le batch).

Conséquences actuelles :
  - Header None ⇒ doc orphelin (clé `club_id` absente) — récidive F.2/CS1.
  - Bulk N items + header None ⇒ N orphelins consécutifs.

Décision architecturale CIBLE (alignée C.3.A.1/I/J) :
  - Signature : ajout `current_user: dict = Depends(get_current_user)`.
  - 1 seul `club_id_resolved = resolve_club_id_or_fallback(...)` par handler.
  - `doc["club_id"] = club_id_resolved` INCONDITIONNEL après `model_dump()`.
  - Pour bulk : la même `club_id_resolved` est posée sur CHAQUE doc de
    la boucle (pas seulement le 1er — TRAP boucle).

Tests :
  - test_create_course_doc_carries_resolved_club_id (single)
  - test_bulk_each_doc_carries_resolved_club_id (CRUX TRAP boucle, ≥2 docs)
  - test_create_course_value_flow_from_header_not_hardcoded_default (anti-hardcode)

État RED attendu : TypeError (signature `current_user`) sur les 3 tests.
0 mutation Atlas (AsyncMock pure).
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from routers import courses as co


pytestmark = [pytest.mark.regression, pytest.mark.asyncio]


VERSOIX_HEADER = "0a327bf5-c759-49eb-87e4-551913f78bdb"  # = DEFAULT_CLUB_ID
DEFAULT_CLUB_ID = "0a327bf5-c759-49eb-87e4-551913f78bdb"
CLUB_B = "club-B-explicit-non-default"
PAYLOAD_CLUB_TRAP = "PAYLOAD_X-cross-club-trap"


def _user(active_club_id: str = VERSOIX_HEADER) -> dict:
    return {"id": "u-1", "email": "u@example.com", "active_club_id": active_club_id}


def _patch_resolver_priority_header(monkeypatch) -> None:
    """Resolver patché : header > active_club_id > DEFAULT_CLUB_ID."""
    def _fake(club_id, current_user, endpoint):
        if club_id:
            return club_id
        return (current_user or {}).get("active_club_id") or DEFAULT_CLUB_ID
    monkeypatch.setattr(co, "resolve_club_id_or_fallback", _fake)


def _course_payload(**overrides) -> dict:
    """Payload CourseKPICreate minimal (champs requis du modèle)."""
    base = {
        "year": 2026,
        "month": 6,
        "course_name": "Hyrox Power",
        "day_of_week": "Lundi",
        "time_slot": "08:00",
        "max_capacity": 10,
        "monthly_expenses": 0,
    }
    base.update(overrides)
    return base


def _mk_create_model(**overrides):
    """Instancie CourseKPICreate Pydantic depuis routers.courses."""
    from models.courses import CourseKPICreate
    return CourseKPICreate(**_course_payload(**overrides))


def _build_db_mock() -> MagicMock:
    course_kpis = MagicMock()
    course_kpis.insert_one = AsyncMock()
    db = MagicMock()
    db.course_kpis = course_kpis
    return db


# ════════════════════════════════════════════════════════════════════════════
#   TEST 1 — POST /courses (single) : insert porte resolved
# ════════════════════════════════════════════════════════════════════════════


async def test_create_course_doc_carries_resolved_club_id(monkeypatch):
    """🎯 L240 insert_one : doc DOIT porter `club_id == VERSOIX_HEADER`
    (resolved). RED actuel : `if club_id: doc["club_id"] = club_id` raw
    conditionnel ⇒ avec header VERSOIX truthy le doc porte VERSOIX déjà,
    MAIS la signature n'accepte pas `current_user` ⇒ TypeError.
    """
    db = _build_db_mock()
    monkeypatch.setattr(co, "db", db)
    _patch_resolver_priority_header(monkeypatch)

    data = _mk_create_model()
    await co.create_course(
        data=data,
        club_id=VERSOIX_HEADER,
        current_user=_user(),
    )

    assert db.course_kpis.insert_one.call_count == 1, (
        f"Attendu 1 insert_one, got {db.course_kpis.insert_one.call_count}"
    )
    inserted_doc = db.course_kpis.insert_one.call_args.args[0]
    assert "club_id" in inserted_doc, (
        f"POST /courses L240 insert_one doc SANS clé `club_id` (orphelin "
        f"F.2/CS1). RED si `if club_id:` reste conditionnel."
    )
    assert inserted_doc.get("club_id") == VERSOIX_HEADER, (
        f"POST /courses L240 doc[\"club_id\"]={inserted_doc.get('club_id')!r}, "
        f"attendu {VERSOIX_HEADER!r} (resolved via header)."
    )


# ════════════════════════════════════════════════════════════════════════════
#   TEST 2 — POST /courses/bulk : CRUX TRAP BOUCLE — CHAQUE doc resolved
# ════════════════════════════════════════════════════════════════════════════


async def test_bulk_each_doc_carries_resolved_club_id(monkeypatch):
    """🎯 CRUX : itérer 3 docs, vérifier que CHAQUE doc inséré porte
    `club_id == VERSOIX_HEADER`. Un patch incorrect qui scoperait
    uniquement le 1er item de la boucle (ou utiliserait une variable
    qui n'est calculée qu'une fois) DOIT rougir sur les items 2 et 3.
    """
    db = _build_db_mock()
    monkeypatch.setattr(co, "db", db)
    _patch_resolver_priority_header(monkeypatch)

    batch = [
        _mk_create_model(course_name="Course-1", day_of_week="Lundi"),
        _mk_create_model(course_name="Course-2", day_of_week="Mardi"),
        _mk_create_model(course_name="Course-3", day_of_week="Mercredi"),
    ]
    await co.bulk_create_courses(
        courses_data=batch,
        club_id=VERSOIX_HEADER,
        current_user=_user(),
    )

    assert db.course_kpis.insert_one.call_count == 3, (
        f"Attendu 3 insert_one (batch=3), got "
        f"{db.course_kpis.insert_one.call_count}"
    )

    inserted_docs = [c.args[0] for c in db.course_kpis.insert_one.call_args_list]
    for i, doc in enumerate(inserted_docs):
        assert "club_id" in doc, (
            f"POST /courses/bulk L255 item #{i+1} (course_name="
            f"{doc.get('course_name')!r}) insert_one doc SANS clé `club_id` "
            f"(orphelin F.2/CS1 dans la boucle). RED si `if club_id:` "
            f"reste conditionnel ou si le scope n'est pas appliqué à CET item."
        )
        assert doc.get("club_id") == VERSOIX_HEADER, (
            f"POST /courses/bulk L255 item #{i+1} (course_name="
            f"{doc.get('course_name')!r}) doc[\"club_id\"]="
            f"{doc.get('club_id')!r}, attendu {VERSOIX_HEADER!r}. "
            f"RED si le patch scope seulement le 1er item ou utilise une "
            f"valeur calculée par item (incohérente entre items)."
        )


# ════════════════════════════════════════════════════════════════════════════
#   TEST 3 — Anti-hardcode : header CLUB_B (≠ DEFAULT) sur single + bulk
# ════════════════════════════════════════════════════════════════════════════


async def test_create_course_value_flow_from_header_not_hardcoded_default(monkeypatch):
    """🎯 DISCRIMINANCE anti-faux-vert : un patch hardcodant
    `doc["club_id"] = DEFAULT_CLUB_ID` (Versoix) passerait les tests 1+2
    car VERSOIX_HEADER == DEFAULT_CLUB_ID.

    Ici on tape avec `header=CLUB_B` (explicitement ≠ DEFAULT). Sur les 2
    handlers (single + 1er item bulk) les docs DOIVENT porter `CLUB_B`.
    Si un patch utilise `DEFAULT_CLUB_ID` au lieu du resolved → FAIL.
    """
    db = _build_db_mock()
    monkeypatch.setattr(co, "db", db)
    _patch_resolver_priority_header(monkeypatch)

    # Single
    await co.create_course(
        data=_mk_create_model(),
        club_id=CLUB_B,
        current_user=_user(),
    )
    doc_single = db.course_kpis.insert_one.call_args_list[0].args[0]
    assert doc_single.get("club_id") == CLUB_B, (
        f"POST /courses (single) doc[\"club_id\"]={doc_single.get('club_id')!r}, "
        f"attendu {CLUB_B!r} (header explicite). Si =={DEFAULT_CLUB_ID!r}, "
        f"value-flow hardcodé sur DEFAULT (faux-vert anti-tautologie)."
    )

    # Bulk (1 item suffit pour la discriminance value-flow)
    await co.bulk_create_courses(
        courses_data=[_mk_create_model(course_name="Bulk-CLUB_B")],
        club_id=CLUB_B,
        current_user=_user(),
    )
    doc_bulk = db.course_kpis.insert_one.call_args_list[1].args[0]
    assert doc_bulk.get("club_id") == CLUB_B, (
        f"POST /courses/bulk doc[\"club_id\"]={doc_bulk.get('club_id')!r}, "
        f"attendu {CLUB_B!r} (header explicite). Si =={DEFAULT_CLUB_ID!r}, "
        f"value-flow hardcodé sur DEFAULT."
    )
