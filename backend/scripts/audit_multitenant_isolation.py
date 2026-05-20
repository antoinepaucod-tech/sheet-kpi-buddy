"""AUDIT STATIQUE LECTURE-SEULE — Isolation multi-tenant club_id.

But
---
Cartographier toutes les opérations MongoDB du code backend qui ne scopent
PAS par `club_id`, en vue de la commercialisation Transform OS Club Management
à des clubs externes (Servette, Saconnex, Lausanne, futurs SaaS).

Méthode
-------
Analyse AST statique (pas de regex fragile) de tous les .py sous routers/,
services/, core/, scripts/. Pour chaque appel `db.X.<op>(filter, ...)` :
  - Extrait la collection, l'opération, le filter brut
  - Détecte si le filter "mentionne" club_id (clé directe, helper `_cq`,
    spread de variable ORPHAN_FILTER, etc.)
  - Classifie par criticité :
      🔴 CATASTROPHIQUE_CROSS_CLUB  : delete_many/update_many sans club_id
      🟠 FUITE_READ                  : find/aggregate/count sans club_id
      🟡 MOYEN_DOC_WRONG             : delete_one/update_one/find_one sans club_id
      🟢 SAFE                        : club_id présent (direct ou via helper)
      ⚪ OUT_OF_SCOPE                : scripts/ one-shot manuels
  - Capture l'endpoint HTTP englobant si trouvable (décorateur @router.METHOD)

0 mutation, 0 query DB. 100% statique. Output JSON + Markdown.
"""
from __future__ import annotations

import ast
import json
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
SCAN_DIRS = ["routers", "services", "core", "scripts"]

OUTPUT_DIR = BACKEND / "audit_results"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Opérations sensibles MongoDB (Motor)
WRITE_OPS_BULK = {"delete_many", "update_many"}
WRITE_OPS_SINGLE = {"delete_one", "update_one", "find_one_and_update",
                    "find_one_and_delete", "find_one_and_replace", "replace_one"}
READ_OPS_BULK = {"find", "aggregate", "count_documents", "distinct"}
READ_OPS_SINGLE = {"find_one"}
ALL_OPS = WRITE_OPS_BULK | WRITE_OPS_SINGLE | READ_OPS_BULK | READ_OPS_SINGLE

# Patterns de "filter contient club_id" (heuristique large)
SAFE_HELPERS = {"_cq", "_q"}  # helpers projet qui injectent club_id
SAFE_VARIABLES = {"ORPHAN_FILTER"}  # ORPHAN_FILTER scanne TOUS les clubs volontairement
# Note : ORPHAN_FILTER cible {club_id: null} — c'est intentionnel pour audit, donc SAFE
# au sens "comportement attendu", pas "scopé par club".


# ──────────────────────────── Helpers ────────────────────────────────────


def _filter_mentions_club_id(node: ast.AST | None) -> tuple[bool, str]:
    """Détecte si l'AST du filter mentionne club_id.

    Returns (has_club_id, evidence).
    """
    if node is None:
        return False, "no_filter"

    # Cas direct : dict literal {"club_id": ...} ou {..., "club_id": ...}
    if isinstance(node, ast.Dict):
        for key in node.keys:
            if isinstance(key, ast.Constant) and key.value == "club_id":
                return True, "direct_key"
        # spread via **var n'existe pas en literal ; check empty dict
        if not node.keys:
            return False, "empty_dict"
        return False, "dict_without_club_id"

    # Cas appel helper : _cq(...), _q(...)
    if isinstance(node, ast.Call):
        func_name = _call_name(node)
        if func_name in SAFE_HELPERS:
            return True, f"helper:{func_name}"
        return False, f"call:{func_name}"

    # Cas variable : difficile à tracer en statique, on marque "à confirmer"
    if isinstance(node, ast.Name):
        if node.id in SAFE_VARIABLES:
            return False, f"variable:{node.id}_intentional_no_club_id"
        return False, f"variable:{node.id}_unconfirmed"

    # Concat avec ** ou autre
    return False, f"complex:{type(node).__name__}"


def _call_name(node: ast.Call) -> str:
    func = node.func
    if isinstance(func, ast.Attribute):
        return func.attr
    if isinstance(func, ast.Name):
        return func.id
    return "<unknown>"


