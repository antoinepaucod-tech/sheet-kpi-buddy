"""Course, Instructor, and Salary Generation routes"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from datetime import datetime, timezone, date, timedelta

from core.config import db, exclude_archived, MONTHS_FR
from core.security import get_club_id
from models.courses import Instructor, CourseKPI, CourseKPICreate
from models.transactions import AccountingCategory, AccountingTransaction

router = APIRouter(tags=["courses"])


def _cq(club_id, base=None):
    q = dict(base or {})
    if club_id:
        q["club_id"] = club_id
    return q


# ─── Sprint D.3 — Helpers ISO weeks per month ─────────────────────────────────
#
# Règle (spec utilisateur, norme ISO adaptée) :
#   « Une semaine ISO appartient au mois où tombe son LUNDI. »
# Garantit qu'une semaine n'apparaît jamais dans 2 mois.

def iso_weeks_for_month(year: int, month: int) -> list[dict]:
    """Retourne la liste ordonnée des semaines (slots) à afficher pour ce mois.

    Chaque entrée : {slot:1..5, iso_year, iso_week, monday_date:"YYYY-MM-DD"}.
    Une semaine appartient à month ssi son lundi tombe dans (year, month).
    """
    # Premier lundi du mois (ou lundi précédent si le 1er n'est pas un lundi —
    # mais on ne le compte que si son année/mois correspondent).
    first = date(year, month, 1)
    # Trouver le lundi de la semaine ISO contenant le 1er du mois
    iso_y, iso_w, iso_d = first.isocalendar()
    monday = date.fromisocalendar(iso_y, iso_w, 1)
    # Si ce lundi est avant le 1er du mois → c'est la semaine du mois précédent
    # par convention ISO. On commence donc à la semaine SUIVANTE.
    if monday.month != month or monday.year != year:
        monday = monday + timedelta(weeks=1)

    slots: list[dict] = []
    slot_idx = 0
    while monday.year == year and monday.month == month:
        slot_idx += 1
        iy, iw, _ = monday.isocalendar()
        slots.append({
            "slot": slot_idx,
            "iso_year": int(iy),
            "iso_week": int(iw),
            "monday_date": monday.isoformat(),
        })
        monday = monday + timedelta(weeks=1)
        if slot_idx >= 5:  # safety cap (max 5 lundis dans un mois)
            break
    return slots


def _compute_attendance_rate(course: dict, today: Optional[date] = None) -> float:
    """Sprint D.3 — recalcule le taux de remplissage selon la spec.

    Dénominateur = `max_capacity × nb_slots_écoulés` où "écoulé" = monday <= today.
    Les semaines futures sont exclues. Retourne 0 si aucun slot écoulé.
    """
    if today is None:
        today = datetime.now(timezone.utc).date()
    year = int(course.get("year") or 0)
    month = int(course.get("month") or 0)
    max_capacity = int(course.get("max_capacity") or 0)
    if max_capacity <= 0 or year <= 0 or month <= 0:
        return 0.0

    slots = iso_weeks_for_month(year, month)
    if not slots:
        return 0.0

    # Slots dont le lundi est passé OU est cette semaine (lundi <= today)
    elapsed_slots = [s for s in slots if date.fromisoformat(s["monday_date"]) <= today]
    if not elapsed_slots:
        return 0.0

    total_attendance = 0
    for s in elapsed_slots:
        total_attendance += int(course.get(f"week{s['slot']}_attendance") or 0)

    denom = max_capacity * len(elapsed_slots)
    if denom <= 0:
        return 0.0
    return round((total_attendance / denom) * 100, 1)


# ── Courses ───────────────────────────────────────────────────────────────────

@router.get("/courses/iso-weeks/{year}/{month}")
async def get_iso_weeks_for_month(year: int, month: int):
    """Sprint D.3 — Retourne la liste des semaines (slots) à afficher pour
    un mois donné, selon la règle ISO « lundi détermine le mois ».

    Réponse : { year, month, total_slots, slots: [{slot, iso_year, iso_week, monday_date}] }.
    """
    if year < 2000 or year > 2100:
        raise HTTPException(status_code=400, detail="Année invalide")
    if month < 1 or month > 12:
        raise HTTPException(status_code=400, detail="Mois invalide (1-12)")
    slots = iso_weeks_for_month(year, month)
    return {"year": year, "month": month, "total_slots": len(slots), "slots": slots}


@router.get("/courses")
async def get_courses(year: Optional[int] = None, month: Optional[int] = None, club_id: Optional[str] = Depends(get_club_id)):
    query = _cq(club_id)
    if year:
        query["year"] = year
    if month:
        query["month"] = month
    return await db.course_kpis.find(query, {"_id": 0}).sort([("day_of_week", 1), ("time_slot", 1)]).to_list(500)


@router.get("/course-types")
async def get_course_types(club_id: Optional[str] = Depends(get_club_id)):
    """Get all course type categories."""
    return await db.course_types.find(_cq(club_id), {"_id": 0}).sort("name", 1).to_list(100)


@router.post("/course-types")
async def create_course_type(data: dict, club_id: Optional[str] = Depends(get_club_id)):
    """Create a new course type category."""
    import uuid
    name = data.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Nom requis")
    existing = await db.course_types.find_one(_cq(club_id, {"name": name}))
    if existing:
        raise HTTPException(status_code=400, detail="Ce type de cours existe déjà")
    doc = {"id": str(uuid.uuid4()), "name": name, "created_at": datetime.now(timezone.utc).isoformat()}
    if club_id:
        doc["club_id"] = club_id
    await db.course_types.insert_one(doc)
    return {"id": doc["id"], "name": name}


@router.put("/course-types/{type_id}")
async def update_course_type(type_id: str, data: dict, club_id: Optional[str] = Depends(get_club_id)):
    """Update a course type name and propagate to all course_kpis."""
    new_name = data.get("name", "").strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="Nom requis")
    
    existing = await db.course_types.find_one({"id": type_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Type de cours introuvable")
    
    old_name = existing.get("name", "")
    if old_name == new_name:
        return {"id": type_id, "name": new_name}
    
    # Check for duplicate name
    duplicate = await db.course_types.find_one(_cq(club_id, {"name": new_name, "id": {"$ne": type_id}}))
    if duplicate:
        raise HTTPException(status_code=400, detail="Ce nom existe déjà")
    
    # Update the course type
    await db.course_types.update_one({"id": type_id}, {"$set": {"name": new_name}})
    
    # Propagate name change to all course_kpis referencing this course type
    await db.course_kpis.update_many(
        {"course_name": old_name},
        {"$set": {"course_name": new_name}}
    )
    
    return {"id": type_id, "name": new_name, "renamed_from": old_name}




@router.get("/courses/{course_id}")
async def get_course(course_id: str):
    doc = await db.course_kpis.find_one({"id": course_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Cours introuvable")
    return doc


@router.post("/courses")
async def create_course(data: CourseKPICreate, club_id: Optional[str] = Depends(get_club_id)):
    month_name = MONTHS_FR[data.month - 1] if 1 <= data.month <= 12 else ""
    course = CourseKPI(**data.model_dump(), month_name=month_name)
    doc = course.model_dump()
    if club_id:
        doc["club_id"] = club_id
    await db.course_kpis.insert_one(doc)
    doc.pop('_id', None)
    return doc


@router.post("/courses/bulk")
async def bulk_create_courses(courses_data: list[CourseKPICreate], club_id: Optional[str] = Depends(get_club_id)):
    """Create multiple courses at once."""
    created = []
    for data in courses_data:
        month_name = MONTHS_FR[data.month - 1] if 1 <= data.month <= 12 else ""
        course = CourseKPI(**data.model_dump(), month_name=month_name)
        doc = course.model_dump()
        if club_id:
            doc["club_id"] = club_id
        await db.course_kpis.insert_one(doc)
        doc.pop('_id', None)
        created.append(doc)
    return {"message": f"{len(created)} cours créés", "created": len(created), "courses": created}


@router.put("/courses/{course_id}")
async def update_course(course_id: str, body: dict):
    existing = await db.course_kpis.find_one({"id": course_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Cours introuvable")

    # Sprint D.3 — Nouvelle formule attendance_rate (spec ISO) :
    #   Dénominateur = max_capacity × nb_slots_écoulés (lundi <= today).
    #   Les semaines à 0 ne sont plus exclues du dénominateur (la formule
    #   précédente sur-estimait le taux).
    merged = {**existing, **body}
    body["attendance_rate"] = _compute_attendance_rate(merged)
    body["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.course_kpis.update_one({"id": course_id}, {"$set": body})
    return await db.course_kpis.find_one({"id": course_id}, {"_id": 0})


@router.delete("/courses/{course_id}")
async def delete_course(course_id: str):
    result = await db.course_kpis.delete_one({"id": course_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cours introuvable")
    return {"message": "Cours supprimé"}


@router.get("/courses/summary/{year}/{month}")
async def get_courses_summary(year: int, month: int, club_id: Optional[str] = Depends(get_club_id)):
    docs = await db.course_kpis.find(_cq(club_id, {"year": year, "month": month}), {"_id": 0}).to_list(500)
    if not docs:
        return {
            "year": year, "month": month,
            "month_name": MONTHS_FR[month - 1] if 1 <= month <= 12 else "",
            "total_courses": 0, "avg_attendance_rate": 0, "total_expenses": 0, "by_day": {}
        }
    avg_attendance = round(sum(d.get("attendance_rate", 0) for d in docs) / len(docs), 1)
    total_expenses = sum(d.get("monthly_expenses", 0) for d in docs)
    by_day = {}
    for d in docs:
        day = d.get("day_of_week", "Autre")
        if day not in by_day:
            by_day[day] = {"count": 0, "courses": []}
        by_day[day]["count"] += 1
        by_day[day]["courses"].append(d.get("course_name", ""))
    return {
        "year": year, "month": month,
        "month_name": MONTHS_FR[month - 1] if 1 <= month <= 12 else "",
        "total_courses": len(docs),
        "avg_attendance_rate": avg_attendance,
        "total_expenses": total_expenses,
        "by_day": by_day
    }


@router.post("/courses/copy-planning/{year}/{month}")
async def copy_planning_from_previous_month(year: int, month: int, club_id: Optional[str] = Depends(get_club_id)):
    if month == 1:
        prev_month, prev_year = 12, year - 1
    else:
        prev_month, prev_year = month - 1, year

    existing = await db.course_kpis.find(_cq(club_id, {"year": year, "month": month}), {"_id": 0}).to_list(500)
    if existing:
        return {
            "message": f"Le mois {MONTHS_FR[month-1]} {year} contient déjà {len(existing)} cours.",
            "existing_count": len(existing), "copied": 0
        }

    prev_courses = await db.course_kpis.find(_cq(club_id, {"year": prev_year, "month": prev_month}), {"_id": 0}).to_list(500)
    if not prev_courses:
        return {"message": f"Aucun cours trouvé pour {MONTHS_FR[prev_month-1]} {prev_year}", "copied": 0}

    copied = []
    for course in prev_courses:
        new_course = CourseKPI(
            year=year, month=month, month_name=MONTHS_FR[month - 1],
            course_name=course.get("course_name", ""),
            day_of_week=course.get("day_of_week", ""),
            time_slot=course.get("time_slot", ""),
            instructor_id=course.get("instructor_id"),
            instructor_name=course.get("instructor_name", ""),
            coach_id=course.get("coach_id"),
            max_capacity=course.get("max_capacity", 10),
            week1_attendance=0, week2_attendance=0, week3_attendance=0,
            week4_attendance=0, week5_attendance=0,
            s1=0, s2=0, s3=0, s4=0, s5=0,
            attendance_rate=0,
            monthly_expenses=course.get("monthly_expenses", 0),
            notes=""
        )
        doc = new_course.model_dump()
        await db.course_kpis.insert_one(doc)
        doc.pop('_id', None)
        copied.append(doc)
    return {
        "message": f"{len(copied)} cours copiés de {MONTHS_FR[prev_month-1]} {prev_year} vers {MONTHS_FR[month-1]} {year}",
        "source": f"{MONTHS_FR[prev_month-1]} {prev_year}",
        "target": f"{MONTHS_FR[month-1]} {year}",
        "copied": len(copied), "courses": copied
    }


# ─── Sprint D.2 — Recopier planning d'un mois à l'autre (configurable) ────────

def _parse_month_param(value: str) -> tuple[int, int]:
    """Parse 'YYYY-MM' → (year, month). Raise 400 si invalide."""
    try:
        parts = (value or "").split("-")
        if len(parts) != 2:
            raise ValueError("format")
        y, m = int(parts[0]), int(parts[1])
        if not (2000 <= y <= 2100) or not (1 <= m <= 12):
            raise ValueError("range")
        return y, m
    except (ValueError, AttributeError, TypeError):
        raise HTTPException(status_code=400, detail=f"Mois invalide : '{value}'. Format attendu : YYYY-MM")


def _course_dedup_key(course: dict) -> tuple[str, str, str]:
    """Identité d'un slot de cours dans un mois : (day_of_week, time_slot, course_name)."""
    return (
        (course.get("day_of_week") or "").strip(),
        (course.get("time_slot") or "").strip(),
        (course.get("course_name") or "").strip(),
    )


