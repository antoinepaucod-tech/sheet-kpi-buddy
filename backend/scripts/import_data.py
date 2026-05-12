"""
Comprehensive data import script for TRANSFORM
Imports: categories, members, transactions, KPIs, course KPIs, instructors
Fixes: CHALENGE typo, PIF/Recurring classification
"""
import csv
import uuid
from datetime import datetime, timezone
import pymongo

client = pymongo.MongoClient("mongodb://localhost:27017")
db = client["kpibuddy"]

ARTIFACTS = "/app/artifacts"

# Fix CHALENGE typo everywhere
def fix_chalenge(val):
    if not val:
        return val
    return val.replace("CHALENGE", "CHALLENGE").replace("chalenge", "challenge")

# Determine PIF classification by membership name
PIF_KEYWORDS = ["ANNUEL X1", "PAIEMENT X1", "6 MOIS", "PACK ", "OFFRE 6 MOIS",
                "6 WEEKS CHALLENGE", "PRÊT", "THE COACH ENTRÉE", "HUBFIT (PIF)",
                "IFRC (PIF)", "VIRTUAL COACH (PIF)"]
RECURRING_KEYWORDS = ["MENSUEL"]

def is_pif_membership(name):
    name_upper = name.upper()
    for kw in PIF_KEYWORDS:
        if kw in name_upper:
            return True
    return False

def is_duo_membership(name):
    return "DUO" in name.upper()

def is_coach_membership(name):
    upper = name.upper()
    return "THE COACH" in upper or "VIRTUAL COACH" in upper

# Category → KPI column mapping
EXPENSE_KPI_MAP = {
    "LOGICIELS": "computer_software",
    "ABONNEMENTS": "subscriptions",
    "LOYERS": "rent",
    "SALAIRES COACH": "salaires_coach",
    "TELEPHONIE": "internet_telephone",
    "REMBOURSEMENT PRÊT": "credit_repayment",
    "RETRAIT BANCOMAT": "other_expenses",
    "ALIMENTAIRE": "food_expenses",
    "PUBLICITÉ": "ad_spend",
    "SALAIRES": "salaries",
    "COURSES": "utilities",
    "FRAIS PROFESSIONNELS": "other_expenses_misc",
    "REMBOURSEMENT UNIFORME COACHS": "other_expenses_misc",
}

REVENUE_TYPE_KPI_MAP = {
    "membre": "general_eft_revenue",
    "produit": "retail_revenue",
    "service": "pt_revenue",
}

def get_kpi_column(cat_type, cat_name, revenue_type):
    if cat_type == "expense":
        return EXPENSE_KPI_MAP.get(cat_name, "other_expenses")
    elif cat_type == "revenue":
        return REVENUE_TYPE_KPI_MAP.get(revenue_type, "general_eft_revenue")
    return None


def import_categories():
    print("\n=== Importing Categories ===")
    db.accounting_categories.delete_many({})
    
    with open(f"{ARTIFACTS}/qq80b4co_categories_comptables.csv", "r") as f:
        reader = csv.DictReader(f)
        docs = []
        for r in reader:
            name = fix_chalenge(r["name"])
            cat_type = r["type"]
            revenue_type = r.get("revenue_type", "") or None
            
            doc = {
                "id": r["id"],
                "name": name,
                "type": cat_type,
                "position": int(r.get("position", 0)),
                "is_recurring": r.get("is_recurring", "f") == "t",
                "recurrence_day": int(r.get("recurrence_day", 1) or 1),
                "default_amount": float(r.get("default_amount", 0) or 0),
                "is_indefinite_recurrence": r.get("is_indefinite_recurrence", "f") == "t",
                "recurrence_end_date": r.get("recurrence_end_date") or None,
                "revenue_type": revenue_type,
                "requires_training_tracking": r.get("requires_training_tracking", "f") == "t",
                "kpi_column": get_kpi_column(cat_type, name, revenue_type),
                "color": "#3B82F6",
                "created_at": r.get("created_at", datetime.now(timezone.utc).isoformat()),
                "updated_at": r.get("updated_at", datetime.now(timezone.utc).isoformat()),
            }
            docs.append(doc)
        
        if docs:
            db.accounting_categories.insert_many(docs)
        print(f"  Imported {len(docs)} categories")
    return docs


