"""Tests régression Phase 5 Batch 2 SB B.2.2 — défense en profondeur globale :
dependency auth globale sur `api_router` + sub-router `public_api_router` pour
les 3 endpoints publics légitimes (login, register, unsubscribe).

Cible : faire passer 120 endpoints no-auth NAKED de "accessible sans token"
à "401 sans token" en 1 patch server.py.

Validation TDD :
  - 3 tests "remains_public" : DOIVENT rester GREEN à travers le patch
    (les 3 endpoints exclus continuent à répondre via leur handler métier).
  - 7 tests "requires_auth" parametrize : RED avant patch (endpoints
    accessibles sans token → 200), GREEN après (401).

Approche TestClient (sans monkeypatch des dépendances) — on veut prouver
le comportement réel du dep globale FastAPI sur api_router.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from server import app


pytestmark = [pytest.mark.regression]

client = TestClient(app)


# ════════════════════════════════════════════════════════════════════════════
#       Tests publics légitimes — DOIVENT rester accessibles sans token
# ════════════════════════════════════════════════════════════════════════════


def test_login_remains_public():
    """POST /api/auth/login DOIT rester accessible sans Authorization header.
    Le handler login répond 401 (mauvais credentials) ou 422 (validation),
    PAS un 401/403 générique du dep globale auth (qui dirait "Token manquant").
    """
    response = client.post(
        "/api/auth/login",
        json={"email": "fake@test.com", "password": "fake"},
    )
    assert response.status_code in (401, 422), (
        f"Login retourne {response.status_code} sans token (attendu 401/422 métier)"
    )
    body_lower = response.text.lower()
    assert "token manquant" not in body_lower, (
        f"Body suggère blocage dep globale auth : {response.text[:200]}"
    )
    assert "not authenticated" not in body_lower


def test_register_remains_public():
    """POST /api/auth/register DOIT rester accessible sans Authorization."""
    response = client.post(
        "/api/auth/register",
        json={"email": "fake@test.com", "password": "fake"},
    )
    assert response.status_code in (201, 400, 422), (
        f"Register retourne {response.status_code} sans token (attendu métier)"
    )
    body_lower = response.text.lower()
    assert "token manquant" not in body_lower
    assert "not authenticated" not in body_lower


def test_unsubscribe_remains_public():
    """GET /api/marketing/unsubscribe?token=<jwt> DOIT rester public.
    Le handler valide le token JWT 30j (UNSUBSCRIBE_SECRET) — un token invalide
    renvoie 400/422, pas un blocage du dep globale auth.
    """
    response = client.get("/api/marketing/unsubscribe?token=invalid_short")
    assert response.status_code in (400, 404, 422), (
        f"Unsubscribe retourne {response.status_code} sans token JWT valide "
        f"(attendu 400/422 métier)"
    )
    body_lower = response.text.lower()
    assert "token manquant" not in body_lower
    assert "not authenticated" not in body_lower


# ════════════════════════════════════════════════════════════════════════════
#       Tests endpoints protégés — DOIVENT renvoyer 401 sans token
# ════════════════════════════════════════════════════════════════════════════


ENDPOINTS_TO_PROTECT = [
    ("GET", "/api/members/stats"),
    ("GET", "/api/members/at-risk"),
    ("GET", "/api/members/categories"),
    ("POST", "/api/notifications/send-email"),
    ("POST", "/api/rollover/run"),
    ("GET", "/api/courses"),
    ("GET", "/api/settings"),
]


@pytest.mark.parametrize("method,path", ENDPOINTS_TO_PROTECT)
def test_endpoint_requires_auth(method, path):
    """Sans Authorization header, l'endpoint DOIT renvoyer 401.

    RED avant patch : tous ces endpoints sont actuellement no-auth (cf. audit
    B.2.0 + B.2.1) → 200 ou réponse métier.
    GREEN après patch : dep globale `Depends(get_current_user)` sur api_router
    intercepte → 401 "Token manquant".
    """
    response = client.request(method, path)
    assert response.status_code == 401, (
        f"{method} {path} retourne {response.status_code} sans token "
        f"(attendu 401). Body : {response.text[:200]}"
    )
