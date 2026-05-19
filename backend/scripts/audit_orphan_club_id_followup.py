"""
AUDIT LECTURE-SEULE — Follow-up des orphelins `club_id` détectés après Sprint
Hardening (12/05/2026) et après la migration F.3 (`migrate_orphan_club_id.py`).

Contexte
--------
Le 12/05/2026, le Sprint Hardening a clôturé avec **0 orphelin** sur 15
collections critiques. Le 19/05/2026, le digest CRON enrichi a re-détecté
**5 orphelins** au passage de l'audit live preview. Cette divergence peut
provenir de :

  - REGRESSION_CODE  : nouvel endpoint sans `club_id`, créé entre 12/05 et 18/05
  - PREVIEW_NOISE    : test data (préfixe `_TEMP_TEST_*`, email `*@example.com`,
                       ...) laissé après tests Antoine ou Emergent
  - HISTORICAL_MISS  : doc plus ancien que 12/05 mais non détecté par l'audit
                       d'origine (faux négatif ; concerne uniquement les
                       collections HORS scope de la migration F.3 — qui ne
                       traitait que `activity_logs / member_renewals /
                       annual_reviews`).

Garde-fous
----------
- LECTURE SEULE STRICTE. Aucune écriture sur la base.
- 0 occurrence de `insert_one|update_one|delete_one|replace_one|*_many` (vérifié
  par grep).
- Affiche la cible DB en haut, en gros, avant tout fetch.
- Pas de scan agressif (limite raisonnable, projection minimaliste).

Usage
-----
    cd /app/backend && python scripts/audit_orphan_club_id_followup.py
"""

from __future__ import annotations

import asyncio
import json
import os
import re
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

# Timeline keypoints (UTC, ISO date)
SPRINT_HARDENING_CLOSE = "2026-05-12"
DIGEST_ENRICHED_LIVE = "2026-05-19"  # date où on a vu 5 orphelins ressortir

# Heuristique PREVIEW_NOISE (cas connus dans le projet)
PREVIEW_NOISE_PATTERNS = [
    re.compile(r"_TEMP_TEST_", re.IGNORECASE),
    re.compile(r"^test[._-]", re.IGNORECASE),
    re.compile(r"@example\.(com|org)$", re.IGNORECASE),
    re.compile(r"playwright|cypress|e2e", re.IGNORECASE),
]

OUTPUT_DIR = Path(__file__).resolve().parents[1] / "audit_results"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def _redact_uri(uri: str) -> str:
    if "@" in uri and "://" in uri:
        scheme, rest = uri.split("://", 1)
        if "@" in rest:
            creds, host = rest.split("@", 1)
            if ":" in creds:
                user, _ = creds.split(":", 1)
                return f"{scheme}://{user}:***@{host}"
    return uri


def _banner():
    print("=" * 88)
    print(" AUDIT LECTURE-SEULE — Follow-up orphelins club_id (post-digest 19/05)")
    print("=" * 88)
    print(f"  CIBLE Atlas : {_redact_uri(MONGO_URL)}")
    print(f"  DB          : {DB_NAME}")
    print(f"  CLUB cible  : Versoix ({DEFAULT_CLUB_ID})")
    print(f"  Timeline    : Sprint Hardening close = {SPRINT_HARDENING_CLOSE}")
    print(f"                Digest enrichi live    = {DIGEST_ENRICHED_LIVE}")
    print( "  MODE        : 🟢 READ-ONLY STRICT (aucune mutation)")
    print("=" * 88)


def _str_date(value) -> str | None:
    """Tolérant : extrait YYYY-MM-DD depuis str ISO/datetime/None."""
    if not value:
        return None
    if isinstance(value, datetime):
        return value.date().isoformat()
    s = str(value).strip()
    if not s:
        return None
    return s[:10]


def _classify_timeline(created_at_str: str | None) -> str:
    """Retourne BEFORE_HARDENING / WINDOW_12_18 / AFTER_18 / UNKNOWN."""
    if not created_at_str:
        return "UNKNOWN"
    iso10 = _str_date(created_at_str)
    if not iso10:
        return "UNKNOWN"
    if iso10 < SPRINT_HARDENING_CLOSE:
        return "BEFORE_HARDENING"
    if iso10 < DIGEST_ENRICHED_LIVE:
        return "WINDOW_12_18"
    return "AFTER_18"


def _looks_like_preview_noise(doc: dict) -> bool:
    """Heuristique : cherche un marqueur de test dans les champs textuels du doc."""
    candidates = [
        doc.get("name"), doc.get("client_name"), doc.get("email"),
        doc.get("member_name"), doc.get("note"), doc.get("notes"),
        doc.get("action"), doc.get("description"),
    ]
    for raw in candidates:
        if not raw:
            continue
        s = str(raw)
        for pat in PREVIEW_NOISE_PATTERNS:
            if pat.search(s):
                return True
    return False