def import_members():
    print("\n=== Importing Members ===")
    db.customer_members.delete_many({})
    
    with open(f"{ARTIFACTS}/wlfwg8wd_membres.csv", "r") as f:
        reader = csv.DictReader(f)
        docs = []
        for r in reader:
            membership = fix_chalenge(r["membership"])
            member_type = r.get("member_type", "")
            
            # Fix misclassified members based on their membership name
            if is_pif_membership(membership) and member_type != "Membres PIF":
                member_type = "Membres PIF"
            
            doc = {
                "id": r["id"],
                "name": r["name"].strip(),
                "membership": membership,
                "member_type": member_type,
                "cash_collected": float(r.get("cash_collected", 0) or 0),
                "contract_signed_date": r.get("contract_signed_date") or None,
                "subscription_end_date": r.get("subscription_end_date") or None,
                "exit_date": r.get("exit_date") or None,
                "sold_by": r.get("sold_by") or None,
                "persons_count": int(r.get("persons_count", 1) or 1),
                "subscription_group_id": r.get("subscription_group_id") or None,
                "is_primary_subscriber": r.get("is_primary_subscriber", "t") == "t",
                # Onboarding
                "onboarding_bsport": r.get("onboarding_bsport", "f") == "t",
                "onboarding_hubfit": r.get("onboarding_hubfit", "f") == "t",
                "onboarding_nutrition": r.get("onboarding_nutrition", "f") == "t",
                "questionnaire_coaching": r.get("questionnaire_coaching", "f") == "t",
                "session_introduction": r.get("session_introduction", "f") == "t",
                "onboarding_completed": False,
                # Defaults
                "email": "",
                "phone": "",
                "billing_enabled": False,
                "billing_amount": 0,
                "billing_cycle_type": "monthly_day",
                "billing_cycle_value": 1,
                "billing_payment_method": "prelevement",
                "annual_review_enabled": False,
                "review_frequency": "annually",
                "is_duo": is_duo_membership(membership) or bool(r.get("subscription_group_id")),
                "duo_partner_id": None,
                "duo_primary": r.get("is_primary_subscriber", "t") == "t" if r.get("subscription_group_id") else False,
                "notes": "",
                "created_at": r.get("created_at", datetime.now(timezone.utc).isoformat()),
                "updated_at": r.get("updated_at", datetime.now(timezone.utc).isoformat()),
            }
            docs.append(doc)
        
        if docs:
            db.customer_members.insert_many(docs)
        print(f"  Imported {len(docs)} members")
        
        # Stats
        from collections import Counter
        types = Counter(d["member_type"] for d in docs)
        for t, c in types.most_common():
            print(f"    {t}: {c}")
    return docs


def import_transactions():
    print("\n=== Importing Transactions ===")
    db.accounting_transactions.delete_many({})
    
    with open(f"{ARTIFACTS}/9kfcmco0_transactions_comptables.csv", "r") as f:
        reader = csv.DictReader(f)
        docs = []
        for r in reader:
            category = fix_chalenge(r["category"])
            
            doc = {
                "id": r["id"],
                "date": r["transaction_date"],
                "type": r["transaction_type"],
                "category": category,
                "description": r.get("service_description", "") or "",
                "client_name": (r.get("client_name", "") or "").strip(),
                "amount": float(r.get("amount", 0) or 0),
                "amount_received": float(r.get("amount_received", 0) or 0),
                "payment_method": r.get("payment_method", "") or "",
                "invoice_number": r.get("invoice_number", "") or "",
                "notes": r.get("notes", "") or "",
                "product_description": r.get("product_description", "") or "",
                "is_validated": r.get("is_validated", "f") == "t",
                "is_auto_generated": r.get("is_auto_generated", "f") == "t",
                "year": int(r.get("year", 0) or 0),
                "month": int(r.get("month", 0) or 0),
                "month_name": r.get("month_name", "") or "",
                "created_at": r.get("created_at", datetime.now(timezone.utc).isoformat()),
                "updated_at": r.get("updated_at", datetime.now(timezone.utc).isoformat()),
            }
            docs.append(doc)
        
        # Batch insert for performance
        batch_size = 500
        for i in range(0, len(docs), batch_size):
            batch = docs[i:i+batch_size]
            db.accounting_transactions.insert_many(batch)
        
        print(f"  Imported {len(docs)} transactions")
        
        from collections import Counter
        types = Counter(d["type"] for d in docs)
        for t, c in types.most_common():
            print(f"    {t}: {c}")
    return docs


MONTH_NAMES_FR = {
    1: "janvier", 2: "février", 3: "mars", 4: "avril",
    5: "mai", 6: "juin", 7: "juillet", 8: "août",
    9: "septembre", 10: "octobre", 11: "novembre", 12: "décembre"
}

