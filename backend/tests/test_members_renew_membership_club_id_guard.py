"""Tests régression SB B.2.3.C.2.D — isolation `renew_membership` (members.py L1293-1415).

7 dimensions :
  T1 — gate L1300 cross-club → 404           (RED : find_one id-only)
  T2 — VIOLATION A.2 L1306 (2e du cycle)     (RED : club_id or member.get("club_id"))
  T3 — R4 six_weeks_challenges scopé         (RED : filter {"is_active":True} sans club_id)
  T4 — R5 challenge_participants scopé        (RED : filter sans club_id)
  T5 — R6 payment_schedules scopé             (RED : filter sans club_id)
  T6 — W21 payment_schedules.update_one composite (RED : filter id-only)
  T7 — anti-régression happy path intra-club (GREEN — acquis Sprint Hardening)

Mock filtre-aware aligné C.2.A/B/C. Aucun patch ici.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from routers import members as mb


pytestmark = [pytest.mark.regression, pytest.mark.asyncio]


CLUB_A = "club-A-versoix"
CLUB_OTHER = "club-OTHER"
FALLBACK = "FALLBACK_VERSOIX"


def _existing_member(**overrides):
    doc = {
        "id": "M1",
        "club_id": CLUB_OTHER,
        "name": "Member M1",
        "membership": "HYBRID FULL",
        "subscription_end_date": "2026-06-01",
        "annual_review_enabled": False,
        "review_frequency": "annually",
        "archived_at": None,
    }
    doc.update(overrides)
    return doc


def _make_db_mock(member_doc, *, schedule_doc=None, challenge_doc=None, participant_doc=None):
    """Mock multi-collections filtre-aware aligné C.2.C."""
    def _filtered(doc):
        async def _fn(filter_dict=None, projection=None, sort=None):
            if doc is None:
                return None
            for k, v in (filter_dict or {}).items():
                target = doc.get(k)
                if isinstance(v, dict):
                    continue
                if target != v:
                    return None
            return doc
        return _fn

    members = MagicMock()
    members.find_one = AsyncMock(side_effect=_filtered(member_doc))
    members.update_one = AsyncMock(return_value=MagicMock(modified_count=1))

    renewals = MagicMock()
    renewals.insert_one = AsyncMock()

    challenges = MagicMock()
    challenges.find_one = AsyncMock(side_effect=_filtered(challenge_doc))

    participants = MagicMock()
    participants.find_one = AsyncMock(side_effect=_filtered(participant_doc))
    participants.insert_one = AsyncMock()

    schedules = MagicMock()
    schedules.find_one = AsyncMock(side_effect=_filtered(schedule_doc))
    schedules.update_one = AsyncMock(return_value=MagicMock(modified_count=1))

    payments = MagicMock()
    payments.update_many = AsyncMock(return_value=MagicMock(modified_count=0))

    reviews = MagicMock()
    reviews.insert_one = AsyncMock()

    db = MagicMock()
    db.customer_members = members
    db.member_renewals = renewals
    db.six_weeks_challenges = challenges
    db.challenge_participants = participants
    db.payment_schedules = schedules
    db.payments = payments
    db.annual_reviews = reviews
    return db


def _patch_common(monkeypatch, db, *, resolver=None):
    monkeypatch.setattr(mb, "db", db)
    if resolver is None:
        resolver = lambda club_id, current_user, endpoint: club_id or FALLBACK
    monkeypatch.setattr(mb, "resolve_club_id_or_fallback", resolver)
    monkeypatch.setattr(mb, "log_activity", AsyncMock())


# ════════════════════════════════════════════════════════════════════════════
#   T1 — Gate cross-club doit raise 404
# ════════════════════════════════════════════════════════════════════════════


async def test_renew_membership_cross_club_gate_raises_404(monkeypatch):
    """🎯 RED T1 : member réel club B, header CLUB_A → cible 404.
    Aujourd'hui : find_one id-only matche → handler poursuit avec doc cross-club.
    """
    doc = _existing_member(club_id=CLUB_OTHER)
    db = _make_db_mock(doc)
    _patch_common(monkeypatch, db)

    try:
        result = await mb.renew_membership(
            member_id="M1",
            body={"new_end_date": "2027-06-01"},
            club_id=CLUB_A,
            current_user={"id": "u1", "email": "u@a.com"},
        )
        pytest.fail(
            f"❌ RED : cross-club renew doit raise 404, got result={result!r}. "
            f"Gate L1300 non scopé → handler poursuit avec doc cross-club."
        )
    except Exception as exc:
        status = getattr(exc, "status_code", None)
        assert status == 404, (
            f"❌ RED : cross-club renew doit raise 404, got status={status}. "
            f"Gate L1300 doit être scopé {{id, club_id: resolved}}."
        )


# ════════════════════════════════════════════════════════════════════════════
#   T2 — VIOLATION A.2 (2e du cycle) : header absent → fallback member.club_id
# ════════════════════════════════════════════════════════════════════════════


async def test_renew_membership_header_absent_must_not_fall_back_on_doc_club_id(monkeypatch):
    """🎯 RED T2 — A.2 strict : `club_id_resolved` doit venir EXCLUSIVEMENT
    du header (puis fallback resolver), JAMAIS de `member.get("club_id")`.

    Construction : header None, member réel club B.
    Aujourd'hui L1306 : `club_id=club_id or member.get("club_id")` → resolved=B
                         → update_one principal cross-club.
    Après patch : resolved = FALLBACK_VERSOIX → update_one JAMAIS sur CLUB_OTHER.
    """
    doc = _existing_member(club_id=CLUB_OTHER)
    db = _make_db_mock(doc)
    _patch_common(monkeypatch, db)

    try:
        await mb.renew_membership(
            member_id="M1",
            body={"new_end_date": "2027-06-01"},
            club_id=None,  # ← header absent
            current_user={"id": "u1", "email": "u@a.com"},
        )
    except Exception:
        pass

    update_one_calls = db.customer_members.update_one.call_args_list
    leaked = [
        c for c in update_one_calls
        if c.args and c.args[0].get("club_id") == CLUB_OTHER
    ]
    assert not leaked, (
        f"❌ RED A.2 VIOLATION (2e) : update_one customer_members appelé avec "
        f"club_id={CLUB_OTHER!r} (via fallback L1306 `club_id or member.get('club_id')`). "
        f"Filters fuités : {[c.args[0] for c in leaked]}. "
        f"Le scope d'un write DOIT venir EXCLUSIVEMENT du header utilisateur."
    )


# ════════════════════════════════════════════════════════════════════════════
#   T3 — R4 six_weeks_challenges.find_one filter doit inclure club_id
# ════════════════════════════════════════════════════════════════════════════


async def test_renew_membership_r4_six_weeks_challenges_scoped(monkeypatch):
    """🎯 RED T3 : `six_weeks_challenges.find_one({"is_active":True})` doit
    inclure `club_id=resolved`. Sinon ramène un challenge d'un autre club.

    Path : body new_membership contient "challenge" → R4 déclenché.
    """
    doc = _existing_member(club_id=CLUB_A, membership="HYBRID FULL")
    chal = {"id": "C1", "club_id": CLUB_A, "is_active": True, "name": "Test"}
    db = _make_db_mock(doc, challenge_doc=chal)
    _patch_common(monkeypatch, db)

    await mb.renew_membership(
        member_id="M1",
        body={"new_end_date": "2027-06-01", "new_membership": "6 WEEK CHALLENGE"},
        club_id=CLUB_A,
        current_user={"id": "u1", "email": "u@a.com"},
    )

    r4_calls = db.six_weeks_challenges.find_one.call_args_list
    assert r4_calls, "R4 six_weeks_challenges.find_one non appelé. Vérifier path challenge."
    r4_filter = r4_calls[0].args[0]
    assert "club_id" in r4_filter and r4_filter.get("club_id") == CLUB_A, (
        f"❌ RED R4 : six_weeks_challenges.find_one filter sans `club_id` : {r4_filter}. "
        f"Doit inclure `club_id=resolved` pour éviter de matcher un challenge cross-club."
    )


# ════════════════════════════════════════════════════════════════════════════
#   T4 — R5 challenge_participants.find_one filter doit inclure club_id
# ════════════════════════════════════════════════════════════════════════════


async def test_renew_membership_r5_challenge_participants_scoped(monkeypatch):
    """🎯 RED T4 : `challenge_participants.find_one(...)` (idempotence inscription)
    doit inclure `club_id=resolved`.
    """
    doc = _existing_member(club_id=CLUB_A)
    chal = {"id": "C1", "club_id": CLUB_A, "is_active": True}
    db = _make_db_mock(doc, challenge_doc=chal, participant_doc=None)
    _patch_common(monkeypatch, db)

    await mb.renew_membership(
        member_id="M1",
        body={"new_end_date": "2027-06-01", "new_membership": "6 WEEK CHALLENGE"},
        club_id=CLUB_A,
        current_user={"id": "u1", "email": "u@a.com"},
    )

    r5_calls = db.challenge_participants.find_one.call_args_list
    assert r5_calls, "R5 challenge_participants.find_one non appelé."
    r5_filter = r5_calls[0].args[0]
    assert "club_id" in r5_filter and r5_filter.get("club_id") == CLUB_A, (
        f"❌ RED R5 : challenge_participants.find_one filter sans `club_id` : {r5_filter}. "
        f"Doit inclure `club_id=resolved` pour scoper l'idempotence d'inscription."
    )


# ════════════════════════════════════════════════════════════════════════════
#   T5 — R6 payment_schedules.find_one filter doit inclure club_id
# ════════════════════════════════════════════════════════════════════════════


async def test_renew_membership_r6_payment_schedules_scoped(monkeypatch):
    """🎯 RED T5 : `payment_schedules.find_one({"member_id":..., "is_active":True})`
    doit inclure `club_id=resolved`.

    Path : body contient au moins une clé billing_* → branche schedule update.
    """
    doc = _existing_member(club_id=CLUB_A)
    sched = {"id": "SCHED-1", "club_id": CLUB_A, "member_id": "M1", "is_active": True, "amount": 100}
    db = _make_db_mock(doc, schedule_doc=sched)
    _patch_common(monkeypatch, db)

    await mb.renew_membership(
        member_id="M1",
        body={"new_end_date": "2027-06-01", "billing_amount": 150},
        club_id=CLUB_A,
        current_user={"id": "u1", "email": "u@a.com"},
    )

    r6_calls = db.payment_schedules.find_one.call_args_list
    assert r6_calls, "R6 payment_schedules.find_one non appelé. Vérifier path billing."
    r6_filter = r6_calls[0].args[0]
    assert "club_id" in r6_filter and r6_filter.get("club_id") == CLUB_A, (
        f"❌ RED R6 : payment_schedules.find_one filter sans `club_id` : {r6_filter}. "
        f"Doit inclure `club_id=resolved`."
    )


# ════════════════════════════════════════════════════════════════════════════
#   T6 — W21 payment_schedules.update_one filter composite
# ════════════════════════════════════════════════════════════════════════════


async def test_renew_membership_w21_payment_schedules_update_filter_composite(monkeypatch):
    """🎯 RED T6 : `payment_schedules.update_one` (L1406) filter doit être
    composite `{id, club_id: resolved}`. Aujourd'hui : id-only.
    """
    doc = _existing_member(club_id=CLUB_A)
    sched = {"id": "SCHED-1", "club_id": CLUB_A, "member_id": "M1", "is_active": True, "amount": 100}
    db = _make_db_mock(doc, schedule_doc=sched)
    _patch_common(monkeypatch, db)

    await mb.renew_membership(
        member_id="M1",
        body={"new_end_date": "2027-06-01", "billing_amount": 150},
        club_id=CLUB_A,
        current_user={"id": "u1", "email": "u@a.com"},
    )

    w21_calls = db.payment_schedules.update_one.call_args_list
    assert w21_calls, "W21 payment_schedules.update_one non appelé. Vérifier branche schedule update."
    w21_filter = w21_calls[0].args[0]
    assert "club_id" in w21_filter and w21_filter.get("club_id") == CLUB_A, (
        f"❌ RED W21 : payment_schedules.update_one filter id-only : {w21_filter}. "
        f"Doit être composite `{{id, club_id: resolved}}` (acquis Sprint Hardening "
        f"sur le member_renewals etc — manquant ici, faux-négatif F.1 audit C.2)."
    )


# ════════════════════════════════════════════════════════════════════════════
#   T7 — Anti-régression happy path intra-club (W17/W18/W19/W20 GREEN)
# ════════════════════════════════════════════════════════════════════════════


async def test_renew_membership_intra_club_happy_path_preserved(monkeypatch):
    """🟢 Anti-régression : renew intra-club doit réussir et W17/W18/W19/W20
    doivent rester scopés `club_id_resolved` (acquis Sprint Hardening).
    """
    doc = _existing_member(
        club_id=CLUB_A,
        annual_review_enabled=True,
        review_frequency="annually",
    )
    chal = {"id": "C1", "club_id": CLUB_A, "is_active": True}
    db = _make_db_mock(doc, challenge_doc=chal, participant_doc=None)
    _patch_common(monkeypatch, db)

    result = await mb.renew_membership(
        member_id="M1",
        body={
            "new_end_date": "2027-06-01T00:00:00",
            "new_membership": "6 WEEK CHALLENGE",
        },
        club_id=CLUB_A,
        current_user={"id": "u1", "email": "u@a.com"},
    )

    assert isinstance(result, dict) and result.get("message") == "Abonnement renouvelé", (
        f"Happy path doit retourner dict avec message Abonnement renouvelé, got {result!r}"
    )

    # W17 : member_renewals.insert_one — doc avec club_id_resolved
    w17_calls = db.member_renewals.insert_one.call_args_list
    assert w17_calls, "W17 member_renewals.insert_one non appelé"
    assert w17_calls[0].args[0].get("club_id") == CLUB_A, (
        f"W17 doc inséré sans club_id={CLUB_A}: {w17_calls[0].args[0]}"
    )

    # W18 : challenge_participants.insert_one — doc avec club_id_resolved
    w18_calls = db.challenge_participants.insert_one.call_args_list
    assert w18_calls, "W18 challenge_participants.insert_one non appelé"
    assert w18_calls[0].args[0].get("club_id") == CLUB_A, (
        f"W18 doc inséré sans club_id={CLUB_A}: {w18_calls[0].args[0]}"
    )

    # W20 : customer_members.update_one — filter scopé
    w20_calls = db.customer_members.update_one.call_args_list
    assert w20_calls, "W20 customer_members.update_one non appelé"
    assert w20_calls[0].args[0].get("club_id") == CLUB_A, (
        f"W20 update_one filter non scopé : {w20_calls[0].args[0]}"
    )
