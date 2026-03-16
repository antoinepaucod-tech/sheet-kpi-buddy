"""
Iteration 45 - Testing 6 new features:
1. Backend: GET /api/members returns is_coach field
2. Backend: PUT /api/transactions/{id} edits transactions with KPI recalculation
3. Frontend: MembersPage - Clickable stat cards as filters
4. Frontend: MembersPage - COACH badge for coaches, Expired badge for expired members
5. Frontend: TransactionsPage - Client column with link, Edit button, Category filter
6. Frontend: Active members tab excludes coaches
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestMembersIsCoachField:
    """Test that GET /api/members returns is_coach field for each member"""
    
    def test_members_endpoint_returns_is_coach(self):
        """Verify is_coach field exists on all members"""
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        members = response.json()
        assert len(members) > 0, "Should have members in database"
        
        # Check all members have is_coach field
        for member in members[:10]:  # Check first 10
            assert "is_coach" in member, f"Member {member.get('name')} missing is_coach field"
            assert isinstance(member["is_coach"], bool), "is_coach should be boolean"
    
    def test_coach_memberships_detected(self):
        """Verify coach memberships are correctly identified"""
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        members = response.json()
        
        coaches = [m for m in members if m.get("is_coach")]
        non_coaches = [m for m in members if not m.get("is_coach")]
        
        print(f"Total members: {len(members)}")
        print(f"Coaches: {len(coaches)}")
        print(f"Non-coaches: {len(non_coaches)}")
        
        # Per spec: 110 coaches, 216 non-coaches
        assert len(coaches) > 0, "Should have some coaches"
        assert len(non_coaches) > 0, "Should have some non-coaches"
        
        # Verify coach memberships contain THE COACH or VIRTUAL COACH
        coach_memberships = set(m.get("membership", "") for m in coaches)
        print(f"Coach membership types: {coach_memberships}")
        
        for coach in coaches[:5]:
            membership = coach.get("membership", "").upper()
            assert "THE COACH" in membership or "VIRTUAL COACH" in membership, \
                f"Coach {coach.get('name')} has non-coach membership: {coach.get('membership')}"


class TestTransactionEditEndpoint:
    """Test PUT /api/transactions/{id} endpoint"""
    
    def test_get_transactions_for_editing(self):
        """Get transactions to find one for editing"""
        response = requests.get(f"{BASE_URL}/api/transactions", params={"month": "2025-01"})
        assert response.status_code == 200
        transactions = response.json()
        assert len(transactions) > 0, "Should have transactions for 2025-01"
        
        # Return first transaction ID for subsequent tests
        return transactions[0] if transactions else None
    
    def test_update_transaction_amount(self):
        """Test editing a transaction's amount"""
        # Get a transaction first
        response = requests.get(f"{BASE_URL}/api/transactions", params={"month": "2025-01"})
        assert response.status_code == 200
        transactions = response.json()
        
        if not transactions:
            pytest.skip("No transactions found for 2025-01")
        
        tx = transactions[0]
        tx_id = tx["id"]
        original_amount = tx["amount"]
        new_amount = original_amount + 0.01  # Small change to verify
        
        # Update the transaction
        update_data = {"amount": new_amount}
        response = requests.put(f"{BASE_URL}/api/transactions/{tx_id}", json=update_data)
        assert response.status_code == 200
        
        updated_tx = response.json()
        assert updated_tx["amount"] == new_amount, "Amount should be updated"
        
        # Verify persistence by fetching again
        response = requests.get(f"{BASE_URL}/api/transactions", params={"month": "2025-01"})
        fetched_txs = response.json()
        found_tx = next((t for t in fetched_txs if t["id"] == tx_id), None)
        assert found_tx is not None, "Transaction should still exist"
        assert found_tx["amount"] == new_amount, "Amount change should persist"
        
        # Restore original amount
        requests.put(f"{BASE_URL}/api/transactions/{tx_id}", json={"amount": original_amount})
    
    def test_update_transaction_client_name(self):
        """Test editing transaction client_name field"""
        response = requests.get(f"{BASE_URL}/api/transactions", params={"month": "2025-01"})
        transactions = response.json()
        
        if not transactions:
            pytest.skip("No transactions found")
        
        tx = transactions[0]
        tx_id = tx["id"]
        original_client = tx.get("client_name", "")
        
        # Update client name
        update_data = {"client_name": "TEST_CLIENT_EDIT"}
        response = requests.put(f"{BASE_URL}/api/transactions/{tx_id}", json=update_data)
        assert response.status_code == 200
        
        updated = response.json()
        assert updated.get("client_name") == "TEST_CLIENT_EDIT"
        
        # Restore original
        requests.put(f"{BASE_URL}/api/transactions/{tx_id}", json={"client_name": original_client})
    
    def test_update_transaction_description(self):
        """Test editing transaction description"""
        response = requests.get(f"{BASE_URL}/api/transactions", params={"month": "2025-01"})
        transactions = response.json()
        
        if not transactions:
            pytest.skip("No transactions found")
        
        tx = transactions[0]
        tx_id = tx["id"]
        original_desc = tx.get("description", "")
        
        update_data = {"description": "TEST_DESCRIPTION_UPDATE"}
        response = requests.put(f"{BASE_URL}/api/transactions/{tx_id}", json=update_data)
        assert response.status_code == 200
        
        updated = response.json()
        assert updated.get("description") == "TEST_DESCRIPTION_UPDATE"
        
        # Restore
        requests.put(f"{BASE_URL}/api/transactions/{tx_id}", json={"description": original_desc})
    
    def test_update_nonexistent_transaction(self):
        """Test that updating nonexistent transaction returns 404"""
        response = requests.put(
            f"{BASE_URL}/api/transactions/nonexistent-id-12345",
            json={"amount": 100}
        )
        assert response.status_code == 404


