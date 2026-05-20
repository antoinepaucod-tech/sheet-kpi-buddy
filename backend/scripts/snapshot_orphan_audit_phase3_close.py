"""SNAPSHOT BASELINE — Post-Phase 3 (close 2026-05-19).

But
---
Geler l'état Atlas juste après la clôture de Phase 3 (31 inserts patchés,
94 tests régression). Sert de référence pour la Phase 4 (migration data) :
  - Avant migration : N orphelins (attendu 5 selon Phase 1 audit)
  - Après migration : 0 orphelin attendu

Classification temporelle
-------------------------
  - pre_phase_2  : created_at <= 2026-05-19 → héritage légitime à migrer
  - post_phase_3 : created_at >  2026-05-20 → RÉGRESSION ALERTE (les
                   patchs Phase 3 ou le hook pre-push ont foiré quelque part)

READ-ONLY strict. 0 mutation DB. Cap raisonnable par collection.
"""
from __future__ import annotations

import asyncio
import json
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core.config import db, client, MONGO_URL, DB_NAME, DEFAULT_CLUB_ID  # noqa: E402

# Aligne sur la liste exacte scannée par services/orphan_audit.py
COLLECTIONS = [
    "accounting_transactions", "payments", "coaches",
    "coach_replacements", "customer_members", "member_renewals",
    "weekly_trainings", "course_kpis", "activity_logs",
    "monthly_kpis", "annual_reviews", "challenge_participants",
    "ghl_sales", "ghl_syncs", "payment_schedules",
]

ORPHAN_FILTER = {"$or": [{"club_id": None}, {"club_id": {"$exists": False}}]}

# Timeline anchors
PHASE_3_CLOSE = "2026-05-19"     # tous les patchs étaient en place ce jour
SNAPSHOT_TODAY = "2026-05-20"    # date du snapshot (pour distinguer post-Phase 3)

EXPECTED_ORPHANS_PHASE_1 = 5     # cf. audit_orphan_club_id_followup 19/05

OUTPUT_DIR = Path(__file__).resolve().parents[1] / "audit_results"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def _redact(uri: str) -> str:
    if "@" in uri and "://" in uri:
        scheme, rest = uri.split("://", 1)
        if "@" in rest:
            creds, host = rest.split("@", 1)
            if ":" in creds:
                user, _ = creds.split(":", 1)
                return f"{scheme}://{user}:***@{host}"
    return uri


def _classify(created_at) -> str:
    if not created_at:
        return "unknown_date"
    iso10 = str(created_at)[:10]
    if iso10 <= PHASE_3_CLOSE:
        return "pre_phase_2"
    if iso10 >= SNAPSHOT_TODAY:
        return "post_phase_3"  # 🔴 alerte régression potentielle
    # Entre 2026-05-19 et 2026-05-20 (zone gris) → pre_phase_2
    return "pre_phase_2"


def _str(v):
    if hasattr(v, "isoformat"):
        return v.isoformat()
    return str(v) if v is not None else None


async def _scan_collection(name: str) -> list[dict]:
    coll = db[name]
    cursor = coll.find(ORPHAN_FILTER)
    docs = await cursor.to_list(length=500)
    rows = []
    for doc in docs:
        if "_id" in doc:
            doc["_id"] = str(doc["_id"])
        rows.append({
            "collection": name,
            "_id": doc.get("_id"),
            "id": doc.get("id"),
            "member_id": doc.get("member_id"),
            "name": doc.get("name") or doc.get("member_name") or doc.get("client_name"),
            "month": doc.get("month"),
            "amount": doc.get("amount"),
            "created_at": _str(doc.get("created_at")),
            "classification": _classify(doc.get("created_at")),
        })
    return rows