def _is_db_call(node: ast.Call) -> tuple[bool, str, str]:
    """Détecte si le call est `db.<collection>.<op>(...)`.

    Returns (matched, collection, op).
    """
    func = node.func
    if not isinstance(func, ast.Attribute):
        return False, "", ""
    op = func.attr
    if op not in ALL_OPS:
        return False, "", ""
    # func.value devrait être db.<collection>
    parent = func.value
    if not isinstance(parent, ast.Attribute):
        return False, "", ""
    collection = parent.attr
    # parent.value doit être Name(db) ou similaire
    grand = parent.value
    if isinstance(grand, ast.Name) and grand.id in ("db",):
        return True, collection, op
    # Cas `client[DB_NAME].<coll>.<op>` ou autre : trop complexe, skip
    return False, "", ""


def _criticality(op: str, has_club_id: bool, file_subdir: str) -> str:
    if file_subdir == "scripts":
        return "OUT_OF_SCOPE"
    if has_club_id:
        return "SAFE"
    if op in WRITE_OPS_BULK:
        return "CATASTROPHIQUE_CROSS_CLUB"
    if op in WRITE_OPS_SINGLE:
        return "MOYEN_DOC_WRONG"
    if op in READ_OPS_BULK:
        return "FUITE_READ"
    if op in READ_OPS_SINGLE:
        return "MOYEN_DOC_WRONG"
    return "UNKNOWN"


def _emoji(crit: str) -> str:
    return {
        "CATASTROPHIQUE_CROSS_CLUB": "🔴",
        "FUITE_READ": "🟠",
        "MOYEN_DOC_WRONG": "🟡",
        "SAFE": "🟢",
        "OUT_OF_SCOPE": "⚪",
    }.get(crit, "❓")


def _effort(op: str, crit: str) -> str:
    if crit == "CATASTROPHIQUE_CROSS_CLUB":
        return "moyen"  # ajout scope filter + tests
    if crit in ("FUITE_READ", "MOYEN_DOC_WRONG"):
        return "trivial"
    return "n/a"


# ─────────────────── Visitor : capture endpoints + calls ─────────────────


class _FunctionContext:
    def __init__(self, name: str, line: int):
        self.name = name
        self.line = line
        self.has_depends_club_id = False
        self.has_depends_current_user = False
        self.http_route: str | None = None


def _func_signature_features(func_node: ast.FunctionDef | ast.AsyncFunctionDef) -> dict:
    has_club = False
    has_user = False
    for arg in func_node.args.args + func_node.args.kwonlyargs:
        # arg.annotation peut être Optional[str] ou autre, on lit le default
        pass
    # Check defaults pour Depends(...)
    defaults = list(func_node.args.defaults) + list(func_node.args.kw_defaults)
    for d in defaults:
        if isinstance(d, ast.Call) and _call_name(d) == "Depends" and d.args:
            target = _call_name(d.args[0]) if isinstance(d.args[0], ast.Call) else (
                d.args[0].id if isinstance(d.args[0], ast.Name) else ""
            )
            if target == "get_club_id":
                has_club = True
            elif target == "get_current_user":
                has_user = True
    # Check HTTP route via decorators
    route = None
    for deco in func_node.decorator_list:
        if isinstance(deco, ast.Call) and isinstance(deco.func, ast.Attribute):
            method = deco.func.attr  # "post", "get", "put", "delete"
            if method in ("get", "post", "put", "delete", "patch"):
                if deco.args and isinstance(deco.args[0], ast.Constant):
                    route = f"{method.upper()} {deco.args[0].value}"
                else:
                    route = f"{method.upper()} ?"
    return {
        "has_depends_club_id": has_club,
        "has_depends_current_user": has_user,
        "http_route": route,
    }