@router.post("/courses/copy-month/preview")
async def copy_month_preview(body: dict, club_id: Optional[str] = Depends(get_club_id)):
    """Sprint D.2 — Pré-calcul avant recopie : combien créés / écrasés / conservés."""
    source_year, source_month = _parse_month_param(body.get("source_month"))
    dest_year, dest_month = _parse_month_param(body.get("dest_month"))

    if (source_year, source_month) == (dest_year, dest_month):
        raise HTTPException(status_code=400, detail="Source et destination identiques")

    source_courses = await db.course_kpis.find(
        _cq(club_id, {"year": source_year, "month": source_month}), {"_id": 0}
    ).to_list(500)
    dest_courses = await db.course_kpis.find(
        _cq(club_id, {"year": dest_year, "month": dest_month}), {"_id": 0}
    ).to_list(500)

    dest_by_key = {_course_dedup_key(c): c for c in dest_courses}
    source_keys = {_course_dedup_key(c) for c in source_courses}

    will_create = sum(1 for c in source_courses if _course_dedup_key(c) not in dest_by_key)
    will_overwrite = sum(1 for c in source_courses if _course_dedup_key(c) in dest_by_key)
    will_keep = sum(1 for k in dest_by_key.keys() if k not in source_keys)

    return {
        "source": f"{MONTHS_FR[source_month-1]} {source_year}",
        "dest": f"{MONTHS_FR[dest_month-1]} {dest_year}",
        "source_count": len(source_courses),
        "dest_count": len(dest_courses),
        "will_create": will_create,
        "will_overwrite": will_overwrite,
        "will_keep": will_keep,
    }


