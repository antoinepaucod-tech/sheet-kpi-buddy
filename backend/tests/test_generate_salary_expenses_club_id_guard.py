"""Tests régression SB B.2.3.C.3.F — scope `club_id` sur le handler
`generate_salary_expenses` (POST `/courses/generate-salary-expenses/{year}/{month}`).

État actuel (audit C.3.F étendu) :
  - L540 guard 400 `if not club_id: raise 400` (déjà en place).
  - L543 find course_kpis : `_cq(club_id, {year, month})` ✅
  - L548 find coaches    : `exclude_archived(_cq(club_id))` ✅
  - L589 find_one accounting_categories : `{"kpi_column": "salaires_coachs"}` ❌ NU
  - L595 insert_one accounting_categories : doc issu de `AccountingCategory(...).model_dump()`
        SANS injection `club_id` ❌ orphelin garanti (sous `if not salary_cat:`)
  - L598 delete_many accounting_transactions : `{"category", "date", "description"}` ❌ NU 🔴🔴
  - L617 insert_one accounting_transactions : `doc["club_id"] = club_id` ✅

Décision architecturale CIBLE :
  - SIGNATURE INCHANGÉE (guard 400 amont = club_id truthy garanti partout) —
    pas besoin de `current_user`.
  - L589 → `{"kpi_column": "salaires_coachs", "club_id": club_id}`.
  - L595 → injection `salary_cat["club_id"] = club_id` AVANT insert (Sprint A
    pattern, comme L616 pour les transactions).
  - L598 → `{"club_id": club_id, "category": "SALAIRES COACHS", "date": …, "description": …}`.

Tests :
  - test_read_cat_scoped (δ)            : filter find_one contient `club_id`
  - test_insert_cat_no_orphan (ε)       : insert_one doc a la clé `club_id`
  - test_insert_cat_club_id_value (ε)   : doc["club_id"] == "club-A"
  - test_delete_many_tx_scoped (ζ)      : delete_many filter contient `club_id`
  - test_guard_400_no_header            : header None → 400 (GREEN actuel, verrou)

État RED attendu : 4× AssertionError (δ/ε/ε/ζ) — PAS de TypeError car
signature inchangée. 1× GREEN (guard).

0 mutation Atlas (AsyncMock pure).
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from routers import courses as co


pytestmark = [pytest.mark.regression, pytest.mark.asyncio]


CLUB_A = "club-A-from-header"


def _course_with_attendance() -> dict:
    """1 course avec instructor + week1_attendance=10 → 1 entrée salary_by_coach."""
    return {
        "id": "c1",
        "year": 2026,
        "month": 6,
        "course_name": "Hyrox",
        "instructor": "Coach A",
        "week1_attendance": 10,
        "week2_attendance": 0,
        "week3_attendance": 0,
        "week4_attendance": 0,
        "week5_attendance": 0,
        "week1_instructor": None,
        "club_id": CLUB_A,
    }


def _coach() -> dict:
    return {
        "id": "ca1",
        "name": "Coach A",
        "hourly_rate": 100,
        "club_id": CLUB_A,
    }


def _build_db_mock(salary_cat_return) -> MagicMock:
    """Driver du handler jusqu'à L589+ :
      - course_kpis.find().to_list() → 1 course avec attendance
      - coaches.find().to_list() → 1 coach rate=100
      → salary_by_coach = {"Coach A": {hours:1, total:100, rate:100}} (non vide)
      - accounting_categories.find_one → paramètre du test (doc ou None)
      - accounting_categories.insert_one → AsyncMock spy
      - accounting_transactions.delete_many → AsyncMock spy
      - accounting_transactions.insert_one → AsyncMock (boucle salary_by_coach)
    """
    def _chain_find(result_list):
        to_list_mock = AsyncMock(return_value=result_list)
        find_result = MagicMock()
        find_result.to_list = to_list_mock
        find_mock = MagicMock(return_value=find_result)
        return find_mock

    course_kpis = MagicMock()
    course_kpis.find = _chain_find([_course_with_attendance()])

    coaches = MagicMock()
    coaches.find = _chain_find([_coach()])

    accounting_categories = MagicMock()
    accounting_categories.find_one = AsyncMock(return_value=salary_cat_return)
    accounting_categories.insert_one = AsyncMock()

    accounting_transactions = MagicMock()
    accounting_transactions.delete_many = AsyncMock()
    accounting_transactions.insert_one = AsyncMock()

    db = MagicMock()
    db.course_kpis = course_kpis
    db.coaches = coaches
    db.accounting_categories = accounting_categories
    db.accounting_transactions = accounting_transactions
    return db


# ════════════════════════════════════════════════════════════════════════════
#   δ — L589 read accounting_categories scopé
# ════════════════════════════════════════════════════════════════════════════


async def test_read_cat_scoped(monkeypatch):
    """🎯 δ L589 find_one doit scoper `club_id`. RED actuel : filter
    `{"kpi_column": "salaires_coachs"}` seul ⇒ peut récupérer la catégorie
    d'un autre club (masquant la nécessité d'un insert local Versoix).
    """
    db = _build_db_mock(salary_cat_return={"id": "cat-EXISTING", "name": "SALAIRES COACHS"})
    monkeypatch.setattr(co, "db", db)

    await co.generate_salary_expenses(year=2026, month=6, club_id=CLUB_A)

    assert db.accounting_categories.find_one.call_count == 1, (
        f"Attendu 1 find_one sur accounting_categories, got "
        f"{db.accounting_categories.find_one.call_count}"
    )
    filter_dict = db.accounting_categories.find_one.call_args.args[0]
    assert filter_dict.get("kpi_column") == "salaires_coachs"
    assert filter_dict.get("club_id") == CLUB_A, (
        f"δ L589 find_one accounting_categories filter sans `club_id` scopé : "
        f"{filter_dict}. RED si reste `{{kpi_column: …}}` (cross-club leak)."
    )


# ════════════════════════════════════════════════════════════════════════════
#   ε — L595 insert accounting_categories : pas orphelin + valeur resolved
# ════════════════════════════════════════════════════════════════════════════


async def test_insert_cat_no_orphan(monkeypatch):
    """🎯 ε L595 insert_one doit poser la clé `club_id` sur le doc. RED actuel :
    `AccountingCategory(...).model_dump()` ne pose pas `club_id` et aucune
    injection post-`model_dump()` → doc orphelin garanti.

    Forcer find_one→None pour atteindre la branche L595.
    """
    db = _build_db_mock(salary_cat_return=None)  # déclenche L590-595
    monkeypatch.setattr(co, "db", db)

    await co.generate_salary_expenses(year=2026, month=6, club_id=CLUB_A)

    assert db.accounting_categories.insert_one.call_count == 1, (
        f"Attendu 1 insert_one accounting_categories (catégorie absente), got "
        f"{db.accounting_categories.insert_one.call_count}. "
        f"Si 0, find_one return None n'a pas déclenché la branche L595."
    )
    inserted_doc = db.accounting_categories.insert_one.call_args.args[0]
    assert "club_id" in inserted_doc, (
        f"ε L595 insert_one accounting_categories doc SANS clé `club_id` "
        f"(orphelin garanti, type F.2 amplifié) : {inserted_doc}. "
        f"RED si pas d'injection `salary_cat[\"club_id\"] = club_id` avant insert."
    )


async def test_insert_cat_club_id_value(monkeypatch):
    """🎯 ε L595 : la valeur posée sur doc["club_id"] doit être exactement
    le `club_id` du header (CLUB_A), pas un hardcode ni un défaut Pydantic.
    """
    db = _build_db_mock(salary_cat_return=None)
    monkeypatch.setattr(co, "db", db)

    await co.generate_salary_expenses(year=2026, month=6, club_id=CLUB_A)

    inserted_doc = db.accounting_categories.insert_one.call_args.args[0]
    assert inserted_doc.get("club_id") == CLUB_A, (
        f"ε L595 insert_one accounting_categories doc[\"club_id\"]="
        f"{inserted_doc.get('club_id')!r} ≠ {CLUB_A!r}. RED si la valeur "
        f"n'est pas le club_id du header (raw passé après guard 400)."
    )


# ════════════════════════════════════════════════════════════════════════════
#   ζ — L598 delete_many accounting_transactions scopé (CATASTROPHIQUE)
# ════════════════════════════════════════════════════════════════════════════


async def test_delete_many_tx_scoped(monkeypatch):
    """🎯 ζ L598 delete_many doit scoper `club_id`. RED actuel : filter
    `{category, date, description}` seul ⇒ wipe cross-club des transactions
    auto même mois (catastrophique : si Genève génère salaires juin 2026
    après Versoix, la régénération Versoix tuerait les tx auto Genève).
    """
    db = _build_db_mock(salary_cat_return={"id": "cat-EXISTING"})
    monkeypatch.setattr(co, "db", db)

    await co.generate_salary_expenses(year=2026, month=6, club_id=CLUB_A)

    assert db.accounting_transactions.delete_many.call_count == 1, (
        f"Attendu 1 delete_many accounting_transactions, got "
        f"{db.accounting_transactions.delete_many.call_count}"
    )
    delete_filter = db.accounting_transactions.delete_many.call_args.args[0]
    # Sanity sur les clés actuelles
    assert delete_filter.get("category") == "SALAIRES COACHS"
    # Cœur du test : scope obligatoire
    assert delete_filter.get("club_id") == CLUB_A, (
        f"ζ L598 delete_many accounting_transactions filter sans `club_id` "
        f"scopé : {delete_filter}. RED CATASTROPHIQUE si reste "
        f"`{{category, date, description}}` (wipe cross-club tx auto)."
    )


# ════════════════════════════════════════════════════════════════════════════
#   Guard 400 — verrou (GREEN actuel, doit le rester)
# ════════════════════════════════════════════════════════════════════════════


async def test_guard_400_no_header(monkeypatch):
    """🎯 Verrou : si X-Club-Id est absent (club_id=None), le handler doit
    raise HTTPException 400 — JAMAIS de fallback Versoix silencieux.

    Test attendu GREEN immédiatement (guard L540-541 déjà en place). Doit
    rester GREEN après les patches δ/ε/ζ.
    """
    db = _build_db_mock(salary_cat_return=None)
    monkeypatch.setattr(co, "db", db)

    with pytest.raises(Exception) as exc_info:
        await co.generate_salary_expenses(year=2026, month=6, club_id=None)

    status = getattr(exc_info.value, "status_code", None)
    detail = getattr(exc_info.value, "detail", None)
    assert status == 400, (
        f"Guard amont doit raise 400 sans header, got status={status} "
        f"detail={detail!r}. RED si le handler tombe sur un fallback Versoix "
        f"silencieux au lieu du 400."
    )
    # Verrou complémentaire : AUCUNE op DB déclenchée (guard AVANT find courses).
    assert db.course_kpis.find.call_count == 0, (
        f"Guard 400 doit s'exécuter AVANT toute op DB, "
        f"got {db.course_kpis.find.call_count} call(s) sur course_kpis.find."
    )
