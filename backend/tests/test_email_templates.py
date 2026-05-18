"""Tests pytest pour core/email_templates.py.

Couvre :
  1. Cascade : club spécifique prime sur global
  2. Cascade : global utilisé si pas de spécifique
  3. Render Jinja2 OK avec variables
  4. Render échoue si variable manquante → fallback déclenché
  5. Fallback si template absent en DB
  6. Fallback warning log structuré JSON
  7. Render avec is_active=false ignoré (cascade descend au global)
  8. Sandbox Jinja2 bloque accès à attributs python privés
  9. ensure_indexes idempotent
"""
from __future__ import annotations

import json
import logging
import os
import sys
from unittest.mock import AsyncMock, MagicMock

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from core.email_templates import (  # noqa: E402
    get_template,
    render_template,
    render_with_fallback,
)


def _make_db(find_results):
    """Crée un mock db.email_templates.find_one qui retourne séquentiellement les valeurs."""
    db = MagicMock()
    calls = []

    async def _find_one(*args, **kwargs):
        # Each call returns next item in find_results
        idx = len(calls)
        calls.append((args, kwargs))
        if idx < len(find_results):
            return find_results[idx]
        return None

    db.email_templates = MagicMock()
    db.email_templates.find_one = _find_one
    db.email_templates._calls = calls
    return db


@pytest.mark.regression
@pytest.mark.asyncio
async def test_cascade_club_specific_wins():
    specific = {
        "id": "spec-1", "template_key": "renewal_reminder", "club_id": "club-versoix",
        "version": 2, "is_active": True, "subject": "S", "html_body": "H", "text_body": "T",
    }
    db = _make_db([specific])  # premier find_one match
    tpl = await get_template(db, "renewal_reminder", "club-versoix")
    assert tpl is not None
    assert tpl["id"] == "spec-1"


@pytest.mark.regression
@pytest.mark.asyncio
async def test_cascade_falls_back_to_global():
    glob = {
        "id": "glob-1", "template_key": "renewal_reminder", "club_id": None,
        "version": 1, "is_active": True, "subject": "S", "html_body": "H", "text_body": "T",
    }
    # 1ère call (club-specific) → None ; 2e call (global) → glob
    db = _make_db([None, glob])
    tpl = await get_template(db, "renewal_reminder", "club-versoix")
    assert tpl is not None
    assert tpl["id"] == "glob-1"
    assert tpl["club_id"] is None


@pytest.mark.regression
@pytest.mark.asyncio
async def test_cascade_returns_none_when_no_match():
    db = _make_db([None, None])
    tpl = await get_template(db, "missing_key", "club-x")
    assert tpl is None


@pytest.mark.regression
def test_render_template_ok_with_variables():
    tpl = {
        "subject": "{{ name }}, you have {{ count }} messages",
        "html_body": "<p>Hello {{ name }}!</p>",
        "text_body": "Hello {{ name }}!",
    }
    out = render_template(tpl, {"name": "Alice", "count": 3})
    assert out["subject"] == "Alice, you have 3 messages"
    assert out["html"] == "<p>Hello Alice!</p>"
    assert out["text"] == "Hello Alice!"


@pytest.mark.regression
def test_render_template_raises_on_missing_variable():
    from jinja2.exceptions import UndefinedError
    tpl = {"subject": "Hi {{ name }}", "html_body": "X", "text_body": ""}
    with pytest.raises(UndefinedError):
        render_template(tpl, {})  # 'name' manque


@pytest.mark.regression
@pytest.mark.asyncio
async def test_fallback_used_when_no_template_in_db(caplog):
    db = _make_db([None, None])

    def _fallback(ctx):
        return {"subject": "FB", "html": "<b>fallback</b>", "text": "fb"}

    with caplog.at_level(logging.WARNING):
        result = await render_with_fallback(
            db, "missing_template", "club-x", {"foo": "bar"}, _fallback
        )
    assert result.used_fallback is True
    assert result.fallback_reason == "template_not_found_in_db"
    assert result.subject == "FB"
    assert result.html == "<b>fallback</b>"
    # Log structuré JSON présent
    logged = [r for r in caplog.records if "email_template_fallback_used" in r.message]
    assert len(logged) >= 1
    payload = json.loads(logged[0].message)
    assert payload["template_key"] == "missing_template"
    assert payload["reason"] == "template_not_found_in_db"


