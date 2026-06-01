"""Tests régression SB B.2.3.C.1 — isolation cross-club sur les 5 reads 🔴
client-facing de `members.py` (énumération d'ID exposée) :

  - L524    `get_member`                  find_one(customer_members)  → fiche complète
  - L529    `get_member` partner          find_one(customer_members)  → duo_partner_name
  - L1407   `get_member_renewals`         find(member_renewals)        → liste 100
  - L1474   `get_member_annual_reviews`   find(annual_reviews)         → liste 50
  - L1481   `get_member_activity_log`     find(activity_logs)          → liste 200

Pattern attendu après patch C.1 :
  - signature : + `club_id: Optional[str] = Depends(get_club_id)` + `current_user: dict = Depends(get_current_user)`
  - resolver : `club_id_resolved = resolve_club_id_or_fallback(club_id, current_user, endpoint=...)`
  - filter find/find_one : injection `"club_id": club_id_resolved`
  - `get_member` : MÊME resolved utilisé pour principal ET partner (un seul resolver).

Preuve comportementale (priorité) :
  - cross-club principal → 404 silencieux
  - cross-club partner (TRAP : principal in A, partner in OTHER, user in A) → 200 sur principal,
    `duo_partner_name` ABSENT (pas de raise 404 — l'utilisateur a le droit de voir M1)
  - cross-club lists → [] (PAS 404 — pas d'énumération possible)

État attendu sur code actuel : ROUGE.

0 mutation DB réelle (AsyncMock + side_effect filter-aware).
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from routers import members as mb


pytestmark = [pytest.mark.regression, pytest.mark.asyncio]


CLUB_A = "club-A-versoix"
CLUB_OTHER = "club-OTHER"


# ──────────────────────────────── Helpers ────────────────────────────────


class _FakeCursor:
    """Mock minimal motor cursor : .sort / .limit chainable, .to_list awaitable."""
    def __init__(self, items):
        self._items = items

    def sort(self, *a, **kw):
        return self

    def limit(self, n):
        return self

    async def to_list(self, length=None):
        return list(self._items)


def _member_doc(mid, club_id, partner_id=None, archived=True):
    """Member doc minimal. archived=True permet de court-circuiter le bloc
    engagement_recent (sinon get_member fetch membership_types + weekly_trainings).
    """
    return {
        "id": mid,
        "club_id": club_id,
        "name": f"Member {mid}",
        "duo_partner_id": partner_id,
        # archived_at non-None → skip block engagement L552-625
        "archived_at": "2026-05-01T00:00:00+00:00" if archived else None,
        "subscription_end_date": "2099-01-01",
    }


def _patch_common(monkeypatch, db):
    monkeypatch.setattr(mb, "db", db)
    monkeypatch.setattr(
        mb,
        "resolve_club_id_or_fallback",
        lambda club_id, current_user, endpoint: club_id or "FALLBACK_VERSOIX",
    )
    monkeypatch.setattr(mb, "log_activity", AsyncMock())


def _make_get_member_db(principal_club, partner_club=None):
    """find_one filter-aware sur customer_members :
       retourne doc seulement si la club_id (si présente dans le filter) matche
       celui du doc cible. Comportement = vrai Mongo.
    """
    async def find_one_se(filter_dict, projection=None, *a, **kw):
        cid = filter_dict.get("club_id")
        mid = filter_dict.get("id")
        if mid == "M1":
            doc = _member_doc("M1", principal_club, partner_id="P1" if partner_club else None)
            if cid is None or cid == principal_club:
                return doc
            return None
        if mid == "P1":
            doc = _member_doc("P1", partner_club or "NO_PARTNER")
            if cid is None or cid == doc["club_id"]:
                return doc
            return None
        return None

    members_coll = MagicMock()
    members_coll.find_one = AsyncMock(side_effect=find_one_se)

    db = MagicMock()
    db.customer_members = members_coll
    # Stubs minimaux pour les autres collections lues par get_member (au cas où)
    db.membership_types = MagicMock(find=MagicMock(return_value=_FakeCursor([])))
    db.weekly_trainings = MagicMock(find=MagicMock(return_value=_FakeCursor([])))
    return db


def _make_list_db(collection_name, items_for_club):
    """find filter-aware sur une sous-collection : retourne items uniquement
    si la club_id du filter matche celui des items (1 set unique). Cross-club → [].
    """
    def find_se(filter_dict, projection=None, *a, **kw):
        cid = filter_dict.get("club_id")
        # Sans scope (code actuel) : aucun filtre club_id → renvoie tout
        if cid is None:
            return _FakeCursor(items_for_club)
        # Avec scope : ne renvoie que si match
        if cid == CLUB_A:
            return _FakeCursor(items_for_club)
        return _FakeCursor([])

    coll = MagicMock()
    coll.find = MagicMock(side_effect=find_se)

    db = MagicMock()
    setattr(db, collection_name, coll)
    return db


# ════════════════════════════════════════════════════════════════════════════
#   TEST 1 — get_member principal find_one (L524)
# ════════════════════════════════════════════════════════════════════════════


async def test_get_member_principal_same_club_returns_doc(monkeypatch):
    """User club A + member M1 club A → 200 avec doc complet."""
    db = _make_get_member_db(principal_club=CLUB_A)
    _patch_common(monkeypatch, db)

    result = await mb.get_member(
        member_id="M1",
        club_id=CLUB_A,
        current_user={"id": "u1", "email": "u@a.com"},
    )
    assert result.get("id") == "M1"
    assert result.get("club_id") == CLUB_A

    # Filter de l'appel principal doit porter club_id=A
    principal_call = db.customer_members.find_one.call_args_list[0]
    f = principal_call.args[0]
    assert f.get("id") == "M1"
    assert f.get("club_id") == CLUB_A, (
        f"L524 find_one principal sans `club_id` : {f}"
    )


async def test_get_member_principal_cross_club_raises_404(monkeypatch):
    """🎯 INVARIANT C.1 : User club OTHER + member M1 (club A) → 404 silencieux."""
    db = _make_get_member_db(principal_club=CLUB_A)
    _patch_common(monkeypatch, db)

    with pytest.raises(Exception) as exc_info:
        await mb.get_member(
            member_id="M1",
            club_id=CLUB_OTHER,
            current_user={"id": "u1", "email": "u@a.com"},
        )
    assert getattr(exc_info.value, "status_code", None) == 404, (
        f"Cross-club doit raise 404 (no-enumeration), got "
        f"status={getattr(exc_info.value, 'status_code', None)}"
    )


# ════════════════════════════════════════════════════════════════════════════
#   TEST 2 — get_member partner enrichment (L529) — TRAP cross-member
# ════════════════════════════════════════════════════════════════════════════


async def test_get_member_partner_cross_club_no_leak(monkeypatch):
    """🎯 TRAP cross-member : principal M1 (club A), partner P1 (club OTHER), user A.
       Le partner lookup doit scoper `club_id=A` (le même resolved que le principal)
       → P1 non trouvé (il est dans OTHER) → réponse 200 sans duo_partner_name.

       Sans patch : filter partner {id: P1} (no club_id) → P1 trouvé → leak nom partner cross-club.
    """
    db = _make_get_member_db(principal_club=CLUB_A, partner_club=CLUB_OTHER)
    _patch_common(monkeypatch, db)

    result = await mb.get_member(
        member_id="M1",
        club_id=CLUB_A,
        current_user={"id": "u1", "email": "u@a.com"},
    )

    # Principal OK, partner name absent (filter scopé sur A → P1 dans OTHER → None)
    assert result.get("id") == "M1"
    assert not result.get("duo_partner_name"), (
        f"Partner cross-club leak : `duo_partner_name` exposé alors que P1 est cross-club. "
        f"Got: {result.get('duo_partner_name')!r}"
    )

    # Inspection filter : 2 appels find_one (principal + partner)
    calls = db.customer_members.find_one.call_args_list
    assert len(calls) >= 2, f"get_member doit appeler 2 find_one (principal + partner), got {len(calls)}"
    f_partner = calls[1].args[0]
    assert f_partner.get("id") == "P1"
    assert f_partner.get("club_id") == CLUB_A, (
        f"L529 partner find_one doit scoper sur `club_id` du REQUESTER ({CLUB_A}), "
        f"pas omettre le filtre. Got: {f_partner}"
    )


# ════════════════════════════════════════════════════════════════════════════
#   TEST 3 — get_member_renewals (L1407)
# ════════════════════════════════════════════════════════════════════════════


async def test_get_member_renewals_scopes_club_id(monkeypatch):
    """Same-club : filter find member_renewals contient club_id=A et liste retournée."""
    items = [{"id": "R1", "member_id": "M1", "club_id": CLUB_A}]
    db = _make_list_db("member_renewals", items)
    _patch_common(monkeypatch, db)

    result = await mb.get_member_renewals(
        member_id="M1",
        club_id=CLUB_A,
        current_user={"id": "u1", "email": "u@a.com"},
    )
    assert result == items
    f = db.member_renewals.find.call_args.args[0]
    assert f.get("member_id") == "M1"
    assert f.get("club_id") == CLUB_A, (
        f"L1407 renewals find sans `club_id` : {f}"
    )


async def test_get_member_renewals_cross_club_returns_empty(monkeypatch):
    """🎯 Cross-club → [] (PAS 404 — no énumération via code de retour)."""
    items = [{"id": "R1", "member_id": "M1", "club_id": CLUB_A}]
    db = _make_list_db("member_renewals", items)
    _patch_common(monkeypatch, db)

    result = await mb.get_member_renewals(
        member_id="M1",
        club_id=CLUB_OTHER,
        current_user={"id": "u1", "email": "u@a.com"},
    )
    assert result == [], (
        f"Cross-club doit retourner [] (no leak), got {result}"
    )


# ════════════════════════════════════════════════════════════════════════════
#   TEST 4 — get_member_annual_reviews (L1474)
# ════════════════════════════════════════════════════════════════════════════


async def test_get_member_annual_reviews_scopes_club_id(monkeypatch):
    items = [{"id": "AR1", "member_id": "M1", "club_id": CLUB_A, "review_date": "2026-06-01"}]
    db = _make_list_db("annual_reviews", items)
    _patch_common(monkeypatch, db)

    result = await mb.get_member_annual_reviews(
        member_id="M1",
        club_id=CLUB_A,
        current_user={"id": "u1", "email": "u@a.com"},
    )
    assert result == items
    f = db.annual_reviews.find.call_args.args[0]
    assert f.get("member_id") == "M1"
    assert f.get("club_id") == CLUB_A, (
        f"L1474 annual_reviews find sans `club_id` : {f}"
    )


async def test_get_member_annual_reviews_cross_club_returns_empty(monkeypatch):
    items = [{"id": "AR1", "member_id": "M1", "club_id": CLUB_A, "review_date": "2026-06-01"}]
    db = _make_list_db("annual_reviews", items)
    _patch_common(monkeypatch, db)

    result = await mb.get_member_annual_reviews(
        member_id="M1",
        club_id=CLUB_OTHER,
        current_user={"id": "u1", "email": "u@a.com"},
    )
    assert result == [], f"Cross-club doit retourner [], got {result}"


# ════════════════════════════════════════════════════════════════════════════
#   TEST 5 — get_member_activity_log (L1481)
# ════════════════════════════════════════════════════════════════════════════


async def test_get_member_activity_log_scopes_club_id(monkeypatch):
    items = [{"id": "L1", "member_id": "M1", "club_id": CLUB_A, "action": "create"}]
    db = _make_list_db("activity_logs", items)
    _patch_common(monkeypatch, db)

    result = await mb.get_member_activity_log(
        member_id="M1",
        club_id=CLUB_A,
        current_user={"id": "u1", "email": "u@a.com"},
    )
    assert result == items
    f = db.activity_logs.find.call_args.args[0]
    assert f.get("member_id") == "M1"
    assert f.get("club_id") == CLUB_A, (
        f"L1481 activity_logs find sans `club_id` : {f}"
    )


async def test_get_member_activity_log_cross_club_returns_empty(monkeypatch):
    items = [{"id": "L1", "member_id": "M1", "club_id": CLUB_A, "action": "create"}]
    db = _make_list_db("activity_logs", items)
    _patch_common(monkeypatch, db)

    result = await mb.get_member_activity_log(
        member_id="M1",
        club_id=CLUB_OTHER,
        current_user={"id": "u1", "email": "u@a.com"},
    )
    assert result == [], f"Cross-club doit retourner [], got {result}"
