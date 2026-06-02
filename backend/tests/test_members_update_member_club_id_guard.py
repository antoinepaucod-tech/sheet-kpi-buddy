"""Tests régression SB B.2.3.C.2.C — isolation `update_member` (members.py L871-1141).

Pattern complet : un seul handler avec 7 dimensions d'isolation à fermer.

  T1 — gate L878 cross-club → 404         (RED : find_one id-only, doc B retourné)
  T2 — VIOLATION A.2 L884                 (RED : club_id or existing.get("club_id"))
  T3 — W10 insert payment_schedules       (RED : aucun club_id posé sur le doc inséré)
  T4 — W9/W11 update payment_schedules    (RED : filter id-only, pas {id, club_id})
  T5 — W13 log_activity source            (RED : explicit_club_id=club_id (raw header))
  T6 — R1/R2/R3 reads secondaires scopés  (RED : filtres sans club_id)
  T7 — anti-régression happy path         (GREEN doit le rester)

Mock filtre-aware aligné C.2.A/B (mut prod code, jamais mock). Aucun patch ici.
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
    """Doc membre minimal stocké en base (club_id par défaut = CLUB_OTHER)."""
    doc = {
        "id": "M1",
        "club_id": CLUB_OTHER,
        "name": "Member M1",
        "email": "m1@other.com",
        "phone": "+00000",
        "membership": "HYBRID FULL",
        "member_type": None,
        "contract_signed_date": "2026-01-01",
        "subscription_end_date": "2027-01-01",
        "exit_date": None,
        "billing_enabled": False,
        "billing_amount": 0,
        "billing_cycle_type": "monthly_day",
        "billing_cycle_value": 1,
        "billing_payment_method": "prelevement",
        "annual_review_enabled": False,
        "review_frequency": "monthly",
        "is_duo": False,
        "duo_primary": False,
        "duo_partner_id": None,
        "archived_at": None,
    }
    doc.update(overrides)
    return doc


def _payload(**overrides):
    """Payload CustomerMemberCreate minimal — billing OFF par défaut."""
    from models.members import CustomerMemberCreate
    base = {
        "name": "Member M1",
        "email": "m1@other.com",
        "phone": "+00000",
        "membership": "HYBRID FULL",
        "member_type": None,
        "contract_signed_date": "2026-01-01",
        "subscription_end_date": "2027-01-01",
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


def _make_db_mock(member_doc, *, schedule_doc=None, payment_doc=None, review_doc=None):
    """Mock multi-collections filtre-aware.

    - customer_members.find_one(filter) : match exact toutes clés du filter.
    - payment_schedules.find_one(filter) : match exact si schedule_doc fourni.
    - payments.find_one(filter) : match exact si payment_doc fourni.
    - annual_reviews.find_one(filter) : match exact si review_doc fourni.
    """
    def _make_filtered(doc):
        async def _fn(filter_dict=None, projection=None, sort=None):
            if doc is None:
                return None
            for k, v in (filter_dict or {}).items():
                target = doc.get(k)
                if isinstance(v, dict):
                    continue  # opérateurs $regex/$in etc → on ignore (mock simplifié)
                if target != v:
                    return None
            return doc
        return _fn

    members_coll = MagicMock()
    members_coll.find_one = AsyncMock(side_effect=_make_filtered(member_doc))
    members_coll.update_one = AsyncMock(return_value=MagicMock(modified_count=1))

    sched_coll = MagicMock()
    sched_coll.find_one = AsyncMock(side_effect=_make_filtered(schedule_doc))
    sched_coll.update_one = AsyncMock(return_value=MagicMock(modified_count=1))
    sched_coll.insert_one = AsyncMock()

    payments_coll = MagicMock()
    payments_coll.find_one = AsyncMock(side_effect=_make_filtered(payment_doc))
    payments_coll.update_many = AsyncMock(return_value=MagicMock(modified_count=0))
    payments_coll.insert_one = AsyncMock()

    reviews_coll = MagicMock()
    reviews_coll.find_one = AsyncMock(side_effect=_make_filtered(review_doc))
    reviews_coll.delete_many = AsyncMock(return_value=MagicMock(deleted_count=0))
    reviews_coll.insert_one = AsyncMock()

    db = MagicMock()
    db.customer_members = members_coll
    db.payment_schedules = sched_coll
    db.payments = payments_coll
    db.annual_reviews = reviews_coll
    return db


def _patch_common(monkeypatch, db, *, resolver=None):
    monkeypatch.setattr(mb, "db", db)
    if resolver is None:
        # Resolver par défaut : header brut OR fallback Versoix.
        resolver = lambda club_id, current_user, endpoint: club_id or FALLBACK
    monkeypatch.setattr(mb, "resolve_club_id_or_fallback", resolver)
    monkeypatch.setattr(mb, "log_activity", AsyncMock())


def _status(exc_info):
    return getattr(exc_info.value, "status_code", None)


# ════════════════════════════════════════════════════════════════════════════
#   T1 — Gate cross-club doit raise 404 (no-enum leak)
# ════════════════════════════════════════════════════════════════════════════


async def test_update_member_cross_club_gate_raises_404(monkeypatch):
    """🎯 RED : header X-Club-Id=A, member réel club B → cible 404.
    Aujourd'hui : find_one id-only matche → handler poursuit → resolver A.2
    violation → write principal scopé A → 0 match côté Mongo → return 200 mensonger.
    """
    doc = _existing_member(club_id=CLUB_OTHER)
    db = _make_db_mock(doc)
    _patch_common(monkeypatch, db)

    try:
        result = await mb.update_member(
            member_id="M1",
            data=_payload(),
            club_id=CLUB_A,
            current_user={"id": "u1", "email": "u@a.com"},
        )
        pytest.fail(
            f"❌ RED : cross-club update doit raise 404, mais a retourné {result!r}. "
            f"Gate L878 non scopé → handler poursuit avec doc cross-club."
        )
    except Exception as exc:
        status = getattr(exc, "status_code", None)
        assert status == 404, (
            f"❌ RED : cross-club update doit raise 404, got status={status}. "
            f"Gate L878 doit être scopé {{id, club_id: resolved}}."
        )


# ════════════════════════════════════════════════════════════════════════════
#   T2 — VIOLATION INVARIANT A.2 : header absent → fallback existing.club_id
# ════════════════════════════════════════════════════════════════════════════


async def test_update_member_header_absent_must_not_fall_back_on_doc_club_id(monkeypatch):
    """🎯 RED — A.2 strict : `club_id_resolved` doit venir EXCLUSIVEMENT du header
    (puis fallback resolver), JAMAIS de `existing.get("club_id")`.

    Construction : header X-Club-Id=None, member réel club B.
    Aujourd'hui L884 : `club_id=club_id or existing.get("club_id")` → resolved=B
                       → update_one principal écrit sur club B (cross-club !)
    Après patch    : resolved = FALLBACK_VERSOIX (ou raise 400) → update_one ne
                       doit JAMAIS être appelé avec club_id=CLUB_OTHER.

    Détection : on inspecte le filter de TOUS les update_one customer_members.
    Si l'un d'entre eux porte club_id=CLUB_OTHER → A.2 violée → RED.
    """
    doc = _existing_member(club_id=CLUB_OTHER)
    db = _make_db_mock(doc)
    _patch_common(monkeypatch, db)

    try:
        await mb.update_member(
            member_id="M1",
            data=_payload(),
            club_id=None,  # ← header absent — déclencheur du fallback A.2
            current_user={"id": "u1", "email": "u@a.com"},
        )
    except Exception:
        pass  # OK si raise (cible patch = 404), on inspecte les writes ensuite.

    update_one_calls = db.customer_members.update_one.call_args_list
    leaked = [
        c for c in update_one_calls
        if c.args and c.args[0].get("club_id") == CLUB_OTHER
    ]
    assert not leaked, (
        f"❌ RED A.2 VIOLATION : update_one customer_members appelé avec "
        f"club_id={CLUB_OTHER!r} (issu de `existing.get('club_id')` via "
        f"fallback L884 `club_id or existing.get('club_id')`). "
        f"Filters fuités : {[c.args[0] for c in leaked]}. "
        f"Le scope d'un write DOIT venir EXCLUSIVEMENT du header utilisateur "
        f"(puis fallback resolver), JAMAIS du doc lu en base."
    )


# ════════════════════════════════════════════════════════════════════════════
#   T3 — W10 insert payment_schedules : doc inséré DOIT porter club_id=resolved
# ════════════════════════════════════════════════════════════════════════════


async def test_update_member_payment_schedule_insert_must_have_club_id(monkeypatch):
    """🎯 RED W10 (members.py L1065) : `payment_schedules.insert_one` doit poser
    `club_id=club_id_resolved` sur le doc. Aujourd'hui : aucun club_id posé.

    Path : billing_enabled=True, existing_schedule=None (force branche else L1065).
    """
    doc = _existing_member(club_id=CLUB_A, billing_enabled=True)
    # schedule_doc=None → existing_schedule = None → branche insert.
    db = _make_db_mock(doc, schedule_doc=None)
    _patch_common(monkeypatch, db)

    await mb.update_member(
        member_id="M1",
        data=_payload(billing_enabled=True, billing_amount=100.0),
        club_id=CLUB_A,
        current_user={"id": "u1", "email": "u@a.com"},
    )

    insert_calls = db.payment_schedules.insert_one.call_args_list
    assert len(insert_calls) == 1, (
        f"Attendu 1 insert sur payment_schedules (W10), got {len(insert_calls)}. "
        f"Path branche : billing_enabled=True + existing_schedule=None."
    )
    inserted_doc = insert_calls[0].args[0]
    assert inserted_doc.get("club_id") == CLUB_A, (
        f"❌ RED W10 : payment_schedules.insert_one doc n'a pas `club_id={CLUB_A!r}`. "
        f"Doc inséré : {inserted_doc}. "
        f"Aujourd'hui L1065 : `schedule.model_dump()` sans aucun `club_id` posé → "
        f"orphelin par construction (faux-négatif F.1 audit C.2)."
    )


# ════════════════════════════════════════════════════════════════════════════
#   T4 — W9/W11 update payment_schedules : filter composite {id, club_id}
# ════════════════════════════════════════════════════════════════════════════


async def test_update_member_payment_schedule_update_filter_must_be_composite(monkeypatch):
    """🎯 RED W9/W11 (L1054 + L1067) : `payment_schedules.update_one` filter
    doit inclure `club_id=resolved`. Aujourd'hui : `{id: existing_schedule["id"]}`
    id-only — cible cross-club possible si IDs devinables.

    Path W9 : billing_enabled=True + existing_schedule présent → update_one L1054.
    """
    doc = _existing_member(club_id=CLUB_A, billing_enabled=True)
    existing_sched = {
        "id": "SCHED-1",
        "club_id": CLUB_A,
        "member_id": "M1",
        "is_active": True,
        "amount": 50.0,
    }
    db = _make_db_mock(doc, schedule_doc=existing_sched)
    _patch_common(monkeypatch, db)

    await mb.update_member(
        member_id="M1",
        data=_payload(billing_enabled=True, billing_amount=100.0),
        club_id=CLUB_A,
        current_user={"id": "u1", "email": "u@a.com"},
    )

    sched_update_calls = db.payment_schedules.update_one.call_args_list
    assert len(sched_update_calls) >= 1, (
        f"Attendu ≥1 update_one sur payment_schedules (W9), got {len(sched_update_calls)}."
    )
    f9 = sched_update_calls[0].args[0]
    assert "club_id" in f9 and f9.get("club_id") == CLUB_A, (
        f"❌ RED W9 : payment_schedules.update_one filter id-only : {f9}. "
        f"Doit être composite `{{id, club_id: resolved}}` pour fermer le risque "
        f"cross-club via ID devinable (faux-négatif F.1 audit C.2)."
    )


# ════════════════════════════════════════════════════════════════════════════
#   T5 — W13 log_activity doit utiliser club_id_resolved, pas le header brut
# ════════════════════════════════════════════════════════════════════════════


async def test_update_member_log_activity_uses_resolved_not_raw_header(monkeypatch):
    """🎯 RED W13 : `log_activity` reçoit `explicit_club_id=club_id` (raw header)
    au lieu de `explicit_club_id=club_id_resolved`. Si header None → log posé
    sans club_id (audit trail dégradé).

    Construction : header=None + doc club A → cible : log doit recevoir
    explicit_club_id != None (soit resolved=FALLBACK, soit le club du resolver).
    """
    doc = _existing_member(club_id=CLUB_A)
    db = _make_db_mock(doc)
    log_mock = AsyncMock()
    _patch_common(monkeypatch, db)
    monkeypatch.setattr(mb, "log_activity", log_mock)

    try:
        await mb.update_member(
            member_id="M1",
            data=_payload(),
            club_id=None,  # ← header absent
            current_user={"id": "u1", "email": "u@a.com"},
        )
    except Exception:
        pass

    # log_activity peut être appelé 1+ fois — chercher le call principal.
    main_log_calls = [
        c for c in log_mock.call_args_list
        if c.kwargs.get("action") == "member_updated"
    ]
    assert main_log_calls, (
        f"log_activity 'member_updated' attendu mais non appelé. "
        f"Calls : {log_mock.call_args_list}"
    )
    explicit = main_log_calls[0].kwargs.get("explicit_club_id")
    assert explicit is not None and explicit != CLUB_OTHER, (
        f"❌ RED W13 : log_activity explicit_club_id={explicit!r} — utilisé "
        f"`club_id` (raw header) au lieu de `club_id_resolved`. "
        f"Cible : explicit_club_id = club_id_resolved (jamais None, jamais "
        f"issu de existing.club_id cross-club)."
    )


# ════════════════════════════════════════════════════════════════════════════
#   T6 — Reads secondaires R1/R2/R3 doivent inclure club_id dans leur filter
# ════════════════════════════════════════════════════════════════════════════


async def test_update_member_secondary_reads_scoped_by_club_id(monkeypatch):
    """🎯 RED R1/R2/R3 : les 3 reads secondaires non scopés (annual_reviews
    L933, payment_schedules L994, payments L1083) doivent inclure `club_id`
    dans leur filter.

    Path : on force le déclenchement des 3 reads via change review_frequency
    (R1), branche billing (R2 + R3).
    """
    doc = _existing_member(
        club_id=CLUB_A,
        billing_enabled=True,
        billing_amount=50.0,
        review_frequency="monthly",
    )
    db = _make_db_mock(doc, schedule_doc=None, payment_doc=None, review_doc=None)
    _patch_common(monkeypatch, db)

    await mb.update_member(
        member_id="M1",
        data=_payload(
            billing_enabled=True,
            billing_amount=100.0,
            annual_review_enabled=True,
            review_frequency="quarterly",  # ← force la branche change_frequency (R1)
        ),
        club_id=CLUB_A,
        current_user={"id": "u1", "email": "u@a.com"},
    )

    # R1 — annual_reviews.find_one
    r1_calls = db.annual_reviews.find_one.call_args_list
    assert r1_calls, "R1 annual_reviews.find_one (L933) non appelé. Vérifier path frequency change."
    r1_filter = r1_calls[0].args[0]
    r1_scoped = "club_id" in r1_filter

    # R2 — payment_schedules.find_one
    r2_calls = db.payment_schedules.find_one.call_args_list
    assert r2_calls, "R2 payment_schedules.find_one (L994) non appelé. Vérifier path billing."
    r2_filter = r2_calls[0].args[0]
    r2_scoped = "club_id" in r2_filter

    # R3 — payments.find_one
    r3_calls = db.payments.find_one.call_args_list
    assert r3_calls, "R3 payments.find_one (L1083) non appelé. Vérifier path billing."
    r3_filter = r3_calls[0].args[0]
    r3_scoped = "club_id" in r3_filter

    assert r1_scoped and r2_scoped and r3_scoped, (
        f"❌ RED R1/R2/R3 reads non scopés :\n"
        f"  R1 annual_reviews.find_one filter   : {r1_filter}  (scoped={r1_scoped})\n"
        f"  R2 payment_schedules.find_one filter: {r2_filter}  (scoped={r2_scoped})\n"
        f"  R3 payments.find_one filter         : {r3_filter}  (scoped={r3_scoped})\n"
        f"Tous doivent inclure `club_id` pour éviter les décisions branchées sur des docs cross-club."
    )


# ════════════════════════════════════════════════════════════════════════════
#   T7 — Anti-régression happy path intra-club (doit rester GREEN)
# ════════════════════════════════════════════════════════════════════════════


async def test_update_member_intra_club_happy_path_preserved(monkeypatch):
    """🟢 Anti-régression : update intra-club doit réussir et le write principal
    customer_members.update_one doit porter `club_id=resolved`.
    """
    doc = _existing_member(club_id=CLUB_A)
    db = _make_db_mock(doc)
    _patch_common(monkeypatch, db)

    result = await mb.update_member(
        member_id="M1",
        data=_payload(),
        club_id=CLUB_A,
        current_user={"id": "u1", "email": "u@a.com"},
    )

    # Succès — pas d'exception, retour dict.
    assert isinstance(result, dict), f"Attendu dict, got {type(result)}"
    # Write principal scopé CLUB_A.
    update_one_calls = db.customer_members.update_one.call_args_list
    assert update_one_calls, "Aucun update_one customer_members — régression."
    primary_filter = update_one_calls[0].args[0]
    assert primary_filter.get("id") == "M1"
    assert primary_filter.get("club_id") == CLUB_A, (
        f"Write principal doit être scopé club_id=CLUB_A intra-club. Filter={primary_filter}"
    )
