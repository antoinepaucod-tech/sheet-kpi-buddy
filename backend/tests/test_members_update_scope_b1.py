"""Tests régression SB B.2.3.B.1 — scope `club_id` sur les 4 `update_one`
de `routers/members.py` qui ré-utilisent `club_id_resolved` déjà calculé :

  - L872  `customer_members.update_one` — update_member CRUD primaire
  - L931  `customer_members.update_one` — update_member cascade annual_review_date
  - L961  `customer_members.update_one` — update_member cascade DUO partner (cross-member)
  - L1324 `customer_members.update_one` — renew_membership CRUD primaire

Décision architecturale (rappel A.2) : le scope cascade prend le club du
user authentifié (header X-Club-Id), PAS le club du document leak (partner
orphan / member cross-club). Test L961 cross-club discriminant le prouve.

0 mutation DB réelle (mocks `AsyncMock` pure). 0 dépendance entre fichiers test.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from routers import members as mb


pytestmark = [pytest.mark.regression, pytest.mark.asyncio]


# ──────────────────────────── Helpers locaux ─────────────────────────────

CLUB_VERSOIX = "0a327bf5-c759-49eb-87e4-551913f78bdb"
CLUB_OTHER = "FAKE_OTHER_CLUB_B1"


def _existing_member(**overrides):
    """Doc member existant minimal (retour du find_one amont)."""
    doc = {
        "id": "mem-1",
        "club_id": CLUB_VERSOIX,
        "exit_date": None,
        "review_frequency": "monthly",
        "billing_amount": 50.0,
        "contract_signed_date": "2026-04-01",
        "billing_cycle_type": "monthly_day",
        "billing_cycle_value": 1,
        "billing_enabled": False,
        "duo_partner_id": None,
        "duo_primary": False,
        "annual_review_enabled": False,
        "membership": "HYBRID FULL - PAIEMENT MENSUEL",
        "name": "Test Member",
    }
    doc.update(overrides)
    return doc


def _make_db_mock(member_doc=None, schedule_doc=None):
    members_coll = MagicMock()
    members_coll.find_one = AsyncMock(return_value=member_doc)
    members_coll.update_one = AsyncMock(return_value=MagicMock(modified_count=1))

    payments_coll = MagicMock()
    payments_coll.update_many = AsyncMock(return_value=MagicMock(modified_count=0))
    payments_coll.insert_one = AsyncMock()
    payments_coll.find_one = AsyncMock(return_value=None)

    reviews_coll = MagicMock()
    reviews_coll.delete_many = AsyncMock(return_value=MagicMock(deleted_count=0))
    reviews_coll.find_one = AsyncMock(return_value=None)
    reviews_coll.insert_one = AsyncMock()

    schedules_coll = MagicMock()
    schedules_coll.find_one = AsyncMock(return_value=schedule_doc)
    schedules_coll.update_one = AsyncMock()
    schedules_coll.insert_one = AsyncMock()

    db = MagicMock()
    db.customer_members = members_coll
    db.payments = payments_coll
    db.annual_reviews = reviews_coll
    db.payment_schedules = schedules_coll
    db.member_renewals = MagicMock(insert_one=AsyncMock())
    db.challenge_participants = MagicMock(find_one=AsyncMock(return_value=None), insert_one=AsyncMock())
    db.six_weeks_challenges = MagicMock(find_one=AsyncMock(return_value=None))
    return db


def _payload_mock(model_dump_dict):
    """Mock du paramètre `data: CustomerMemberCreate` :
    code lit `data.model_dump()` puis attributs directs (data.billing_enabled, etc.).
    """
    p = MagicMock()
    p.model_dump.return_value = dict(model_dump_dict)
    for k, v in model_dump_dict.items():
        setattr(p, k, v)
    return p


def _patch_common(monkeypatch, db):
    monkeypatch.setattr(mb, "db", db)
    monkeypatch.setattr(
        mb,
        "resolve_club_id_or_fallback",
        lambda club_id, current_user, endpoint: club_id or CLUB_VERSOIX,
    )
    monkeypatch.setattr(mb, "log_activity", AsyncMock())


def _customer_update_calls(db):
    """Retourne la liste des call_args (args, kwargs) sur customer_members.update_one."""
    return [c for c in db.customer_members.update_one.call_args_list]


# ════════════════════════════════════════════════════════════════════════════
#   Test 1 — L872 update_member CRUD primaire scope club_id
# ════════════════════════════════════════════════════════════════════════════


async def test_l872_update_member_primary_includes_club_id_filter(monkeypatch):
    """PUT /members/{id} : l'update_one principal (L872) DOIT scoper club_id."""
    db = _make_db_mock(_existing_member())
    _patch_common(monkeypatch, db)

    payload = _payload_mock({
        "exit_date": None,
        "review_frequency": "monthly",
        "billing_amount": 50.0,
        "billing_enabled": False,
        "annual_review_enabled": False,
        "contract_signed_date": "2026-04-01",
        "billing_cycle_type": "monthly_day",
        "billing_cycle_value": 1,
        "name": "Test Member",
        "membership": "HYBRID FULL - PAIEMENT MENSUEL",
    })

    await mb.update_member(
        member_id="mem-1",
        data=payload,
        club_id=CLUB_VERSOIX,
        current_user={"id": "u1", "email": "u@a.com"},
    )

    calls = _customer_update_calls(db)
    # Au moins 1 update_one customer_members appelé
    assert len(calls) >= 1, "update_member n'a appelé aucun update_one customer_members"
    # Premier call = L872 (CRUD primaire avant cascade)
    filter_dict = calls[0].args[0]
    assert filter_dict.get("id") == "mem-1"
    assert "club_id" in filter_dict, (
        f"L872 CRUD primaire sans `club_id` : {filter_dict}"
    )
    assert filter_dict["club_id"] == CLUB_VERSOIX


