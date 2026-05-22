"""Tests régression Phase 5 Batch 2 SB B.2.3.A — défense en profondeur
multi-tenant sur les 5 cascade `update_many`/`delete_many` du top AST 2026-05-20
dans `routers/members.py` :
  - L878 `payments.update_many`        (update_member — cancellation/departure)
  - L897 `annual_reviews.delete_many`  (update_member — frequency change)
  - L971 `payments.update_many`        (update_member — billing_amount sync)
  - L1008 `payments.update_many`       (update_member — billing root → due_date recalc)
  - L1341 `payments.update_many`       (renew_membership — billing_amount sync)

Cible patch B.2.3.A.2 : ajouter `"club_id": club_id_resolved` au filter des 5
mutations cascade. Le `resolve_club_id_or_fallback` est déjà calculé en amont
dans `update_member` (L855-859) et `renew_membership` (L1236-1241) — la
variable existante DOIT être réutilisée (pas de double-call).

Test 6 cross-club discriminant : preuve qu'un user authentifié sur le club A
ne peut JAMAIS cascader des mutations sur les payments/reviews d'un member
du club B, même si `find_one` amont leak l'existence (cas data corrompue
post-Hardening F.1).

0 mutation DB réelle (mocks AsyncMock pure — pattern Q5 PRD).
0 dépendance entre fichiers test (fixtures 100% locales).
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from routers import members as mb


pytestmark = [pytest.mark.regression, pytest.mark.asyncio]


# ──────────────────────────── Helpers locaux ─────────────────────────────


CLUB_VERSOIX = "0a327bf5-c759-49eb-87e4-551913f78bdb"
CLUB_OTHER = "FAKE_OTHER_CLUB_B"


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
        "annual_review_enabled": False,
    }
    doc.update(overrides)
    return doc


def _make_db_mock(member_doc=None, schedule_doc=None):
    """Mock DB minimal pour update_member / renew_membership."""
    members_coll = MagicMock()
    members_coll.find_one = AsyncMock(return_value=member_doc)
    members_coll.update_one = AsyncMock(return_value=MagicMock(modified_count=1))

    payments_coll = MagicMock()
    payments_coll.update_many = AsyncMock(return_value=MagicMock(modified_count=0))
    payments_coll.insert_one = AsyncMock()

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
    db.challenge_participants = MagicMock(insert_one=AsyncMock())
    return db


def _payload_mock(model_dump_dict):
    """Mock du paramètre `data: CustomerMemberCreate`. Le code appelle
    `data.model_dump()` puis lit les attributs directs (data.annual_review_enabled,
    data.billing_enabled, data.billing_amount, etc.).
    """
    p = MagicMock()
    p.model_dump.return_value = dict(model_dump_dict)
    for k, v in model_dump_dict.items():
        setattr(p, k, v)
    return p


def _patch_common(monkeypatch, db):
    """Monkeypatch shared deps."""
    monkeypatch.setattr(mb, "db", db)
    monkeypatch.setattr(
        mb,
        "resolve_club_id_or_fallback",
        lambda club_id, current_user, endpoint: club_id or CLUB_VERSOIX,
    )
    # log_activity might be called as side-effect
    monkeypatch.setattr(mb, "log_activity", AsyncMock())


# ════════════════════════════════════════════════════════════════════════════
#       Test 1 — L878 cascade cancellation payments (update_member)
# ════════════════════════════════════════════════════════════════════════════


async def test_l878_update_many_payments_cancellation_includes_club_id_filter(monkeypatch):
    """Quand un member passe `exit_date` (départ), L878 cascade les payments
    pending/late vers `status=cancelled`. Le filter DOIT scoper `club_id`.

    RED avec code actuel (filter = `{member_id, status:{$in:[pending,late]}}`).
    GREEN après patch (filter += `club_id`).
    """
    db = _make_db_mock(_existing_member(exit_date=None))
    _patch_common(monkeypatch, db)

    payload = _payload_mock({
        "exit_date": "2026-06-01",
        "review_frequency": "monthly",
        "billing_amount": 50.0,
        "billing_enabled": False,
        "annual_review_enabled": False,
        "contract_signed_date": "2026-04-01",
        "billing_cycle_type": "monthly_day",
        "billing_cycle_value": 1,
    })

    await mb.update_member(
        member_id="mem-1",
        data=payload,
        club_id=CLUB_VERSOIX,
        current_user={"id": "u1", "email": "u@a.com"},
    )

    db.payments.update_many.assert_called_once()
    filter_dict = db.payments.update_many.call_args.args[0]
    assert "club_id" in filter_dict, (
        f"L878 cascade filter sans `club_id` : {filter_dict}"
    )
    assert filter_dict["club_id"] == CLUB_VERSOIX
    # régression métier : filter conserve member_id + status conditions
    assert filter_dict.get("member_id") == "mem-1"
    assert filter_dict.get("status") == {"$in": ["pending", "late"]}


# ════════════════════════════════════════════════════════════════════════════
#       Test 2 — L897 delete_many annual_reviews (update_member)
# ════════════════════════════════════════════════════════════════════════════


async def test_l897_delete_many_annual_reviews_includes_club_id_filter(monkeypatch):
    """Quand `review_frequency` change, L897 supprime les scheduled reviews.
    Le filter DOIT scoper `club_id`.
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
    })

    await mb.update_member(
        member_id="mem-1",
        data=payload,
        club_id=CLUB_VERSOIX,
        current_user={"id": "u1", "email": "u@a.com"},
    )

    db.annual_reviews.delete_many.assert_called_once()
    filter_dict = db.annual_reviews.delete_many.call_args.args[0]
    assert "club_id" in filter_dict, (
        f"L897 delete_many filter sans `club_id` : {filter_dict}"
    )
    assert filter_dict["club_id"] == CLUB_VERSOIX
    # régression métier
    assert filter_dict.get("member_id") == "mem-1"
    assert filter_dict.get("status") == "scheduled"