@router.post("/courses/copy-month")
async def copy_month(body: dict, club_id: Optional[str] = Depends(get_club_id)):
    """Sprint D.2 — Recopier planning source_month → dest_month, avec option overwrite.

    Body : { source_month: "YYYY-MM", dest_month: "YYYY-MM", overwrite: bool }.

    Logique :
      - Pour chaque cours source, clé d'identité = (day_of_week, time_slot, course_name).
      - Si destination a déjà un cours avec la même clé :
          * `overwrite=true`  → écrase (garde l'ID dest existant, met à jour les fields).
          * `overwrite=false` → conservé tel quel, source ignorée.
      - Sinon → création (nouveau ID, attendances repartent à 0).
      - Les cours dest sans équivalent source ne sont **jamais** touchés (conservés).
    """
    source_year, source_month = _parse_month_param(body.get("source_month"))
    dest_year, dest_month = _parse_month_param(body.get("dest_month"))
    overwrite = bool(body.get("overwrite", True))

    if (source_year, source_month) == (dest_year, dest_month):
        raise HTTPException(status_code=400, detail="Source et destination identiques")

    source_courses = await db.course_kpis.find(
        _cq(club_id, {"year": source_year, "month": source_month}), {"_id": 0}
    ).to_list(500)
    if not source_courses:
        return {
            "message": f"Aucun cours à copier depuis {MONTHS_FR[source_month-1]} {source_year}",
            "created": 0, "overwritten": 0, "kept": 0, "skipped": 0,
        }

    dest_courses = await db.course_kpis.find(
        _cq(club_id, {"year": dest_year, "month": dest_month}), {"_id": 0}
    ).to_list(500)
    dest_by_key = {_course_dedup_key(c): c for c in dest_courses}

    now_iso = datetime.now(timezone.utc).isoformat()
    created = 0
    overwritten = 0
    skipped = 0

    for src in source_courses:
        key = _course_dedup_key(src)
        if key in dest_by_key and not overwrite:
            skipped += 1
            continue

        if key in dest_by_key and overwrite:
            existing = dest_by_key[key]
            update_fields = {
                "instructor": src.get("instructor"),
                "max_capacity": int(src.get("max_capacity") or 10),
                "week1_attendance": 0, "week2_attendance": 0, "week3_attendance": 0,
                "week4_attendance": 0, "week5_attendance": 0,
                "week1_instructor": None, "week2_instructor": None, "week3_instructor": None,
                "week4_instructor": None, "week5_instructor": None,
                "attendance_rate": 0.0,
                "monthly_expenses": float(src.get("monthly_expenses") or 0),
                "updated_at": now_iso,
            }
            await db.course_kpis.update_one({"id": existing["id"]}, {"$set": update_fields})
            overwritten += 1
        else:
            new_course = CourseKPI(
                year=dest_year, month=dest_month,
                month_name=MONTHS_FR[dest_month - 1],
                day_of_week=src.get("day_of_week", ""),
                time_slot=src.get("time_slot", ""),
                course_name=src.get("course_name", ""),
                instructor=src.get("instructor"),
                max_capacity=int(src.get("max_capacity") or 10),
                monthly_expenses=float(src.get("monthly_expenses") or 0),
            )
            doc = new_course.model_dump()
            if club_id:
                doc["club_id"] = club_id
            await db.course_kpis.insert_one(doc)
            created += 1

    # Cours dest sans équivalent source = conservés
    source_keys = {_course_dedup_key(c) for c in source_courses}
    kept = sum(1 for k in dest_by_key.keys() if k not in source_keys)

    return {
        "message": f"{created} créés, {overwritten} écrasés, {kept} conservés"
                   + (f", {skipped} ignorés" if skipped else ""),
        "source": f"{MONTHS_FR[source_month-1]} {source_year}",
        "dest": f"{MONTHS_FR[dest_month-1]} {dest_year}",
        "created": created,
        "overwritten": overwritten,
        "kept": kept,
        "skipped": skipped,
    }