async def main() -> int:
    snapshot_at = datetime.now(timezone.utc).isoformat()
    print("=" * 80)
    print(" SNAPSHOT BASELINE — Post-Phase 3 close")
    print("=" * 80)
    print(f"  Atlas       : {_redact(MONGO_URL)}")
    print(f"  DB          : {DB_NAME}")
    print(f"  Snapshot at : {snapshot_at}")
    print(f"  Phase_3_close anchor : {PHASE_3_CLOSE}")
    print(f"  Expected orphans     : {EXPECTED_ORPHANS_PHASE_1}")
    print( "  MODE        : 🟢 READ-ONLY STRICT")
    print("=" * 80)

    grand: list[dict] = []
    by_collection: dict[str, int] = {}
    for c in COLLECTIONS:
        rows = await _scan_collection(c)
        if rows:
            by_collection[c] = len(rows)
            grand.extend(rows)
            print(f"  [{c:<27}] {len(rows)}")

    total = len(grand)
    by_class = Counter(r["classification"] for r in grand)
    regression_alerts = [r for r in grand if r["classification"] == "post_phase_3"]
    delta = total - EXPECTED_ORPHANS_PHASE_1

    print()
    print(f"TOTAL orphans         : {total}")
    print(f"Expected baseline     : {EXPECTED_ORPHANS_PHASE_1}")
    print(f"Delta vs expected     : {delta:+d}")
    print(f"By classification     : {dict(by_class)}")
    print(f"Regression alerts     : {len(regression_alerts)}")

    print()
    print("─── DÉTAIL ────────────────────────────────────────────────────────────")
    for r in grand:
        emoji = "🔴" if r["classification"] == "post_phase_3" else "🟡"
        compact = {
            k: v for k, v in r.items()
            if k in ("_id", "id", "member_id", "name", "month", "amount", "created_at")
            and v is not None
        }
        print(f"  {emoji} [{r['collection']}] cls={r['classification']}")
        print(f"      {json.dumps(compact, default=str)}")

    print()
    print("─── VERDICT ────────────────────────────────────────────────────────────")
    if total == EXPECTED_ORPHANS_PHASE_1 and not regression_alerts:
        verdict = "✅ BASELINE COHÉRENTE — prêt pour Phase 4 migration"
        status = "READY_FOR_PHASE_4"
    elif total > EXPECTED_ORPHANS_PHASE_1 and regression_alerts:
        verdict = "🔴 RÉGRESSION DÉTECTÉE post-Phase 3 — STOP, NE PAS lancer Phase 4"
        status = "REGRESSION_DETECTED"
    elif total < EXPECTED_ORPHANS_PHASE_1:
        verdict = "🟡 ANOMALIE : moins d'orphelins qu'attendu — investigation requise"
        status = "ANOMALY_FEWER"
    elif total > EXPECTED_ORPHANS_PHASE_1 and not regression_alerts:
        verdict = "🟡 PLUS D'ORPHELINS QU'ATTENDU mais aucun post-Phase 3 — vérifier"
        status = "ANOMALY_MORE_PRE_PHASE"
    else:
        verdict = "🟡 État ambigu — review manuelle"
        status = "AMBIGUOUS"
    print(f"  {verdict}")

    payload = {
        "snapshot_date": snapshot_at,
        "phase_3_status": "CLOSED",
        "phase_3_close_anchor": PHASE_3_CLOSE,
        "total_inserts_patched_phase_3": 31,
        "total_tests_regression": 94,
        "total_orphans_found": total,
        "expected_orphans_phase_1": EXPECTED_ORPHANS_PHASE_1,
        "delta_vs_expected": delta,
        "verdict_status": status,
        "verdict_message": verdict,
        "by_collection": by_collection,
        "by_classification": dict(by_class),
        "regression_alerts": regression_alerts,
        "orphans": grand,
        "default_club_id_for_phase_4": DEFAULT_CLUB_ID,
    }
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    out_path = OUTPUT_DIR / f"post_phase3_close_{ts}.json"
    with out_path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False, default=str)
    print()
    print(f"[JSON] {out_path} ({out_path.stat().st_size} bytes)")
    print("[FIN] AUCUNE MUTATION effectuée.")
    return 0


if __name__ == "__main__":
    try:
        rc = asyncio.run(main())
    finally:
        client.close()
    sys.exit(rc)