def import_kpis():
    print("\n=== Importing Monthly KPIs ===")
    db.monthly_kpis.delete_many({})
    
    with open(f"{ARTIFACTS}/rs5vmm6u_kpis_mensuels.csv", "r") as f:
        reader = csv.DictReader(f)
        docs = []
        for r in reader:
            year = int(r["year"])
            month_num = int(r["month"])
            month_str = f"{year}-{month_num:02d}"
            
            def fv(key, default=0):
                """Float value from CSV"""
                val = r.get(key, default)
                try:
                    return float(val) if val else default
                except (ValueError, TypeError):
                    return default
            
            def iv(key, default=0):
                """Int value from CSV"""
                val = r.get(key, default)
                try:
                    return int(float(val)) if val else default
                except (ValueError, TypeError):
                    return default
            
            doc = {
                "id": r["id"],
                "month": month_str,
                "year": year,
                "month_name": r.get("month_name", MONTH_NAMES_FR.get(month_num, "")),
                # Revenue
                "general_eft_revenue": fv("general_eft_revenue"),
                "pt_revenue": fv("pt_revenue"),
                "retail_revenue": fv("retail_revenue"),
                "fast_cash_revenue": fv("fast_cash_revenue"),
                "total_revenue": fv("total_revenue"),
                "revenue_members": fv("general_eft_revenue"),  # Alias
                # Members
                "pif_members": iv("pif_members"),
                "recurring_general_members": iv("recurring_general_members"),
                "pt_members": iv("pt_members"),
                "total_active_members": iv("total_active_members"),
                "active_members": iv("total_active_members"),  # Alias
                "total_members": iv("total_active_members"),
                "new_members": iv("new_members", 0),
                "lost_members": iv("lost_members", 0),
                "pif_exits": iv("pif_exits"),
                "general_exits": iv("general_exits"),
                "pt_exits": iv("pt_exits"),
                "pauses": iv("pauses"),
                "pif_churn": fv("pif_churn"),
                "general_churn": fv("general_churn"),
                "pt_churn": fv("pt_churn"),
                # Funnel
                "leads": iv("leads"),
                "calls_made": iv("calls_made"),
                "scheduled": iv("scheduled"),
                "show": iv("show"),
                "close": iv("close"),
                "cash_collected": fv("cash_collected"),
                "organic_leads": iv("organic_leads"),
                "organic_close": iv("organic_close"),
                "organic_cash_collected": fv("organic_cash_collected"),
                "in_trial": iv("in_trial"),
                "trial_ending": iv("trial_ending"),
                "converted": iv("converted"),
                # Expenses (use BOTH English and French field names for compat)
                "total_expenses": fv("total_expenses"),
                "ad_spend": fv("ad_spend"),
                "rent": fv("rent"),
                "loyer": fv("rent"),  # French alias
                "repairs_maintenance": fv("repairs_maintenance"),
                "computer_software": fv("computer_software"),
                "internet_telephone": fv("internet_telephone"),
                "utilities": fv("utilities"),
                "subscriptions": fv("subscriptions"),
                "bank_finance_charges": fv("bank_finance_charges"),
                "insurance": fv("insurance"),
                "salaries": fv("salaries"),
                "salaires": fv("salaries"),  # French alias
                "salaires_coach": fv("salaries_coach"),
                "salaires_coachs": fv("salaries_coach"),  # Alias
                "food_expenses": fv("food_expenses"),
                "credit_repayment": fv("credit_repayment"),
                "marketing_spend": fv("ad_spend"),  # Alias
                "other_expenses": 0,
                "other_expenses_misc": 0,
                # Metrics
                "profit": fv("profit"),
                "net_profit": fv("profit"),
                "gym_floor_sqft": fv("gym_floor_sqft"),
                "general_acrm": fv("general_acrm"),
                "general_ltv": fv("general_ltv"),
                "pt_acrm": fv("pt_acrm"),
                "pt_ltv": fv("pt_ltv"),
                "cpl": fv("cpl"),
                "cpr": fv("cpr"),
                "cac": fv("cac"),
                "ro_ads": fv("ro_ads"),
                "total_classes": iv("total_classes"),
                # Timestamps
                "created_at": r.get("created_at", datetime.now(timezone.utc).isoformat()),
                "updated_at": r.get("updated_at", datetime.now(timezone.utc).isoformat()),
            }
            docs.append(doc)
        
        if docs:
            db.monthly_kpis.insert_many(docs)
        print(f"  Imported {len(docs)} monthly KPIs")
        for d in docs[:3]:
            print(f"    {d['month']}: rev={d['total_revenue']}, exp={d['total_expenses']}, members={d['total_active_members']}")
    return docs


