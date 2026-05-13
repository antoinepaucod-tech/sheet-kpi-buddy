"""
AUDIT READ-ONLY F1 — Paiements historiques manquants
Compare `payments` (cycle court, depuis 2026-03-19) vs `accounting_transactions` (historique long).
Aucune mutation. Sortie : rapport structuré + chiffres pour 3 stratégies de dédup.
"""
import asyncio
import json
from collections import defaultdict, Counter
from motor.motor_asyncio import AsyncIOMotorClient
from core.config import MONGO_URL, DB_NAME


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    print("=" * 80)
    print("AUDIT F1 — PAYMENTS vs ACCOUNTING_TRANSACTIONS (READ-ONLY)")
    print("=" * 80)

    # === SECTION 1 : Structure et volumétrie ===
    print("\n[1] STRUCTURE & VOLUMÉTRIE")
    print("-" * 80)
    p_total = await db.payments.count_documents({})
    at_total = await db.accounting_transactions.count_documents({})
    at_revenue = await db.accounting_transactions.count_documents({"type": "revenue"})
    at_expense = await db.accounting_transactions.count_documents({"type": "expense"})
    print(f"payments              : {p_total}")
    print(f"accounting_tx total   : {at_total}")
    print(f"accounting_tx revenue : {at_revenue}")
    print(f"accounting_tx expense : {at_expense}")

    # Exemple de doc payments
    p_sample = await db.payments.find_one({})
    at_sample = await db.accounting_transactions.find_one({"type": "revenue"})
    print(f"\n[Sample payment keys]        : {sorted(p_sample.keys()) if p_sample else 'N/A'}")
    print(f"[Sample accounting_tx keys]  : {sorted(at_sample.keys()) if at_sample else 'N/A'}")

    # Champs critiques
    print("\n[Champs pivots dans payments]")
    for k in ['member_id', 'member_name', 'due_date', 'paid_at', 'payment_date', 'amount', 'status', 'club_id', 'created_at', 'month']:
        v = p_sample.get(k) if p_sample else None
        print(f"  {k:20s} -> {type(v).__name__:10s} : {v}")
    print("\n[Champs pivots dans accounting_tx]")
    for k in ['member_id', 'member_name', 'name', 'date', 'amount', 'type', 'category', 'club_id', 'created_at', 'linked_payment_id', 'source_payment_id', 'payment_id']:
        v = at_sample.get(k) if at_sample else None
        print(f"  {k:20s} -> {type(v).__name__:10s} : {v}")

    # Détecter présence d'un lien explicite payments↔accounting_tx
    print("\n[Liens explicites accounting_tx → payments]")
    for fk in ['linked_payment_id', 'source_payment_id', 'payment_id']:
        count = await db.accounting_transactions.count_documents({fk: {"$exists": True, "$ne": None}})
        print(f"  accounting_tx avec '{fk}' non-null : {count}")

    # === SECTION 2 : Distribution temporelle ===
    print("\n[2] DISTRIBUTION TEMPORELLE")
    print("-" * 80)

    # payments: utiliser due_date ou created_at
    pipeline_p = [
        {"$project": {"ym": {"$substr": ["$due_date", 0, 7]}}},
        {"$group": {"_id": "$ym", "n": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]
    p_dist = await db.payments.aggregate(pipeline_p).to_list(length=200)
    print("\n[payments par mois (due_date YYYY-MM)]")
    for r in p_dist:
        print(f"  {r['_id']}: {r['n']}")

    pipeline_at = [
        {"$match": {"type": "revenue"}},
        {"$project": {"ym": {"$substr": ["$date", 0, 7]}}},
        {"$group": {"_id": "$ym", "n": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]
    at_dist = await db.accounting_transactions.aggregate(pipeline_at).to_list(length=200)
    print("\n[accounting_tx REVENUE par mois (date YYYY-MM)]")
    for r in at_dist:
        print(f"  {r['_id']}: {r['n']}")

    # Premier doc payments par created_at
    earliest_p = await db.payments.find({}).sort("created_at", 1).limit(1).to_list(1)
    if earliest_p:
        print(f"\n[Premier payment crée] created_at={earliest_p[0].get('created_at')} due_date={earliest_p[0].get('due_date')}")

    # === SECTION 3 : Analyse de chevauchement (mois communs) ===
    print("\n[3] CHEVAUCHEMENT TEMPOREL")
    print("-" * 80)
    p_months = {r['_id'] for r in p_dist if r['_id']}
    at_months_rev = {r['_id'] for r in at_dist if r['_id']}
    overlap = p_months & at_months_rev
    only_at = at_months_rev - p_months
    only_p = p_months - at_months_rev
    print(f"Mois communs (overlap)    : {sorted(overlap)}")
    print(f"Mois uniquement payments  : {sorted(only_p)}")
    print(f"Mois uniquement acct_tx   : {sorted(only_at)}")

    # === SECTION 4 : Stratégies de dédup (chiffres concrets sur overlap) ===
    print("\n[4] STRATÉGIES DE DÉDUP — Chiffres concrets")
    print("-" * 80)

    # Charger tous les payments (avec member_id, due_date, amount, member_name)
    all_payments = await db.payments.find({}, {
        "_id": 0, "id": 1, "member_id": 1, "member_name": 1, "due_date": 1,
        "amount": 1, "status": 1, "club_id": 1, "paid_at": 1
    }).to_list(length=5000)

    # Charger tous les revenue accounting_tx (sur les mois overlap)
    all_revenue_at = await db.accounting_transactions.find(
        {"type": "revenue"},
        {"_id": 0, "id": 1, "member_id": 1, "member_name": 1, "name": 1,
         "date": 1, "amount": 1, "category": 1, "club_id": 1, "linked_payment_id": 1}
    ).to_list(length=10000)

    print(f"Total payments chargés     : {len(all_payments)}")
    print(f"Total accounting_tx revenue: {len(all_revenue_at)}")

    # ----- STRATÉGIE 1 : member_id + YYYY-MM + amount -----
    p_keys_s1 = defaultdict(list)
    for p in all_payments:
        m = (p.get("member_id"), (p.get("due_date") or "")[:7], float(p.get("amount") or 0))
        p_keys_s1[m].append(p)

    matches_s1 = 0
    multi_match_s1 = 0
    at_no_member_id = 0
    at_overlap_s1 = []
    for tx in all_revenue_at:
        if not tx.get("member_id"):
            at_no_member_id += 1
            continue
        k = (tx.get("member_id"), (tx.get("date") or "")[:7], float(tx.get("amount") or 0))
        if k in p_keys_s1:
            matches_s1 += 1
            at_overlap_s1.append(tx)
            if len(p_keys_s1[k]) > 1:
                multi_match_s1 += 1

    print(f"\n>> STRATÉGIE 1 : (member_id, mois YYYY-MM, amount)")
    print(f"   accounting_tx sans member_id            : {at_no_member_id}")
    print(f"   accounting_tx matchant un payment       : {matches_s1}")
    print(f"   ↳ dont matchent plusieurs payments      : {multi_match_s1} (ambiguïté)")
    print(f"   accounting_tx considérés HISTORIQUE     : {len(all_revenue_at) - matches_s1}")

    # ----- STRATÉGIE 2 : member_id + due_date exact + amount -----
    p_keys_s2 = defaultdict(list)
    for p in all_payments:
        m = (p.get("member_id"), p.get("due_date"), float(p.get("amount") or 0))
        p_keys_s2[m].append(p)

    matches_s2 = 0
    multi_match_s2 = 0
    for tx in all_revenue_at:
        if not tx.get("member_id"):
            continue
        k = (tx.get("member_id"), tx.get("date"), float(tx.get("amount") or 0))
        if k in p_keys_s2:
            matches_s2 += 1
            if len(p_keys_s2[k]) > 1:
                multi_match_s2 += 1

    print(f"\n>> STRATÉGIE 2 : (member_id, due_date exact, amount)")
    print(f"   accounting_tx matchant un payment       : {matches_s2}")
    print(f"   ↳ dont matchent plusieurs payments      : {multi_match_s2}")
    print(f"   accounting_tx considérés HISTORIQUE     : {len(all_revenue_at) - matches_s2}")

    # ----- STRATÉGIE 3 : member_id + paid_at exact + amount (uniquement payments payés) -----
    p_keys_s3 = defaultdict(list)
    for p in all_payments:
        if p.get("paid_at"):
            m = (p.get("member_id"), (p.get("paid_at") or "")[:10], float(p.get("amount") or 0))
            p_keys_s3[m].append(p)

    matches_s3 = 0
    multi_match_s3 = 0
    for tx in all_revenue_at:
        if not tx.get("member_id"):
            continue
        k = (tx.get("member_id"), (tx.get("date") or "")[:10], float(tx.get("amount") or 0))
        if k in p_keys_s3:
            matches_s3 += 1
            if len(p_keys_s3[k]) > 1:
                multi_match_s3 += 1

    print(f"\n>> STRATÉGIE 3 : (member_id, paid_at exact, amount) — payments PAYÉS uniquement")
    print(f"   payments payés                          : {len([p for p in all_payments if p.get('paid_at')])}")
    print(f"   accounting_tx matchant un payment payé  : {matches_s3}")
    print(f"   ↳ dont matchent plusieurs payments      : {multi_match_s3}")
    print(f"   accounting_tx considérés HISTORIQUE     : {len(all_revenue_at) - matches_s3}")

    # === SECTION 5 : Échantillon de docs uniquement dans accounting_tx (historique pur) ===
    print("\n[5] ÉCHANTILLON — Historique pur (uniquement accounting_tx, hors overlap)")
    print("-" * 80)
    pre_march_2026 = [tx for tx in all_revenue_at if (tx.get("date") or "")[:7] < "2026-03"]
    print(f"accounting_tx revenue avec date < 2026-03 : {len(pre_march_2026)}")
    print(f"Exemples (3 premiers) :")
    for tx in pre_march_2026[:3]:
        print(f"  - date={tx.get('date')} amount={tx.get('amount')} name={tx.get('name') or tx.get('member_name')} category={tx.get('category')} club={tx.get('club_id', '')[:8]}...")

    # === SECTION 6 : Catégories des accounting_tx revenue ===
    print("\n[6] CATÉGORIES accounting_tx revenue")
    print("-" * 80)
    cats = Counter([tx.get("category") for tx in all_revenue_at])
    for cat, n in cats.most_common(15):
        print(f"  {str(cat)[:50]:50s} : {n}")

    client.close()


asyncio.run(main())