# ── Instructors ───────────────────────────────────────────────────────────────

@router.get("/instructors")
async def get_instructors(active_only: Optional[bool] = None, club_id: Optional[str] = Depends(get_club_id)):
    query = _cq(club_id, {"is_active": True} if active_only else None)
    return await db.instructors.find(query, {"_id": 0}).sort("name", 1).to_list(100)


@router.post("/instructors")
async def create_instructor(body: dict, club_id: Optional[str] = Depends(get_club_id)):
    instructor = Instructor(
        name=body.get("name", ""),
        email=body.get("email"),
        hourly_rate=body.get("hourly_rate", 0),
        is_active=body.get("is_active", True)
    )
    doc = instructor.model_dump()
    if club_id:
        doc["club_id"] = club_id
    await db.instructors.insert_one(doc)
    doc.pop('_id', None)
    return doc


@router.put("/instructors/{instructor_id}")
async def update_instructor(instructor_id: str, body: dict):
    existing = await db.instructors.find_one({"id": instructor_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Instructeur introuvable")
    await db.instructors.update_one({"id": instructor_id}, {"$set": body})
    return await db.instructors.find_one({"id": instructor_id}, {"_id": 0})


@router.delete("/instructors/{instructor_id}")
async def delete_instructor(instructor_id: str):
    result = await db.instructors.delete_one({"id": instructor_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Instructeur introuvable")
    return {"message": "Instructeur supprimé"}


# ── Salary Generation ─────────────────────────────────────────────────────────

@router.post("/courses/generate-salary-expenses/{year}/{month}")
async def generate_salary_expenses(year: int, month: int, club_id: Optional[str] = Depends(get_club_id)):
    courses = await db.course_kpis.find(_cq(club_id, {"year": year, "month": month}), {"_id": 0}).to_list(500)
    if not courses:
        raise HTTPException(status_code=404, detail="Aucun cours trouvé pour ce mois")

    # Build lookup maps by both name and id
    coaches_list = await db.coaches.find(exclude_archived(_cq(club_id)), {"_id": 0}).to_list(100)
    coaches_by_name = {c["name"]: c for c in coaches_list}
    coaches_by_id = {c["id"]: c for c in coaches_list}
    instructors_map = {i["name"]: i for i in await db.instructors.find(_cq(club_id), {"_id": 0}).to_list(100)}

    salary_by_coach = {}
    for course in courses:
        # Resolve main instructor: try instructor field, then coach_id lookup
        main_instr = course.get("instructor") or ""
        if not main_instr and course.get("coach_id"):
            coach = coaches_by_id.get(course["coach_id"])
            if coach:
                main_instr = coach["name"]

        if not main_instr:
            continue

        # Resolve hourly rate
        rate = 0
        if main_instr in coaches_by_name:
            rate = coaches_by_name[main_instr].get("hourly_rate", 0)
        elif main_instr in instructors_map:
            rate = instructors_map[main_instr].get("hourly_rate", 0)

        for w in range(1, 6):
            if course.get(f"week{w}_attendance", 0) == 0:
                continue
            override = course.get(f"week{w}_instructor")
            instr_name = override if override else main_instr
            r = rate
            if override:
                if override in coaches_by_name:
                    r = coaches_by_name[override].get("hourly_rate", 0)
                elif override in instructors_map:
                    r = instructors_map[override].get("hourly_rate", 0)
            if instr_name not in salary_by_coach:
                salary_by_coach[instr_name] = {"hours": 0, "total": 0, "rate": r}
            salary_by_coach[instr_name]["hours"] += 1
            salary_by_coach[instr_name]["total"] += r

    # Filter out coaches with 0 CHF total (avoid creating useless transactions)
    salary_by_coach = {k: v for k, v in salary_by_coach.items() if v["total"] > 0}

    if not salary_by_coach:
        return {"message": "Aucune rémunération à générer", "transactions": []}

    salary_cat = await db.accounting_categories.find_one({"kpi_column": "salaires_coachs"})
    if not salary_cat:
        salary_cat = AccountingCategory(
            name="SALAIRES COACHS", kpi_column="salaires_coachs",
            type="expense", color="#8B5CF6"
        ).model_dump()
        await db.accounting_categories.insert_one(salary_cat)

    month_str = f"{year}-{month:02d}"
    await db.accounting_transactions.delete_many({
        "category": "SALAIRES COACHS",
        "date": {"$regex": f"^{month_str}"},
        "description": {"$regex": "^\\[Auto\\]"}
    })

    transactions = []
    for coach_name, info in salary_by_coach.items():
        tx = AccountingTransaction(
            date=f"{month_str}-28",
            description=f"[Auto] Salaire {coach_name} - {info['hours']}h à {info['rate']} CHF/h",
            amount=round(info["total"], 2),
            type="expense",
            category="SALAIRES COACHS"
        )
        doc = tx.model_dump()
        await db.accounting_transactions.insert_one(doc)
        doc.pop("_id", None)
        transactions.append(doc)

    total = sum(t["amount"] for t in transactions)
    return {
        "message": f"{len(transactions)} transactions de salaires générées pour {MONTHS_FR[month-1]} {year}",
        "total": total, "by_coach": salary_by_coach, "transactions": transactions
    }
