# Demande d'accès API bsport — CrossFit Lausanne (TRANSFORM)

## Contexte

Nous développons une plateforme interne de pilotage financier et opérationnel (TRANSFORM) pour notre box CrossFit. Nous souhaitons intégrer bsport afin d'automatiser la synchronisation des données et éliminer les saisies manuelles.

**Objectifs de l'intégration :**
1. Synchroniser automatiquement le planning des cours et la fréquentation
2. Récupérer les informations complètes des membres (contacts, abonnements)
3. Automatiser le suivi des paiements (statut, échecs, relances)
4. Relier automatiquement les coachs aux cours qu'ils donnent
5. Suivre en temps réel le taux de remplissage des cours

---

## Endpoints requis

### 1. MEMBRES / CLIENTS

| Endpoint | Méthode | Description | Champs nécessaires |
|----------|---------|-------------|-------------------|
| `/api/v1/members` ou `/api/v1/clients` | GET | Liste de tous les membres actifs et inactifs | `id`, `first_name`, `last_name`, `email`, `phone`, `status` (actif/inactif/suspendu), `created_at`, `tags` |
| `/api/v1/members/{id}` | GET | Détail d'un membre spécifique | Tous les champs ci-dessus + `address`, `birth_date`, `emergency_contact`, `notes`, `photo_url` |
| `/api/v1/members/{id}/subscriptions` | GET | Abonnements actifs et historiques d'un membre | `subscription_id`, `plan_name`, `start_date`, `end_date`, `price`, `billing_cycle`, `status`, `auto_renew` |
| `/api/v1/members/{id}/bookings` | GET | Historique des réservations d'un membre | `booking_id`, `class_id`, `class_name`, `date`, `time`, `status` (booked/attended/no-show/cancelled) |
| `/api/v1/members/{id}/attendance` | GET | Historique de présence | `date`, `class_id`, `class_name`, `checked_in`, `check_in_time` |

**Webhooks souhaités :**
- `member.created` — Nouveau membre inscrit
- `member.updated` — Modification du profil
- `member.subscription.changed` — Changement d'abonnement
- `member.deactivated` — Membre désactivé/parti

---

### 2. PLANNING / COURS / SÉANCES

| Endpoint | Méthode | Description | Champs nécessaires |
|----------|---------|-------------|-------------------|
| `/api/v1/schedule` ou `/api/v1/classes` | GET | Planning des cours (filtrable par date) | `class_id`, `name`, `description`, `date`, `start_time`, `end_time`, `coach_id`, `coach_name`, `room`, `capacity`, `booked_count`, `waitlist_count` |
| `/api/v1/classes/{id}` | GET | Détail d'un cours spécifique | Tous les champs + `attendees` (liste des participants avec statut de présence) |
| `/api/v1/classes/{id}/attendees` | GET | Liste des participants à un cours | `member_id`, `member_name`, `booking_status` (confirmed/waitlisted/cancelled), `attended` (boolean), `check_in_time` |
| `/api/v1/class-types` | GET | Types de cours disponibles | `id`, `name`, `description`, `default_duration`, `default_capacity`, `color` |

**Paramètres de filtrage nécessaires :**
- `?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD` — Plage de dates
- `?coach_id={id}` — Filtrer par coach
- `?location_id={id}` — Filtrer par salle/site

**Webhooks souhaités :**
- `class.created` — Nouveau cours planifié
- `class.updated` — Modification d'un cours (horaire, coach, capacité)
- `class.cancelled` — Cours annulé
- `booking.created` — Nouvelle réservation
- `booking.cancelled` — Annulation de réservation
- `attendance.checked_in` — Membre pointé présent

---

### 3. PAIEMENTS / FACTURATION

| Endpoint | Méthode | Description | Champs nécessaires |
|----------|---------|-------------|-------------------|
| `/api/v1/payments` ou `/api/v1/invoices` | GET | Liste des paiements (filtrable par date/statut) | `payment_id`, `member_id`, `member_name`, `amount`, `currency`, `status` (paid/pending/failed/refunded), `payment_method`, `date`, `description`, `invoice_url` |
| `/api/v1/payments/{id}` | GET | Détail d'un paiement | Tous les champs + `retry_count`, `failure_reason`, `stripe_payment_intent_id` |
| `/api/v1/members/{id}/payments` | GET | Historique des paiements d'un membre | Idem que `/payments` mais filtré par membre |
| `/api/v1/subscriptions/billing` | GET | Prochains prélèvements programmés | `member_id`, `next_billing_date`, `amount`, `subscription_plan` |

