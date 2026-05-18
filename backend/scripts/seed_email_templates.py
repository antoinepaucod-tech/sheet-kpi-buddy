"""Seed `email_templates` collection on Atlas with v1 renewal_reminder.

Pattern Sprint A : --dry-run par défaut, --apply avec confirmation interactive.

La version V1 seedée est EXTRAITE char-par-char de `core/notifications.py`
via la technique des sentinelles :

  1. On appelle `renewal_reminder_template()` avec des sentinelles uniques
     (`JinjaFirstSentinel`, `JinjaClubSentinel`, etc.)
  2. Les sentinelles sont substituées dans le HTML rendu
  3. On remplace `JINJAFIRSTSENTINEL` (uppercase) par `{{ first|upper }}`
     AVANT de remplacer `JinjaFirstSentinel` par `{{ first }}` — ordre
     critique pour éviter d'avaler la version uppercase

Résultat : un Jinja template byte-équivalent à `renewal_reminder_template()`
quand rendu avec le même context.

Usage :
    python scripts/seed_email_templates.py            # dry-run
    python scripts/seed_email_templates.py --apply    # apply (confirmation 'yes')
"""
from __future__ import annotations

import argparse
import asyncio
import os
import re
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.config import db, MONGO_URL, DB_NAME  # noqa: E402
from core.email_templates import ensure_indexes, render_template  # noqa: E402
from core.notifications import renewal_reminder_template  # noqa: E402


TEMPLATE_KEY = "renewal_reminder"
TEMPLATE_VERSION = 1


# Sentinelles uniques pour extraction par substitution.
# Mixed-case → distinct de leur .upper().
_SENT_FIRST = "JinjaFirstSentinel"
_SENT_CLUB = "JinjaClubNameSentinel"
_SENT_WA = "JinjaWhatsappUrlSentinel"
_SENT_UNSUB = "JinjaUnsubscribeUrlSentinel"


def _ascii_banner(text: str, char: str = "=") -> str:
    line = char * 70
    return f"{line}\n  {text}\n{line}"


def _print_target_db():
    print(_ascii_banner("CIBLE MONGODB ATLAS"))
    print(f"  MONGO_URL  : {MONGO_URL[:55]}...")
    print(f"  DB_NAME    : {DB_NAME}")
    print(f"  COLLECTION : email_templates")
    print(f"  TEMPLATE   : {TEMPLATE_KEY} (version={TEMPLATE_VERSION}, club_id=NULL)")
    print(_ascii_banner("", "="))


def extract_jinja_template() -> dict:
    """Extrait subject + html Jinja-compatibles depuis notifications.py V3.

    Returns:
        {
            "subject": "{{ first }}, on ne t'a pas vu cette semaine 👀",
            "html_body": "<!DOCTYPE html>...{{ first|upper }}...{{ club_name }}...",
            "text_body": "",
            "variables_found": [...],
        }
    """
    subject_raw, html_raw = renewal_reminder_template(
        member_name=f"{_SENT_FIRST} Lastname",
        club_name=_SENT_CLUB,
        unsubscribe_url=_SENT_UNSUB,
        whatsapp_url=_SENT_WA,
    )

    # Ordre critique : remplacer la version UPPER avant la version mixed-case
    # (sinon le .replace(mixed_case) "consomme" et la version upper n'est plus présente)
    def _to_jinja(s: str) -> str:
        return (
            s
            .replace(_SENT_FIRST.upper(), "{{ first|upper }}")
            .replace(_SENT_FIRST, "{{ first }}")
            .replace(_SENT_CLUB.upper(), "{{ club_name|upper }}")
            .replace(_SENT_CLUB, "{{ club_name }}")
            .replace(_SENT_WA, "{{ whatsapp_url }}")
            .replace(_SENT_UNSUB, "{{ unsubscribe_url }}")
        )

    subject_j = _to_jinja(subject_raw)
    html_j = _to_jinja(html_raw)

    # Grep exhaustif des placeholders Jinja2 du résultat
    placeholders = sorted(set(re.findall(r"\{\{\s*([a-zA-Z_][\w\|\s]*?)\s*\}\}", subject_j + " " + html_j)))
    # On nettoie les filtres (`first|upper` → `first`)
    variables = sorted({p.split("|")[0].strip() for p in placeholders})

    return {
        "subject": subject_j,
        "html_body": html_j,
        "text_body": "",
        "placeholders_found": placeholders,
        "variables": variables,
    }


