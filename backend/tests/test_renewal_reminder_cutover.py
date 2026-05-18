"""Régression cutover bulk-renewal-reminder → DB template + fallback V3.

Couvre :
  1. Happy path : DB template présent → used_fallback=False, html contient context
  2. Fallback : DB vide → used_fallback=True + warning JSON log
  3. Fallback : DB template avec variable non déclarée → render error → fallback
  4. Byte-identical : render(DB) == _renewal_reminder_fallback_v3(ctx)
"""
from __future__ import annotations

import json
import logging
import os
import sys
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

os.environ.setdefault("UNSUBSCRIBE_SECRET", "test_unsubscribe_secret_for_cutover")


def _yesterday() -> str:
    return (datetime.now(timezone.utc).date() - timedelta(days=1)).isoformat()


def _make_expired_member(mid, name, email):
    return {
        "id": mid,
        "name": name,
        "email": email,
        "club_id": "club-xyz",
        "membership": "HYBRID GYM",
        "subscription_end_date": _yesterday(),
        "archived_at": None,
    }


def _build_router_test_client():
    """Construit un TestClient avec auth + club_id overridés."""
    from server import app
    from core import security

    fake_user = {"id": "u-test", "email": "tester@example.com", "role": "super_admin"}

    async def _override_user():
        return fake_user

    async def _override_club_id():
        return "club-xyz"

    app.dependency_overrides[security.get_current_user] = _override_user
    app.dependency_overrides[security.get_club_id] = _override_club_id
    return app


@pytest.fixture
def app_overrides():
    app = _build_router_test_client()
    yield app
    app.dependency_overrides.clear()


@pytest.fixture
def patched_db_for_cutover(app_overrides):
    """Patch tout l'accès DB + send Resend. Le mock email_templates est paramétrable."""
    from core import config as core_config

    members_in_db: dict[str, dict] = {}
    sent_emails: list = []
    db_template_doc = {"value": None}  # holder mutable pour le test (None = pas de template)
    update_calls = []

    def _set_members(members):
        members_in_db.clear()
        for m in members:
            members_in_db[m["id"]] = dict(m)

    def _set_db_template(doc):
        db_template_doc["value"] = doc

    # Mock customer_members.find (par {"id": {"$in": ...}})
    last_query = {"q": None}

    async def _find_cm_to_list(*_a, **_kw):
        q = last_query["q"] or {}
        ids = (q.get("id") or {}).get("$in") or []
        club = q.get("club_id")
        return [
            {k: v for k, v in members_in_db[mid].items() if k != "_id"}
            for mid in ids if mid in members_in_db and members_in_db[mid].get("club_id") == club
        ]

    def _find_cm(query, projection=None):
        last_query["q"] = query
        cur = MagicMock()
        cur.to_list = AsyncMock(side_effect=_find_cm_to_list)
        return cur

    async def _update_one_cm(filt, update):
        mid = filt.get("id")
        m = members_in_db.get(mid)
        if not m:
            return MagicMock(matched_count=0)
        if "$set" in update:
            m.update(update["$set"])
        if "$inc" in update:
            for k, v in update["$inc"].items():
                m[k] = m.get(k, 0) + v
        update_calls.append({"filter": filt, "update": update})
        return MagicMock(matched_count=1)

    async def _find_one_club(filt, projection=None):
        return {"id": filt.get("id"), "name": "Hybrid Gym Geneva", "public_name": "Hybrid Gym Geneva"}

    async def _find_one_email_template(filt, projection=None, sort=None):
        doc = db_template_doc["value"]
        if not doc:
            return None
        # Mimick find_one behavior with cascade: respect template_key + club_id + is_active
        if filt.get("template_key") != doc.get("template_key"):
            return None
        if filt.get("is_active") and not doc.get("is_active"):
            return None
        # If filt asks for specific club_id but doc is None (global), skip
        target_club = filt.get("club_id")
        if target_club is None and doc.get("club_id") is None:
            return doc
        if target_club is not None and doc.get("club_id") == target_club:
            return doc
        # Else no match
        return None

    async def _activity_insert(doc):
        return MagicMock(inserted_id="x")

    async def _send_resend(to_email, subject, html):
        sent_emails.append({"to": to_email, "subject": subject, "html": html})
        return {"sent": True, "resend_id": f"fake_{len(sent_emails)}"}

    mock_find_cm = MagicMock(side_effect=_find_cm)

    with patch.object(core_config.db, "customer_members") as mock_cm, \
         patch.object(core_config.db, "clubs") as mock_clubs, \
         patch.object(core_config.db, "activity_logs") as mock_al, \
         patch.object(core_config.db, "email_templates") as mock_et:
        mock_cm.find = mock_find_cm
        mock_cm.update_one = AsyncMock(side_effect=_update_one_cm)
        mock_clubs.find_one = AsyncMock(side_effect=_find_one_club)
        mock_al.insert_one = AsyncMock(side_effect=_activity_insert)
        mock_et.find_one = AsyncMock(side_effect=_find_one_email_template)

        # Patch send_resend_email IN ROUTER (already imported there at top-level)
        with patch("routers.members.send_resend_email", new=AsyncMock(side_effect=_send_resend)):
            yield {
                "set_members": _set_members,
                "set_db_template": _set_db_template,
                "members_in_db": members_in_db,
                "sent_emails": sent_emails,
                "update_calls": update_calls,
            }