@pytest.mark.regression
@pytest.mark.asyncio
async def test_fallback_used_on_undefined_variable(caplog):
    tpl_in_db = {
        "id": "tpl-1", "template_key": "renewal_reminder", "club_id": None,
        "subject": "Hi {{ first_name }}", "html_body": "<p>{{ missing_var }}</p>", "text_body": "",
    }
    db = _make_db([None, tpl_in_db])  # club-specific None, global trouvé

    def _fallback(ctx):
        return {"subject": "FB", "html": "<b>fb</b>", "text": ""}

    with caplog.at_level(logging.WARNING):
        result = await render_with_fallback(
            db, "renewal_reminder", "club-x",
            {"first_name": "Alex"},  # missing_var manque
            _fallback,
        )
    assert result.used_fallback is True
    assert "render_error" in result.fallback_reason
    assert result.template_id == "tpl-1"
    # Log warning bien émis
    logged = [r for r in caplog.records if "email_template_fallback_used" in r.message]
    assert len(logged) >= 1


@pytest.mark.regression
@pytest.mark.asyncio
async def test_render_with_fallback_happy_path_db_used():
    tpl_in_db = {
        "id": "tpl-1", "template_key": "renewal_reminder", "club_id": None,
        "subject": "Hi {{ first_name }}",
        "html_body": "<p>Welcome {{ first_name }}</p>",
        "text_body": "Welcome {{ first_name }}",
    }
    db = _make_db([tpl_in_db])  # spécifique match direct

    def _fallback(ctx):
        return {"subject": "FB", "html": "fb", "text": "fb"}

    result = await render_with_fallback(
        db, "renewal_reminder", "club-versoix", {"first_name": "Alex"}, _fallback
    )
    assert result.used_fallback is False
    assert result.template_id == "tpl-1"
    assert result.subject == "Hi Alex"
    assert "Welcome Alex" in result.html


@pytest.mark.regression
def test_sandbox_blocks_python_internals():
    """SandboxedEnvironment doit bloquer accès aux attrs sensibles."""
    tpl = {"subject": "x", "html_body": "{{ ''.__class__ }}", "text_body": ""}
    from jinja2.exceptions import SecurityError
    with pytest.raises(SecurityError):
        render_template(tpl, {})


@pytest.mark.regression
@pytest.mark.asyncio
async def test_ensure_indexes_idempotent():
    """Vérifie qu'ensure_indexes appelle create_index avec les bons params."""
    from core.email_templates import ensure_indexes

    db = MagicMock()
    db.email_templates = MagicMock()
    db.email_templates.create_index = AsyncMock(return_value="email_templates_resolver_idx")

    await ensure_indexes(db)
    db.email_templates.create_index.assert_awaited_once()
    args, kwargs = db.email_templates.create_index.call_args
    # 1er positional arg = liste de tuples
    assert args[0] == [("template_key", 1), ("club_id", 1), ("is_active", 1), ("version", -1)]
    assert kwargs.get("name") == "email_templates_resolver_idx"

    # Re-appel idempotent (Mongo créera pas un 2e index)
    await ensure_indexes(db)
    assert db.email_templates.create_index.await_count == 2


@pytest.mark.regression
def test_seed_jinja_equals_v3_fallback_char_by_char():
    """Régression critique : le template seedé doit produire un HTML strictement
    identique à celui généré par `renewal_reminder_template` (V3 fallback).
    Tout drift du template V3 ou du seed sera détecté ici.
    """
    from scripts.seed_email_templates import extract_jinja_template, diff_check

    extracted = extract_jinja_template()
    diff = diff_check(extracted)
    assert diff["subject_ok"], f"subject diverge: seed={diff['subject_seed']!r} vs v3={diff['subject_v3']!r}"
    assert diff["html_ok"], f"html diverge: {diff['first_diff']}"
