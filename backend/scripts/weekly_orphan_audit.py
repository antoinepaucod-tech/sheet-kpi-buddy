"""
Standalone wrapper to run the weekly orphan audit.

Usage:
    PYTHONPATH=/app/backend python3 -m scripts.weekly_orphan_audit
    PYTHONPATH=/app/backend python3 -m scripts.weekly_orphan_audit --force-email

Notes :
  - Lecture seule. Aucun document modifié.
  - Si ORPHAN_AUDIT_RECIPIENT est vide → audit run mais aucun email (kill switch).
  - --force-email envoie même si 0 orphelin (utile pour tester le pipeline).
"""
import argparse
import asyncio
import json
import logging

from services.orphan_audit import run_weekly_orphan_audit


logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--force-email", action="store_true", help="Envoyer email même si 0 orphelin")
    args = parser.parse_args()
    result = await run_weekly_orphan_audit(force_email=args.force_email)
    print("\n=== AUDIT RESULT ===")
    print(json.dumps({k: v for k, v in result.items() if k != "report"}, indent=2, default=str))
    if result.get("report"):
        print("\n=== REPORT ===")
        for r in result["report"]:
            print(f"  {r['collection']:<28} null={r['null_count']:<5} total={r['total']:<6} {r['pct_orphan']}%")


if __name__ == "__main__":
    asyncio.run(main())