def import_course_kpis():
    print("\n=== Importing Course KPIs ===")
    db.course_kpis.delete_many({})
    
    with open(f"{ARTIFACTS}/xuremajd_kpis_cours.csv", "r") as f:
        reader = csv.DictReader(f)
        docs = []
        for r in reader:
            def fv(key, default=0):
                val = r.get(key, default)
                try:
                    return float(val) if val else default
                except:
                    return default
            def iv(key, default=0):
                val = r.get(key, default)
                try:
                    return int(float(val)) if val else default
                except:
                    return default
            
            doc = {
                "id": r["id"],
                "year": int(r["year"]),
                "month": int(r["month"]),
                "month_name": r.get("month_name", ""),
                "course_name": r["course_name"],
                "day_of_week": r.get("day_of_week", ""),
                "time_slot": r.get("time_slot", ""),
                "instructor": r.get("instructor", ""),
                "max_capacity": iv("max_capacity", 13),
                "week1_attendance": iv("week1_attendance"),
                "week2_attendance": iv("week2_attendance"),
                "week3_attendance": iv("week3_attendance"),
                "week4_attendance": iv("week4_attendance"),
                "week5_attendance": iv("week5_attendance"),
                "week1_instructor": r.get("week1_instructor") or None,
                "week2_instructor": r.get("week2_instructor") or None,
                "week3_instructor": r.get("week3_instructor") or None,
                "week4_instructor": r.get("week4_instructor") or None,
                "week5_instructor": r.get("week5_instructor") or None,
                "attendance_rate": fv("attendance_rate"),
                "monthly_expenses": fv("monthly_expenses"),
                "created_at": r.get("created_at", datetime.now(timezone.utc).isoformat()),
                "updated_at": r.get("updated_at", datetime.now(timezone.utc).isoformat()),
            }
            docs.append(doc)
        
        if docs:
            db.course_kpis.insert_many(docs)
        print(f"  Imported {len(docs)} course KPIs")
    return docs


def rebuild_membership_types(members):
    print("\n=== Rebuilding Membership Types ===")
    db.membership_types.delete_many({})
    
    # Count members per membership
    from collections import Counter
    membership_counts = Counter(m["membership"] for m in members)
    
    # Build membership types from unique memberships
    docs = []
    for name, count in sorted(membership_counts.items()):
        pif = is_pif_membership(name)
        duo = is_duo_membership(name)
        coach = is_coach_membership(name)
        
        if pif:
            member_type = "Membres PIF"
        else:
            member_type = "Membres Généraux Récurrents"
        
        # Determine duration
        duration_days = None
        duration_months = 1
        if "6 WEEKS" in name.upper() or "CHALLENGE" in name.upper():
            duration_days = 42
            duration_months = 0
        elif "ANNUEL" in name.upper():
            duration_months = 12
        elif "6 MOIS" in name.upper():
            duration_months = 6
        elif "PACK" in name.upper():
            duration_months = 0
        
        doc = {
            "id": str(uuid.uuid4()),
            "name": name,
            "duration_months": duration_months,
            "duration_days": duration_days,
            "price": 0,
            "is_recurring": not pif,
            "member_type": member_type,
            "is_coach_subscription": coach,
            "is_duo": duo,
            "is_pif": pif,
            "nb_membres": count,
            "default_billing_cycle_type": "monthly_day",
            "default_billing_cycle_value": 1,
            "is_active": True,
            "display_order": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        docs.append(doc)
    
    if docs:
        db.membership_types.insert_many(docs)
    print(f"  Created {len(docs)} membership types")
    for d in docs:
        print(f"    {d['name']}: type={d['member_type']}, pif={d['is_pif']}, duo={d['is_duo']}, coach={d['is_coach_subscription']}, members={d['nb_membres']}")
    return docs


def cleanup_orphan_data():
    print("\n=== Cleaning up orphan data ===")
    # Clear data that depends on the old members
    db.annual_reviews.delete_many({})
    db.payment_schedules.delete_many({})
    db.ghl_sales.delete_many({})
    db.challenge_participants.delete_many({})
    db.recurring_transactions.delete_many({})
    db.recurring_validations.delete_many({})
    db.member_renewals.delete_many({})
    db.member_followups.delete_many({})
    print("  Cleared orphan collections")


def verify_import():
    print("\n=== Verification ===")
    collections = [
        "accounting_categories", "customer_members", "accounting_transactions",
        "monthly_kpis", "course_kpis", "membership_types"
    ]
    for c in collections:
        count = db[c].count_documents({})
        print(f"  {c}: {count} docs")
    
    # Verify no CHALENGE typo
    for c in ["accounting_categories", "customer_members", "accounting_transactions", "membership_types"]:
        chalenge_count = db[c].count_documents({"$or": [
            {"name": {"$regex": "CHALENGE"}},
            {"membership": {"$regex": "CHALENGE"}},
            {"category": {"$regex": "CHALENGE"}},
        ]})
        if chalenge_count > 0:
            print(f"  WARNING: {c} still has {chalenge_count} docs with CHALENGE typo!")
        else:
            print(f"  {c}: No CHALENGE typo found ✓")


if __name__ == "__main__":
    print("=" * 60)
    print("TRANSFORM - Full Data Import")
    print("=" * 60)
    
    cleanup_orphan_data()
    categories = import_categories()
    members = import_members()
    import_transactions()
    import_kpis()
    import_course_kpis()
    membership_types = rebuild_membership_types(members)
    verify_import()
    
    print("\n" + "=" * 60)
    print("Import complete!")
    print("=" * 60)