# ── TESTS ─────────────────────────────────────────────────────────────────────

@pytest.mark.regression
def test_bulk_renewal_uses_db_template_when_present(app_overrides, patched_db_for_cutover, caplog):
    """Happy path : doc seedé en DB → used_fallback=False, log JSON absent."""
    db_doc = {
        "id": "tpl-seeded",
        "template_key": "renewal_reminder",
        "club_id": None,
        "version": 1,
        "is_active": True,
        "subject": "{{ first }}, ça va ?",
        "html_body": "<p>Hi {{ first }} from {{ club_name }} - <a href='{{ unsubscribe_url }}'>unsub</a> - <a href='{{ whatsapp_url }}'>wa</a></p>",
        "text_body": "",
        "variables": ["first", "club_name", "whatsapp_url", "unsubscribe_url"],
    }
    patched_db_for_cutover["set_db_template"](db_doc)
    patched_db_for_cutover["set_members"]([
        _make_expired_member("m1", "Manon Frick", "manon@ex.com"),
    ])

    client = TestClient(app_overrides)
    with caplog.at_level(logging.WARNING):
        resp = client.post(
            "/api/members/bulk-renewal-reminder",
            json={"member_ids": ["m1"]},
            headers={"Authorization": "Bearer test", "X-Club-Id": "club-xyz"},
        )

    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["sent"] == 1
    detail = data["details"][0]
    assert detail["status"] == "sent"
    assert detail["used_fallback"] is False
    assert detail["template_id"] == "tpl-seeded"

    sent = patched_db_for_cutover["sent_emails"]
    assert len(sent) == 1
    # Subject rendered from DB template
    assert sent[0]["subject"] == "Manon, ça va ?"
    # HTML contains context
    assert "Hi Manon from Hybrid Gym Geneva" in sent[0]["html"]
    assert "wa.me/41774966626" in sent[0]["html"]

    # NO fallback log
    fb_logs = [r for r in caplog.records if "email_template_fallback_used" in r.message]
    assert len(fb_logs) == 0, f"Expected no fallback log, got: {[r.message for r in fb_logs]}"