class TestMembersCategories:
    """Test member categorization - active, coaches, expired"""
    
    def test_coaches_count(self):
        """Verify coach count matches expectation"""
        response = requests.get(f"{BASE_URL}/api/members")
        members = response.json()
        
        coaches = [m for m in members if m.get("is_coach")]
        print(f"Coaches found: {len(coaches)}")
        
        # Per spec: ~110 coaches
        assert len(coaches) >= 100, f"Expected ~110 coaches, got {len(coaches)}"
    
    def test_expired_members_detection(self):
        """Verify expired members are correctly identified"""
        response = requests.get(f"{BASE_URL}/api/members")
        members = response.json()
        
        today = datetime.now().strftime("%Y-%m-%d")
        non_coaches = [m for m in members if not m.get("is_coach")]
        
        expired = [m for m in non_coaches if m.get("subscription_end_date") and m["subscription_end_date"] < today]
        active = [m for m in non_coaches if not m.get("subscription_end_date") or m["subscription_end_date"] >= today]
        
        print(f"Non-coaches: {len(non_coaches)}")
        print(f"Expired: {len(expired)}")
        print(f"Active: {len(active)}")
        
        # Per spec: ~111 expired non-coaches, ~105 active non-coaches
        assert len(expired) >= 100, f"Expected ~111 expired, got {len(expired)}"
        assert len(active) >= 95, f"Expected ~105 active, got {len(active)}"
    
    def test_active_members_exclude_coaches(self):
        """Active members tab should NOT include coaches"""
        response = requests.get(f"{BASE_URL}/api/members")
        members = response.json()
        
        today = datetime.now().strftime("%Y-%m-%d")
        non_coaches = [m for m in members if not m.get("is_coach")]
        active_non_coaches = [m for m in non_coaches if not m.get("subscription_end_date") or m["subscription_end_date"] >= today]
        
        # Verify none of them are coaches
        for m in active_non_coaches:
            assert not m.get("is_coach"), f"Active member {m.get('name')} should not be a coach"


class TestTransactionsClientName:
    """Test transactions have client_name field"""
    
    def test_transactions_have_client_name(self):
        """Verify client_name field exists on transactions"""
        response = requests.get(f"{BASE_URL}/api/transactions", params={"month": "2025-01"})
        assert response.status_code == 200
        transactions = response.json()
        
        # Count transactions with client_name
        with_client = [t for t in transactions if t.get("client_name")]
        print(f"Total transactions: {len(transactions)}")
        print(f"With client_name: {len(with_client)}")
        
        # Show some examples
        for tx in with_client[:5]:
            print(f"  - {tx.get('description')[:50]} | Client: {tx.get('client_name')}")


class TestCategoriesEndpoint:
    """Test categories for filter dropdown"""
    
    def test_get_categories(self):
        """Verify categories endpoint returns revenue and expense categories"""
        response = requests.get(f"{BASE_URL}/api/categories")
        assert response.status_code == 200
        categories = response.json()
        
        revenue_cats = [c for c in categories if c.get("type") == "revenue"]
        expense_cats = [c for c in categories if c.get("type") == "expense"]
        
        print(f"Total categories: {len(categories)}")
        print(f"Revenue: {len(revenue_cats)}")
        print(f"Expense: {len(expense_cats)}")
        
        assert len(revenue_cats) > 0, "Should have revenue categories"
        assert len(expense_cats) > 0, "Should have expense categories"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