def _sample_context() -> dict:
    """Context représentatif pour diff char-par-char (Manon + Hybrid Gym Geneva)."""
    return {
        "first": "Manon",
        "club_name": "Hybrid Gym Geneva",
        "whatsapp_url": "https://wa.me/41774966626?text=Salut%20%21%20Je%20veux%20renouveler%20mon%20abonnement%20%F0%9F%92%AA",
        "unsubscribe_url": "https://club.transform-os.ch/api/marketing/unsubscribe?token=PREVIEW_TOKEN",
    }


def diff_check(extracted: dict) -> dict:
    """Test diff char-par-char : seed render == V3 fallback render. Aucun écrit DB.

    Returns:
        {"subject_ok": bool, "html_ok": bool, "first_diff": str | None}
    """
    ctx = _sample_context()
    # Render via Jinja avec doc seed
    seed_doc = {
        "subject": extracted["subject"],
        "html_body": extracted["html_body"],
        "text_body": "",
    }
    seed_rendered = render_template(seed_doc, ctx)

    # Render via V3 fallback (notifications.py direct)
    v3_subject, v3_html = renewal_reminder_template(
        member_name=ctx["first"] + " Lastname",
        club_name=ctx["club_name"],
        whatsapp_url=ctx["whatsapp_url"],
        unsubscribe_url=ctx["unsubscribe_url"],
    )

    subject_ok = seed_rendered["subject"] == v3_subject
    html_ok = seed_rendered["html"] == v3_html

    first_diff = None
    if not html_ok:
        # Trouver la 1ère différence pour debug
        for i, (a, b) in enumerate(zip(seed_rendered["html"], v3_html)):
            if a != b:
                start = max(0, i - 30)
                end = min(len(seed_rendered["html"]), i + 30)
                first_diff = (
                    f"position {i}:\n"
                    f"  SEED: ...{seed_rendered['html'][start:end]!r}...\n"
                    f"  V3:   ...{v3_html[start:end]!r}...\n"
                )
                break
        if first_diff is None:
            # Longueurs différentes
            first_diff = f"length mismatch: seed={len(seed_rendered['html'])} vs v3={len(v3_html)}"

    return {
        "subject_ok": subject_ok,
        "html_ok": html_ok,
        "subject_seed": seed_rendered["subject"],
        "subject_v3": v3_subject,
        "first_diff": first_diff,
    }


async def audit_existing() -> list:
    """Lecture seule : list les templates existants pour template_key=renewal_reminder."""
    cursor = db.email_templates.find(
        {"template_key": TEMPLATE_KEY},
        {"_id": 0, "id": 1, "template_key": 1, "club_id": 1, "version": 1, "is_active": 1, "created_at": 1},
    )
    return await cursor.to_list(length=None)