@pytest.mark.regression
def test_bulk_renewal_falls_back_to_v3_when_template_absent(app_overrides, patched_db_for_cutover, caplog):
    """DB email_templates vide → fallback V3 + log JSON warning structuré."""
    patched_db_for_cutover["set_db_template"](None)  # no template
    patched_db_for_cutover["set_members"]([
        _make_expired_member("m1", "Manon Frick", "manon@ex.com"),
    ])

    client = TestClient(app_overrides)
    with caplog.at_level(logging.WARNING):
        resp = client.post(
            "/api/members/bulk-renewal-reminder",
            json={"member_ids": ["m1"]},
            headers={"Authorization": "Bearer test", "X-Club-Id": "club-xyz"},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["sent"] == 1
    detail = data["details"][0]
    assert detail["used_fallback"] is True
    assert detail["template_id"] is None

    sent = patched_db_for_cutover["sent_emails"]
    assert len(sent) == 1
    # V3 fallback subject
    assert sent[0]["subject"] == "Manon, on ne t'a pas vu cette semaine 👀"
    # V3 fallback html signature
    assert "ON NE T'A PAS VU CETTE SEMAINE" in sent[0]["html"]
    assert "L'ÉQUIPE HYBRID GYM GENEVA" in sent[0]["html"]

    # Fallback log JSON structuré présent
    fb_logs = [r for r in caplog.records if "email_template_fallback_used" in r.message]
    assert len(fb_logs) >= 1
    payload = json.loads(fb_logs[0].message)
    assert payload["template_key"] == "renewal_reminder"
    assert payload["reason"] == "template_not_found_in_db"


@pytest.mark.regression
def test_bulk_renewal_falls_back_on_render_error(app_overrides, patched_db_for_cutover, caplog):
    """DB template a une variable non déclarée → StrictUndefined → fallback V3."""
    bad_doc = {
        "id": "tpl-broken",
        "template_key": "renewal_reminder",
        "club_id": None,
        "version": 2,
        "is_active": True,
        "subject": "{{ first }}, salut !",
        "html_body": "<p>{{ this_var_is_not_in_context }}</p>",
        "text_body": "",
        "variables": [],
    }
    patched_db_for_cutover["set_db_template"](bad_doc)
    patched_db_for_cutover["set_members"]([
        _make_expired_member("m1", "Manon Frick", "manon@ex.com"),
    ])

    client = TestClient(app_overrides)
    with caplog.at_level(logging.WARNING):
        resp = client.post(
            "/api/members/bulk-renewal-reminder",
            json={"member_ids": ["m1"]},
            headers={"Authorization": "Bearer test", "X-Club-Id": "club-xyz"},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["sent"] == 1
    detail = data["details"][0]
    assert detail["used_fallback"] is True
    # Template_id du doc fautif préservé (utile debug)
    assert detail["template_id"] == "tpl-broken"

    # Fallback used → V3 html
    sent = patched_db_for_cutover["sent_emails"]
    assert "ON NE T'A PAS VU CETTE SEMAINE" in sent[0]["html"]

    # Log JSON warning structuré présent avec reason=render_error
    fb_logs = [r for r in caplog.records if "email_template_fallback_used" in r.message]
    assert len(fb_logs) >= 1
    payload = json.loads(fb_logs[0].message)
    assert "render_error" in payload["reason"]
    assert payload["template_id"] == "tpl-broken"


@pytest.mark.regression
def test_rendered_html_byte_identical_db_vs_fallback():
    """Contrat critique : avec le seed V1 actuel, render(DB doc) == V3 fallback pour le
    même context. Re-vérifié ici pour garantir que le cutover ne casse pas le contrat
    établi en SB2 (test_seed_jinja_equals_v3_fallback_char_by_char).
    """
    from scripts.seed_email_templates import extract_jinja_template
    from core.email_templates import render_template
    from core.notifications import _renewal_reminder_fallback_v3

    extracted = extract_jinja_template()
    seed_doc = {
        "subject": extracted["subject"],
        "html_body": extracted["html_body"],
        "text_body": "",
    }
    ctx = {
        "first": "Manon",
        "club_name": "Hybrid Gym Geneva",
        "whatsapp_url": "https://wa.me/41774966626?text=Salut%20%21%20Je%20veux%20renouveler%20mon%20abonnement%20%F0%9F%92%AA",
        "unsubscribe_url": "https://club.transform-os.ch/api/marketing/unsubscribe?token=XYZ",
    }

    seed_rendered = render_template(seed_doc, ctx)
    fb_rendered = _renewal_reminder_fallback_v3(ctx)

    assert seed_rendered["subject"] == fb_rendered["subject"]
    assert seed_rendered["html"] == fb_rendered["html"], (
        f"Drift detected — first 100 chars differ:\n"
        f"  seed: {seed_rendered['html'][:200]!r}\n"
        f"  fb:   {fb_rendered['html'][:200]!r}"
    )
