"""Tests régression CS1-étendu — isolation `create_member` (members.py L727-874).

5 dimensions :
  T1 — W6 challenge_participants doit porter club_id    (RED : p_doc sans club_id)
  T2 — W5 update_one link partner composite filter      (RED : id-only)
  T3 — R1/R2/R3/R4 reads secondaires scopés             (RED : sans club_id)
  T4 — anti-régression : gate L734 header absent → 400  (GREEN, NE PAS casser)
  T5 — anti-régression happy path intra-club W1 scopé   (GREEN, acquis)

Source attendue du `club_id` : variable BRUTE `club_id` (Depends get_club_id),
garantie non-None par le gate L734. PAS via `resolve_club_id_or_fallback`
(verrou L734 plus strict que le resolver — hors scope).

Mock filtre-aware aligné C.2.A/B/C/D.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from routers import members as mb


pytestmark = [pytest.mark.regression, pytest.mark.asyncio]


VERSOIX = "0a327bf5-c759-49eb-87e4-551913f78bdb"
CLUB_OTHER = "club-OTHER"


def _payload(**overrides):
    from models.members import CustomerMemberCreate
    base = {
        "name": "Member M1",
        "email": "m1@versoix.com",
        "phone": "+41000000001",
        "membership": "HYBRID FULL",
        "member_type": None,
        "contract_signed_date": "2026-06-01",
        "subscription_end_date": "2027-06-01",
        "cash_collected": 0,
        "billing_enabled": False,
        "billing_amount": 0,
        "billing_cycle_type": "monthly_day",
        "billing_cycle_value": 1,
        "billing_payment_method": "prelevement",
        "annual_review_enabled": False,
        "review_frequency": "monthly",
        "is_duo": False,
    }
    base.update(overrides)
    return CustomerMemberCreate(**base)


def _make_db_mock(*, active_challenge=None, accounting_category=None, existing_tx=None, existing_participant=None):
    """Mock multi-collections filtre-aware."""
    def _filtered(doc):
        async def _fn(filter_dict=None, projection=None, sort=None):
            if doc is None:
                return None
            for k, v in (filter_dict or {}).items():
                if isinstance(v, dict):
                    continue
                if doc.get(k) != v:
                    return None
            return doc
        return _fn

    members = MagicMock()
    members.insert_one = AsyncMock()
    members.update_one = AsyncMock(return_value=MagicMock(modified_count=1))

    schedules = MagicMock()
    schedules.insert_one = AsyncMock()

    reviews = MagicMock()
    reviews.insert_one = AsyncMock()

    challenges = MagicMock()
    challenges.find_one = AsyncMock(side_effect=_filtered(active_challenge))

    participants = MagicMock()
    participants.find_one = AsyncMock(side_effect=_filtered(existing_participant))
    participants.insert_one = AsyncMock()

    categories = MagicMock()
    categories.find_one = AsyncMock(side_effect=_filtered(accounting_category))

    transactions = MagicMock()
    transactions.find_one = AsyncMock(side_effect=_filtered(existing_tx))
    transactions.insert_one = AsyncMock()

    db = MagicMock()
    db.customer_members = members
    db.payment_schedules = schedules
    db.annual_reviews = reviews
    db.six_weeks_challenges = challenges
    db.challenge_participants = participants
    db.accounting_categories = categories
    db.accounting_transactions = transactions
    return db


def _patch_common(monkeypatch, db):
    monkeypatch.setattr(mb, "db", db)
    monkeypatch.setattr(mb, "log_activity", AsyncMock())
    # _auto_recalculate_kpis est importé localement dans le handler — patcher le module source
    import routers.transactions as tx_mod
    monkeypatch.setattr(tx_mod, "_auto_recalculate_kpis", AsyncMock())


# ════════════════════════════════════════════════════════════════════════════
#   T1 — W6 challenge_participants doit porter club_id sur le doc inséré
# ════════════════════════════════════════════════════════════════════════════


async def test_create_member_w6_challenge_participant_must_have_club_id(monkeypatch):
    """🎯 RED W6 (CS1) : `challenge_participants.insert_one(p_doc)` doit poser
    `p_doc["club_id"] = club_id` AVANT l'insert. Aujourd'hui L839 : aucun
    club_id posé → orphelin (matérialisé : 7 docs Versoix du 26/05 en prod).

    Path : membership contient "challenge" + active_challenge présent + pas
    déjà participant → branche L832-839 fire.
    """
    chal = {"id": "C1", "club_id": VERSOIX, "is_active": True, "name": "Test"}
    db = _make_db_mock(active_challenge=chal, existing_participant=None)
    _patch_common(monkeypatch, db)

    await mb.create_member(
        data=_payload(membership="6 WEEK CHALLENGE"),
        club_id=VERSOIX,
        current_user={"id": "u1", "email": "u@versoix.com"},
    )

    insert_calls = db.challenge_participants.insert_one.call_args_list
    assert len(insert_calls) == 1, (
        f"Attendu 1 insert challenge_participants (W6), got {len(insert_calls)}. "
        f"Vérifier path membership='challenge' + active_challenge présent."
    )
    inserted_doc = insert_calls[0].args[0]
    assert inserted_doc.get("club_id") == VERSOIX, (
        f"❌ RED W6 (CS1) : challenge_participants.insert_one doc n'a pas "
        f"`club_id={VERSOIX!r}`. Doc inséré : {inserted_doc}. "
        f"Aujourd'hui L838-839 : `p_doc = participant.model_dump()` puis insert "
        f"direct — aucune ligne `p_doc['club_id'] = club_id` (jumelle de "
        f"W2/W3/W4/W7 manquante). Cause racine des 7 orphelins prod du 26/05."
    )


# ════════════════════════════════════════════════════════════════════════════
#   T2 — W5 update_one link primary→partner doit avoir filter composite
# ════════════════════════════════════════════════════════════════════════════


async def test_create_member_w5_link_partner_filter_must_be_composite(monkeypatch):
    """🎯 RED W5 : `customer_members.update_one(filter, ...)` (link primary
    vers partner DUO, L816) filter doit être composite `{id, club_id}`.
    Aujourd'hui : `{"id": doc["id"]}` id-only.

    Path : is_duo=True + duo_partner_name renseigné → branche L794 fire.
    """
    db = _make_db_mock()
    _patch_common(monkeypatch, db)

    await mb.create_member(
        data=_payload(
            is_duo=True,
            duo_partner_name="Partner DUO",
            duo_partner_email="partner@versoix.com",
            duo_partner_phone="+41000000002",
        ),
        club_id=VERSOIX,
        current_user={"id": "u1", "email": "u@versoix.com"},
    )

    update_one_calls = db.customer_members.update_one.call_args_list
    assert update_one_calls, (
        f"W5 update_one(link partner) non appelé. "
        f"Vérifier path is_duo=True + duo_partner_name."
    )
    w5_filter = update_one_calls[0].args[0]
    assert "club_id" in w5_filter and w5_filter.get("club_id") == VERSOIX, (
        f"❌ RED W5 : update_one(link primary→partner) filter id-only : {w5_filter}. "
        f"Doit être composite `{{id, club_id: club_id}}` (jumeau CS1 non-audité, "
        f"cohérence avec le pattern C.2)."
    )


# ════════════════════════════════════════════════════════════════════════════
#   T3 — R1/R2/R3/R4 reads secondaires scopés par club_id
# ════════════════════════════════════════════════════════════════════════════


async def test_create_member_secondary_reads_scoped_by_club_id(monkeypatch):
    """🎯 RED R1/R2/R3/R4 : les 4 reads secondaires doivent inclure `club_id`
    dans leur filter.

    Path : membership="challenge" (déclenche R1+R2) + cash_collected>0
    (déclenche R3+R4).
    """
    chal = {"id": "C1", "club_id": VERSOIX, "is_active": True}
    cat = {"name": "ABONNEMENTS", "club_id": VERSOIX, "type": "revenue", "kpi_column": "revenue_members"}
    db = _make_db_mock(active_challenge=chal, accounting_category=cat, existing_participant=None, existing_tx=None)
    _patch_common(monkeypatch, db)

    await mb.create_member(
        data=_payload(membership="6 WEEK CHALLENGE", cash_collected=100),
        club_id=VERSOIX,
        current_user={"id": "u1", "email": "u@versoix.com"},
    )

    # R1 — six_weeks_challenges
    r1_calls = db.six_weeks_challenges.find_one.call_args_list
    assert r1_calls, "R1 six_weeks_challenges.find_one non appelé"
    r1_f = r1_calls[0].args[0]
    r1_ok = "club_id" in r1_f and r1_f.get("club_id") == VERSOIX

    # R2 — challenge_participants idempotence
    r2_calls = db.challenge_participants.find_one.call_args_list
    assert r2_calls, "R2 challenge_participants.find_one non appelé"
    r2_f = r2_calls[0].args[0]
    r2_ok = "club_id" in r2_f and r2_f.get("club_id") == VERSOIX

    # R3 — accounting_categories
    r3_calls = db.accounting_categories.find_one.call_args_list
    assert r3_calls, "R3 accounting_categories.find_one non appelé"
    r3_f = r3_calls[0].args[0]
    r3_ok = "club_id" in r3_f and r3_f.get("club_id") == VERSOIX

    # R4 — accounting_transactions idempotence
    r4_calls = db.accounting_transactions.find_one.call_args_list
    assert r4_calls, "R4 accounting_transactions.find_one non appelé"
    r4_f = r4_calls[0].args[0]
    r4_ok = "club_id" in r4_f and r4_f.get("club_id") == VERSOIX

    assert r1_ok and r2_ok and r3_ok and r4_ok, (
        f"❌ RED reads secondaires non scopés :\n"
        f"  R1 six_weeks_challenges.find_one       : {r1_f}  (scoped={r1_ok})\n"
        f"  R2 challenge_participants.find_one     : {r2_f}  (scoped={r2_ok})\n"
        f"  R3 accounting_categories.find_one      : {r3_f}  (scoped={r3_ok})\n"
        f"  R4 accounting_transactions.find_one    : {r4_f}  (scoped={r4_ok})\n"
        f"Tous doivent inclure `club_id` pour éviter de matcher des docs cross-club "
        f"(notamment R3 — `accounting_categories` est multi-tenant : 41/41 docs prod "
        f"portent un club_id)."
    )


# ════════════════════════════════════════════════════════════════════════════
#   T4 — Anti-régression : gate L734 (header absent → 400) reste intact
# ════════════════════════════════════════════════════════════════════════════


async def test_create_member_missing_club_id_header_returns_400(monkeypatch):
    """🟢 Anti-régression : le gate L733-734 doit continuer à raise 400 quand
    `club_id` est None. Ce verrou est l'équivalent A.2-strict de
    `create_member` (plus strict que `resolve_club_id_or_fallback`).
    """
    db = _make_db_mock()
    _patch_common(monkeypatch, db)

    try:
        await mb.create_member(
            data=_payload(),
            club_id=None,  # ← header absent
            current_user={"id": "u1", "email": "u@versoix.com"},
        )
        pytest.fail("create_member doit raise 400 quand club_id est None")
    except Exception as exc:
        status = getattr(exc, "status_code", None)
        detail = getattr(exc, "detail", None)
        assert status == 400, f"Attendu 400, got status={status} detail={detail!r}"
        assert "Club ID" in (detail or ""), f"Detail attendu mentionne 'Club ID', got {detail!r}"

    # Aucun write ne doit avoir eu lieu.
    assert db.customer_members.insert_one.call_count == 0, (
        f"Aucun write ne doit tourner si club_id None. "
        f"insert_one calls={db.customer_members.insert_one.call_count}"
    )


# ════════════════════════════════════════════════════════════════════════════
#   T5 — Anti-régression happy path : W1 customer_members posé club_id
# ════════════════════════════════════════════════════════════════════════════


async def test_create_member_intra_club_happy_path_w1_scoped(monkeypatch):
    """🟢 Anti-régression : create intra-club Versoix → W1 doc inséré porte
    `club_id=VERSOIX`. Acquis depuis Sprint Hardening — doit le rester.
    """
    db = _make_db_mock()
    _patch_common(monkeypatch, db)

    result = await mb.create_member(
        data=_payload(),
        club_id=VERSOIX,
        current_user={"id": "u1", "email": "u@versoix.com"},
    )

    assert isinstance(result, dict) and result.get("club_id") == VERSOIX, (
        f"Happy path doit retourner doc avec club_id={VERSOIX}, got {result!r}"
    )

    insert_calls = db.customer_members.insert_one.call_args_list
    assert insert_calls, "W1 customer_members.insert_one non appelé"
    w1_doc = insert_calls[0].args[0]
    assert w1_doc.get("club_id") == VERSOIX, (
        f"W1 doc inséré sans club_id={VERSOIX}: {w1_doc}"
    )
