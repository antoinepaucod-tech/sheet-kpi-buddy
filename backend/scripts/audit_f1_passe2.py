"""
AUDIT F1 PASSE 2 — Stratégies basées sur payment_id et client_name
(Découverte passe 1 : accounting_tx.member_id est None partout, mais payment_id non-null sur 285 docs)
"""
import asyncio
from collections import defaultdict, Counter
from motor.motor_asyncio import AsyncIOMotorClient
from core.config import MONGO_URL, DB_NAME


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    print("=" * 80)
    print("AUDIT F1 PASSE 2 — Stratégies via payment_id et client_name")
    print("=" * 80)

    all_payments = await db.payments.find({}, {
        "_id": 0, "id": 1, "member_id": 1, "member_name": 1, "due_date": 1,
        "amount": 1, "status": 1, "club_id": 1, "paid_date": 1
    }).to_list(length=5000)
    all_at = await db.accounting_transactions.find({"type": "revenue"}, {
        "_id": 0, "id": 1, "client_name": 1, "date": 1, "amount": 1,
        "category": 1, "club_id": 1, "payment_id": 1, "is_auto_generated": 1
    }).to_list(length=10000)

    print(f"\npayments       : {len(all_payments)}")
    print(f"accounting_tx  : {len(all_at)}")

    # === STRATÉGIE A : payment_id direct ===
    p_ids = {p["id"] for p in all_payments}
    matched_by_pid = [tx for tx in all_at if tx.get("payment_id") in p_ids]
    orphan_pid = [tx for tx in all_at if tx.get("payment_id") and tx.get("payment_id") not in p_ids]
    no_pid = [tx for tx in all_at if not tx.get("payment_id")]

    print(f"\n>> STRATÉGIE A : payment_id direct (lien fort)")
    print(f"   accounting_tx avec payment_id → match  : {len(matched_by_pid)}")
    print(f"   accounting_tx avec payment_id → ORPHELIN (pointe vers payment supprimé) : {len(orphan_pid)}")
    print(f"   accounting_tx sans payment_id (historique pur) : {len(no_pid)}")
    print(f"   ↳ Risque faux positif : 0 (lien explicite, créé par le code)")
    print(f"   ↳ Risque faux négatif : {len(no_pid)} (= tous les historiques antérieurs à mars 2026)")

    # === STRATÉGIE B : client_name + date + amount ===
    p_keys_b = defaultdict(list)
    for p in all_payments:
        m = ((p.get("member_name") or "").strip().lower(), p.get("due_date"), float(p.get("amount") or 0))
        p_keys_b[m].append(p)

    matches_b = 0
    multi_b = 0
    for tx in all_at:
        if not tx.get("client_name"):
            continue
        k = ((tx.get("client_name") or "").strip().lower(), tx.get("date"), float(tx.get("amount") or 0))
        if k in p_keys_b:
            matches_b += 1
            if len(p_keys_b[k]) > 1:
                multi_b += 1

    print(f"\n>> STRATÉGIE B : (client_name + date EXACT + amount)")
    print(f"   matches : {matches_b}")
    print(f"   ambiguïtés (>1 payment matche) : {multi_b}")

    # === STRATÉGIE C : client_name + mois + amount ===
    p_keys_c = defaultdict(list)
    for p in all_payments:
        m = ((p.get("member_name") or "").strip().lower(), (p.get("due_date") or "")[:7], float(p.get("amount") or 0))
        p_keys_c[m].append(p)

    matches_c = 0
    multi_c = 0
    for tx in all_at:
        if not tx.get("client_name"):
            continue
        k = ((tx.get("client_name") or "").strip().lower(), (tx.get("date") or "")[:7], float(tx.get("amount") or 0))
        if k in p_keys_c:
            matches_c += 1
            if len(p_keys_c[k]) > 1:
                multi_c += 1

    print(f"\n>> STRATÉGIE C : (client_name + mois YYYY-MM + amount)")
    print(f"   matches : {matches_c}")
    print(f"   ambiguïtés (>1 payment matche) : {multi_c}")

    # === STRATÉGIE D : A + B en cascade (payment_id si présent, sinon client+date+amount) ===
    matched_a_ids = {tx.get("id") for tx in matched_by_pid}
    matches_d = len(matched_a_ids)
    multi_d = 0
    for tx in all_at:
        if tx.get("id") in matched_a_ids:
            continue
        if not tx.get("client_name"):
            continue
        k = ((tx.get("client_name") or "").strip().lower(), tx.get("date"), float(tx.get("amount") or 0))
        if k in p_keys_b:
            matches_d += 1
            if len(p_keys_b[k]) > 1:
                multi_d += 1

    print(f"\n>> STRATÉGIE D : CASCADE (A → fallback B)")
    print(f"   total matches : {matches_d}")
    print(f"   ↳ via payment_id : {len(matched_a_ids)}")
    print(f"   ↳ via client+date+amount : {matches_d - len(matched_a_ids)}")
    print(f"   ambiguïtés fallback : {multi_d}")

    # === client_name analysis ===
    print(f"\n[Analyse client_name]")
    no_cn = sum(1 for tx in all_at if not tx.get("client_name"))
    with_cn = sum(1 for tx in all_at if tx.get("client_name"))
    print(f"   accounting_tx avec client_name    : {with_cn}")
    print(f"   accounting_tx sans client_name    : {no_cn}")
    auto_gen = sum(1 for tx in all_at if tx.get("is_auto_generated"))
    print(f"   is_auto_generated=true            : {auto_gen}")

    # Distribution des 285 docs avec payment_id par mois (pour comprendre pourquoi orphan)
    print(f"\n[Distribution des 285 acct_tx avec payment_id, par mois]")
    by_month = Counter([(tx.get("date") or "")[:7] for tx in all_at if tx.get("payment_id")])
    for ym, n in sorted(by_month.items()):
        print(f"   {ym}: {n}")

    # Échantillon docs orphelins (payment_id mais pas dans payments)
    print(f"\n[Échantillon 5 orphelins payment_id]")
    for tx in orphan_pid[:5]:
        print(f"   pid={tx.get('payment_id', '')[:8]} date={tx.get('date')} amount={tx.get('amount')} cn={tx.get('client_name')}")

    # Échantillon des 285 matches
    print(f"\n[Échantillon 5 matches payment_id directs]")
    for tx in matched_by_pid[:5]:
        print(f"   pid={tx.get('payment_id', '')[:8]} date={tx.get('date')} amount={tx.get('amount')} cn={tx.get('client_name')}")

    client.close()


asyncio.run(main())