# ════════════════════════════════════════════════════════════════════════════
#   Test 2 — L931 update_member cascade annual_review_date scope
# ════════════════════════════════════════════════════════════════════════════


async def test_l931_update_member_review_date_cascade_includes_club_id_filter(monkeypatch):
    """Quand review_frequency change : L931 met à jour `annual_review_date` du
    member. Le filter DOIT scoper club_id.
    """
    db = _make_db_mock(_existing_member(review_frequency="monthly"))
    _patch_common(monkeypatch, db)

    payload = _payload_mock({
        "review_frequency": "quarterly",
        "exit_date": None,
        "billing_amount": 50.0,
        "billing_enabled": False,
        "annual_review_enabled": False,
        "contract_signed_date": "2026-04-01",
        "billing_cycle_type": "monthly_day",
        "billing_cycle_value": 1,
        "name": "Test Member",
        "membership": "HYBRID FULL - PAIEMENT MENSUEL",
    })

    await mb.update_member(
        member_id="mem-1",
        data=payload,
        club_id=CLUB_VERSOIX,
        current_user={"id": "u1", "email": "u@a.com"},
    )

    calls = _customer_update_calls(db)
    # Cherche le call qui contient "annual_review_date" dans le $set
    target = None
    for c in calls:
        set_doc = c.args[1].get("$set", {}) if len(c.args) >= 2 else {}
        if "annual_review_date" in set_doc and len(set_doc) == 1:
            target = c
            break
    assert target is not None, (
        f"Aucun update_one customer_members ne porte $set={{annual_review_date}} (cascade L931 non déclenchée). "
        f"calls={[(c.args[0], c.args[1].get('$set', {})) for c in calls]}"
    )
    filter_dict = target.args[0]
    assert filter_dict.get("id") == "mem-1"
    assert "club_id" in filter_dict, (
        f"L931 cascade filter sans `club_id` : {filter_dict}"
    )
    assert filter_dict["club_id"] == CLUB_VERSOIX


# ════════════════════════════════════════════════════════════════════════════
#   Test 3 — L961 update_member DUO partner cascade scope (cross-member)
# ════════════════════════════════════════════════════════════════════════════


async def test_l961_update_member_duo_partner_cascade_includes_club_id_filter(monkeypatch):
    """Quand existing est DUO primary + propagation field change : L961 met
    à jour le partner. Le filter DOIT scoper club_id (cross-member).
    """
    db = _make_db_mock(_existing_member(
        duo_primary=True,
        duo_partner_id="partner-x",
        membership="HYBRID FULL - PAIEMENT MENSUEL",
    ))
    _patch_common(monkeypatch, db)

    payload = _payload_mock({
        "membership": "HYBRID FULL - PAIEMENT TRIMESTRIEL",  # change → propagate to partner
        "exit_date": None,
        "review_frequency": "monthly",
        "billing_amount": 50.0,
        "billing_enabled": False,
        "annual_review_enabled": False,
        "contract_signed_date": "2026-04-01",
        "billing_cycle_type": "monthly_day",
        "billing_cycle_value": 1,
        "name": "Test Member",
    })

    await mb.update_member(
        member_id="mem-1",
        data=payload,
        club_id=CLUB_VERSOIX,
        current_user={"id": "u1", "email": "u@a.com"},
    )

    calls = _customer_update_calls(db)
    # Cherche le call qui cible partner-x
    target = None
    for c in calls:
        if c.args[0].get("id") == "partner-x":
            target = c
            break
    assert target is not None, (
        f"Aucun update_one customer_members ne cible 'partner-x' (cascade DUO non déclenchée). "
        f"calls_ids={[c.args[0].get('id') for c in calls]}"
    )
    filter_dict = target.args[0]
    assert "club_id" in filter_dict, (
        f"L961 DUO partner cascade filter sans `club_id` : {filter_dict}"
    )
    assert filter_dict["club_id"] == CLUB_VERSOIX