def _classify_origin(collection: str, doc: dict, timeline: str,
                     member_known: bool) -> str:
    """Classification grossière de l'origine probable.

    - PREVIEW_NOISE   : marqueurs textuels de test détectés
    - REGRESSION_CODE : créé entre 12/05 et aujourd'hui, pas de marqueur test
    - HISTORICAL_MISS : antérieur à 12/05, n'a pas été détecté en F.3
                        (concerne surtout les collections HORS scope F.3 :
                        F.3 = activity_logs / member_renewals / annual_reviews)
    - UNCLASSIFIED    : timeline UNKNOWN
    """
    if _looks_like_preview_noise(doc):
        return "PREVIEW_NOISE"
    if timeline == "UNKNOWN":
        return "UNCLASSIFIED"
    if timeline == "BEFORE_HARDENING":
        return "HISTORICAL_MISS"
    # WINDOW_12_18 ou AFTER_18 → régression code potentielle
    return "REGRESSION_CODE"


def _pick_relevant_fields(collection: str, doc: dict) -> dict:
    """Retourne un sous-ensemble lisible des champs intéressants du doc."""
    keys = [
        "id", "_id", "member_id", "member_name", "name", "email",
        "client_name", "action", "amount", "type", "status",
        "renewal_date", "review_date", "month", "year",
        "course_id", "coach_id", "instructor", "is_active",
        "created_at", "updated_at",
    ]
    out = {}
    for k in keys:
        if k in doc and doc[k] is not None:
            v = doc[k]
            if hasattr(v, "isoformat"):
                v = v.isoformat()
            elif not isinstance(v, (str, int, float, bool, list, dict)):
                v = str(v)
            out[k] = v
    return out


async def _resolve_member_context(member_id: str | None) -> dict:
    """Cherche le membre lié pour aider à la qualification (lecture seule)."""
    if not member_id:
        return {"found": False, "reason": "no_member_id"}
    m = await db.customer_members.find_one(
        {"id": member_id},
        {"_id": 0, "id": 1, "name": 1, "club_id": 1, "archived_at": 1},
    )
    if not m:
        return {"found": False, "reason": "member_not_in_db"}
    return {
        "found": True,
        "name": m.get("name"),
        "club_id": m.get("club_id"),
        "archived": bool(m.get("archived_at")),
    }


async def _scan_collection(collection: str) -> list[dict]:
    coll = db[collection]
    cursor = coll.find(ORPHAN_FILTER)  # projection complète pour analyse
    docs = await cursor.to_list(length=200)  # cap raisonnable
    rows = []
    for doc in docs:
        # Sérialise ObjectId proprement
        if "_id" in doc:
            doc["_id"] = str(doc["_id"])
        created_at = doc.get("created_at")
        timeline = _classify_timeline(_str_date(created_at))
        member_ctx = await _resolve_member_context(doc.get("member_id"))
        origin = _classify_origin(collection, doc, timeline, member_ctx.get("found", False))
        rows.append({
            "collection": collection,
            "_id": doc.get("_id"),
            "id": doc.get("id"),
            "created_at": str(created_at) if created_at else None,
            "timeline": timeline,
            "origin_class": origin,
            "preview_noise_signal": _looks_like_preview_noise(doc),
            "member_context": member_ctx,
            "doc_fields": _pick_relevant_fields(collection, doc),
        })
    return rows