async def main():
    parser = argparse.ArgumentParser(description="Seed email_templates collection")
    parser.add_argument("--apply", action="store_true", help="Exécute l'insert (sinon dry-run)")
    args = parser.parse_args()

    _print_target_db()
    mode = "APPLY" if args.apply else "DRY-RUN"
    print(f"\n  MODE : {mode}\n")

    # ── 1. Extraction Jinja
    print("[1] Extraction du template V3 → Jinja2")
    extracted = extract_jinja_template()
    print(f"  · subject (Jinja)  : {extracted['subject']!r}")
    print(f"  · html_body length : {len(extracted['html_body'])} chars")
    print(f"  · text_body length : {len(extracted['text_body'])} chars")

    # ── 2. Grep placeholders
    print("\n[2] Grep placeholders Jinja2")
    print(f"  · raw placeholders : {extracted['placeholders_found']}")
    print(f"  · variables (union): {extracted['variables']}")
    declared_variables = ["first", "club_name", "whatsapp_url", "unsubscribe_url"]
    if set(extracted['variables']) == set(declared_variables):
        print(f"  · ✓ STRICT UNION = ÉGALITÉ avec variables déclarées : {declared_variables}")
    else:
        print(f"  ⚠ DIVERGENCE : déclarées={declared_variables} vs trouvées={extracted['variables']}")

    # ── 3. Diff char-par-char
    print("\n[3] Diff char-par-char : render(seed_doc, ctx) == V3 fallback(ctx)")
    diff = diff_check(extracted)
    print(f"  · subject_ok : {diff['subject_ok']}")
    print(f"  · html_ok    : {diff['html_ok']}")
    if not diff['subject_ok']:
        print(f"    seed = {diff['subject_seed']!r}")
        print(f"    v3   = {diff['subject_v3']!r}")
    if not diff['html_ok']:
        print(f"    first_diff:\n{diff['first_diff']}")
        print("\n  ✗ ABORT : diff détectée, ne pas appliquer tant que non corrigé")
        sys.exit(1)
    print("  · ✓ DIFF VIDE — render seed identique au render V3")

    # ── 4. Construct full doc
    now_iso = datetime.now(timezone.utc).isoformat()
    from uuid import uuid4
    doc = {
        "id": str(uuid4()),
        "template_key": TEMPLATE_KEY,
        "club_id": None,  # global
        "version": TEMPLATE_VERSION,
        "is_active": True,
        "subject": extracted["subject"],
        "html_body": extracted["html_body"],
        "text_body": extracted["text_body"],
        "variables": declared_variables,
        "metadata": {
            "description": "Renewal reminder email pour membres expirés. Migré depuis notifications.py V3.",
            "source": "migrated_from_notifications.py_v3",
            "migrated_at": now_iso,
            "brand": "Hybrid Gym Geneva (dark mode v3)",
        },
        "created_at": now_iso,
        "updated_at": now_iso,
    }

    print("\n[4] Document à insérer (pretty-print, sans html_body complet pour lisibilité)")
    for k in ["id", "template_key", "club_id", "version", "is_active", "subject"]:
        print(f"  · {k} = {doc[k]!r}")
    print(f"  · html_body : <{len(doc['html_body'])} chars>")
    print(f"  · text_body : <{len(doc['text_body'])} chars>")
    print(f"  · variables : {doc['variables']}")
    print(f"  · metadata  : {doc['metadata']}")

    # ── 5. Audit existing
    print("\n[5] Audit collection email_templates (renewal_reminder)")
    existing = await audit_existing()
    print(f"  · {len(existing)} doc(s) existant(s) :")
    for e in existing:
        print(f"    - id={e.get('id')[:8]}... version={e.get('version')} club_id={e.get('club_id')} active={e.get('is_active')}")

    conflict = next((e for e in existing if e.get("club_id") is None and e.get("version") == TEMPLATE_VERSION), None)

    # ── DRY-RUN exit
    if not args.apply:
        if conflict:
            print(f"\n  ⚠ DRY-RUN : un doc existe déjà ({conflict.get('id')[:8]}...) → SKIP attendu sur --apply")
        else:
            print("\n  → DRY-RUN : doc serait INSÉRÉ (aucun conflict)")
        print("\nRelance avec --apply (confirmation 'yes') pour exécuter.")
        return

    # ── APPLY
    if conflict:
        print(f"\n[6] APPLY → SKIP (idempotence) : doc existant {conflict.get('id')[:8]}... v{conflict.get('version')} club_id=NULL")
        return

    ans = input(
        "\nConfirme l'insertion sur cette cible Atlas ? Tape 'yes' pour valider : "
    ).strip().lower()
    if ans != "yes":
        print("Annulé.")
        return

    # Ensure indexes (idempotent)
    print("\n[6a] Ensure indexes...")
    await ensure_indexes(db)
    print("  · index email_templates_resolver_idx OK")

    print("\n[6b] Insert doc...")
    await db.email_templates.insert_one(dict(doc))
    print(f"  · inserted id = {doc['id']}")

    # ── 7. Post-insert verification : re-run diff char-par-char SUR LE DOC DB RÉEL
    print("\n[7] POST-INSERT : verify diff sur le doc DB réel")
    db_doc = await db.email_templates.find_one(
        {"id": doc["id"]}, {"_id": 0}
    )
    if not db_doc:
        print("  ✗ ABORT : doc inséré introuvable post-fetch")
        sys.exit(1)

    ctx = _sample_context()
    db_rendered = render_template(db_doc, ctx)
    v3_subject, v3_html = renewal_reminder_template(
        member_name=ctx["first"] + " Lastname",
        club_name=ctx["club_name"],
        whatsapp_url=ctx["whatsapp_url"],
        unsubscribe_url=ctx["unsubscribe_url"],
    )
    print(f"  · subject == V3 : {db_rendered['subject'] == v3_subject}")
    print(f"  · html    == V3 : {db_rendered['html'] == v3_html}")

    total = await db.email_templates.count_documents({})
    print(f"\n[8] State final email_templates :")
    print(f"  · total docs in collection: {total}")
    print(f"  · seeded doc _id: {doc['id']}")


if __name__ == "__main__":
    asyncio.run(main())
