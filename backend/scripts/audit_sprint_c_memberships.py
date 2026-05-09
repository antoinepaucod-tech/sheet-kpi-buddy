"""Sprint C pre-audit — READ-ONLY MongoDB Atlas.

Lists distinct memberships, proposes category mapping, lists membership_types.
"""
import asyncio
import re
import sys
import os

sys.path.insert(0, "/app/backend")
from core.config import db  # noqa: E402


COACH_KEYWORDS = ["THE COACH", "VIRTUAL COACH"]
PARTNER_KEYWORDS = ["DUO", "PARTENAIRE"]
OPENGYM_KEYWORDS = ["OPEN GYM", "OPEN-GYM"]
IFRC_KEYWORDS = ["IFRC"]


def categorize(membership: str) -> str:
    if not membership:
        return "VIDE"
    m = membership.upper()
    if any(kw in m for kw in COACH_KEYWORDS):
        return "Coach"
    if any(kw in m for kw in IFRC_KEYWORDS):
        return "IFRC"
    if any(kw in m for kw in OPENGYM_KEYWORDS):
        return "OpenGym"
    if any(kw in m for kw in PARTNER_KEYWORDS):
        return "Partenaire"
    return "HG"


async def main():
    # 1. Distinct memberships + counts (handle both missing-key and null-value as "active")
    pipeline = [
        {"$group": {
            "_id": "$membership",
            "count": {"$sum": 1},
            "active": {"$sum": {"$cond": [
                {"$or": [
                    {"$eq": [{"$ifNull": ["$archived_at", None]}, None]},
                    {"$eq": ["$archived_at", ""]},
                    {"$eq": ["$archived_at", False]},
                ]},
                1, 0
            ]}},
        }},
        {"$sort": {"count": -1}},
    ]
    rows = await db.customer_members.aggregate(pipeline).to_list(length=None)
    for r in rows:
        r["archived"] = r["count"] - r["active"]

    total_members = sum(r["count"] for r in rows)
    total_active = sum(r["active"] for r in rows)
    total_archived = sum(r["archived"] for r in rows)

    print("=" * 100)
    print(f"AUDIT — collection customer_members (DB: {os.environ.get('DB_NAME')})")
    print(f"Total: {total_members} | Actifs: {total_active} | Archivés: {total_archived}")
    print(f"Distinct memberships: {len(rows)}")
    print("=" * 100)

    # 2. Tableau categorisation proposée
    print("\n=== TABLEAU 1 — DISTINCT MEMBERSHIPS + CATEGORISATION PROPOSEE ===")
    print(f"{'#':<3} | {'Membership':<60} | {'Total':<6} | {'Actif':<6} | {'Arch.':<6} | {'Cat.':<11} | Notes")
    print("-" * 130)
    cat_totals = {}
    for i, r in enumerate(rows, 1):
        m = r["_id"] if r["_id"] is not None else "(null/empty)"
        cat = categorize(r["_id"] or "")
        cat_totals.setdefault(cat, {"total": 0, "active": 0, "archived": 0, "members": []})
        cat_totals[cat]["total"] += r["count"]
        cat_totals[cat]["active"] += r["active"]
        cat_totals[cat]["archived"] += r["archived"]
        cat_totals[cat]["members"].append(m)
        notes = ""
        if not r["_id"]:
            notes = "VIDE — à investiguer"
        elif r["active"] == 0 and r["archived"] > 0:
            notes = "OBSOLETE — 0 actif"
        elif "HUBFIT" in (r["_id"] or "").upper():
            notes = "HUBFIT (legacy)"
        print(f"{i:<3} | {str(m)[:60]:<60} | {r['count']:<6} | {r['active']:<6} | {r['archived']:<6} | {cat:<11} | {notes}")

    # 3. Récap par catégorie
    print("\n=== TABLEAU 2 — TOTAUX PAR CATEGORIE ===")
    print(f"{'Catégorie':<12} | {'Total':<6} | {'Actif':<6} | {'Arch.':<6} | Memberships distincts")
    print("-" * 80)
    for cat, data in sorted(cat_totals.items(), key=lambda x: -x[1]["total"]):
        print(f"{cat:<12} | {data['total']:<6} | {data['active']:<6} | {data['archived']:<6} | {len(data['members'])}")

    # 4. membership_types collection
    print("\n=== TABLEAU 3 — collection membership_types ===")
    types = await db.membership_types.find({}, {"_id": 0}).to_list(length=None)
    print(f"Total documents: {len(types)}")
    if types:
        # Show all keys present in sample
        all_keys = set()
        for t in types:
            all_keys.update(t.keys())
        keys_to_show = ["name", "category", "type", "price", "duration_months", "is_active", "club_id"]
        keys_to_show = [k for k in keys_to_show if k in all_keys]
        # If schema has different keys, show them all
        if not keys_to_show:
            keys_to_show = list(all_keys)[:6]
        print(f"Colonnes affichées: {keys_to_show}")
        print(f"Toutes les clés trouvées: {sorted(all_keys)}")
        print("-" * 100)
        for t in types:
            line = " | ".join(f"{k}={t.get(k)}" for k in keys_to_show)
            print(f"  • {line}")

    # 5. Cas particuliers
    print("\n=== TABLEAU 4 — CAS PARTICULIERS ===")
    # 5a. Membership null/empty
    null_count = await db.customer_members.count_documents({"$or": [{"membership": None}, {"membership": ""}, {"membership": {"$exists": False}}]})
    print(f"Membership null/empty/missing: {null_count} membres")

    # 5b. Memberships obsolètes (0 actif)
    obsolete = [r for r in rows if r["_id"] and r["active"] == 0 and r["archived"] > 0]
    print(f"Memberships avec 0 actif (obsolètes): {len(obsolete)}")
    for r in obsolete[:20]:
        print(f"  • {r['_id']!r} ({r['archived']} archivés)")

    # 5c. Memberships actifs catégorisés "HG" (default) — à valider
    hg_active = [r for r in rows if r["_id"] and r["active"] > 0 and categorize(r["_id"]) == "HG"]
    print(f"\nMemberships actifs catégorisés HG (par défaut, à valider): {len(hg_active)}")
    for r in sorted(hg_active, key=lambda x: -x["active"])[:30]:
        print(f"  • {r['_id']!r} (actifs={r['active']}, archivés={r['archived']})")

    # 5d. Existence de "HUBFIT", "VIRTUAL", autres legacy
    print("\nLegacy / keyword scan:")
    for keyword in ["HUBFIT", "VIRTUAL", "TRIAL", "ESSAI", "GRATUIT", "FREE", "TEST"]:
        matched = [r for r in rows if r["_id"] and keyword.upper() in r["_id"].upper()]
        if matched:
            print(f"  • Contient '{keyword}': {len(matched)} memberships, "
                  f"{sum(r['count'] for r in matched)} membres")
            for r in matched[:5]:
                print(f"      - {r['_id']!r} (total={r['count']}, actif={r['active']})")


asyncio.run(main())
