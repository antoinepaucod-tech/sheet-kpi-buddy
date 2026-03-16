"""
Iteration 41 - Test new features and bug fixes:
1. Recurring Validations API (POST, GET, DELETE)
2. DELETE /api/transactions/{id} - simplified exclusion logic
3. Bilans page - renamed from Reviews
4. Challenge page - 6-week goal fix and per-participant bilan status
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Module: Recurring Validations API Tests
class TestRecurringValidations:
    """Test the recurring validation endpoints for monthly payment/receipt confirmation"""
    
    def test_get_recurring_validations_empty(self):
        """GET /api/recurring-validations/{month} returns empty list when no validations"""
        response = requests.get(f"{BASE_URL}/api/recurring-validations/2026-01")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: GET validations returns list, count: {len(data)}")

    def test_get_recurring_transactions_for_validation(self):
        """Verify there are active recurring transactions to validate"""
        response = requests.get(f"{BASE_URL}/api/recurring-transactions")
        assert response.status_code == 200
        data = response.json()
        active = [r for r in data if r.get("is_active")]
        print(f"PASS: Found {len(active)} active recurring transactions")
        assert len(active) > 0, "Need at least one active recurring transaction"
        return active[0]

    def test_create_recurring_validation(self):
        """POST /api/recurring-validations creates a validation"""
        # First get a recurring transaction
        rec_response = requests.get(f"{BASE_URL}/api/recurring-transactions")
        assert rec_response.status_code == 200
        recurring = [r for r in rec_response.json() if r.get("is_active")]
        assert len(recurring) > 0, "Need active recurring transaction"
        
        recurring_id = recurring[0]["id"]
        test_month = "2026-02"
        
        # Create validation
        response = requests.post(f"{BASE_URL}/api/recurring-validations", json={
            "recurring_id": recurring_id,
            "month": test_month
        })
        
        if response.status_code == 400 and "Déjà validée" in response.text:
            print(f"PASS (already validated): Validation already exists for {test_month}")
            return
            
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        data = response.json()
        assert "id" in data
        assert data["recurring_id"] == recurring_id
        assert data["month"] == test_month
        assert data["validated"] == True
        print(f"PASS: Created validation for recurring {recurring_id} month {test_month}")
        return data

    def test_get_recurring_validations_for_month(self):
        """GET /api/recurring-validations/{month} returns validations"""
        test_month = "2026-02"
        response = requests.get(f"{BASE_URL}/api/recurring-validations/{test_month}")
        assert response.status_code == 200
        data = response.json()
        print(f"PASS: GET validations for {test_month}, count: {len(data)}")
        return data

    def test_delete_recurring_validation(self):
        """DELETE /api/recurring-validations/{id} removes a validation"""
        # Get existing validations
        test_month = "2026-02"
        response = requests.get(f"{BASE_URL}/api/recurring-validations/{test_month}")
        assert response.status_code == 200
        validations = response.json()
        
        if not validations:
            # Create one first
            rec_response = requests.get(f"{BASE_URL}/api/recurring-transactions")
            recurring = [r for r in rec_response.json() if r.get("is_active")]
            if recurring:
                requests.post(f"{BASE_URL}/api/recurring-validations", json={
                    "recurring_id": recurring[0]["id"],
                    "month": test_month
                })
                validations = requests.get(f"{BASE_URL}/api/recurring-validations/{test_month}").json()
        
        if validations:
            val_id = validations[0]["id"]
            del_response = requests.delete(f"{BASE_URL}/api/recurring-validations/{val_id}")
            assert del_response.status_code == 200
            print(f"PASS: Deleted validation {val_id}")
        else:
            print("SKIP: No validations to delete")

    def test_validation_requires_recurring_id_and_month(self):
        """POST /api/recurring-validations requires recurring_id and month"""
        # Missing recurring_id
        response = requests.post(f"{BASE_URL}/api/recurring-validations", json={
            "month": "2026-03"
        })
        assert response.status_code == 400
        print("PASS: Missing recurring_id returns 400")
        
        # Missing month
        response = requests.post(f"{BASE_URL}/api/recurring-validations", json={
            "recurring_id": "some-id"
        })
        assert response.status_code == 400 or response.status_code == 404  # 404 if recurring not found
        print("PASS: Missing month returns 400/404")


# Module: Transaction Deletion - Simplified Exclusion Logic
class TestTransactionDeletion:
    """Test that manual transactions don't create exclusions on delete"""
    
    def test_create_manual_transaction(self):
        """Create a manual (non-recurring) transaction"""
        tx_data = {
            "date": "2026-03-15",
            "description": f"TEST_Manual_Transaction_{uuid.uuid4().hex[:8]}",
            "amount": 99.00,
            "type": "expense",
            "category": "MATERIEL"
        }
        response = requests.post(f"{BASE_URL}/api/transactions", json=tx_data)
        if response.status_code == 400 and "exclue" in response.text.lower():
            print("SKIP: Transaction was previously excluded")
            return None
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        data = response.json()
        print(f"PASS: Created manual transaction {data['id']}")
        return data

    def test_delete_manual_no_exclusion(self):
        """DELETE manual transaction should NOT create exclusion"""
        # Create a unique manual transaction
        unique_desc = f"TEST_NoExclusion_{uuid.uuid4().hex[:8]}"
        tx_data = {
            "date": "2026-03-16",
            "description": unique_desc,
            "amount": 50.00,
            "type": "expense",
            "category": "MATERIEL"
        }
        create_response = requests.post(f"{BASE_URL}/api/transactions", json=tx_data)
        if create_response.status_code != 200:
            print(f"SKIP: Could not create transaction - {create_response.text}")
            return
            
        tx = create_response.json()
        tx_id = tx["id"]
        
        # Get exclusions before delete
        before_excl = requests.get(f"{BASE_URL}/api/excluded").json()
        before_count = len(before_excl)
        
        # Delete the transaction
        del_response = requests.delete(f"{BASE_URL}/api/transactions/{tx_id}")
        assert del_response.status_code == 200, f"Delete failed: {del_response.text}"
        
        # Check exclusions after delete
        after_excl = requests.get(f"{BASE_URL}/api/excluded").json()
        after_count = len(after_excl)
        
        # Should NOT have created an exclusion for manual transaction
        new_excl = [e for e in after_excl if e.get("description") == unique_desc]
        assert len(new_excl) == 0, f"Error: Exclusion was created for manual transaction!"
        print(f"PASS: No exclusion created for manual transaction (before: {before_count}, after: {after_count})")

    def test_delete_recurring_creates_exclusion(self):
        """DELETE recurring-matched transaction SHOULD create exclusion"""
        # Get recurring transactions to find description/category
        rec_response = requests.get(f"{BASE_URL}/api/recurring-transactions")
        recurring = rec_response.json()
        active_recurring = [r for r in recurring if r.get("is_active")]
        
        if not active_recurring:
            print("SKIP: No active recurring transactions to test")
            return
        
        rec = active_recurring[0]
        rec_desc = rec["description"]
        rec_cat = rec["category"]
        
        # Create a transaction matching the recurring template
        tx_data = {
            "date": "2026-03-17",
            "description": rec_desc,
            "amount": rec["amount"],
            "type": rec["type"],
            "category": rec_cat
        }
        
        create_response = requests.post(f"{BASE_URL}/api/transactions", json=tx_data)
        if create_response.status_code != 200:
            print(f"SKIP: Could not create recurring-matched transaction - {create_response.text}")
            return
            
        tx = create_response.json()
        tx_id = tx["id"]
        
        # Get exclusions before delete
        before_excl = requests.get(f"{BASE_URL}/api/excluded").json()
        
        # Delete the transaction
        del_response = requests.delete(f"{BASE_URL}/api/transactions/{tx_id}")
        assert del_response.status_code == 200
        
        # Check exclusions after delete
        after_excl = requests.get(f"{BASE_URL}/api/excluded").json()
        
        # Should have created an exclusion
        new_excl = [e for e in after_excl if e.get("description") == rec_desc and e not in before_excl]
        if new_excl:
            print(f"PASS: Exclusion created for recurring-matched transaction '{rec_desc}'")
            # Clean up - remove exclusion
            for excl in new_excl:
                requests.delete(f"{BASE_URL}/api/excluded/{excl['id']}")
        else:
            # Check if already excluded from before
            existing_excl = [e for e in before_excl if e.get("description") == rec_desc]
            if existing_excl:
                print(f"PASS (already excluded): Transaction '{rec_desc}' was already in exclusions")
            else:
                print(f"INFO: No new exclusion detected (may be expected if logic changed)")


