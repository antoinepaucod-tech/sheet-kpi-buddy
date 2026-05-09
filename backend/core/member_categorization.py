"""Sprint C — Helpers de catégorisation membre (read-only).

Stratégie hybride :
  1) Source primaire : flags `is_coach_subscription` / `is_duo` du document
     `membership_types` (lookup par `name`).
  2) Fallback regex sur la string `membership` du membre — couvre les 6
     memberships utilisés en base mais absents de `membership_types`.

Aucune migration de données. Aucune écriture. Juste de la dérivation.

Catégories retournées (constantes) :
  - "HG"          : membres généraux récurrents (default)
  - "Coach"       : THE COACH PASS / THE COACH ENTRÉE / VIRTUAL COACH
  - "Partenaire"  : abonnements DUO (HYBRID DUO, UNLIMITED DUO)
  - "IFRC"        : abonnement IFRC
  - "OpenGym"     : OPEN GYM
  - "Challenge"   : 6 WEEKS CHALLENGE (et variantes)
  - "Pret"        : statut spécial PRÊT
  - "Inconnu"     : membership vide/null
"""
from __future__ import annotations
from typing import Optional

CATEGORIES = ("HG", "Coach", "Partenaire", "IFRC", "OpenGym", "Challenge", "Pret", "Inconnu")


def get_member_category(
    member: dict,
    membership_types_by_name: Optional[dict] = None,
) -> str:
    """Retourne la catégorie d'un membre.

    Args:
        member: doc Mongo `customer_members`.
        membership_types_by_name: mapping `name -> membership_type_doc`.
            Optionnel — si fourni, sert de source primaire pour Coach/Partenaire
            via les flags `is_coach_subscription` / `is_duo`.

    Returns:
        Une des constantes de `CATEGORIES`.
    """
    membership = (member.get("membership") or "").strip()
    if not membership:
        return "Inconnu"

    membership_upper = membership.upper()
    type_doc = (membership_types_by_name or {}).get(membership)

    # 1) Source primaire : flags du membership_type
    if type_doc:
        if type_doc.get("is_coach_subscription") is True:
            return "Coach"
        if type_doc.get("is_duo") is True:
            return "Partenaire"

    # 2) Fallback regex (covers orphans & confirms primary classification)
    if "THE COACH" in membership_upper or "VIRTUAL COACH" in membership_upper:
        return "Coach"
    if "DUO" in membership_upper:
        return "Partenaire"
    if "IFRC" in membership_upper:
        return "IFRC"
    if "OPEN GYM" in membership_upper or "OPEN-GYM" in membership_upper:
        return "OpenGym"
    if "6 WEEKS CHALLENGE" in membership_upper or "CHALLENGE" in membership_upper:
        return "Challenge"
    if membership_upper == "PRÊT" or membership_upper == "PRET":
        return "Pret"

    return "HG"


def get_duo_pair(member: dict, all_members_by_id: dict) -> Optional[dict]:
    """Retourne le doc partenaire d'un membre DUO via duo_partner_id.

    Args:
        member: le doc membre.
        all_members_by_id: dict `member_id -> member_doc` pour lookup O(1).

    Returns:
        Le doc partenaire si trouvé, sinon None.
    """
    if not member.get("is_duo"):
        return None
    partner_id = member.get("duo_partner_id")
    if not partner_id:
        return None
    return all_members_by_id.get(partner_id)


def is_active(member: dict) -> bool:
    """True si le membre n'est pas archivé."""
    archived_at = member.get("archived_at")
    return archived_at in (None, "", False)


async def get_active_members_by_category(
    db,
    category: str,
    club_id: Optional[str] = None,
) -> list[dict]:
    """Retourne les membres actifs (non archivés) d'une catégorie pour un club.

    Pour `Partenaire`, ne retourne qu'un seul membre par couple (le primary
    déterminé par `duo_primary=True`, fallback sur `created_at` le plus
    ancien si aucun primary marqué).

    Args:
        db: Motor AsyncIOMotorDatabase.
        category: une des constantes de `CATEGORIES`.
        club_id: optionnel, filtrage par club.

    Returns:
        Liste de docs membres (sans `_id`).
    """
    query = {"$or": [{"archived_at": None}, {"archived_at": {"$exists": False}}]}
    if club_id:
        query["club_id"] = club_id

    # Charger en mémoire — volume max ~500 docs par club, négligeable
    members = await db.customer_members.find(query, {"_id": 0}).to_list(length=None)

    # Charger membership_types pour le lookup
    types_query = {"club_id": club_id} if club_id else {}
    types_list = await db.membership_types.find(types_query, {"_id": 0}).to_list(length=None)
    types_by_name = {t.get("name"): t for t in types_list if t.get("name")}

    # Catégoriser
    in_category = [m for m in members if get_member_category(m, types_by_name) == category]

    # Pour Partenaire : déduplication par couple
    if category == "Partenaire":
        in_category = _dedupe_partenaire(in_category)

    return in_category


def _dedupe_partenaire(members: list[dict]) -> list[dict]:
    """Pour les Partenaires, retourne 1 membre par couple.

    Préfère `duo_primary=True`. Si aucun primary dans le couple, prend le
    plus ancien `created_at`. Les célibataires DUO (sans partenaire actif)
    sont conservés tels quels.
    """
    by_id = {m["id"]: m for m in members if m.get("id")}
    seen_pairs: set[frozenset] = set()
    result: list[dict] = []

    for m in members:
        partner_id = m.get("duo_partner_id")
        if not partner_id or partner_id not in by_id:
            # Célibataire DUO ou partenaire archivé/absent → on garde
            result.append(m)
            continue

        # Couple déjà traité ?
        pair_key = frozenset((m["id"], partner_id))
        if pair_key in seen_pairs:
            continue
        seen_pairs.add(pair_key)

        partner = by_id[partner_id]

        # Choisir le primary
        if m.get("duo_primary"):
            result.append(m)
        elif partner.get("duo_primary"):
            result.append(partner)
        else:
            # Aucun primary → plus ancien created_at gagne
            m_ts = m.get("created_at") or ""
            p_ts = partner.get("created_at") or ""
            result.append(m if m_ts <= p_ts else partner)

    return result
