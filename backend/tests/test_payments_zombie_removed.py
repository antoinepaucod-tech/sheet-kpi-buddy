"""Tests régression Phase 5 Batch 1.B Sub B.3b — suppression des 2 endpoints
zombies de `routers/payments.py` (audit SB B.3a — ZOMBIE_CONFIRMED) :
  - PUT `/api/payment-schedules/{id}` (ex-L62-70 `update_payment_schedule`)
  - PUT `/api/payments/{id}`           (ex-L541-551 `update_payment`)

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
from fastapi.testclient import TestClient

from server import app


pytestmark = [pytest.mark.regression]


def test_put_payment_schedule_endpoint_removed():
    """Garantie : PUT /api/payment-schedules/{id} n'existe plus.

    RED tant que la route est encore définie (renvoie 200/422/401).
    GREEN après suppression : 404 (route inconnue) ou 405 (méthode non
    autorisée si d'autres méthodes restent définies sur le path).
    """
    client = TestClient(app)
    response = client.put(
        "/api/payment-schedules/any-id-fake",
        json={"foo": "bar"},
    )
    assert response.status_code in (404, 405), (
        f"Endpoint zombie toujours actif : status={response.status_code} "
        f"body={response.text[:200]}"
    )


def test_put_payment_endpoint_removed():
    """Garantie : PUT /api/payments/{id} n'existe plus.

    RED tant que la route est encore définie.
    GREEN après suppression : 404 ou 405.
    """
    client = TestClient(app)
    response = client.put(
        "/api/payments/any-id-fake",
        json={"paid_date": "2026-05-20"},
    )
    assert response.status_code in (404, 405), (
        f"Endpoint zombie toujours actif : status={response.status_code} "
        f"body={response.text[:200]}"
    )