# ════════════════════════════════════════════════════════════════════════════
#   Test 4 — L961 DUO partner cross-club discriminant (anti-leak)
# ════════════════════════════════════════════════════════════════════════════


async def test_l961_duo_partner_cross_club_does_not_leak(monkeypatch):
    """Scénario data-leak hypothétique : partner_id pointe vers un partner
    appartenant au club B (data orphan / DUO legacy cross-club).

    L'utilisateur authentifié est sur le club A (Versoix via header).
    Le `resolve_club_id_or_fallback` priorise `club_id` (header) → Versoix.
    Le filter cascade DOIT scoper `club_id=Versoix` — donc 0 match sur le
    partner réel du club B.

    Invariant multi-tenant : un user du club A ne peut JAMAIS muter un
    partner DUO appartenant au club B, même via une cascade DUO orpheline.
    """
    db = _make_db_mock(_existing_member(
        duo_primary=True,
        duo_partner_id="partner-other-club",
        membership="HYBRID FULL - PAIEMENT MENSUEL",
    ))
    _patch_common(monkeypatch, db)

    payload = _payload_mock({
        "membership": "HYBRID FULL - PAIEMENT TRIMESTRIEL",  # propagate
        "exit_date": None,
        "review_frequency": "monthly",
        "billing_amount": 50.0,
        "billing_enabled": False,
        "annual_review_enabled": False,
        "contract_signed_date": "2026-04-01",
        "billing_cycle_type": "monthly_day",
        "billing_cycle_value": 1,
        "name": "Test Member",
    })

    await mb.update_member(
        member_id="mem-1",
        data=payload,
        club_id=CLUB_VERSOIX,  # user du club A
        current_user={"id": "u1", "email": "u@a.com"},
    )

    calls = _customer_update_calls(db)
    target = None
    for c in calls:
        if c.args[0].get("id") == "partner-other-club":
            target = c
            break
    assert target is not None, (
        f"Aucun update_one customer_members ne cible 'partner-other-club' "
        f"(cascade DUO non déclenchée). calls_ids={[c.args[0].get('id') for c in calls]}"
    )
    filter_dict = target.args[0]
    # Propriété critique : le filter scope sur le club du USER (header),
    # pas sur le club du partner (qui pourrait être orphan/leak).
    assert filter_dict.get("club_id") == CLUB_VERSOIX, (
        f"Cross-club leak : filter aurait dû scoper sur {CLUB_VERSOIX} "
        f"(header user) mais a {filter_dict.get('club_id')}"
    )
    assert filter_dict.get("club_id") != CLUB_OTHER, (
        "Cross-club leak : filter scope sur le club du partner, pas du user"
    )


# ════════════════════════════════════════════════════════════════════════════
#   Test 5 — L1324 renew_membership scope
# ════════════════════════════════════════════════════════════════════════════


async def test_l1324_renew_membership_primary_includes_club_id_filter(monkeypatch):
    """POST /members/{id}/renew : l'update_one principal (L1324) DOIT scoper club_id."""
    db = _make_db_mock(_existing_member(billing_enabled=False))
    _patch_common(monkeypatch, db)

    body = {
        "new_end_date": "2027-05-01",
        "renewal_duration": "12 mois",
        "notes": "renew test",
    }

    await mb.renew_membership(
        member_id="mem-1",
        body=body,
        club_id=CLUB_VERSOIX,
        current_user={"id": "u1", "email": "u@a.com"},
    )

    calls = _customer_update_calls(db)
    assert len(calls) >= 1, "renew_membership n'a appelé aucun update_one customer_members"
    # L1324 = unique update_one customer_members dans renew_membership
    target = calls[0]
    filter_dict = target.args[0]
    assert filter_dict.get("id") == "mem-1"
    assert "club_id" in filter_dict, (
        f"L1324 renew primary filter sans `club_id` : {filter_dict}"
    )
    assert filter_dict["club_id"] == CLUB_VERSOIX
