"""Sprint C — Tests pytest pour core.member_categorization.

Couvre :
  - Mapping des 27 memberships réels → catégorie attendue (selon audit Sprint C)
  - Cas Inconnu (membership vide)
  - Déduplication DUO (1 retour par couple)
  - Non-régression : `is_active` respecte `archived_at`
"""
from __future__ import annotations
import sys
import pytest

sys.path.insert(0, "/app/backend")
from core.member_categorization import (  # noqa: E402
    get_member_category,
    get_duo_pair,
    is_active,
    _dedupe_partenaire,
    CATEGORIES,
)


# Mapping de référence (audit du 08/05/2026)
EXPECTED_CATEGORY = {
    # Coach
    "THE COACH PASS MENSUEL": "Coach",
    "THE COACH PASS - PAIEMENT ANNUEL X1": "Coach",
    "THE COACH PASS 6 MOIS - PAIEMENT X1": "Coach",
    "THE COACH ENTRÉE": "Coach",
    "VIRTUAL COACH": "Coach",
    # IFRC
    "IFRC": "IFRC",
    # Partenaire (DUO)
    "HYBRID FULL DUO - PAIEMENT MENSUEL": "Partenaire",
    "HYBRID FULL DUO - PAIEMENT ANNUEL X1": "Partenaire",
    "HYBRID FULL DUO SANS ENGAGEMENT - PAIEMENT MENSUEL": "Partenaire",
    "UNLIMITED ACCESS DUO - PAIEMENT MENSUEL": "Partenaire",
    "UNLIMITED ACCESS DUO - PAIEMENT ANNUEL X1": "Partenaire",
    # OpenGym
    "OPEN GYM - PAIEMENT MENSUEL": "OpenGym",
    "OPEN GYM - PAIEMENT ANNUEL X1": "OpenGym",
    # Challenge
    "6 WEEKS CHALLENGE": "Challenge",
    # Pret
    "PRÊT": "Pret",
    # HG (default — tout le reste sans match)
    "HYBRID FULL - PAIEMENT MENSUEL": "HG",
    "HYBRID FULL - PAIEMENT ANNUEL X1": "HG",
    "HYBRID FULL SANS ENGAGEMENT - PAIEMENT MENSUEL": "HG",
    "HYBRID FULL STUDENT - PAIEMENT MENSUEL": "HG",
    "UNLIMITED ACCESS - PAIEMENT MENSUEL": "HG",
    "UNLIMITED ACCESS - PAIEMENT X1 - ANNUEL": "HG",
    "UNLIMITED ACCESS SANS EMGAGEMENT - PAIEMENT MENSUEL": "HG",  # typo en base
    "OFFRE 6 MOIS - 499 CHF": "HG",
    "PACK 10 SESSIONS": "HG",
    "PACK 20 SESSIONS": "HG",
    "HUBFIT": "HG",
}


# Simulated membership_types collection (matches what's actually in DB for Versoix)
TYPES_BY_NAME = {
    "THE COACH PASS MENSUEL": {"is_coach_subscription": True, "is_duo": False},
    "THE COACH PASS 6 MOIS - PAIEMENT X1": {"is_coach_subscription": True, "is_duo": False},
    "THE COACH ENTRÉE": {"is_coach_subscription": True, "is_duo": False},
    "HYBRID FULL DUO - PAIEMENT MENSUEL": {"is_coach_subscription": False, "is_duo": True},
    "HYBRID FULL DUO - PAIEMENT ANNUEL X1": {"is_coach_subscription": False, "is_duo": True},
    "HYBRID FULL DUO SANS ENGAGEMENT - PAIEMENT MENSUEL": {"is_coach_subscription": False, "is_duo": True},
    "HYBRID FULL - PAIEMENT MENSUEL": {"is_coach_subscription": False, "is_duo": False},
    "HYBRID FULL - PAIEMENT ANNUEL X1": {"is_coach_subscription": False, "is_duo": False},
    "UNLIMITED ACCESS - PAIEMENT MENSUEL": {"is_coach_subscription": False, "is_duo": False},
    "UNLIMITED ACCESS - PAIEMENT X1 - ANNUEL": {"is_coach_subscription": False, "is_duo": False},
    "UNLIMITED ACCESS SANS EMGAGEMENT - PAIEMENT MENSUEL": {"is_coach_subscription": False, "is_duo": False},
    "IFRC": {"is_coach_subscription": False, "is_duo": False},
    "OPEN GYM - PAIEMENT MENSUEL": {"is_coach_subscription": False, "is_duo": False},
    "OPEN GYM - PAIEMENT ANNUEL X1": {"is_coach_subscription": False, "is_duo": False},
    "6 WEEKS CHALLENGE": {"is_coach_subscription": False, "is_duo": False},
    "OFFRE 6 MOIS - 499 CHF": {"is_coach_subscription": False, "is_duo": False},
    "PACK 10 SESSIONS": {"is_coach_subscription": False, "is_duo": False},
    "PACK 20 SESSIONS": {"is_coach_subscription": False, "is_duo": False},
    "HUBFIT": {"is_coach_subscription": False, "is_duo": False},
    "HYBRID FULL STUDENT - PAIEMENT MENSUEL": {"is_coach_subscription": False, "is_duo": False},
    # Memberships PRESENT in customer_members but ABSENT from membership_types — fallback regex must catch them
    # (omitted intentionally to test the fallback)
}


