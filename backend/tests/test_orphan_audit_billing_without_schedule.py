"""Tests pour services/orphan_audit.py::check_billing_without_schedule()
et son intégration dans le digest CRON hebdomadaire.

Verrouillage post-remédiation Norman Pilller (2026-05-18) :
- Si un futur bug crée un orphelin billing → digest hebdo doit le détecter.
- PIF probables doivent être filtrés (faux positifs éliminés).
- Email doit partir si billing_without_schedule non vide, même si tout le
  reste est clean.
"""
from __future__ import annotations

import asyncio
from typing import Any

import pytest

import services.orphan_audit as oa


pytestmark = pytest.mark.regression


# ---------- helpers : fake DB (read-only, anti-mutation) -----------------


class FakeCursor:
    """Curseur Motor mocké : supporte to_list() ET __aiter__ pour `async for`."""

    def __init__(self, docs):
        self._docs = list(docs)

    async def to_list(self, length=None):
        return list(self._docs)

    def __aiter__(self):
        async def gen():
            for d in self._docs:
                yield d
        return gen()


class FakeCollection:
    def __init__(self, docs):
        self._docs = docs

    def find(self, *_args, **_kwargs):
        # On ignore le filtre : on retourne TOUS les docs préparés par le test.
        # Les filtres MongoDB sont déjà appliqués mentalement par le test setup.
        return FakeCursor(self._docs)


class FakeDB:
    def __init__(self, **collections):
        self._cols = {name: FakeCollection(docs) for name, docs in collections.items()}

    def __getitem__(self, name):
        return self._cols.get(name, FakeCollection([]))

    def __getattr__(self, name):
        return self._cols.get(name, FakeCollection([]))


# ---------- fixtures de scénarios ----------------------------------------


def _member(mid, name, *, billing_enabled=True, archived_at=None,
            membership="HYBRID FULL", billing_amount=156.0,
            contract_signed_date="2026-03-01"):
    return {
        "id": mid,
        "name": name,
        "club_id": oa.DEFAULT_CLUB_ID,
        "billing_enabled": billing_enabled,
        "archived_at": archived_at,
        "membership": membership,
        "billing_amount": billing_amount,
        "contract_signed_date": contract_signed_date,
    }


def _schedule(member_id, *, is_active=True):
    return {
        "id": f"sched-{member_id}",
        "member_id": member_id,
        "club_id": oa.DEFAULT_CLUB_ID,
        "is_active": is_active,
    }


def _membership_type(name, price=156.0, duration_months=1, is_pif=False):
    return {
        "name": name,
        "price": price,
        "duration_months": duration_months,
        "is_pif": is_pif,
    }


def _tx(client_name, amount):
    return {
        "client_name": client_name,
        "amount_received": amount,
        "amount": amount,
        "club_id": oa.DEFAULT_CLUB_ID,
        "type": "revenue",
        "is_validated": True,
    }


# ---------- check_billing_without_schedule() ------------------------------


def test_no_orphan_when_all_members_have_active_schedule():
    """Cas Versoix post-remédiation Norman : tous les billing_enabled ont un
    schedule actif → orphan_count = 0."""
    db = FakeDB(
        customer_members=[
            _member("m1", "Alice"),
            _member("m2", "Bob"),
        ],
        payment_schedules=[
            _schedule("m1"),
            _schedule("m2"),
        ],
        membership_types=[_membership_type("HYBRID FULL")],
        accounting_transactions=[],
    )
    result = asyncio.run(oa.check_billing_without_schedule(db))
    assert result["orphan_count"] == 0
    assert result["orphans"] == []
    assert result["total_billing_on"] == 2


def test_orphan_detected_when_no_active_schedule():
    """Cas reproduction Norman : 1 membre sans schedule actif, pas PIF → orphan détecté."""
    db = FakeDB(
        customer_members=[
            _member("m1", "Norman Pilller", membership="THE COACH PASS MENSUEL",
                    billing_amount=470.0, contract_signed_date="2026-04-01"),
        ],
        payment_schedules=[],  # aucun schedule
        membership_types=[
            _membership_type("THE COACH PASS MENSUEL", price=0.0, duration_months=1),
        ],
        accounting_transactions=[],  # 0 revenu reçu → pas PIF
    )
    result = asyncio.run(oa.check_billing_without_schedule(db))
    assert result["orphan_count"] == 1
    assert result["orphans"][0]["name"] == "Norman Pilller"
    assert result["orphans"][0]["monthly_estimated"] == 470.0


def test_pif_probable_is_filtered_out():
    """Membre PIF avec 100% du prix payé → exclu (faux positif éliminé)."""
    db = FakeDB(
        customer_members=[
            _member("m_pif", "Camille PIF", membership="HUBFIT",
                    billing_amount=100.0, contract_signed_date="2024-04-15"),
        ],
        payment_schedules=[],
        membership_types=[
            # HUBFIT : prix 1200 / 12 mois → théorique = 1200
            _membership_type("HUBFIT", price=1200.0, duration_months=12),
        ],
        accounting_transactions=[
            # Cumul reçu = 1100 → 91.6% du théorique ≥ 80% → PIF probable
            _tx("Camille PIF", 1100.0),
        ],
    )
    result = asyncio.run(oa.check_billing_without_schedule(db))
    assert result["orphan_count"] == 0, (
        "Le PIF probable (≥80% du théorique) doit être filtré, "
        f"got orphans={result['orphans']}"
    )


