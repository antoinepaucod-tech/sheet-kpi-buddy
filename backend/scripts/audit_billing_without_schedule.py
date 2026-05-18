"""AUDIT LECTURE-SEULE — Membres billing_enabled=True sans payment_schedule actif.

Contexte : bug PaymentSchedule import fixé Sprint Hardening 12/05/2026.
Objectif : quantifier l'impact pré-fix sur Versoix.

GARDE-FOUS :
- Aucune écriture DB (vérifié par grep : 0 occurrence de
  update_one/insert_one/delete_one/replace_one/insert_many/etc.)
- Affichage cible Atlas + DB en gros au démarrage (pattern Sprint A)
- Filtre temporel : exclut les membres créés APRÈS le fix (post-2026-05-12)
- Output JSON dans /app/backend/audit_results/

Heuristique PIF probable :
- Si sum(accounting_transactions.amount_received) ≥ 80% du prix total
  théorique → PIF probable, NE PAS compter comme orphelin "bug"
- Sinon → orphelin réel, revenu manqué estimé = monthly × mois_écoulés

Usage :
    python scripts/audit_billing_without_schedule.py
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
from datetime import date, datetime, timezone
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.config import db, MONGO_URL, DB_NAME  # noqa: E402
from core.member_categorization import get_member_category  # noqa: E402

VERSOIX_CLUB_ID = "0a327bf5-c759-49eb-87e4-551913f78bdb"
FIX_DATE = "2026-05-12"  # bug fixé ce jour, exclure les créations postérieures
PIF_THRESHOLD_RATIO = 0.80  # >= 80% du prix théorique payé → PIF probable

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "audit_results")
os.makedirs(OUTPUT_DIR, exist_ok=True)


def _banner():
    print("=" * 78)
    print(" AUDIT LECTURE-SEULE — billing_enabled SANS payment_schedule actif")
    print("=" * 78)
    print(f"  CIBLE Atlas : {MONGO_URL[:60]}...")
    print(f"  DB          : {DB_NAME}")
    print(f"  CLUB        : Versoix ({VERSOIX_CLUB_ID})")
    print(f"  FIX_DATE    : {FIX_DATE} (membres créés après = exclus)")
    print(f"  MODE        : READ-ONLY (aucune mutation)")
    print("=" * 78)


def _parse_date(s):
    """Retourne date ou None depuis une string ISO ou YYYY-MM-DD ou None/''.

    Tolérant aux formats Mongo legacy (avec ou sans T, sans tz, etc.)."""
    if not s:
        return None
    if isinstance(s, datetime):
        return s.date()
    if isinstance(s, date):
        return s
    s = str(s).strip()
    if not s:
        return None
    # Tente plusieurs formats
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f"):
        try:
            return datetime.strptime(s[:len(fmt) + 5] if "." in s and fmt.endswith("%f") else s[:len(fmt)], fmt).date()
        except (ValueError, TypeError):
            continue
    # Tente fromisoformat (ISO compliant)
    try:
        if "T" in s or "+" in s:
            cleaned = s.replace("Z", "+00:00")
            return datetime.fromisoformat(cleaned).date()
        return datetime.fromisoformat(s).date()
    except (ValueError, TypeError):
        return None


def _months_between(start, end):
    """Nombre de mois entiers entre 2 dates (start <= end)."""
    if not start or not end or end < start:
        return 0
    return max(0, (end.year - start.year) * 12 + (end.month - start.month))


async def main():
    _banner()

    # ── 1. Membres billing_enabled=True Versoix, créés avant le fix
    print("\n[1] Query customer_members billing_enabled=True (Versoix, créés avant fix)")
    members_all = await db.customer_members.find(
        {"club_id": VERSOIX_CLUB_ID, "billing_enabled": True},
        {"_id": 0},
    ).to_list(length=None)
    print(f"  Total billing_enabled=True (toutes périodes) : {len(members_all)}")

    members_in_window = []
    for m in members_all:
        ca = _parse_date(m.get("created_at"))
        csd = _parse_date(m.get("contract_signed_date"))
        # On prend la date la plus ancienne représentative (contract_signed sinon created_at)
        ref_date = csd or ca
        m["_ref_date"] = ref_date
        if ref_date and ref_date.isoformat() < FIX_DATE:
            members_in_window.append(m)
    print(f"  Filtrés (créés/contractés avant {FIX_DATE}) : {len(members_in_window)}")

    # ── 2. Payment schedules ACTIFS
    print("\n[2] Query payment_schedules actifs (Versoix)")
    schedules = await db.payment_schedules.find(
        {"club_id": VERSOIX_CLUB_ID, "is_active": True},
        {"_id": 0, "member_id": 1, "amount": 1, "frequency": 1, "archived_at": 1, "start_date": 1, "id": 1},
    ).to_list(length=None)
    active_schedules = [s for s in schedules if not s.get("archived_at")]
    schedules_by_member = defaultdict(list)
    for s in active_schedules:
        schedules_by_member[s.get("member_id")].append(s)
    print(f"  Total schedules actifs (non-archivés) : {len(active_schedules)}")
    print(f"  Membres distincts avec ≥1 schedule actif : {len(schedules_by_member)}")

    # ── 3. Membership types (lookup price + is_pif)
    print("\n[3] Query membership_types")
    types_list = await db.membership_types.find(
        {"club_id": VERSOIX_CLUB_ID},
        {"_id": 0, "name": 1, "price": 1, "is_pif": 1, "is_recurring": 1, "duration_months": 1, "duration_days": 1, "is_coach_subscription": 1},
    ).to_list(length=None)
    types_by_name = {t["name"]: t for t in types_list if t.get("name")}
    print(f"  Total types Versoix : {len(types_list)}")

    # ── 4. Accounting transactions revenue agrégés par client_name (proxy member)
    print("\n[4] Query accounting_transactions (revenue, validées)")
    txs = await db.accounting_transactions.find(
        {"club_id": VERSOIX_CLUB_ID, "type": "revenue", "is_validated": True},
        {"_id": 0, "client_name": 1, "amount_received": 1, "amount": 1, "date": 1},
    ).to_list(length=None)
    revenue_by_name = defaultdict(float)
    for t in txs:
        cn = (t.get("client_name") or "").strip()
        if not cn:
            continue
        amt = t.get("amount_received") if t.get("amount_received") is not None else t.get("amount", 0)
        try:
            revenue_by_name[cn] += float(amt or 0)
        except (TypeError, ValueError):
            pass
    print(f"  Total transactions revenue validées : {len(txs)}")
    print(f"  Clients distincts avec revenu cumulé : {len(revenue_by_name)}")

    # ── 5. Cross-join orphelins
    print("\n[5] Cross-join : flag orphelins (billing_enabled=True sans schedule actif)")
    today = datetime.now(timezone.utc).date()
    fix_d = _parse_date(FIX_DATE)

    orphans = []
    pif_probable = []
    has_schedule = []

    for m in members_in_window:
        mid = m.get("id")
        if not mid:
            continue
        if schedules_by_member.get(mid):
            has_schedule.append(m)
            continue

        # Orphelin candidat
        mt_name = m.get("membership") or ""
        mt = types_by_name.get(mt_name, {})
        is_pif_type = bool(mt.get("is_pif"))
        is_coach_type = bool(mt.get("is_coach_subscription"))
        type_price = float(mt.get("price") or 0)
        type_duration_months = mt.get("duration_months") or 0
        category = get_member_category(m, types_by_name)

        # Source vérité monthly: billing_amount (membre) sinon type_price / duration
        member_billing_amount = float(m.get("billing_amount") or 0)
        monthly = member_billing_amount if member_billing_amount > 0 else (
            (type_price / type_duration_months) if (type_price and type_duration_months) else 0
        )

        # Période d'exposition : du ref_date (contract_signed sinon created) jusqu'à
        # min(today, archived_at, fix_date). NB on cap à fix_date car post-fix le
        # comportement attendu était que le schedule soit créé.
        start = m.get("_ref_date")
        archived_at = _parse_date(m.get("archived_at"))
        exit_date = _parse_date(m.get("exit_date"))
        end = min(d for d in [today, archived_at, exit_date, fix_d] if d is not None)
        months_exposed = _months_between(start, end)

        # Cumul revenu reçu pour ce membre (proxy par name match)
        client_name = (m.get("name") or "").strip()
        revenue_received = revenue_by_name.get(client_name, 0.0)

        # Théorique = type_price (pour PIF) ou monthly * duration (pour récurrent)
        theoretical_total = (
            type_price if is_pif_type and type_price > 0
            else (monthly * type_duration_months if monthly and type_duration_months else 0)
        )

        revenue_manque_estime = 0
        is_pif_probable = False
        if theoretical_total > 0 and revenue_received >= (PIF_THRESHOLD_RATIO * theoretical_total):
            is_pif_probable = True
            # PIF complet ou quasi → pas de revenu manqué
        else:
            # Orphelin réel : revenu manqué = monthly × mois_exposés (capé au théorique)
            est = monthly * months_exposed
            if theoretical_total > 0:
                est = min(est, max(0, theoretical_total - revenue_received))
            revenue_manque_estime = max(0, est)

        record = {
            "id": mid,
            "name": client_name,
            "membership": mt_name,
            "category": category,
            "member_type": m.get("member_type"),
            "billing_amount": member_billing_amount,
            "type_price": type_price,
            "type_duration_months": type_duration_months,
            "monthly_estimated": monthly,
            "theoretical_total": theoretical_total,
            "revenue_received": revenue_received,
            "is_pif_type": is_pif_type,
            "is_coach_type": is_coach_type,
            "ref_date": start.isoformat() if start else None,
            "archived_at": archived_at.isoformat() if archived_at else None,
            "exit_date": exit_date.isoformat() if exit_date else None,
            "months_exposed_capped_fix": months_exposed,
            "revenue_manque_estime": round(revenue_manque_estime, 2),
            "is_pif_probable": is_pif_probable,
            "is_archived": bool(archived_at),
            "is_exited": bool(exit_date),
        }

        if is_pif_probable:
            pif_probable.append(record)
        else:
            orphans.append(record)

    # ── 6. Rapport console
    print("\n" + "=" * 78)
    print(" RAPPORT")
    print("=" * 78)
    print(f"  Total billing_enabled=True (toutes périodes)  : {len(members_all)}")
    print(f"  Pré-fix ({FIX_DATE}, créés avant)             : {len(members_in_window)}")
    print(f"  └─ Avec ≥1 schedule actif (OK)                : {len(has_schedule)}")
    print(f"  └─ ORPHELINS RÉELS (bug, revenu manqué)       : {len(orphans)}")
    print(f"  └─ PIF probables (≥80% du prix payé)          : {len(pif_probable)}")

    # Breakdown orphelins
    if orphans:
        print("\n[Breakdown ORPHELINS par catégorie]")
        cat_count = Counter(o["category"] for o in orphans)
        for cat, n in sorted(cat_count.items(), key=lambda x: -x[1]):
            print(f"  · {cat:20s} = {n}")

        print("\n[Breakdown ORPHELINS par statut]")
        archived_n = sum(1 for o in orphans if o["is_archived"])
        exited_n = sum(1 for o in orphans if o["is_exited"] and not o["is_archived"])
        active_n = len(orphans) - archived_n - exited_n
        print(f"  · actifs (non archivés, non exited)  = {active_n}")
        print(f"  · sortis (exit_date set)             = {exited_n}")
        print(f"  · archivés                           = {archived_n}")

        print("\n[Distribution par mois de création (ref_date)]")
        month_buckets = Counter(
            o["ref_date"][:7] if o["ref_date"] else "unknown" for o in orphans
        )
        for mo, n in sorted(month_buckets.items()):
            print(f"  · {mo} = {n}")

        print("\n[TOP 10 orphelins par revenu manqué estimé]")
        top10 = sorted(orphans, key=lambda x: -x["revenue_manque_estime"])[:10]
        for i, o in enumerate(top10, 1):
            print(f"  {i:2d}. {o['name']:30s} · {o['membership']:35s} · {o['monthly_estimated']:7.2f}/mo × {o['months_exposed_capped_fix']:2d}mo = {o['revenue_manque_estime']:.2f} CHF  [{o['category']}]")

        total_manque = sum(o["revenue_manque_estime"] for o in orphans)
        print(f"\n  SUM revenu manqué estimé (orphelins) : {total_manque:.2f} CHF")
        print(f"  (hypothèse : monthly = billing_amount membre ; capé à théorique max)")

    # ── 7. Persist JSON
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    out_path = os.path.join(OUTPUT_DIR, f"billing_audit_{ts}.json")
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "club_id": VERSOIX_CLUB_ID,
        "fix_date": FIX_DATE,
        "totals": {
            "billing_enabled_total": len(members_all),
            "pre_fix": len(members_in_window),
            "has_active_schedule": len(has_schedule),
            "orphans_real": len(orphans),
            "pif_probable": len(pif_probable),
            "revenue_manque_estime_total_chf": round(sum(o["revenue_manque_estime"] for o in orphans), 2),
        },
        "orphans": orphans,
        "pif_probable": pif_probable,
        "has_schedule_summary": [
            {"id": m.get("id"), "name": m.get("name"), "membership": m.get("membership")} for m in has_schedule[:10]
        ],  # juste 10 pour debug, pas besoin de tous
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2, default=str)
    print(f"\n[JSON output] {out_path}")
    print(f"  Size : {os.path.getsize(out_path)} bytes")

    print("\n[FIN] Audit terminé. AUCUNE MUTATION effectuée.")


if __name__ == "__main__":
    asyncio.run(main())