@pytest.mark.parametrize("membership,expected", list(EXPECTED_CATEGORY.items()))
def test_categorization_with_types(membership, expected):
    """27 memberships connus → catégorie attendue."""
    member = {"membership": membership}
    cat = get_member_category(member, TYPES_BY_NAME)
    assert cat == expected, f"{membership!r} → {cat!r} (attendu: {expected!r})"


@pytest.mark.parametrize("membership,expected", list(EXPECTED_CATEGORY.items()))
def test_categorization_without_types(membership, expected):
    """Sans dictionnaire de types : le fallback regex doit suffire pour les catégories non-HG.

    NB: un membership "Coach" ou "Partenaire" qui ne contient pas le keyword
    explicite échouerait — ce qui est le cas SOUHAITÉ. Aucun cas réel ne tombe
    dans cette zone (vérifié via l'audit).
    """
    member = {"membership": membership}
    cat = get_member_category(member, {})
    assert cat == expected, f"[no types] {membership!r} → {cat!r} (attendu: {expected!r})"


def test_inconnu_for_empty_membership():
    """Cas Teo Succi : membership vide → Inconnu."""
    assert get_member_category({"membership": ""}, TYPES_BY_NAME) == "Inconnu"
    assert get_member_category({"membership": None}, TYPES_BY_NAME) == "Inconnu"
    assert get_member_category({}, TYPES_BY_NAME) == "Inconnu"
    assert get_member_category({"membership": "   "}, TYPES_BY_NAME) == "Inconnu"


def test_categories_constant_complete():
    """La constante CATEGORIES couvre toutes les catégories attendues."""
    assert set(CATEGORIES) == {"HG", "Coach", "Partenaire", "IFRC", "OpenGym", "Challenge", "Pret", "Inconnu"}


# ───── DUO pairing ─────

def test_get_duo_pair_basic():
    m1 = {"id": "A", "is_duo": True, "duo_partner_id": "B"}
    m2 = {"id": "B", "is_duo": True, "duo_partner_id": "A"}
    by_id = {"A": m1, "B": m2}
    assert get_duo_pair(m1, by_id) is m2
    assert get_duo_pair(m2, by_id) is m1


def test_get_duo_pair_returns_none_if_not_duo():
    m = {"id": "A", "is_duo": False, "duo_partner_id": "B"}
    by_id = {"A": m, "B": {"id": "B"}}
    assert get_duo_pair(m, by_id) is None


def test_get_duo_pair_returns_none_if_partner_missing():
    m = {"id": "A", "is_duo": True, "duo_partner_id": "B"}
    assert get_duo_pair(m, {"A": m}) is None


# ───── Dedupe Partenaire ─────

def test_dedupe_uses_primary_flag():
    """1 paire avec duo_primary défini → 1 seule entrée (le primary)."""
    m1 = {"id": "A", "name": "Alice", "is_duo": True, "duo_partner_id": "B", "duo_primary": True}
    m2 = {"id": "B", "name": "Bob",   "is_duo": True, "duo_partner_id": "A", "duo_primary": False}
    out = _dedupe_partenaire([m1, m2])
    assert len(out) == 1
    assert out[0]["id"] == "A"


def test_dedupe_falls_back_to_oldest_created_at():
    """Aucun primary → le plus ancien created_at gagne."""
    m1 = {"id": "A", "name": "Alice", "is_duo": True, "duo_partner_id": "B", "duo_primary": False, "created_at": "2026-02-01"}
    m2 = {"id": "B", "name": "Bob",   "is_duo": True, "duo_partner_id": "A", "duo_primary": False, "created_at": "2026-01-01"}
    out = _dedupe_partenaire([m1, m2])
    assert len(out) == 1
    assert out[0]["id"] == "B"  # plus ancien


def test_dedupe_keeps_orphan_duo_member():
    """Membre DUO dont le partenaire n'est plus en base (archivé/supprimé) → conservé tel quel."""
    m1 = {"id": "A", "is_duo": True, "duo_partner_id": "GHOST"}
    out = _dedupe_partenaire([m1])
    assert len(out) == 1
    assert out[0]["id"] == "A"


def test_dedupe_real_volume():
    """Test de volume : 12 paires + 1 célibataire DUO = 13 entrées."""
    pairs = []
    for i in range(12):
        a_id = f"P{i}A"
        b_id = f"P{i}B"
        pairs.extend([
            {"id": a_id, "is_duo": True, "duo_partner_id": b_id, "duo_primary": True, "created_at": f"2026-01-{i+1:02d}"},
            {"id": b_id, "is_duo": True, "duo_partner_id": a_id, "duo_primary": False, "created_at": f"2026-01-{i+1:02d}"},
        ])
    pairs.append({"id": "ORPH", "is_duo": True, "duo_partner_id": "GONE"})
    out = _dedupe_partenaire(pairs)
    assert len(out) == 13
    primaries = [m for m in out if m.get("duo_primary")]
    assert len(primaries) == 12


# ───── is_active (régression Sprint A/B) ─────

@pytest.mark.parametrize("archived_at,expected", [
    (None, True),
    ("", True),
    (False, True),
    ("2026-04-22T10:00:00Z", False),
    ("2026-01-01", False),
])
def test_is_active(archived_at, expected):
    assert is_active({"archived_at": archived_at}) is expected


def test_is_active_missing_field():
    """Membre sans clé archived_at = actif (compat backward Sprint B)."""
    assert is_active({}) is True