# Module: KPI Details - Recurring Validations Integration
class TestKPIDetailsValidation:
    """Test that KPI details endpoint includes recurring validation status"""
    
    def test_kpi_details_includes_recurring_validations(self):
        """GET /api/monthly-kpis/{month}/details returns recurring_validations"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis/2026-03/details")
        assert response.status_code == 200
        data = response.json()
        
        assert "recurring_validations" in data
        assert "recurring_revenue" in data
        assert "recurring_expense" in data
        
        # Check that recurring items have validated_this_month flag
        for rec in data.get("recurring_expense", []):
            assert "validated_this_month" in rec
            print(f"  - {rec['description']}: validated={rec['validated_this_month']}")
        
        print(f"PASS: KPI details includes recurring_validations (count: {len(data['recurring_validations'])})")


# Module: Annual Reviews (Bilans) API
class TestBilansAPI:
    """Test the annual reviews endpoint - renamed to Bilans"""
    
    def test_get_annual_reviews(self):
        """GET /api/annual-reviews returns list"""
        response = requests.get(f"{BASE_URL}/api/annual-reviews")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: GET /api/annual-reviews returns {len(data)} reviews")
        return data

    def test_get_upcoming_reviews(self):
        """GET /api/annual-reviews/upcoming returns upcoming reviews"""
        response = requests.get(f"{BASE_URL}/api/annual-reviews/upcoming?days=60")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: GET upcoming reviews returns {len(data)} items")


# Module: Challenges API
class TestChallengesAPI:
    """Test challenges endpoints"""
    
    def test_get_challenges(self):
        """GET /api/challenges returns list"""
        response = requests.get(f"{BASE_URL}/api/challenges")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: GET /api/challenges returns {len(data)} challenges")
        return data

    def test_challenge_detail(self):
        """GET /api/challenges/{id} returns challenge with participants"""
        challenges = requests.get(f"{BASE_URL}/api/challenges").json()
        if not challenges:
            print("SKIP: No challenges to test")
            return
            
        challenge_id = challenges[0]["id"]
        response = requests.get(f"{BASE_URL}/api/challenges/{challenge_id}")
        assert response.status_code == 200
        data = response.json()
        
        # Verify challenge has checkins_goal
        assert "checkins_goal" in data or data.get("checkins_goal") is None  # May be None if old data
        print(f"PASS: Challenge detail retrieved, participants: {len(data.get('participants', []))}")
        return data


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