async def main() -> int:
    _banner()
    print()
    grand_rows: list[dict] = []
    counts_per_collection: dict[str, int] = {}
    for collection in COLLECTIONS:
        rows = await _scan_collection(collection)
        if rows:
            counts_per_collection[collection] = len(rows)
            grand_rows.extend(rows)
            print(f"  [{collection:<27}] {len(rows)} orphelin(s)")
        # Pas de log si 0 (signal trop bruyant à 15 collections)

    if not grand_rows:
        print()
        print("✅ Aucun orphelin détecté sur les 15 collections.")
        print("   (Si le digest CRON en a alerté récemment, ils ont déjà été nettoyés.)")
        return 0

    print()
    print(f"TOTAL orphelins         : {len(grand_rows)}")
    print(f"Collections affectées   : {len(counts_per_collection)}")

    # === Breakdowns ===
    by_timeline = Counter(r["timeline"] for r in grand_rows)
    by_origin = Counter(r["origin_class"] for r in grand_rows)
    by_member_state = Counter(
        ("member_found" if r["member_context"].get("found")
         else r["member_context"].get("reason", "unknown"))
        for r in grand_rows
    )
    by_member_club = Counter(
        r["member_context"].get("club_id") or "—"
        for r in grand_rows if r["member_context"].get("found")
    )

    print()
    print("─── BREAKDOWN PAR TIMELINE ───────────────────────────────────────────")
    for t, n in sorted(by_timeline.items(), key=lambda x: -x[1]):
        print(f"  · {t:<22} : {n}")

    print()
    print("─── BREAKDOWN PAR ORIGINE PROBABLE ───────────────────────────────────")
    for o, n in sorted(by_origin.items(), key=lambda x: -x[1]):
        print(f"  · {o:<22} : {n}")

    print()
    print("─── BREAKDOWN PAR ÉTAT DU MEMBRE LIÉ ─────────────────────────────────")
    for st, n in sorted(by_member_state.items(), key=lambda x: -x[1]):
        print(f"  · {st:<22} : {n}")
    if by_member_club:
        print("  → club_id du membre quand il existe :")
        for c, n in sorted(by_member_club.items(), key=lambda x: -x[1]):
            badge = "✅ Versoix" if c == DEFAULT_CLUB_ID else f"⚠️ {c[:8]}..." if c != "—" else "—"
            print(f"      {c[:36]:<36} ({n}) {badge}")

    # === Détail par doc ===
    print()
    print("─── DÉTAIL PAR ORPHELIN ──────────────────────────────────────────────")
    for r in grand_rows:
        mctx = r["member_context"]
        mlabel = mctx.get("name") or mctx.get("reason") or "—"
        if mctx.get("found"):
            mlabel = f"{mlabel} [club={(mctx.get('club_id') or '—')[:8]}{'…' if mctx.get('club_id') else ''}]"
        fields = r["doc_fields"]
        compact = ", ".join(
            f"{k}={str(v)[:25]}"
            for k, v in fields.items()
            if k not in ("_id", "id", "member_id", "created_at", "updated_at", "member_name")
        )
        compact = compact[:120]
        print(
            f"  [{r['collection']}]\n"
            f"    _id={r['_id']} id={r['id']} created={r['created_at'] or '—'}\n"
            f"    timeline={r['timeline']} | origin={r['origin_class']} | noise={r['preview_noise_signal']}\n"
            f"    member={mlabel}\n"
            f"    fields={compact}"
        )

    # === Recommandations ===
    print()
    print("─── RECOMMANDATIONS ──────────────────────────────────────────────────")
    if by_origin.get("PREVIEW_NOISE", 0):
        print(f"  🧹 {by_origin['PREVIEW_NOISE']} PREVIEW_NOISE → cleanup script ad-hoc,")
        print("     puis re-run l'audit. NE PAS migrer vers Versoix (pollution).")
    if by_origin.get("REGRESSION_CODE", 0):
        print(f"  🐛 {by_origin['REGRESSION_CODE']} REGRESSION_CODE → tracer l'endpoint")
        print("     créateur (timeline >= 12/05). Ouvrir ticket P1 patch + test régression.")
    if by_origin.get("HISTORICAL_MISS", 0):
        print(f"  📜 {by_origin['HISTORICAL_MISS']} HISTORICAL_MISS → ces docs sont")
        print("     antérieurs au Sprint Hardening F.3 (qui n'a touché que 3 collections).")
        print("     Étendre migrate_orphan_club_id.py aux collections concernées,")
        print("     ou archiver les docs si tracking impossible.")
    if by_origin.get("UNCLASSIFIED", 0):
        print(f"  ❓ {by_origin['UNCLASSIFIED']} UNCLASSIFIED → created_at absent,")
        print("     examen manuel requis.")

    # === Output JSON ===
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    out_path = OUTPUT_DIR / f"orphan_club_id_followup_{ts}.json"
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "db": DB_NAME,
        "default_club_id": DEFAULT_CLUB_ID,
        "timeline_anchors": {
            "sprint_hardening_close": SPRINT_HARDENING_CLOSE,
            "digest_enriched_live": DIGEST_ENRICHED_LIVE,
        },
        "summary": {
            "total_orphans": len(grand_rows),
            "collections_affected": counts_per_collection,
            "by_timeline": dict(by_timeline),
            "by_origin_class": dict(by_origin),
            "by_member_state": dict(by_member_state),
        },
        "orphans": grand_rows,
    }
    with out_path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2, default=str)
    print()
    print(f"[JSON output] {out_path}")
    print(f"  Size : {out_path.stat().st_size} bytes")
    print()
    print("[FIN] Audit terminé. AUCUNE MUTATION effectuée.")
    return 0


if __name__ == "__main__":
    try:
        rc = asyncio.run(main())
    finally:
        client.close()
    sys.exit(rc)
