"""
AUDIT READ-ONLY G1/G4 — Membres PASS COACH cachés + Expirés
Liste les membres qui ont une catégorie auto "Coach" (via flag is_coach_subscription)
et calcule combien sont expirés (subscription_end_date < today).
"""
import asyncio
from datetime import date
from collections import Counter, defaultdict
from motor.motor_asyncio import AsyncIOMotorClient
from core.config import MONGO_URL, DB_NAME
from core.member_categorization import get_member_category


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    today = date.today().isoformat()

    print("=" * 80)
    print("AUDIT G1/G4 — PASS COACH + EXPIRÉS (READ-ONLY)")
    print("=" * 80)
    print(f"Date du jour : {today}\n")

    # Charger memberships_types pour catégorisation
    mtypes = await db.membership_types.find({}).to_list(length=500)
    mtypes_map = {m["name"]: m for m in mtypes if "name" in m}

    # Charger tous les membres (non-archived ET archived pour rapport complet)
    all_members = await db.customer_members.find({}, {
        "_id": 0, "id": 1, "name": 1, "first_name": 1, "last_name": 1, "email": 1,
        "membership": 1, "subscription_start_date": 1, "subscription_end_date": 1,
        "exit_date": 1, "archived_at": 1, "club_id": 1, "is_coach": 1
    }).to_list(length=10000)

    print(f"[1] VOLUMÉTRIE TOTALE")
    print("-" * 80)
    print(f"Total membres                : {len(all_members)}")
    archived = [m for m in all_members if m.get("archived_at")]
    active = [m for m in all_members if not m.get("archived_at")]
    print(f"  ↳ Archivés                 : {len(archived)}")
    print(f"  ↳ Non-archivés (actifs)    : {len(active)}")

    # === Catégoriser tous les actifs ===
    print(f"\n[2] CATÉGORISATION DES MEMBRES NON-ARCHIVÉS")
    print("-" * 80)
    cat_counter = Counter()
    coach_members = []  # catégorie = "Coach"
    for m in active:
        cat = get_member_category(m, mtypes_map)
        cat_counter[cat] += 1
        if cat == "Coach":
            coach_members.append(m)

    for cat, n in cat_counter.most_common():
        print(f"  {cat:15s} : {n}")

    # === Focus sur les membres catégorie "Coach" ===
    print(f"\n[3] MEMBRES CATÉGORIE 'Coach' (auto-catégorisés)")
    print("-" * 80)
    print(f"Total catégorie Coach : {len(coach_members)}\n")

    # Distribution par membership
    mem_dist = Counter([m.get("membership") for m in coach_members])
    print("[Distribution par membership]")
    for mem, n in mem_dist.most_common():
        print(f"  {str(mem)[:60]:60s} : {n}")

    # === Calculer expirés (G4) ===
    print(f"\n[4] EXPIRATIONS (G4) — sur l'ensemble des actifs non-archivés")
    print("-" * 80)
    expired_all = []
    expired_coach = []
    no_end_date = []
    not_expired = []
    for m in active:
        end = m.get("subscription_end_date")
        if not end:
            no_end_date.append(m)
            continue
        if end < today:
            expired_all.append(m)
            cat = get_member_category(m, mtypes_map)
            if cat == "Coach":
                expired_coach.append(m)
        else:
            not_expired.append(m)

    print(f"Membres sans subscription_end_date : {len(no_end_date)}")
    print(f"Membres avec date future ou =today : {len(not_expired)}")
    print(f"Membres EXPIRÉS (end < today)      : {len(expired_all)}")
    print(f"  ↳ dont catégorie Coach           : {len(expired_coach)}")

    # === Échantillon recherche "Alex Giraud" (use case utilisateur) ===
    print(f"\n[5] RECHERCHE 'Alex Giraud' (use case utilisateur)")
    print("-" * 80)
    alex_candidates = [
        m for m in all_members
        if "alex" in (m.get("name") or "").lower() and "giraud" in (m.get("name") or "").lower()
    ]
    print(f"Matches trouvés : {len(alex_candidates)}")
    for m in alex_candidates:
        cat = get_member_category(m, mtypes_map) if not m.get("archived_at") else "ARCHIVED"
        end = m.get("subscription_end_date")
        expired = "EXPIRED" if end and end < today else ("ACTIVE" if end else "NO_END")
        print(f"  id={m.get('id', '')[:8]} name={m.get('name')} membership={m.get('membership')}")
        print(f"     cat={cat} end_date={end} status={expired} archived={bool(m.get('archived_at'))} club={(m.get('club_id') or '')[:8]}")

    # === Échantillon top 10 coach members avec expiration ===
    print(f"\n[6] ÉCHANTILLON — 10 premiers membres catégorie Coach")
    print("-" * 80)
    for m in coach_members[:10]:
        end = m.get("subscription_end_date")
        expired = "EXPIRED" if end and end < today else ("ACTIVE" if end else "NO_END")
        print(f"  {(m.get('name') or '')[:30]:30s} | {(m.get('membership') or '')[:40]:40s} | end={end} | {expired}")

    # === Distribution expirés par mois ===
    print(f"\n[7] DISTRIBUTION DES EXPIRÉS PAR MOIS")
    print("-" * 80)
    expired_by_month = Counter([(m.get("subscription_end_date") or "")[:7] for m in expired_all])
    for ym, n in sorted(expired_by_month.items()):
        print(f"  {ym} : {n}")

    client.close()


asyncio.run(main())