**Paramètres de filtrage nécessaires :**
- `?status=paid|pending|failed|refunded` — Filtrer par statut
- `?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD` — Plage de dates
- `?member_id={id}` — Filtrer par membre

**Webhooks souhaités :**
- `payment.succeeded` — Paiement réussi
- `payment.failed` — Échec de paiement
- `payment.refunded` — Remboursement
- `invoice.created` — Nouvelle facture générée
- `invoice.finalized` — Facture finalisée (déjà supporté selon la doc)

---

### 4. COACHS / STAFF

| Endpoint | Méthode | Description | Champs nécessaires |
|----------|---------|-------------|-------------------|
| `/api/v1/coaches` ou `/api/v1/staff` | GET | Liste des coachs | `coach_id`, `first_name`, `last_name`, `email`, `phone`, `role`, `status` (active/inactive), `specialties` |
| `/api/v1/coaches/{id}/schedule` | GET | Planning d'un coach | `class_id`, `class_name`, `date`, `start_time`, `end_time`, `attendee_count` |
| `/api/v1/coaches/{id}/stats` | GET | Statistiques d'un coach | `classes_given`, `total_attendees`, `avg_attendance`, `period` |

---

### 5. ABONNEMENTS / PLANS

| Endpoint | Méthode | Description | Champs nécessaires |
|----------|---------|-------------|-------------------|
| `/api/v1/plans` ou `/api/v1/offers` | GET | Liste des plans/offres d'abonnement | `plan_id`, `name`, `price`, `billing_cycle` (monthly/quarterly/annual), `duration`, `class_limit`, `status` (active/archived) |
| `/api/v1/subscriptions` | GET | Toutes les souscriptions actives | `subscription_id`, `member_id`, `plan_id`, `plan_name`, `start_date`, `end_date`, `status`, `next_billing_date`, `amount` |

---

### 6. STATISTIQUES / REPORTING

| Endpoint | Méthode | Description | Champs nécessaires |
|----------|---------|-------------|-------------------|
| `/api/v1/stats/attendance` | GET | Taux de fréquentation par période | `date`, `class_name`, `capacity`, `booked`, `attended`, `no_show`, `fill_rate` |
| `/api/v1/stats/revenue` | GET | Chiffre d'affaires par période | `period`, `total_revenue`, `new_subscriptions`, `renewals`, `one_time_purchases` |
| `/api/v1/stats/retention` | GET | Métriques de rétention | `period`, `active_members`, `new_members`, `churned_members`, `churn_rate` |

---

## Informations techniques

| Paramètre | Valeur |
|-----------|--------|
| **Format de données** | JSON (REST API) |
| **Authentification** | API Key / Bearer Token (OAuth2 si disponible) |
| **Fréquence de sync** | Toutes les 15 minutes (polling) + Webhooks temps réel |
| **Volume estimé** | ~100-150 membres actifs, ~30 cours/semaine, ~200 transactions/mois |
| **Environnement** | Serveur HTTPS sécurisé (hébergé cloud) |
| **Webhook endpoint** | `https://{notre-domaine}/api/webhooks/bsport` |

## Cas d'usage détaillés

### A. Synchronisation du planning (remplace la saisie manuelle)
1. Récupérer le planning hebdomadaire via `GET /classes?date_from=...&date_to=...`
2. Pour chaque cours, récupérer les participants via `GET /classes/{id}/attendees`
3. Mettre à jour automatiquement la page "KPI Cours" avec la fréquentation réelle
4. Calculer automatiquement les salaires coachs basés sur les cours donnés

### B. Validation automatique des paiements
1. Recevoir les webhooks `payment.succeeded` et `payment.failed`
2. Marquer automatiquement les paiements comme validés dans TRANSFORM
3. Créer automatiquement les transactions de revenus correspondantes
4. Alerter en cas d'échec de paiement pour relance

### C. Synchronisation des fiches membres
1. Sync quotidienne via `GET /members` pour les mises à jour
2. Remplir automatiquement : téléphone, email, adresse, abonnement actif
3. Détecter les changements de statut (actif → suspendu → parti)
4. Mettre à jour le CRM TRANSFORM en temps réel via webhooks

### D. Suivi de la fréquentation des cours
1. Récupérer le `fill_rate` (taux de remplissage) par cours
2. Afficher dans le dashboard TRANSFORM les cours les plus/moins remplis
3. Identifier les créneaux sous-performants
4. Calculer le taux de no-show par membre

---

## Contact technique

- **Entreprise :** CrossFit Lausanne
- **Plateforme :** TRANSFORM (pilotage financier et opérationnel)
- **Contact :** [Votre nom et email]
- **Identifiant bsport :** [Votre ID client bsport]