# ════════════════════════════════════════════════════════════════════════════
#       Test 3 — L971 update_many payments billing_amount sync (update_member)
# ════════════════════════════════════════════════════════════════════════════


async def test_l971_update_many_payments_transition_price_includes_club_id_filter(monkeypatch):
    """Quand `billing_amount` change (avec valeur >0), L971 sync les payments
    pending/late vers le nouveau montant. Le filter DOIT scoper `club_id`.
    """
    db = _make_db_mock(_existing_member(billing_amount=50.0))
    _patch_common(monkeypatch, db)

    payload = _payload_mock({
        "billing_amount": 75.0,
        "exit_date": None,
        "review_frequency": "monthly",
        "billing_enabled": False,
        "annual_review_enabled": False,
        "contract_signed_date": "2026-04-01",
        "billing_cycle_type": "monthly_day",
        "billing_cycle_value": 1,
    })

    await mb.update_member(
        member_id="mem-1",
        data=payload,
        club_id=CLUB_VERSOIX,
        current_user={"id": "u1", "email": "u@a.com"},
    )

    db.payments.update_many.assert_called_once()
    filter_dict = db.payments.update_many.call_args.args[0]
    assert "club_id" in filter_dict, (
        f"L971 cascade filter sans `club_id` : {filter_dict}"
    )
    assert filter_dict["club_id"] == CLUB_VERSOIX
    assert filter_dict.get("member_id") == "mem-1"


# ════════════════════════════════════════════════════════════════════════════
#       Test 4 — L1008 update_many payments due_date recalc (update_member)
# ════════════════════════════════════════════════════════════════════════════


async def test_l1008_update_many_payments_bulk_month_includes_club_id_filter(monkeypatch):
    """Quand `contract_signed_date` change avec `interval_days` cycle, L1008
    recalcule les due_date des payments pending/late du mois. Le filter DOIT
    scoper `club_id` (en plus de member_id, due_date regex, status).
    """
    db = _make_db_mock(_existing_member(
        contract_signed_date="2026-04-01",
        billing_cycle_type="interval_days",
        billing_cycle_value=30,
        billing_amount=50.0,
    ))
    _patch_common(monkeypatch, db)

    payload = _payload_mock({
        "contract_signed_date": "2026-05-15",
        "billing_cycle_type": "interval_days",
        "billing_cycle_value": 30,
        "billing_amount": 50.0,  # unchanged (skip L971)
        "exit_date": None,
        "review_frequency": "monthly",
        "billing_enabled": False,
        "annual_review_enabled": False,
    })

    await mb.update_member(
        member_id="mem-1",
        data=payload,
        club_id=CLUB_VERSOIX,
        current_user={"id": "u1", "email": "u@a.com"},
    )

    # L1008 peut être appelé OU non selon que la nouvelle due_date tombe dans
    # le mois courant. On vérifie : si appelé, le filter scope club_id.
    if db.payments.update_many.called:
        # Le dernier appel (ou unique) doit avoir club_id
        last_call = db.payments.update_many.call_args
        filter_dict = last_call.args[0]
        assert "club_id" in filter_dict, (
            f"L1008 cascade filter sans `club_id` : {filter_dict}"
        )
        assert filter_dict["club_id"] == CLUB_VERSOIX
        assert filter_dict.get("member_id") == "mem-1"
    else:
        pytest.skip(
            "L1008 code path non déclenché (due_date hors mois courant). "
            "Test à re-tenter avec calendrier favorable."
        )