def _scan_file(path: Path) -> list[dict]:
    rel = path.relative_to(BACKEND)
    subdir = rel.parts[0] if rel.parts else ""
    try:
        source = path.read_text(encoding="utf-8")
        tree = ast.parse(source, filename=str(path))
    except (SyntaxError, UnicodeDecodeError):
        return []

    # Map line → enclosing function context
    func_by_line: dict[int, dict] = {}
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            feats = _func_signature_features(node)
            feats["name"] = node.name
            # Cover whole function body lines
            start = node.lineno
            end = getattr(node, "end_lineno", start)
            for ln in range(start, (end or start) + 1):
                func_by_line[ln] = feats

    results = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        matched, collection, op = _is_db_call(node)
        if not matched:
            continue
        # Premier argument = filter
        filter_arg = node.args[0] if node.args else None
        has_club_id, evidence = _filter_mentions_club_id(filter_arg)
        ctx = func_by_line.get(node.lineno, {})
        crit = _criticality(op, has_club_id, subdir)
        results.append({
            "file": str(rel),
            "line": node.lineno,
            "collection": collection,
            "operation": op,
            "has_club_id_in_filter": has_club_id,
            "filter_evidence": evidence,
            "function": ctx.get("name"),
            "http_route": ctx.get("http_route"),
            "has_depends_club_id": ctx.get("has_depends_club_id", False),
            "has_depends_current_user": ctx.get("has_depends_current_user", False),
            "criticality": crit,
            "emoji": _emoji(crit),
            "effort": _effort(op, crit),
        })
    return results


# ────────────────────────────── Main ─────────────────────────────────────


