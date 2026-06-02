"""Members routes"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from datetime import datetime, timezone, timedelta
from dateutil.relativedelta import relativedelta
from uuid import uuid4

from core.config import db, exclude_archived, check_member_not_archived
from core.security import get_club_id, get_current_user
from core.activity_log import log_activity
from core.club_id_guard import resolve_club_id_or_fallback
from core.notifications import (
    send_renewal_reminder,
    send_resend_email,
    build_unsubscribe_url,
    build_whatsapp_url,
    _first_name,
    _renewal_reminder_fallback_v3,
)
from core.email_templates import render_with_fallback
from core.member_categorization import (
    get_member_category,
    _dedupe_partenaire,
    CATEGORIES,
)
from models.members import (
    CustomerMember, CustomerMemberCreate,
    MemberRenewalHistory, WeeklyTraining, WeeklyTrainingUpdate,
    AnnualReview
)
from models.payments import PaymentSchedule
from models.challenges import ChallengeParticipant

router = APIRouter(prefix="/members", tags=["members"])

FREQUENCY_DELTA = {
    "weekly": relativedelta(weeks=1),
    "monthly": relativedelta(months=1),
    "quarterly": relativedelta(months=3),
    "semi-annually": relativedelta(months=6),
    "annually": relativedelta(years=1),
    "challenge": timedelta(days=42),  # 6 weeks challenge
}


def calc_review_date(contract_date_str, frequency):
    """Calculate first review date from contract date and frequency"""
    try:
        contract_date = datetime.fromisoformat(contract_date_str)
        delta = FREQUENCY_DELTA.get(frequency, relativedelta(years=1))
        return (contract_date + delta).strftime("%Y-%m-%d")
    except Exception:
        return None


COACH_KEYWORDS = ["THE COACH", "VIRTUAL COACH"]

def _is_coach(membership: str) -> bool:
    if not membership:
        return False
    upper = membership.upper()
    return any(kw in upper for kw in COACH_KEYWORDS)


@router.get("")
async def get_members(expiring_soon: Optional[bool] = None, member_type: Optional[str] = None, include_archived: Optional[bool] = None, only_archived: Optional[bool] = None, include_paused: Optional[bool] = None, club_id: Optional[str] = Depends(get_club_id)):
    query = {}
    if club_id:
        query["club_id"] = club_id
    if member_type:
        query["member_type"] = member_type
    
    # Archived filtering (B.2)
    if only_archived:
        query["archived_at"] = {"$ne": None, "$exists": True}
    elif not include_archived:
        query = exclude_archived(query)
    
    docs = await db.customer_members.find(query, {"_id": 0}).sort("name", 1).to_list(5000)
    
    # Sprint D Phase 2 — compute on_pause flag and optionally filter
    today_iso_d = datetime.now(timezone.utc).date().isoformat()
    for d in docs:
        d["on_pause"] = _is_on_pause(d, today_iso_d)
    if not include_paused and not only_archived:
        docs = [d for d in docs if not d.get("on_pause")]
    
    # Add computed is_coach field
    for d in docs:
        d["is_coach"] = _is_coach(d.get("membership", ""))

    # G4 — compute is_expired flag (read-only, no DB write)
    # Logic: subscription_end_date < today AND not archived
    # subscription_end_date null/empty → is_expired = false
    for d in docs:
        end_date = d.get("subscription_end_date")
        d["is_expired"] = bool(
            end_date and end_date < today_iso_d and not d.get("archived_at")
        )
        # Bulk renewal reminder fields (2026-05-16) — expose defaults sûrs
        # même quand le doc Mongo n'a pas encore ces champs (jamais relancé)
        d.setdefault("last_renewal_reminder_at", None)
        d.setdefault("renewal_reminder_count", 0)
        d.setdefault("marketing_opt_out", False)

    # Separate current vs departed (departed = exit_date in the past only)
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    current_docs = [d for d in docs if not d.get("exit_date") or d["exit_date"] in [None, "", "None"] or d["exit_date"] >= today_str]
    departed_docs = [d for d in docs if d.get("exit_date") and d["exit_date"] not in [None, "", "None"] and d["exit_date"] < today_str]
    
    # Deduplicate ONLY within current members
    name_groups = {}
    for d in current_docs:
        name = d.get("name", "")
        if name not in name_groups:
            name_groups[name] = []
        name_groups[name].append(d)
    
    for name, group in name_groups.items():
        if len(group) <= 1:
            continue
        has_coach = any(d["is_coach"] for d in group)
        has_noncoach = any(not d["is_coach"] for d in group)
        if has_coach and has_noncoach:
            for d in group:
                if not d["is_coach"]:
                    d["is_coach_also"] = True
        # Handle true duplicates (same name AND same membership), but NOT DUO pairs
        seen = set()
        for d in group:
            key = d.get("membership", "")
            if key in seen:
                # Don't flag DUO partners as duplicates
                if not d.get("is_duo"):
                    d["is_duplicate"] = True
            seen.add(key)
    
    if expiring_soon:
        today = datetime.now(timezone.utc).date()
        thirty_days = today + timedelta(days=30)
        docs = [
            d for d in docs
            if d.get("subscription_end_date") and
            today <= datetime.fromisoformat(d["subscription_end_date"]).date() <= thirty_days
        ]
    
    return docs


@router.get("/stats")
async def get_member_stats(club_id: Optional[str] = Depends(get_club_id)):
    """Real-time member statistics computed from raw data."""
    query = {}
    if club_id:
        query["club_id"] = club_id
    query = exclude_archived(query)
    docs = await db.customer_members.find(query, {"_id": 0}).to_list(5000)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    thirty_days = (datetime.now(timezone.utc) + timedelta(days=30)).strftime("%Y-%m-%d")

    departed = [d for d in docs if d.get("exit_date") and d["exit_date"] not in [None, "", "None"] and d["exit_date"] < today]
    current = [d for d in docs if not d.get("exit_date") or d["exit_date"] in [None, "", "None"] or d["exit_date"] >= today]

    # Deduplicate: identify people with both coach + non-coach subscriptions
    name_coach_map = {}
    for d in current:
        name = d.get("name", "")
        is_coach = _is_coach(d.get("membership", ""))
        if name not in name_coach_map:
            name_coach_map[name] = {"coach": False, "noncoach": False, "ids": []}
        if is_coach:
            name_coach_map[name]["coach"] = True
        else:
            name_coach_map[name]["noncoach"] = True
        name_coach_map[name]["ids"].append(d.get("id"))

    # Build sets of IDs to skip (non-coach records of people who are also coaches, and duplicates)
    skip_ids = set()
    seen_memberships = {}
    for name, info in name_coach_map.items():
        if info["coach"] and info["noncoach"]:
            # Skip non-coach records for this person
            for d in current:
                if d.get("name") == name and not _is_coach(d.get("membership", "")):
                    skip_ids.add(d.get("id"))
    # Also skip exact duplicates (same name + same membership), but NOT DUO pairs
    seen = set()
    for d in current:
        key = (d.get("name", ""), d.get("membership", ""))
        if key in seen:
            # Don't skip DUO partners
            if not d.get("is_duo"):
                skip_ids.add(d.get("id"))
        seen.add(key)

    deduped = [d for d in current if d.get("id") not in skip_ids]

    coaches = [d for d in deduped if _is_coach(d.get("membership", ""))]
    non_coaches = [d for d in deduped if not _is_coach(d.get("membership", ""))]

    active_coaches = [d for d in coaches if not d.get("subscription_end_date") or d["subscription_end_date"] >= today]
    active_members = [d for d in non_coaches if not d.get("subscription_end_date") or d["subscription_end_date"] >= today]
    expired_members = [d for d in non_coaches if d.get("subscription_end_date") and d["subscription_end_date"] < today]
    expired_coaches = [d for d in coaches if d.get("subscription_end_date") and d["subscription_end_date"] < today]

    expiring = [d for d in deduped if d.get("subscription_end_date") and today <= d["subscription_end_date"] <= thirty_days]

    pif_active = [d for d in active_members if d.get("member_type") == "Membres PIF"]
    recurring_active = [d for d in active_members if d.get("member_type") == "Membres Généraux Récurrents"]

    return {
        "total": len(docs),
        "active_members": len(active_members),
        "active_coaches": len(active_coaches),
        "expired_members": len(expired_members),
        "expired_coaches": len(expired_coaches),
        "departed": len(departed),
        "expiring_30d": len(expiring),
        "pif_active": len(pif_active),
        "recurring_active": len(recurring_active),
        "total_coaches": len(coaches),
        "total_non_coaches": len(non_coaches),
    }


@router.get("/memberships")
async def get_unique_memberships(club_id: Optional[str] = Depends(get_club_id)):
    """Return all unique membership names from the members collection."""
    query = {}
    if club_id:
        query["club_id"] = club_id
    memberships = await db.customer_members.distinct("membership", query)
    return sorted(m for m in memberships if m)




@router.get("/expiring")
async def get_expiring_members(days: int = 30, club_id: Optional[str] = Depends(get_club_id)):
    today = datetime.now(timezone.utc).date()
    end_date = today + timedelta(days=days)
    
    query = {
        "subscription_end_date": {"$gte": today.isoformat(), "$lte": end_date.isoformat()},
        "$or": [{"exit_date": None}, {"exit_date": ""}, {"exit_date": {"$exists": False}}]
    }
    if club_id:
        query["club_id"] = club_id
    query = exclude_archived(query)
    docs = await db.customer_members.find(query, {"_id": 0}).to_list(500)
    for d in docs:
        sub_end = datetime.fromisoformat(d["subscription_end_date"]).date()
        d["days_remaining"] = (sub_end - today).days
    
    docs.sort(key=lambda x: x.get("days_remaining", 999))
    return docs


# ─── Sprint C : catégorisation membres ────────────────────────────────────────

async def _build_categorization_map(club_id: Optional[str]) -> tuple[list[dict], dict[str, str]]:
    """Helper interne : retourne (members_active, category_by_member_id).

    Charge tous les membres ACTIFS du club + le mapping membership_types puis
    applique `get_member_category` à chacun. Lecture seule, pas de side effect.
    """
    member_query = {"$or": [{"archived_at": None}, {"archived_at": {"$exists": False}}]}
    if club_id:
        member_query["club_id"] = club_id
    members = await db.customer_members.find(member_query, {"_id": 0}).to_list(length=None)

    types_query = {"club_id": club_id} if club_id else {}
    types_list = await db.membership_types.find(types_query, {"_id": 0}).to_list(length=None)
    types_by_name = {t.get("name"): t for t in types_list if t.get("name")}

    cat_by_id = {m["id"]: get_member_category(m, types_by_name) for m in members if m.get("id")}
    return members, cat_by_id


@router.get("/categories")
async def get_member_categories(club_id: Optional[str] = Depends(get_club_id)):
    """Sprint C — Mapping des catégories pour tous les membres ACTIFS du club.

    Retourne :
        {
          member_id: {
            category, duo_partner_id, duo_partner_name, is_primary_in_duo
          }
        }
    Lecture seule. Pas de modification base.
    """
    members, cat_by_id = await _build_categorization_map(club_id)
    by_id = {m["id"]: m for m in members if m.get("id")}

    result: dict[str, dict] = {}
    for m in members:
        mid = m.get("id")
        if not mid:
            continue
        partner_id = m.get("duo_partner_id")
        partner_name = ""
        if partner_id and partner_id in by_id:
            partner_name = by_id[partner_id].get("name") or ""
        elif partner_id:
            # partner archived/missing — fetch one-shot for label only
            partner = await db.customer_members.find_one(
                {"id": partner_id}, {"_id": 0, "name": 1}
            )
            partner_name = (partner or {}).get("name") or ""

        result[mid] = {
            "category": cat_by_id.get(mid, "Inconnu"),
            "duo_partner_id": partner_id or None,
            "duo_partner_name": partner_name or None,
            "is_primary_in_duo": bool(m.get("duo_primary")),
        }
    return result


@router.get("/categories/stats")
async def get_member_categories_stats(club_id: Optional[str] = Depends(get_club_id)):
    """Sprint C — Compteurs de membres actifs par catégorie pour le club.

    Pour la catégorie `Partenaire`, applique la déduplication par couple
    (1 entrée par couple, pas par membre). Lecture seule.
    """
    members, cat_by_id = await _build_categorization_map(club_id)

    by_cat: dict[str, list[dict]] = {c: [] for c in CATEGORIES}
    for m in members:
        cat = cat_by_id.get(m.get("id"), "Inconnu")
        by_cat[cat].append(m)

    # Dédupe Partenaire (1 par couple)
    by_cat["Partenaire"] = _dedupe_partenaire(by_cat["Partenaire"])

    stats = {cat: len(by_cat[cat]) for cat in CATEGORIES}
    stats["total"] = sum(stats.values())
    return stats


# ─── Sprint D.5 : Membres à risques (zéro séance sur N semaines) ──────────────

# Catégories ignorées dans le calcul à risque (selon spec Sprint D)
AT_RISK_EXCLUDED_CATEGORIES = {"OpenGym", "Inconnu", "Pret"}


def _is_on_pause(member: dict, today_iso: str) -> bool:
    """Sprint D.4 (future) — détecte si un membre est actuellement en pause.

    Compatibilité ascendante : si les champs `pause_start_date` / `pause_end_date`
    n'existent pas encore (avant rollout Phase 2), renvoie toujours False.
    """
    start = member.get("pause_start_date")
    end = member.get("pause_end_date")
    if not start:
        return False
    if start > today_iso:
        return False
    if end and today_iso > end:
        return False
    return True


def _isocalendar_weeks_back(today: "datetime.date", n: int) -> list[tuple[int, int]]:
    """Retourne la liste des (year, iso_week) des N dernières semaines, semaine
    courante incluse, ordre chronologique ASC (la plus ancienne d'abord).
    """
    weeks: list[tuple[int, int]] = []
    for offset in range(n - 1, -1, -1):
        d = today - timedelta(weeks=offset)
        y, w, _ = d.isocalendar()
        weeks.append((int(y), int(w)))
    return weeks


@router.get("/at-risk")
async def get_members_at_risk(
    weeks: int = 2,
    club_id: Optional[str] = Depends(get_club_id),
):
    """Sprint D.5 — Liste les membres actifs sans aucune séance sur les N
    dernières semaines (semaine courante incluse).

    Règles :
      - Membres actifs (non archivés).
      - Exclut les catégories `OpenGym`, `Inconnu`, `Pret`.
      - Exclut les membres en pause (`pause_start_date <= today <= pause_end_date`).
      - Période = N dernières semaines ISO (1..12). Défaut 2.
      - Total `trainings_count` sur la période == 0 → inclus.
      - Trié par `weeks_without_session` desc, puis `last_session_date` asc.

    Réponse : `{ period: {...}, total, members: [...] }`.
    """
    weeks = max(1, min(int(weeks or 2), 12))

    today = datetime.now(timezone.utc).date()
    today_iso = today.isoformat()
    period_weeks = _isocalendar_weeks_back(today, weeks)
    period_set = set(period_weeks)

    members, cat_by_id = await _build_categorization_map(club_id)

    # Pre-filter : exclu catégories et membres en pause
    candidates = []
    for m in members:
        mid = m.get("id")
        if not mid:
            continue
        cat = cat_by_id.get(mid, "Inconnu")
        if cat in AT_RISK_EXCLUDED_CATEGORIES:
            continue
        if _is_on_pause(m, today_iso):
            continue
        candidates.append(m)

    if not candidates:
        return {
            "period": {"weeks": weeks, "iso_weeks": [f"{y}-W{w:02d}" for y, w in period_weeks]},
            "total": 0,
            "members": [],
        }

    candidate_ids = [m["id"] for m in candidates]

    # Bulk fetch des trainings sur la période pour tous les candidats (1 requête)
    years_in_period = sorted({y for y, _ in period_weeks})
    weeks_in_period = sorted({w for _, w in period_weeks})
    trainings = await db.weekly_trainings.find(
        {
            "member_id": {"$in": candidate_ids},
            "calendar_year": {"$in": years_in_period},
            "calendar_week": {"$in": weeks_in_period},
        },
        {"_id": 0, "member_id": 1, "calendar_year": 1, "calendar_week": 1, "trainings_count": 1},
    ).to_list(length=None)

    # Trainings sur la période, indexés par membre
    period_count_by_member: dict[str, int] = {}
    period_weeks_with_session: dict[str, set[tuple[int, int]]] = {}
    for t in trainings:
        yw = (int(t.get("calendar_year") or 0), int(t.get("calendar_week") or 0))
        if yw not in period_set:
            continue
        if int(t.get("trainings_count") or 0) <= 0:
            continue
        mid = t.get("member_id")
        if not mid:
            continue
        period_count_by_member[mid] = period_count_by_member.get(mid, 0) + int(t["trainings_count"])
        period_weeks_with_session.setdefault(mid, set()).add(yw)

    # Filtrer : 0 séance sur la période
    at_risk_ids = [mid for mid in candidate_ids if period_count_by_member.get(mid, 0) == 0]

    if not at_risk_ids:
        return {
            "period": {"weeks": weeks, "iso_weeks": [f"{y}-W{w:02d}" for y, w in period_weeks]},
            "total": 0,
            "members": [],
        }

    # Pour chaque membre at-risk : trouver sa dernière séance (toutes années)
    last_sessions = await db.weekly_trainings.aggregate([
        {"$match": {"member_id": {"$in": at_risk_ids}, "trainings_count": {"$gt": 0}}},
        {"$sort": {"calendar_year": -1, "calendar_week": -1}},
        {"$group": {
            "_id": "$member_id",
            "year": {"$first": "$calendar_year"},
            "week": {"$first": "$calendar_week"},
        }},
    ]).to_list(length=None)
    last_by_member = {d["_id"]: (int(d["year"]), int(d["week"])) for d in last_sessions}

    def _weeks_without(member_id: str) -> int:
        last = last_by_member.get(member_id)
        if not last:
            return 999  # jamais aucune séance enregistrée
        ly, lw = last
        try:
            # ISO week → date (jour 1 = lundi de la semaine ISO)
            last_date = datetime.fromisocalendar(ly, lw, 1).date()
        except ValueError:
            return 999
        diff_days = (today - last_date).days
        return max(0, diff_days // 7)

    def _last_iso(member_id: str) -> Optional[str]:
        last = last_by_member.get(member_id)
        return f"{last[0]}-W{last[1]:02d}" if last else None

    members_by_id = {m["id"]: m for m in candidates}
    result_rows = []
    for mid in at_risk_ids:
        m = members_by_id[mid]
        cat = cat_by_id.get(mid, "Inconnu")
        wno = _weeks_without(mid)
        result_rows.append({
            "id": mid,
            "name": m.get("name") or "",
            "membership": m.get("membership") or "",
            "category": cat,
            "club_id": m.get("club_id"),
            "weeks_without_session": wno,
            "last_session_iso_week": _last_iso(mid),
            "subscription_end_date": m.get("subscription_end_date"),
        })

    # Tri : weeks_without_session desc, puis nom asc
    result_rows.sort(key=lambda r: (-r["weeks_without_session"], r["name"].lower()))

    return {
        "period": {
            "weeks": weeks,
            "iso_weeks": [f"{y}-W{w:02d}" for y, w in period_weeks],
        },
        "total": len(result_rows),
        "members": result_rows,
    }


@router.get("/{member_id}")
async def get_member(
    member_id: str,
    club_id: Optional[str] = Depends(get_club_id),
    current_user: dict = Depends(get_current_user),
):
    club_id_resolved = resolve_club_id_or_fallback(
        club_id=club_id,
        current_user=current_user,
        endpoint="/api/members/{id}",
    )
    doc = await db.customer_members.find_one({"id": member_id, "club_id": club_id_resolved}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Membre introuvable")
    # Enrich duo info
    if doc.get("duo_partner_id"):
        partner = await db.customer_members.find_one(
            {"id": doc["duo_partner_id"], "club_id": club_id_resolved}, {"_id": 0, "id": 1, "name": 1, "email": 1, "phone": 1}
        )
        if partner:
            doc["duo_partner_name"] = partner.get("name", "")

    # Sprint D Phase 2 — on_pause flag (computed)
    today_d = datetime.now(timezone.utc).date()
    today_iso_d = today_d.isoformat()
    doc["on_pause"] = _is_on_pause(doc, today_iso_d)

    # G4 — is_expired flag (read-only)
    end_date = doc.get("subscription_end_date")
    doc["is_expired"] = bool(
        end_date and end_date < today_iso_d and not doc.get("archived_at")
    )
    # Bulk renewal reminder fields (2026-05-16) — defaults sûrs
    doc.setdefault("last_renewal_reminder_at", None)
    doc.setdefault("renewal_reminder_count", 0)
    doc.setdefault("marketing_opt_out", False)

    # Sprint D Bonus — engagement_recent widget data (4 dernières semaines).
    # Volontairement nul si membre archivé.
    if doc.get("archived_at"):
        doc["engagement_recent"] = None
    else:
        # Catégorie pour distinguer "non tracé" (OpenGym/Inconnu/Pret)
        types_query = {"club_id": doc.get("club_id")} if doc.get("club_id") else {}
        types_list = await db.membership_types.find(types_query, {"_id": 0}).to_list(length=None)
        types_by_name = {t.get("name"): t for t in types_list if t.get("name")}
        category = get_member_category(doc, types_by_name)

        if category in {"OpenGym", "Inconnu", "Pret"}:
            doc["engagement_recent"] = {
                "status": "not_tracked",
                "category": category,
                "sessions_last_4_weeks": 0,
                "last_session_date": None,
                "last_session_iso_week": None,
            }
        else:
            # Bulk fetch trainings on last 4 ISO weeks
            period_weeks = _isocalendar_weeks_back(today_d, 4)
            years_in_period = sorted({y for y, _ in period_weeks})
            weeks_in_period = sorted({w for _, w in period_weeks})
            period_set = set(period_weeks)

            trainings = await db.weekly_trainings.find(
                {
                    "member_id": member_id,
                    "calendar_year": {"$in": years_in_period},
                    "calendar_week": {"$in": weeks_in_period},
                },
                {"_id": 0, "calendar_year": 1, "calendar_week": 1, "trainings_count": 1},
            ).to_list(length=None)

            sessions_count = 0
            for t in trainings:
                yw = (int(t.get("calendar_year") or 0), int(t.get("calendar_week") or 0))
                if yw in period_set:
                    sessions_count += int(t.get("trainings_count") or 0)

            # Dernière séance (toutes années)
            last_session_doc = await db.weekly_trainings.find(
                {"member_id": member_id, "trainings_count": {"$gt": 0}},
                {"_id": 0, "calendar_year": 1, "calendar_week": 1, "updated_at": 1},
            ).sort([("calendar_year", -1), ("calendar_week", -1)]).limit(1).to_list(1)

            last_iso_week = None
            last_session_date = None
            if last_session_doc:
                ly = int(last_session_doc[0].get("calendar_year") or 0)
                lw = int(last_session_doc[0].get("calendar_week") or 0)
                last_iso_week = f"{ly}-W{lw:02d}"
                try:
                    last_session_date = datetime.fromisocalendar(ly, lw, 1).date().isoformat()
                except ValueError:
                    last_session_date = None

            # Statut visuel (priorité : on_pause > sessions buckets)
            if doc.get("on_pause"):
                status = "on_pause"
            elif sessions_count >= 3:
                status = "engaged"
            elif sessions_count >= 1:
                status = "moderate"
            else:
                status = "at_risk"

            doc["engagement_recent"] = {
                "status": status,
                "category": category,
                "sessions_last_4_weeks": sessions_count,
                "last_session_date": last_session_date,
                "last_session_iso_week": last_iso_week,
                "period_weeks": [f"{y}-W{w:02d}" for y, w in period_weeks],
            }

    return doc


@router.put("/{member_id}/pause")
async def set_member_pause(
    member_id: str,
    payload: dict,
    club_id: Optional[str] = Depends(get_club_id),
    current_user: dict = Depends(get_current_user),
):
    """Sprint D Phase 2 — Mettre un membre en pause.

    Body: { start_date: 'YYYY-MM-DD' (requis), end_date: 'YYYY-MM-DD' (optionnel), reason: str (optionnel) }.
    Refuse si le membre est archivé.
    """
    club_id_resolved = resolve_club_id_or_fallback(
        club_id=club_id,
        current_user=current_user,
        endpoint="/api/members/{id}/pause",
    )
    doc = await db.customer_members.find_one(
        {"id": member_id, "club_id": club_id_resolved},
        {"_id": 0, "id": 1, "archived_at": 1},
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Membre introuvable")
    if doc.get("archived_at"):
        raise HTTPException(status_code=400, detail="Membre archivé — restaurer avant de mettre en pause")

    start = (payload or {}).get("start_date")
    end = (payload or {}).get("end_date")
    reason = (payload or {}).get("reason") or None

    if not start:
        raise HTTPException(status_code=400, detail="start_date requis")
    # Validation format
    try:
        datetime.fromisoformat(start).date()
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="start_date invalide (YYYY-MM-DD)")
    if end:
        try:
            datetime.fromisoformat(end).date()
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="end_date invalide (YYYY-MM-DD)")
        if end < start:
            raise HTTPException(status_code=400, detail="end_date doit être >= start_date")

    update_fields = {
        "pause_start_date": start,
        "pause_end_date": end,
        "pause_reason": reason,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.customer_members.update_one({"id": member_id, "club_id": club_id_resolved}, {"$set": update_fields})
    updated = await db.customer_members.find_one({"id": member_id}, {"_id": 0})
    today_iso_d = datetime.now(timezone.utc).date().isoformat()
    updated["on_pause"] = _is_on_pause(updated, today_iso_d)
    return updated


@router.delete("/{member_id}/pause")
async def remove_member_pause(
    member_id: str,
    club_id: Optional[str] = Depends(get_club_id),
    current_user: dict = Depends(get_current_user),
):
    """Sprint D Phase 2 — Annuler la pause d'un membre."""
    club_id_resolved = resolve_club_id_or_fallback(
        club_id=club_id,
        current_user=current_user,
        endpoint="/api/members/{id}/pause (DELETE)",
    )
    doc = await db.customer_members.find_one(
        {"id": member_id, "club_id": club_id_resolved},
        {"_id": 0, "id": 1},
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Membre introuvable")
    await db.customer_members.update_one(
        {"id": member_id, "club_id": club_id_resolved},
        {"$set": {
            "pause_start_date": None,
            "pause_end_date": None,
            "pause_reason": None,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    return {"message": "Pause annulée", "id": member_id}


@router.post("")
async def create_member(
    data: CustomerMemberCreate,
    club_id: Optional[str] = Depends(get_club_id),
    current_user: dict = Depends(get_current_user),
):
    if not club_id:
        raise HTTPException(status_code=400, detail="Club ID requis (header X-Club-Id manquant)")
    member_data = data.model_dump()
    
    # Add club_id to the member
    member_data["club_id"] = club_id
    
    # Auto-detect challenge membership type
    is_challenge = data.membership and "challenge" in data.membership.lower()
    
    # If challenge, override review settings
    if is_challenge:
        member_data["annual_review_enabled"] = True
        member_data["review_frequency"] = "challenge"
        if data.contract_signed_date:
            review_date = calc_review_date(data.contract_signed_date, "challenge")
            if review_date:
                member_data["annual_review_date"] = review_date
    elif data.annual_review_enabled and data.contract_signed_date:
        freq = getattr(data, 'review_frequency', 'annually')
        review_date = calc_review_date(data.contract_signed_date, freq)
        if review_date:
            member_data["annual_review_date"] = review_date
    
    member = CustomerMember(**member_data)
    doc = member.model_dump()
    doc["club_id"] = club_id  # défense en profondeur
    await db.customer_members.insert_one(doc)
    doc.pop('_id', None)
    
    # Create payment schedule if billing is enabled
    if data.billing_enabled and data.billing_amount > 0:
        schedule = PaymentSchedule(
            member_id=doc["id"],
            amount=data.billing_amount,
            recurrence_type=data.billing_cycle_type,
            recurrence_value=data.billing_cycle_value,
            start_date=data.contract_signed_date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            payment_method=data.billing_payment_method,
            is_active=True
        )
        schedule_doc = schedule.model_dump()
        if club_id:
            schedule_doc["club_id"] = club_id
        await db.payment_schedules.insert_one(schedule_doc)
    
    # Create review if enabled or if challenge (auto-enabled)
    if (data.annual_review_enabled or is_challenge) and doc.get("annual_review_date"):
        freq = "challenge" if is_challenge else getattr(data, 'review_frequency', 'annually')
        annual_review = AnnualReview(
            member_id=doc["id"],
            review_date=doc["annual_review_date"],
            review_type=freq,
            status="scheduled"
        )
        review_doc = annual_review.model_dump()
        if club_id:
            review_doc["club_id"] = club_id
        await db.annual_reviews.insert_one(review_doc)

    # Create duo partner if duo subscription
    if data.is_duo and data.duo_partner_name:
        partner = CustomerMember(
            name=data.duo_partner_name,
            email=data.duo_partner_email or "",
            phone=data.duo_partner_phone or "",
            membership=data.membership,
            member_type=data.member_type,
            contract_signed_date=data.contract_signed_date,
            subscription_end_date=data.subscription_end_date,
            cash_collected=0,
            is_duo=True,
            duo_partner_id=doc["id"],
            duo_primary=False,
            notes=f"Partenaire duo de {data.name}",
        )
        partner_doc = partner.model_dump()
        if club_id:
            partner_doc["club_id"] = club_id
        await db.customer_members.insert_one(partner_doc)
        partner_doc.pop("_id", None)

        # Link primary to partner
        await db.customer_members.update_one(
            {"id": doc["id"]},
            {"$set": {"is_duo": True, "duo_partner_id": partner_doc["id"], "duo_primary": True}}
        )
        doc["is_duo"] = True
        doc["duo_partner_id"] = partner_doc["id"]
        doc["duo_primary"] = True

    # Auto-add to active challenge if membership is a challenge type
    if doc.get("membership") and "challenge" in doc["membership"].lower():
        active_challenge = await db.six_weeks_challenges.find_one({"is_active": True}, {"_id": 0})
        if active_challenge:
            # Check not already participant
            existing_p = await db.challenge_participants.find_one({
                "challenge_id": active_challenge["id"], "member_id": doc["id"]
            })
            if not existing_p:
                participant = ChallengeParticipant(
                    challenge_id=active_challenge["id"],
                    member_id=doc["id"],
                    member_name=doc["name"]
                )
                p_doc = participant.model_dump()
                await db.challenge_participants.insert_one(p_doc)

    # Create accounting transaction for the initial payment
    if data.cash_collected and data.cash_collected > 0:
        rev_cat = await db.accounting_categories.find_one({"type": "revenue", "kpi_column": "revenue_members"})
        cat_name = rev_cat["name"] if rev_cat else "ABONNEMENTS"
        tx_doc = {
            "id": f"member-{doc['id']}-initial",
            "date": data.contract_signed_date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "description": f"Vente {data.membership} - {data.name}",
            "amount": data.cash_collected,
            "type": "revenue",
            "category": cat_name,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        if club_id:
            tx_doc["club_id"] = club_id
        existing_tx = await db.accounting_transactions.find_one({"id": tx_doc["id"]})
        if not existing_tx:
            await db.accounting_transactions.insert_one(tx_doc)
            tx_doc.pop("_id", None)
        # Auto-recalculate KPIs
        from routers.transactions import _auto_recalculate_kpis
        await _auto_recalculate_kpis(tx_doc["date"])

    # Log creation
    await log_activity(
        db,
        action="member_created",
        description=f"Membre créé : {doc.get('name')}",
        member_id=doc["id"],
        current_user=current_user,
        explicit_club_id=club_id,
    )

    return doc


@router.put("/{member_id}")
async def update_member(
    member_id: str,
    data: CustomerMemberCreate,
    club_id: Optional[str] = Depends(get_club_id),
    current_user: dict = Depends(get_current_user),
):
    # Sprint C.2.C — A.2 strict : header (puis fallback resolver) seul, JAMAIS doc.club_id.
    club_id_resolved = resolve_club_id_or_fallback(
        club_id=club_id,
        current_user=current_user,
        endpoint="/api/members/{id} (PUT)",
    )
    existing = await db.customer_members.find_one({"id": member_id, "club_id": club_id_resolved})
    if not existing:
        raise HTTPException(status_code=404, detail="Membre introuvable")

    update_data = data.model_dump()
    update_data.pop("club_id", None)  # Ne jamais écraser club_id via PUT

    # Update review date if enabled and changed
    if data.annual_review_enabled and data.contract_signed_date:
        freq = getattr(data, 'review_frequency', 'annually')
        review_date = calc_review_date(data.contract_signed_date, freq)
        if review_date:
            update_data["annual_review_date"] = review_date
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.customer_members.update_one({"id": member_id, "club_id": club_id_resolved}, {"$set": update_data})

    # Auto-cancel pending/late payments when member is marked as departed
    new_exit = update_data.get("exit_date")
    old_exit = existing.get("exit_date")
    if new_exit and new_exit != old_exit:
        cancelled = await db.payments.update_many(
            {"member_id": member_id, "club_id": club_id_resolved, "status": {"$in": ["pending", "late"]}},
            {"$set": {"status": "cancelled", "notes": "Membre parti", "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        if cancelled.modified_count > 0:
            await log_activity(
                db,
                action="payments_cancelled_on_departure",
                description=f"{cancelled.modified_count} paiement(s) annulé(s) suite au départ du membre.",
                member_id=member_id,
                current_user=current_user,
                user_name="Système",
            )

    # Sync bilans when review_frequency changes
    old_freq = existing.get("review_frequency", "monthly")
    new_freq = update_data.get("review_frequency", old_freq)
    if new_freq != old_freq:
        # Delete all scheduled reviews for this member
        deleted = await db.annual_reviews.delete_many({
            "member_id": member_id,
            "club_id": club_id_resolved,
            "status": "scheduled",
        })
        # Create a new scheduled review with the correct frequency
        delta = FREQUENCY_DELTA.get(new_freq, relativedelta(months=1))
        # Base: last completed review, or contract_signed_date
        last_completed = await db.annual_reviews.find_one(
            {"member_id": member_id, "club_id": club_id_resolved, "status": "completed"},
            {"_id": 0, "review_date": 1},
            sort=[("review_date", -1)]
        )
        if last_completed:
            base_date = datetime.strptime(last_completed["review_date"], "%Y-%m-%d")
        elif update_data.get("contract_signed_date"):
            base_date = datetime.strptime(update_data["contract_signed_date"], "%Y-%m-%d")
        else:
            base_date = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        next_date = base_date + delta
        today_dt = datetime.now(timezone.utc).replace(tzinfo=None)
        # Advance to current or next period
        while next_date + delta <= today_dt:
            next_date = next_date + delta
        new_review = AnnualReview(
            member_id=member_id,
            review_date=next_date.strftime("%Y-%m-%d"),
            review_type=new_freq,
            status="scheduled",
        )
        new_review_doc = new_review.model_dump()
        new_review_doc["club_id"] = club_id_resolved
        await db.annual_reviews.insert_one(new_review_doc)
        update_data["annual_review_date"] = next_date.strftime("%Y-%m-%d")
        await db.customer_members.update_one(
            {"id": member_id, "club_id": club_id_resolved},
            {"$set": {"annual_review_date": next_date.strftime("%Y-%m-%d")}}
        )
        # Log activity
        await log_activity(
            db,
            action="review_frequency_changed",
            description=f"Fréquence bilan changée: {old_freq} → {new_freq}. {deleted.deleted_count} bilan(s) planifié(s) supprimé(s), nouveau bilan {new_freq} créé le {next_date.strftime('%Y-%m-%d')}.",
            member_id=member_id,
            current_user=current_user,
        )

    # If DUO primary, propagate key changes to partner
    if existing.get("duo_primary") and existing.get("duo_partner_id"):
        partner_update = {}
        propagate_fields = ["membership", "member_type", "subscription_end_date", "contract_signed_date"]
        for field in propagate_fields:
            new_val = update_data.get(field)
            if new_val is not None and new_val != existing.get(field):
                partner_update[field] = new_val
        # Propagate billing changes too
        billing_fields = ["billing_enabled", "billing_amount", "billing_day",
                          "billing_cycle_type", "billing_cycle_value", "billing_payment_method"]
        for field in billing_fields:
            new_val = update_data.get(field)
            if new_val is not None and new_val != existing.get(field):
                partner_update[field] = new_val
        if partner_update:
            partner_update["updated_at"] = datetime.now(timezone.utc).isoformat()
            await db.customer_members.update_one(
                {"id": existing["duo_partner_id"], "club_id": club_id_resolved}, {"$set": partner_update}
            )
    
    # Update payment schedule if billing changed
    existing_schedule = await db.payment_schedules.find_one({"member_id": member_id, "club_id": club_id_resolved, "is_active": True})
    
    # Sync billing_amount to existing pending/late payments
    new_amount = update_data.get("billing_amount")
    old_amount = existing.get("billing_amount")
    if new_amount is not None and new_amount != old_amount and new_amount > 0:
        await db.payments.update_many(
            {"member_id": member_id, "club_id": club_id_resolved, "status": {"$in": ["pending", "late"]}},
            {"$set": {"amount": new_amount, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )

    # Auto-recalculate pending/late payment dates when billing root changes
    billing_root_fields = ["contract_signed_date", "billing_cycle_type", "billing_cycle_value"]
    billing_root_changed = any(
        update_data.get(f) is not None and update_data.get(f) != existing.get(f)
        for f in billing_root_fields
    )
    if billing_root_changed:
        new_contract = update_data.get("contract_signed_date") or existing.get("contract_signed_date")
        new_cycle_type = update_data.get("billing_cycle_type") or existing.get("billing_cycle_type", "monthly_day")
        new_cycle_value = int(update_data.get("billing_cycle_value") or existing.get("billing_cycle_value") or 1)
        
        if new_contract and new_cycle_type == "interval_days" and new_cycle_value > 0:
            from calendar import monthrange
            now = datetime.now(timezone.utc)
            month_str = now.strftime("%Y-%m")
            year, month_num = now.year, now.month
            days_in_m = monthrange(year, month_num)[1]
            month_start = datetime(year, month_num, 1)
            month_end = datetime(year, month_num, days_in_m, 23, 59, 59)
            
            try:
                start_dt = datetime.strptime(new_contract[:10], "%Y-%m-%d")
                days_since = (month_start - start_dt).days
                if days_since < 0:
                    due_dt = start_dt
                else:
                    cycles = days_since // new_cycle_value
                    due_dt = start_dt + timedelta(days=cycles * new_cycle_value)
                    if due_dt < month_start:
                        due_dt += timedelta(days=new_cycle_value)
                if month_start <= due_dt <= month_end:
                    new_due = due_dt.strftime("%Y-%m-%d")
                    await db.payments.update_many(
                        {"member_id": member_id, "club_id": club_id_resolved, "due_date": {"$regex": f"^{month_str}"}, "status": {"$in": ["pending", "late"]}},
                        {"$set": {"due_date": new_due, "updated_at": now.isoformat()}}
                    )
            except (ValueError, TypeError):
                pass

    if data.billing_enabled and data.billing_amount > 0:
        schedule_update = {
            "amount": data.billing_amount,
            "recurrence_type": data.billing_cycle_type,
            "recurrence_value": data.billing_cycle_value,
            "payment_method": data.billing_payment_method,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        if existing_schedule:
            await db.payment_schedules.update_one({"id": existing_schedule["id"], "club_id": club_id_resolved}, {"$set": schedule_update})
        else:
            schedule = PaymentSchedule(
                member_id=member_id,
                amount=data.billing_amount,
                recurrence_type=data.billing_cycle_type,
                recurrence_value=data.billing_cycle_value,
                start_date=data.contract_signed_date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                payment_method=data.billing_payment_method,
                is_active=True
            )
            schedule_doc = schedule.model_dump()
            schedule_doc["club_id"] = club_id_resolved
            await db.payment_schedules.insert_one(schedule_doc)
    elif existing_schedule and not data.billing_enabled:
        await db.payment_schedules.update_one({"id": existing_schedule["id"], "club_id": club_id_resolved}, {"$set": {"is_active": False}})
    
    # Auto-generate payment for current month if billing enabled, amount > 0, and no payment exists
    if data.billing_enabled and data.billing_amount > 0:
        from calendar import monthrange
        now = datetime.now(timezone.utc)
        month_str = now.strftime("%Y-%m")
        today_str = now.strftime("%Y-%m-%d")
        year, month_num = now.year, now.month
        days_in_m = monthrange(year, month_num)[1]
        month_start = datetime(year, month_num, 1)
        month_end = datetime(year, month_num, days_in_m, 23, 59, 59)
        
        # Check if member is DUO secondary (no "&" in name) → skip payment generation
        is_duo_secondary = existing.get("duo_partner_id") and "&" not in (existing.get("name") or "")
        
        existing_payment = await db.payments.find_one({
            "member_id": member_id,
            "club_id": club_id_resolved,
            "due_date": {"$regex": f"^{month_str}"}
        })
        
        if not existing_payment and not is_duo_secondary:
            cycle_type = data.billing_cycle_type or existing.get("billing_cycle_type", "monthly_day")
            cycle_value = int(data.billing_cycle_value or existing.get("billing_cycle_value") or 1)
            contract = data.contract_signed_date or existing.get("contract_signed_date", "")
            
            due_date = None
            if cycle_type == "interval_days" and cycle_value > 0 and contract:
                try:
                    start_dt = datetime.strptime(contract[:10], "%Y-%m-%d")
                    days_since = (month_start - start_dt).days
                    if days_since < 0:
                        due_dt = start_dt
                    else:
                        cycles_passed = days_since // cycle_value
                        due_dt = start_dt + timedelta(days=cycles_passed * cycle_value)
                        if due_dt < month_start:
                            due_dt += timedelta(days=cycle_value)
                    if month_start <= due_dt <= month_end:
                        due_date = due_dt.strftime("%Y-%m-%d")
                except (ValueError, TypeError):
                    pass
            
            if not due_date:
                day = min(cycle_value, days_in_m)
                due_date = f"{month_str}-{day:02d}"
            
            payment = {
                "id": str(uuid4()),
                "member_id": member_id,
                "schedule_id": member_id,
                "member_name": existing.get("name", ""),
                "member_email": existing.get("email", ""),
                "member_phone": existing.get("phone", ""),
                "amount": data.billing_amount,
                "due_date": due_date,
                "status": "late" if due_date < today_str else "pending",
                "payment_method": data.billing_payment_method or existing.get("billing_payment_method", "prelevement"),
                "created_at": now.isoformat(),
                "updated_at": now.isoformat(),
            }
            payment["club_id"] = club_id_resolved
            await db.payments.insert_one(payment)
    
    # Log modification
    await log_activity(
        db,
        action="member_updated",
        description=f"Fiche membre modifiée : {data.name}",
        member_id=member_id,
        current_user=current_user,
        explicit_club_id=club_id_resolved,
    )

    return await db.customer_members.find_one({"id": member_id, "club_id": club_id_resolved}, {"_id": 0})



@router.post("/{member_id}/dissociate-duo")
async def dissociate_duo(
    member_id: str,
    club_id: Optional[str] = Depends(get_club_id),
    current_user: dict = Depends(get_current_user),
):
    """Dissociate a DUO pair into two individual subscriptions."""
    club_id_resolved = resolve_club_id_or_fallback(
        club_id=club_id,
        current_user=current_user,
        endpoint="/api/members/{id}/dissociate-duo",
    )
    member = await db.customer_members.find_one({"id": member_id, "club_id": club_id_resolved})
    if not member:
        raise HTTPException(status_code=404, detail="Membre introuvable")

    if not member.get("is_duo"):
        raise HTTPException(status_code=400, detail="Ce membre n'est pas un DUO")

    partner_id = member.get("duo_partner_id")
    now = datetime.now(timezone.utc).isoformat()

    # Remove DUO flags from this member
    duo_clear = {
        "is_duo": False,
        "duo_partner_id": None,
        "duo_primary": False,
        "updated_at": now,
    }
    await db.customer_members.update_one({"id": member_id, "club_id": club_id_resolved}, {"$set": duo_clear})

    # Remove DUO flags from partner
    if partner_id:
        await db.customer_members.update_one({"id": partner_id, "club_id": club_id_resolved}, {"$set": duo_clear})
        # Also clear reverse link if partner points back
        await db.customer_members.update_many(
            {"duo_partner_id": member_id, "club_id": club_id_resolved}, {"$set": duo_clear}
        )

    return {
        "message": "DUO dissocié. Les deux membres ont maintenant des abonnements individuels.",
        "member_id": member_id,
        "partner_id": partner_id,
    }


@router.delete("/{member_id}")
async def delete_member(
    member_id: str,
    club_id: Optional[str] = Depends(get_club_id),
    current_user: dict = Depends(get_current_user),
):
    """B.5 — Redirect hard delete to soft delete. Member is archived instead of deleted."""
    import logging
    logger = logging.getLogger(__name__)
    club_id_resolved = resolve_club_id_or_fallback(
        club_id=club_id,
        current_user=current_user,
        endpoint="/api/members/{id} (DELETE)",
    )
    doc = await db.customer_members.find_one({"id": member_id, "club_id": club_id_resolved})
    if not doc:
        raise HTTPException(status_code=404, detail="Membre introuvable")
    if doc.get("archived_at"):
        logger.info(f"[SoftDelete] DELETE /members/{member_id} — already archived, no-op")
        return {"message": "Soft delete applied (already archived)", "soft_delete": True}
    now = datetime.now(timezone.utc).isoformat()
    await db.customer_members.update_one({"id": member_id, "club_id": club_id_resolved}, {"$set": {"archived_at": now, "updated_at": now}})
    logger.info(f"[SoftDelete] DELETE /members/{member_id} redirected to archive — name={doc.get('name')}")
    return {"message": "Soft delete applied", "soft_delete": True, "archived_at": now}


# ── Soft delete (archive / restore) ──────────────────────────────────────────

@router.post("/{member_id}/archive")
async def archive_member(
    member_id: str,
    body: Optional[dict] = None,
    club_id: Optional[str] = Depends(get_club_id),
    current_user: dict = Depends(get_current_user),
):
    club_id_resolved = resolve_club_id_or_fallback(
        club_id=club_id,
        current_user=current_user,
        endpoint="/api/members/{id}/archive",
    )
    doc = await db.customer_members.find_one({"id": member_id, "club_id": club_id_resolved})
    if not doc:
        raise HTTPException(status_code=404, detail="Membre introuvable")
    if doc.get("archived_at"):
        raise HTTPException(status_code=400, detail="Membre déjà archivé")
    now = datetime.now(timezone.utc).isoformat()
    reason = (body or {}).get("reason") if isinstance(body, dict) else None
    update = {"archived_at": now, "updated_at": now}
    if reason:
        update["archived_reason"] = reason
    await db.customer_members.update_one({"id": member_id, "club_id": club_id_resolved}, {"$set": update})
    await log_activity(
        db,
        action="member_archived",
        description=f"Membre archivé{' — Raison : ' + reason if reason else ''}.",
        member_id=member_id,
        current_user=current_user,
    )
    updated = await db.customer_members.find_one({"id": member_id}, {"_id": 0})
    return updated


@router.post("/{member_id}/restore")
async def restore_member(
    member_id: str,
    club_id: Optional[str] = Depends(get_club_id),
    current_user: dict = Depends(get_current_user),
):
    club_id_resolved = resolve_club_id_or_fallback(
        club_id=club_id,
        current_user=current_user,
        endpoint="/api/members/{id}/restore",
    )
    doc = await db.customer_members.find_one({"id": member_id, "club_id": club_id_resolved})
    if not doc:
        raise HTTPException(status_code=404, detail="Membre introuvable")
    if not doc.get("archived_at"):
        raise HTTPException(status_code=400, detail="Membre déjà actif (non archivé)")
    now = datetime.now(timezone.utc).isoformat()
    await db.customer_members.update_one(
        {"id": member_id, "club_id": club_id_resolved},
        {"$set": {"archived_at": None, "updated_at": now}, "$unset": {"archived_reason": ""}}
    )
    await log_activity(
        db,
        action="member_restored",
        description="Membre restauré (sorti des archives).",
        member_id=member_id,
        current_user=current_user,
    )
    updated = await db.customer_members.find_one({"id": member_id}, {"_id": 0})
    return updated


@router.post("/{member_id}/renew")
async def renew_membership(
    member_id: str,
    body: dict,
    club_id: Optional[str] = Depends(get_club_id),
    current_user: dict = Depends(get_current_user),
):
    member = await db.customer_members.find_one({"id": member_id})
    if not member:
        raise HTTPException(status_code=404, detail="Membre introuvable")

    # Cascade : header > member.club_id > user > Versoix
    club_id_resolved = resolve_club_id_or_fallback(
        club_id=club_id or member.get("club_id"),
        current_user=current_user,
        endpoint="/api/members/{id}/renew",
    )

    new_end_date = body.get("new_end_date")
    renewal_duration = body.get("renewal_duration", "12 mois")
    is_no_commitment = renewal_duration == "Sans engagement"

    if not new_end_date and not is_no_commitment:
        raise HTTPException(status_code=400, detail="new_end_date requis")

    renewal = MemberRenewalHistory(
        member_id=member_id,
        previous_end_date=member.get("subscription_end_date"),
        new_end_date=new_end_date if new_end_date else "Sans engagement",
        renewal_duration=renewal_duration,
        notes=body.get("notes", "")
    )
    renewal_doc = renewal.model_dump()
    renewal_doc["club_id"] = club_id_resolved
    await db.member_renewals.insert_one(renewal_doc)
    
    member_update = {
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    if is_no_commitment:
        member_update["subscription_end_date"] = None
    else:
        member_update["subscription_end_date"] = new_end_date
    
    # Update membership type if changing
    if "new_membership" in body:
        member_update["membership"] = body["new_membership"]
    if "new_member_type" in body:
        member_update["member_type"] = body["new_member_type"]
    
    # Auto-add to challenge if new membership is challenge type
    new_membership = body.get("new_membership", member.get("membership", ""))
    if new_membership and "challenge" in new_membership.lower():
        active_challenge = await db.six_weeks_challenges.find_one({"is_active": True}, {"_id": 0})
        if active_challenge:
            existing_p = await db.challenge_participants.find_one({
                "challenge_id": active_challenge["id"], "member_id": member_id
            })
            if not existing_p:
                participant = ChallengeParticipant(
                    challenge_id=active_challenge["id"],
                    member_id=member_id,
                    member_name=member.get("name", "")
                )
                participant_doc = participant.model_dump()
                participant_doc["club_id"] = club_id_resolved
                await db.challenge_participants.insert_one(participant_doc)
    
    # Update billing cycle if provided
    if "billing_cycle_type" in body:
        member_update["billing_cycle_type"] = body["billing_cycle_type"]
    if "billing_cycle_value" in body:
        member_update["billing_cycle_value"] = body["billing_cycle_value"]
    if "billing_amount" in body:
        member_update["billing_amount"] = body["billing_amount"]
    if "billing_payment_method" in body:
        member_update["billing_payment_method"] = body["billing_payment_method"]
    
    # Schedule next review based on frequency
    if member.get("annual_review_enabled"):
        freq = member.get("review_frequency", "annually")
        delta = FREQUENCY_DELTA.get(freq, relativedelta(years=1))
        try:
            end_date = datetime.fromisoformat(new_end_date)
            review_date = (end_date + delta).strftime("%Y-%m-%d")
            member_update["annual_review_date"] = review_date
            annual_review = AnnualReview(
                member_id=member_id,
                review_date=review_date,
                review_type=freq,
                status="scheduled"
            )
            ar_doc = annual_review.model_dump()
            ar_doc["club_id"] = club_id_resolved
            await db.annual_reviews.insert_one(ar_doc)
        except Exception:
            pass
    
    await db.customer_members.update_one({"id": member_id, "club_id": club_id_resolved}, {"$set": member_update})
    
    # Update payment schedule if billing cycle changed
    if any(k in body for k in ["billing_cycle_type", "billing_cycle_value", "billing_amount", "billing_payment_method"]):
        existing_schedule = await db.payment_schedules.find_one({"member_id": member_id, "is_active": True})
        if existing_schedule:
            schedule_update = {"updated_at": datetime.now(timezone.utc).isoformat()}
            if "billing_cycle_type" in body:
                schedule_update["recurrence_type"] = body["billing_cycle_type"]
            if "billing_cycle_value" in body:
                schedule_update["recurrence_value"] = body["billing_cycle_value"]
            if "billing_amount" in body:
                schedule_update["amount"] = body["billing_amount"]
            if "billing_payment_method" in body:
                schedule_update["payment_method"] = body["billing_payment_method"]
            await db.payment_schedules.update_one({"id": existing_schedule["id"]}, {"$set": schedule_update})
        # Also sync amount to existing pending/late payments on renewal
        if "billing_amount" in body and body["billing_amount"] > 0:
            await db.payments.update_many(
                {"member_id": member_id, "club_id": club_id_resolved, "status": {"$in": ["pending", "late"]}},
                {"$set": {"amount": body["billing_amount"], "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
    
    doc = await db.customer_members.find_one({"id": member_id}, {"_id": 0})
    return {"member": doc, "message": "Abonnement renouvelé"}


@router.get("/{member_id}/renewals")
async def get_member_renewals(
    member_id: str,
    club_id: Optional[str] = Depends(get_club_id),
    current_user: dict = Depends(get_current_user),
):
    club_id_resolved = resolve_club_id_or_fallback(
        club_id=club_id,
        current_user=current_user,
        endpoint="/api/members/{id}/renewals",
    )
    return await db.member_renewals.find({"member_id": member_id, "club_id": club_id_resolved}, {"_id": 0}).sort("created_at", -1).to_list(100)


@router.put("/{member_id}/onboarding")
async def update_member_onboarding(
    member_id: str,
    body: dict,
    club_id: Optional[str] = Depends(get_club_id),
    current_user: dict = Depends(get_current_user),
):
    """Update onboarding steps for a member.

    Tracks who completed the onboarding and when (audit fields).
    """
    existing = await db.customer_members.find_one({"id": member_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Membre introuvable")
    club_id_resolved = resolve_club_id_or_fallback(
        club_id=club_id,
        current_user=current_user,
        endpoint="/api/members/{id}/onboarding",
    )

    update = {}
    onboarding_fields = [
        "onboarding_bsport", "onboarding_hubfit", "onboarding_nutrition",
        "questionnaire_coaching", "session_introduction"
    ]

    for field in onboarding_fields:
        if field in body:
            update[field] = body[field]

    all_steps = [update.get(f, existing.get(f, False)) for f in onboarding_fields]
    was_completed = existing.get("onboarding_completed", False) is True
    is_completed = all(all_steps)
    now_iso = datetime.now(timezone.utc).isoformat()

    if is_completed:
        update["onboarding_completed"] = True
        update["onboarding_completed_date"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        # Audit fields: only stamp on the transition (idempotent re-saves keep original author/date)
        if not was_completed or not existing.get("onboarding_completed_at"):
            update["onboarding_completed_at"] = now_iso
            update["onboarding_completed_by"] = current_user.get("id")
            # Display name: derive from email local part if no explicit name on user model.
            email = current_user.get("email") or ""
            display = current_user.get("name") or email.split("@")[0] or "Utilisateur"
            update["onboarding_completed_by_name"] = display
            update["onboarding_completed_by_email"] = email or None
    else:
        update["onboarding_completed"] = False
        update["onboarding_completed_date"] = None
        # On regression to incomplete, clear audit fields
        update["onboarding_completed_at"] = None
        update["onboarding_completed_by"] = None
        update["onboarding_completed_by_name"] = None
        update["onboarding_completed_by_email"] = None

    update["updated_at"] = now_iso
    await db.customer_members.update_one({"id": member_id, "club_id": club_id_resolved}, {"$set": update})
    return await db.customer_members.find_one({"id": member_id}, {"_id": 0})


@router.get("/{member_id}/annual-reviews")
async def get_member_annual_reviews(
    member_id: str,
    club_id: Optional[str] = Depends(get_club_id),
    current_user: dict = Depends(get_current_user),
):
    """Get all annual reviews for a specific member"""
    club_id_resolved = resolve_club_id_or_fallback(
        club_id=club_id,
        current_user=current_user,
        endpoint="/api/members/{id}/annual-reviews",
    )
    return await db.annual_reviews.find({"member_id": member_id, "club_id": club_id_resolved}, {"_id": 0}).sort("review_date", -1).to_list(50)



@router.get("/{member_id}/activity-log")
async def get_member_activity_log(
    member_id: str,
    club_id: Optional[str] = Depends(get_club_id),
    current_user: dict = Depends(get_current_user),
):
    """Get full activity log for a member"""
    club_id_resolved = resolve_club_id_or_fallback(
        club_id=club_id,
        current_user=current_user,
        endpoint="/api/members/{id}/activity-log",
    )
    return await db.activity_logs.find(
        {"member_id": member_id, "club_id": club_id_resolved}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)



# ── Bulk renewal reminder (2026-05-15) ────────────────────────────────────────

@router.post("/bulk-renewal-reminder")
async def bulk_renewal_reminder(
    payload: dict,
    current_user: dict = Depends(get_current_user),
    club_id: Optional[str] = Depends(get_club_id),
):
    """Envoie une relance de renouvellement à un batch de membres expirés.

    Body : { "member_ids": [str, ...] } — cap 50.
    Filtres serveur (défense en profondeur) :
      - membre existe et club_id correspond (sécurité multi-tenant)
      - is_expired calculé : subscription_end_date < today AND not archived
      - cooldown 7j : last_renewal_reminder_at + 7j > now → skip
      - marketing_opt_out true → skip
      - email manquant → skip
    Retourne breakdown { sent, skipped_cooldown, skipped_opt_out,
                          skipped_not_expired, skipped_no_email, failed,
                          details: [{member_id, name, status, reason?}] }.
    """
    import logging
    from core.config import RENEWAL_REMINDER_COOLDOWN_DAYS

    logger = logging.getLogger(__name__)

    member_ids = payload.get("member_ids") or []
    if not isinstance(member_ids, list) or not member_ids:
        raise HTTPException(status_code=400, detail="member_ids requis (liste non vide)")
    if len(member_ids) > 50:
        raise HTTPException(status_code=400, detail="Cap dépassé : maximum 50 membres par batch")

    resolved_club_id = resolve_club_id_or_fallback(
        club_id=club_id,
        current_user=current_user,
        endpoint="/api/members/bulk-renewal-reminder",
    )

    today_iso_d = datetime.now(timezone.utc).date().isoformat()
    now_dt = datetime.now(timezone.utc)
    cooldown_threshold = now_dt - timedelta(days=RENEWAL_REMINDER_COOLDOWN_DAYS)

    breakdown = {
        "sent": 0,
        "skipped_cooldown": 0,
        "skipped_opt_out": 0,
        "skipped_not_expired": 0,
        "skipped_no_email": 0,
        "failed": 0,
        "details": [],
    }

    # Fetch tous les membres ciblés en 1 query
    docs = await db.customer_members.find(
        {"id": {"$in": member_ids}, "club_id": resolved_club_id},
        {"_id": 0},
    ).to_list(length=None)
    by_id = {d["id"]: d for d in docs if d.get("id")}

    # Resolve club_name once (best-effort) — Option C : cascade public_name → name → fallback
    from core.club_branding import get_club_public_name
    club_name = await get_club_public_name(db, resolved_club_id)

    for mid in member_ids:
        m = by_id.get(mid)
        if not m:
            breakdown["failed"] += 1
            breakdown["details"].append({
                "member_id": mid, "name": None, "status": "failed",
                "reason": "not_found_or_wrong_club",
            })
            continue

        name = m.get("name") or ""
        end_date = m.get("subscription_end_date")
        archived = bool(m.get("archived_at"))
        is_expired = bool(end_date and end_date < today_iso_d and not archived)
        if not is_expired:
            breakdown["skipped_not_expired"] += 1
            breakdown["details"].append({
                "member_id": mid, "name": name, "status": "skipped",
                "reason": "not_expired",
            })
            continue

        if m.get("marketing_opt_out"):
            breakdown["skipped_opt_out"] += 1
            breakdown["details"].append({
                "member_id": mid, "name": name, "status": "skipped",
                "reason": "opt_out",
            })
            continue

        last_iso = m.get("last_renewal_reminder_at")
        if last_iso:
            try:
                last_dt = datetime.fromisoformat(last_iso.replace("Z", "+00:00"))
                if last_dt.tzinfo is None:
                    last_dt = last_dt.replace(tzinfo=timezone.utc)
                if last_dt > cooldown_threshold:
                    breakdown["skipped_cooldown"] += 1
                    breakdown["details"].append({
                        "member_id": mid, "name": name, "status": "skipped",
                        "reason": "cooldown_7d",
                    })
                    continue
            except (ValueError, TypeError):
                pass

        email = (m.get("email") or "").strip()
        if not email:
            breakdown["skipped_no_email"] += 1
            breakdown["details"].append({
                "member_id": mid, "name": name, "status": "skipped",
                "reason": "no_email",
            })
            continue

        try:
            # Cutover 2026-05-18 — Render via DB template (cascade club > global)
            # avec fallback automatique V3 si template absent / render fail.
            first = _first_name(name)
            whatsapp_url = build_whatsapp_url(first)
            unsubscribe_url = build_unsubscribe_url(mid)
            render_ctx = {
                "first": first or "",
                "club_name": club_name or "HYBRID GYM",
                "whatsapp_url": whatsapp_url,
                "unsubscribe_url": unsubscribe_url,
            }
            rendered = await render_with_fallback(
                db,
                template_key="renewal_reminder",
                club_id=resolved_club_id,
                context=render_ctx,
                fallback_fn=_renewal_reminder_fallback_v3,
            )
            sent_result = await send_resend_email(
                to_email=email,
                subject=rendered.subject,
                html=rendered.html,
            )
            # Update mutations Atlas seulement après succès Resend
            now_iso = datetime.now(timezone.utc).isoformat()
            await db.customer_members.update_one(
                {"id": mid},
                {
                    "$set": {"last_renewal_reminder_at": now_iso, "updated_at": now_iso},
                    "$inc": {"renewal_reminder_count": 1},
                },
            )
            breakdown["sent"] += 1
            breakdown["details"].append({
                "member_id": mid, "name": name, "status": "sent",
                "resend_id": sent_result.get("resend_id"),
                "used_fallback": rendered.used_fallback,
                "template_id": rendered.template_id,
            })
        except Exception as e:
            breakdown["failed"] += 1
            breakdown["details"].append({
                "member_id": mid, "name": name, "status": "failed",
                "reason": str(e)[:200],
            })
            logger.error(f"BULK_RENEWAL_REMINDER_FAIL member={mid} error={e}")

    # 1 log d'activité pour l'action globale (pas un par membre)
    await log_activity(
        db,
        action="bulk_renewal_reminder_sent",
        description=(
            f"Bulk relance — envoyés:{breakdown['sent']} "
            f"cooldown:{breakdown['skipped_cooldown']} "
            f"opt_out:{breakdown['skipped_opt_out']} "
            f"not_expired:{breakdown['skipped_not_expired']} "
            f"no_email:{breakdown['skipped_no_email']} "
            f"failed:{breakdown['failed']}"
        ),
        current_user=current_user,
    )
    logger.info(
        "BULK_RENEWAL_REMINDER_DONE "
        f"club={resolved_club_id} "
        f"sent={breakdown['sent']} "
        f"cooldown={breakdown['skipped_cooldown']} "
        f"opt_out={breakdown['skipped_opt_out']} "
        f"not_expired={breakdown['skipped_not_expired']} "
        f"no_email={breakdown['skipped_no_email']} "
        f"failed={breakdown['failed']}"
    )
    return breakdown