# ════════════════════════════════════════════════════════════════════════════
#       Test 5 — L1341 update_many payments renew cascade (renew_membership)
# ════════════════════════════════════════════════════════════════════════════


async def test_l1341_update_many_payments_renew_cascade_includes_club_id_filter(monkeypatch):
    """Lors du renouvellement avec un nouveau `billing_amount`, L1341 sync les
    payments pending/late du member. Le filter DOIT scoper `club_id`.
    """
    db = _make_db_mock(
        _existing_member(billing_enabled=True),
        schedule_doc={"id": "sch-1", "is_active": True},
    )
    _patch_common(monkeypatch, db)

    body = {
        "new_end_date": "2027-05-01",
        "renewal_duration": "12 mois",
        "billing_amount": 80.0,
        "notes": "renew test",
    }

    await mb.renew_membership(
        member_id="mem-1",
        body=body,
        club_id=CLUB_VERSOIX,
        current_user={"id": "u1", "email": "u@a.com"},
    )

    db.payments.update_many.assert_called_once()
    filter_dict = db.payments.update_many.call_args.args[0]
    assert "club_id" in filter_dict, (
        f"L1341 renew cascade filter sans `club_id` : {filter_dict}"
    )
    assert filter_dict["club_id"] == CLUB_VERSOIX
    assert filter_dict.get("member_id") == "mem-1"
    assert filter_dict.get("status") == {"$in": ["pending", "late"]}


# ════════════════════════════════════════════════════════════════════════════
#       Test 6 — Cross-club discriminant fort (anti-enumeration cascade)
# ════════════════════════════════════════════════════════════════════════════


async def test_cross_club_member_id_collision_does_not_cascade_other_club(monkeypatch):
    """Scénario data leak hypothétique : `find_one({"id": member_id})` retourne
    un member du club B (data orphan ou F.1 résiduel), mais l'utilisateur
    authentifié est sur le club A (Versoix via header X-Club-Id).

    Le `resolve_club_id_or_fallback` priorise `club_id` (header) → "Versoix"
    (PAS `existing.club_id` = "OTHER"). Le filter cascade composite doit
    scoper `club_id="Versoix"` — donc 0 cascade sur les payments réels du
    club B.

    Multi-tenant invariant : un user authentifié sur le club A ne peut
    JAMAIS muter des docs cascadés appartenant au club B, même si l'id
    leak l'existence.
    """
    db = _make_db_mock(_existing_member(club_id=CLUB_OTHER, exit_date=None))
    _patch_common(monkeypatch, db)

    payload = _payload_mock({
        "exit_date": "2026-06-01",
        "review_frequency": "monthly",
        "billing_amount": 50.0,
        "billing_enabled": False,
        "annual_review_enabled": False,
        "contract_signed_date": "2026-04-01",
        "billing_cycle_type": "monthly_day",
        "billing_cycle_value": 1,
    })

    await mb.update_member(
        member_id="mem-1",
        data=payload,
        club_id=CLUB_VERSOIX,  # header user (club A)
        current_user={"id": "u1", "email": "u@a.com"},
    )

    db.payments.update_many.assert_called_once()
    filter_dict = db.payments.update_many.call_args.args[0]
    # Propriété critique : le filter scope sur le club du USER (header),
    # PAS sur le club du member retourné par find_one (qui pourrait être
    # orphan/leak).
    assert filter_dict.get("club_id") == CLUB_VERSOIX, (
        f"Cross-club cascade : filter aurait dû scoper sur {CLUB_VERSOIX} "
        f"(header user) mais a {filter_dict.get('club_id')} (potentiel leak)"
    )
    assert filter_dict.get("club_id") != CLUB_OTHER, (
        "Cross-club leak : filter scope sur le club du member retourné "
        "par find_one, pas sur le club de l'utilisateur authentifié"
    )