def main() -> int:
    all_findings: list[dict] = []
    for sub in SCAN_DIRS:
        base = BACKEND / sub
        if not base.exists():
            continue
        for py in base.rglob("*.py"):
            if "__pycache__" in py.parts or py.name.startswith("test_"):
                continue
            all_findings.extend(_scan_file(py))

    # Stats
    by_crit = Counter(f["criticality"] for f in all_findings)
    by_op = Counter(f["operation"] for f in all_findings)
    by_file = Counter(f["file"] for f in all_findings)
    top_files_exposed = Counter(
        f["file"] for f in all_findings
        if f["criticality"] in ("CATASTROPHIQUE_CROSS_CLUB", "FUITE_READ", "MOYEN_DOC_WRONG")
    )

    # Effort cumulé
    effort_units = {"trivial": 5, "moyen": 15, "complexe": 30, "n/a": 0}
    cumulated_minutes = sum(
        effort_units.get(f["effort"], 0)
        for f in all_findings
        if f["criticality"] in ("CATASTROPHIQUE_CROSS_CLUB", "FUITE_READ", "MOYEN_DOC_WRONG")
    )

    ts_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    payload = {
        "audit_date": datetime.now(timezone.utc).isoformat(),
        "scope_dirs": SCAN_DIRS,
        "total_call_sites": len(all_findings),
        "by_criticality": dict(by_crit),
        "by_operation": dict(by_op),
        "top_5_files_exposed": top_files_exposed.most_common(5),
        "cumulated_effort_minutes": cumulated_minutes,
        "findings": all_findings,
    }
    json_path = OUTPUT_DIR / f"multitenant_isolation_audit_{ts_str}.json"
    json_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False, default=str))

    # ── Markdown report ──
    md = [
        "# 🛡️ Audit isolation multi-tenant `club_id` — Backend",
        "",
        f"**Audit date** : {payload['audit_date']}",
        f"**Scope** : `{', '.join(SCAN_DIRS)}` (tests exclus)",
        "",
        "## 1. Executive summary",
        "",
    ]
    cata = by_crit.get("CATASTROPHIQUE_CROSS_CLUB", 0)
    leak = by_crit.get("FUITE_READ", 0)
    medium = by_crit.get("MOYEN_DOC_WRONG", 0)
    safe = by_crit.get("SAFE", 0)
    oos = by_crit.get("OUT_OF_SCOPE", 0)
    md.append(
        f"Sur **{payload['total_call_sites']} call sites MongoDB** scannés via AST statique : "
        f"**🔴 {cata} catastrophiques** (delete/update_many cross-club), "
        f"**🟠 {leak} fuites read** (find/aggregate sans scope), "
        f"**🟡 {medium} moyens** (find_one/delete_one/update_one sans scope), "
        f"**🟢 {safe} safe**, **⚪ {oos} hors scope** (scripts manuels). "
        f"Effort cumulé patch estimé : **~{cumulated_minutes} min** "
        f"(~{cumulated_minutes // 60}h{cumulated_minutes % 60:02d})."
    )
    md.append("")
    md.append("## 2. Métriques globales")
    md.append("")
    md.append("| Criticité | Count |")
    md.append("|---|---|")
    for crit, n in by_crit.most_common():
        md.append(f"| {_emoji(crit)} {crit} | {n} |")
    md.append("")
    md.append("| Opération | Count |")
    md.append("|---|---|")
    for op, n in by_op.most_common():
        md.append(f"| `{op}` | {n} |")
    md.append("")
    md.append("### Top 5 fichiers les plus exposés (🔴+🟠+🟡)")
    md.append("")
    md.append("| Fichier | Call sites à risque |")
    md.append("|---|---|")
    for f, n in top_files_exposed.most_common(5):
        md.append(f"| `{f}` | {n} |")
    md.append("")

    for crit_label, crit_name in [
        ("🔴 CATASTROPHIQUE_CROSS_CLUB (priorité 1)", "CATASTROPHIQUE_CROSS_CLUB"),
        ("🟠 FUITE_READ (priorité 2)", "FUITE_READ"),
        ("🟡 MOYEN_DOC_WRONG (priorité 3)", "MOYEN_DOC_WRONG"),
    ]:
        items = [f for f in all_findings if f["criticality"] == crit_name]
        if not items:
            continue
        md.append(f"## 3. {crit_label}")
        md.append("")
        md.append("| Fichier:ligne | Coll | Op | Endpoint | club_id Depends ? | filter |")
        md.append("|---|---|---|---|---|---|")
        for f in sorted(items, key=lambda x: (x["file"], x["line"])):
            route = f.get("http_route") or f.get("function") or "—"
            depends = "✅" if f["has_depends_club_id"] else "❌"
            md.append(
                f"| `{f['file']}:{f['line']}` | `{f['collection']}` | `{f['operation']}` | "
                f"{route} | {depends} | {f['filter_evidence']} |"
            )
        md.append("")

    # 4. Recommandations patch
    md.append("## 4. Recommandations patch (regroupé par fichier)")
    md.append("")
    by_file_risky = defaultdict(list)
    for f in all_findings:
        if f["criticality"] in ("CATASTROPHIQUE_CROSS_CLUB", "FUITE_READ", "MOYEN_DOC_WRONG"):
            by_file_risky[f["file"]].append(f)
    for fname in sorted(by_file_risky.keys()):
        items = by_file_risky[fname]
        cata_n = sum(1 for i in items if i["criticality"] == "CATASTROPHIQUE_CROSS_CLUB")
        leak_n = sum(1 for i in items if i["criticality"] == "FUITE_READ")
        med_n = sum(1 for i in items if i["criticality"] == "MOYEN_DOC_WRONG")
        md.append(f"### `{fname}` — 🔴{cata_n} 🟠{leak_n} 🟡{med_n}")
        for i in items:
            md.append(
                f"- {_emoji(i['criticality'])} L{i['line']} `{i['collection']}.{i['operation']}` "
                f"({i['filter_evidence']}) — endpoint: {i.get('http_route') or i.get('function')}"
            )
        md.append("")

    md.append("## 5. Effort estimé cumulé")
    md.append("")
    md.append(f"- 🔴 patches : ~15min × {cata} = {cata * 15}min")
    md.append(f"- 🟠 patches : ~5min × {leak} = {leak * 5}min")
    md.append(f"- 🟡 patches : ~5min × {medium} = {medium * 5}min")
    md.append(f"- **Total** : ~{cumulated_minutes}min ({cumulated_minutes // 60}h{cumulated_minutes % 60:02d})")
    md.append("")
    md.append("> ⚠️ Effort patches uniquement. Tests régression à ajouter en parallèle (~50% de l'effort patch).")

    md_path = OUTPUT_DIR / f"multitenant_isolation_audit_{ts_str}.md"
    md_path.write_text("\n".join(md))

    # Console summary
    print("=" * 80)
    print(" AUDIT STATIQUE — Isolation multi-tenant club_id")
    print("=" * 80)
    print(f"Scope dirs       : {SCAN_DIRS}")
    print(f"Total call sites : {payload['total_call_sites']}")
    print()
    for crit, n in by_crit.most_common():
        print(f"  {_emoji(crit)} {crit:<28} : {n}")
    print()
    print(f"Cumulated effort : ~{cumulated_minutes} min "
          f"(~{cumulated_minutes // 60}h{cumulated_minutes % 60:02d})")
    print()
    print(f"[JSON] {json_path}")
    print(f"[MD]   {md_path}")
    print()
    print("[FIN] Audit terminé. 0 mutation effectuée.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