def test_archived_member_is_skipped_at_query_level():
    """Les membres archivés ne doivent pas remonter (filtré DB-side dans la query)."""
    # Note : notre FakeDB ignore les filtres → on simule en ne mettant
    # PAS le membre archivé dans la collection (comme Mongo le ferait).
    db = FakeDB(
        customer_members=[
            _member("m1", "Active Member"),
            # m_archived absent volontairement (Mongo filtrerait `archived_at: null`)
        ],
        payment_schedules=[_schedule("m1")],
        membership_types=[_membership_type("HYBRID FULL")],
        accounting_transactions=[],
    )
    result = asyncio.run(oa.check_billing_without_schedule(db))
    assert result["orphan_count"] == 0


def test_exception_is_swallowed_and_logged(monkeypatch):
    """Si une exception DB se produit → log warning + retourne payload vide,
    NE BLOQUE PAS le digest principal."""

    class BrokenDB:
        def __getattr__(self, name):
            raise RuntimeError("simulated DB outage")

    result = asyncio.run(oa.check_billing_without_schedule(BrokenDB()))
    assert result["orphan_count"] == 0
    assert result["orphans"] == []
    assert "error" in result
    assert "simulated DB outage" in result["error"]


# ---------- send_audit_email() : déclencheur enrichi ---------------------


def _audit_payload(*, orphans_total=0, billing_red=0, billing_orange=0,
                   bws_orphans=0):
    return {
        "total_orphans": orphans_total,
        "collections_affected": 0,
        "report": [],
        "timestamp": "2026-05-19T09:00:00+00:00",
        "billing": {
            "total_billing_on": 87,
            "red_count": billing_red,
            "orange_count": billing_orange,
            "red_estimated_lost_revenue_chf": 0,
            "red_details": [],
            "orange_details": [],
            "scanned_at": "2026-05-19T09:00:00+00:00",
        },
        "billing_without_schedule": {
            "total_billing_on": 87,
            "orphan_count": bws_orphans,
            "orphans": [
                {"id": f"m{i}", "name": f"Orphan {i}", "membership": "TEST",
                 "billing_amount": 200.0, "monthly_estimated": 200.0,
                 "ref_date": "2026-01-01"}
                for i in range(bws_orphans)
            ] if bws_orphans else [],
            "scanned_at": "2026-05-19T09:00:00+00:00",
        },
    }


def test_email_not_sent_when_everything_clean(monkeypatch):
    """Aucune alerte (orphans/billing/bws tous à 0) → pas d'email."""
    monkeypatch.setenv("ORPHAN_AUDIT_RECIPIENT", "test@example.com")
    payload = _audit_payload()
    result = asyncio.run(oa.send_audit_email(payload, force=False))
    assert result["sent"] is False
    assert result["reason"] == "no_alert_no_force"


def test_email_sent_when_only_bws_alert(monkeypatch):
    """Cas critique : seul bws_orphans > 0 → l'email DOIT partir."""
    monkeypatch.setenv("ORPHAN_AUDIT_RECIPIENT", "test@example.com")
    monkeypatch.setenv("RESEND_API_KEY", "re_fake_key")
    import resend
    resend.api_key = "re_fake_key"

    sent_params: dict[str, Any] = {}

    def fake_send(params):
        sent_params.update(params)
        return {"id": "fake-resend-id-bws"}

    monkeypatch.setattr(resend.Emails, "send", fake_send)

    payload = _audit_payload(bws_orphans=2)
    result = asyncio.run(oa.send_audit_email(payload, force=False))

    assert result["sent"] is True, f"Email aurait dû partir, got: {result}"
    assert result["resend_id"] == "fake-resend-id-bws"
    assert "sans schedule" in sent_params["subject"]
    # Le HTML doit contenir la nouvelle section
    assert "Billing sans payment_schedule" in sent_params["html"]
    assert "Orphan 0" in sent_params["html"]


def test_kill_switch_disables_email_even_with_bws_alert(monkeypatch):
    """Kill switch ORPHAN_AUDIT_RECIPIENT='' → aucun email même si bws > 0."""
    monkeypatch.setenv("ORPHAN_AUDIT_RECIPIENT", "")
    payload = _audit_payload(bws_orphans=5)
    result = asyncio.run(oa.send_audit_email(payload, force=False))
    assert result["sent"] is False
    assert result["reason"] == "recipient_empty_kill_switch"


def test_html_contains_bws_section_when_orphans_present():
    """_build_html doit injecter la section dédiée si bws orphans > 0."""
    payload = _audit_payload(bws_orphans=1)
    html = oa._build_html(payload)
    assert "Billing sans payment_schedule" in html
    assert "Orphan 0" in html
    assert "PIF" in html  # mention de l'heuristique appliquée


def test_html_omits_bws_section_when_clean():
    """_build_html ne doit PAS injecter la section si bws orphans = 0."""
    payload = _audit_payload(bws_orphans=0)
    html = oa._build_html(payload)
    assert "Billing sans payment_schedule" not in html
