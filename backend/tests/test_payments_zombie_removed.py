"""Tests régression Phase 5 Batch 1.B Sub B.3b — suppression des 2 endpoints
zombies de `routers/payments.py` (audit SB B.3a — ZOMBIE_CONFIRMED) :
  - PUT `/api/payment-schedules/{id}` (ex-L62-70 `update_payment_schedule`)
  - PUT `/api/payments/{id}`           (ex-L541-551 `update_payment`)

Approche κ : inspection directe du registry FastAPI (`app.routes`) plutôt
qu'appel HTTP via TestClient. Évite l'ambiguïté HTTP 404 (route inconnue vs
handler métier "introuvable") et les problèmes asyncio TestClient + Motor.

Justification suppression (cf. rapport B.3a) :
  - 0 trace sur 9 zones investiguées (backend, frontend, scripts, tests,
    docs, logs preview).
  - Couverture fonctionnelle assurée par d'autres endpoints
    (`members.py` cascade, `sync-with-members`, `mark-paid`, `revert-to-unpaid`,
    `notifications.py`).
  - L62 acceptait `body: dict` ouvert → vulnérabilité mass assignment.
  - L541 ne déclenchait aucun side-effect (transaction, KPI, notif).

Git tag rollback : `pre-batch-1b-zombie-removal`.
"""
from __future__ import annotations

import pytest

from server import app


pytestmark = [pytest.mark.regression]


def test_put_payment_schedule_endpoint_removed():
    """Garantie : PUT /api/payment-schedules/{id} n'est PLUS déclaré dans le
    routeur FastAPI (zombie supprimé Batch 1.B SB B.3b). On inspecte
    directement le registry pour éviter l'ambiguïté HTTP 404 (route inconnue
    vs handler métier "introuvable").

    RED tant que la route PUT est encore déclarée.
    GREEN après suppression L62-70.
    """
    methods_on_path = set()
    for route in app.routes:
        if getattr(route, "path", None) == "/api/payment-schedules/{schedule_id}":
            methods_on_path |= set(route.methods or [])

    assert "PUT" not in methods_on_path, (
        f"Route PUT toujours déclarée. Méthodes actuelles : "
        f"{sorted(methods_on_path)}"
    )


def test_put_payment_endpoint_removed():
    """Garantie : PUT /api/payments/{id} n'est plus déclaré dans le registry
    FastAPI.

    RED tant que la route PUT est encore déclarée.
    GREEN après suppression L541-551.
    """
    methods_on_path = set()
    for route in app.routes:
        if getattr(route, "path", None) == "/api/payments/{payment_id}":
            methods_on_path |= set(route.methods or [])

    assert "PUT" not in methods_on_path, (
        f"Route PUT toujours déclarée. Méthodes actuelles : "
        f"{sorted(methods_on_path)}"
    )
