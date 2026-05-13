"""
SPRINT HARDENING — F.1 RE-AUDIT BASELINE ORPHELINS (READ-ONLY)
Mesure post-Bloc 2 sur 15 collections critiques pour confirmer qu'aucun orphelin
n'a été créé depuis la baseline initiale.
"""
import asyncio
from collections import Counter
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from core.config import MONGO_URL, DB_NAME


COLLECTIONS = [
    "accounting_transactions",
    "payments",
    "coaches",
    "coach_replacements",
    "customer_members",
    "member_renewals",
    "weekly_trainings",
    "course_kpis",
    "activity_logs",
    "monthly_kpis",
    "annual_reviews",
    "challenge_participants",
    "ghl_sales",
    "ghl_syncs",
    "payment_schedules",
]

EXPECTED_BASELINE = {
    "activity_logs": 6,
    "member_renewals": 3,
    "annual_reviews": 20,
    # Toutes les autres : 0 attendu
}


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    today_iso = datetime.now(timezone.utc).isoformat()
    today_date = today_iso[:10]

    print("=" * 90)
    print("SPRINT HARDENING — F.1 RE-AUDIT BASELINE ORPHELINS (READ-ONLY)")
    print("=" * 90)
    print(f"Cible DB    : {DB_NAME}")
    print(f"Cible URL   : {MONGO_URL[:60]}...")
    print(f"Date du jour: {today_date}\n")

    summary = []
    grand_total_orphans = 0
    anomalies = []

    for collection in COLLECTIONS:
        coll = db[collection]
        total = await coll.count_documents({})
        # Inclut absence du champ ET null
        null_q = {"$or": [{"club_id": None}, {"club_id": {"$exists": False}}]}
        null_count = await coll.count_documents(null_q)
        pct = (null_count / max(total, 1)) * 100
        expected = EXPECTED_BASELINE.get(collection, 0)
        delta = null_count - expected
        status_flag = "✅" if delta == 0 else ("🔴" if delta > 0 else "🟡")

        # Pour les collections avec orphelins, récupérer date min/max et compter post-aujourd'hui
        oldest_str = newest_str = "—"
        created_today_count = 0
        if null_count > 0:
            orphans = await coll.find(null_q, {"_id": 0, "created_at": 1, "id": 1}).to_list(length=null_count)
            dates = [d.get("created_at") for d in orphans if d.get("created_at")]
            if dates:
                # Normaliser en string ISO
                str_dates = [str(d) for d in dates]
                oldest_str = min(str_dates)
                newest_str = max(str_dates)
                created_today_count = sum(1 for d in str_dates if d[:10] >= today_date)

        summary.append({
            "collection": collection,
            "total": total,
            "null_count": null_count,
            "pct": pct,
            "expected": expected,
            "delta": delta,
            "status": status_flag,
            "oldest": oldest_str,
            "newest": newest_str,
            "created_today_or_later": created_today_count,
        })
        grand_total_orphans += null_count
        if delta != 0:
            anomalies.append((collection, delta))

    # === Affichage table ===
    print(f"{'Collection':<28}{'Total':>8}{'Orphelin':>10}{'%':>8}{'Baseline':>10}{'Delta':>8}  Status  Plage de dates orphelins")
    print("-" * 130)
    for r in summary:
        plage = f"{r['oldest'][:19]} → {r['newest'][:19]}" if r['null_count'] > 0 else "—"
        post_today = f" (+{r['created_today_or_later']} post-today)" if r['created_today_or_later'] > 0 else ""
        print(f"{r['collection']:<28}{r['total']:>8}{r['null_count']:>10}{r['pct']:>7.2f}%{r['expected']:>10}{r['delta']:>+8}    {r['status']}   {plage}{post_today}")

    print("-" * 130)
    print(f"{'TOTAL':<28}{'':>8}{grand_total_orphans:>10}{'':>8}{'29':>10}{grand_total_orphans-29:>+8}\n")

    # === Analyse ===
    print("=" * 90)
    print("ANALYSE")
    print("=" * 90)
    if not anomalies:
        print("✅ Aucune divergence vs baseline. Les patches Bloc 2 sont sains.")
        print("→ GO pour F.2 (script dry-run migration).")
    else:
        print("⚠️ Divergences détectées :")
        for coll, delta in anomalies:
            verdict = ("(+) NOUVEAUX orphelins créés → audit endpoint" if delta > 0
                       else "(-) orphelins disparus → suspicion delete/migration externe")
            print(f"  {coll}: delta={delta:+d}  {verdict}")
        print("\n→ STOP. Diagnostiquer avant F.2.")

    # === Détail des orphelins par collection (pour visibilité avant F.2) ===
    print("\n" + "=" * 90)
    print("DÉTAIL DES ORPHELINS (preview F.2)")
    print("=" * 90)
    for r in summary:
        if r["null_count"] == 0:
            continue
        print(f"\n[{r['collection']}] {r['null_count']} orphelins")
        coll = db[r["collection"]]
        orphans = await coll.find(
            {"$or": [{"club_id": None}, {"club_id": {"$exists": False}}]},
            {"_id": 0}
        ).to_list(length=r["null_count"])
        for i, doc in enumerate(orphans[:5]):
            keys = {k: doc.get(k) for k in ("id", "member_id", "action", "renewal_date", "review_date", "status", "created_at") if k in doc}
            print(f"  [{i+1}] {keys}")
        if r["null_count"] > 5:
            print(f"  ... +{r['null_count']-5} autres")

    client.close()


asyncio.run(main())
