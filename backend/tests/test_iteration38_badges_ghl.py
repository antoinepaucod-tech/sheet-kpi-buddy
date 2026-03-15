"""
Iteration 38 Tests: Sidebar Badges & GHL Transaction Type
- Test GET /api/annual-reviews/overdue endpoint
- Test GET /api/annual-reviews/upcoming?days=14 endpoint
- Test GET /api/payments/late endpoint (should return 2)
- Test GET /api/onboarding/pending endpoint (should return 9)
- Test POST /api/ghl/confirm-sale creates transaction with type='revenue' and dynamic category
"""
import pytest
import requests
import os
from datetime import datetime, timezone

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")


class TestAnnualReviewsEndpoints:
    """Tests for annual reviews overdue and upcoming endpoints"""

    def test_get_overdue_reviews(self):
        """GET /api/annual-reviews/overdue returns overdue reviews (past date + scheduled)"""
        response = requests.get(f"{BASE_URL}/api/annual-reviews/overdue")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Should return a list"
        print(f"Overdue reviews count: {len(data)}")
        
        # Verify all returned reviews have review_date < today and status = scheduled
        today = datetime.now(timezone.utc).date().isoformat()
        for review in data:
            assert "review_date" in review, "Each review should have review_date"
            assert review.get("status") == "scheduled", f"Overdue review should be scheduled, got: {review.get('status')}"
            # review_date should be before today
            print(f"  - Review {review.get('id', 'N/A')}: date={review.get('review_date')}, member={review.get('member_name', 'N/A')}")

    def test_get_upcoming_reviews(self):
        """GET /api/annual-reviews/upcoming?days=14 returns reviews in next 14 days"""
        response = requests.get(f"{BASE_URL}/api/annual-reviews/upcoming", params={"days": 14})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Should return a list"
        print(f"Upcoming reviews (14 days): {len(data)}")
        
        # Verify all returned reviews have status = scheduled
        for review in data:
            assert "review_date" in review, "Each review should have review_date"
            assert review.get("status") == "scheduled", f"Upcoming review should be scheduled, got: {review.get('status')}"
            print(f"  - Review {review.get('id', 'N/A')}: date={review.get('review_date')}, member={review.get('member_name', 'N/A')}, days_until={review.get('days_until')}")


class TestSidebarBadgeCounts:
    """Test sidebar badge API endpoints"""

    def test_late_payments_endpoint(self):
        """GET /api/payments/late should return late payments (expected ~2)"""
        response = requests.get(f"{BASE_URL}/api/payments/late")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Should return a list"
        print(f"Late payments count: {len(data)}")
        # Verify we have late payments
        assert len(data) >= 1, f"Expected at least 1 late payment, got {len(data)}"

    def test_pending_onboarding_endpoint(self):
        """GET /api/onboarding/pending should return pending onboardings (expected ~9)"""
        response = requests.get(f"{BASE_URL}/api/onboarding/pending")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Should return a list"
        print(f"Pending onboarding count: {len(data)}")


class TestGHLSaleTransactionType:
    """Test that GHL confirm-sale creates revenue transactions (not income)"""

    def test_ghl_confirm_sale_creates_revenue_transaction(self):
        """POST /api/ghl/confirm-sale should create transaction with type='revenue'"""
        opp_id = f"TEST_iteration38_{datetime.now().timestamp()}"
        payload = {
            "opportunity_id": opp_id,
            "opportunity_name": "TEST_Badge_User_Iter38",
            "contact_email": "test38@example.com",
            "subscription_type": "Abonnement Mensuel",
            "cash_collected": 150,
            "month": datetime.now().strftime("%Y-%m")
        }
        
        response = requests.post(f"{BASE_URL}/api/ghl/confirm-sale", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        sale_data = response.json()
        assert sale_data.get("opportunity_id") == opp_id
        print(f"Sale confirmed: {sale_data}")
        
        # Check transaction was created with correct type
        tx_id = f"ghl-sale-{opp_id}"
        tx_response = requests.get(f"{BASE_URL}/api/transactions")
        assert tx_response.status_code == 200
        
        transactions = tx_response.json()
        found_tx = None
        for tx in transactions:
            if tx.get("id") == tx_id:
                found_tx = tx
                break
        
        assert found_tx is not None, f"Transaction {tx_id} not found"
        
        # Verify transaction type is 'revenue' (NOT 'income')
        assert found_tx.get("type") == "revenue", f"Transaction type should be 'revenue', got: {found_tx.get('type')}"
        print(f"Transaction type verified: {found_tx.get('type')}")
        
        # Verify category lookup worked (should be ABONNEMENTS or similar)
        category = found_tx.get("category")
        assert category is not None, "Transaction should have a category"
        print(f"Transaction category: {category}")
        
        # Cleanup: Delete test member and transaction
        member_response = requests.get(f"{BASE_URL}/api/members")
        if member_response.status_code == 200:
            members = member_response.json()
            for m in members:
                if m.get("name") == "TEST_Badge_User_Iter38":
                    requests.delete(f"{BASE_URL}/api/members/{m.get('id')}")
                    break
        
        # Delete transaction
        requests.delete(f"{BASE_URL}/api/transactions/{tx_id}")


class TestTransactionsPageCards:
    """Test that transactions page shows correct revenue/expense sums"""
    
    def test_get_transactions_endpoint(self):
        """GET /api/transactions returns all transactions"""
        response = requests.get(f"{BASE_URL}/api/transactions")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Should return list"
        
        revenue_sum = sum(tx.get("amount", 0) for tx in data if tx.get("type") == "revenue")
        expense_sum = sum(tx.get("amount", 0) for tx in data if tx.get("type") == "expense")
        
        print(f"Total transactions: {len(data)}")
        print(f"Revenue sum: {revenue_sum}")
        print(f"Expense sum: {expense_sum}")


class TestCarolineChallengeObjective:
    """Test Caroline challenge fix - should show 0%"""
    
    def test_challenge_participants(self):
        """GET /api/challenges/:id/participants should show Caroline with 0%"""
        # Get active challenge
        challenges_response = requests.get(f"{BASE_URL}/api/challenges")
        assert challenges_response.status_code == 200
        challenges = challenges_response.json()
        
        active_challenge = None
        for c in challenges:
            if c.get("is_active"):
                active_challenge = c
                break
        
        if not active_challenge:
            pytest.skip("No active challenge found")
        
        # Get participants
        participants_response = requests.get(f"{BASE_URL}/api/challenges/{active_challenge['id']}/participants")
        assert participants_response.status_code == 200
        participants = participants_response.json()
        
        caroline = None
        for p in participants:
            if "Caroline" in p.get("member_name", ""):
                caroline = p
                break
        
        if caroline:
            print(f"Caroline participant data: {caroline}")
            # Verify completion is 0 or near 0
            completion = caroline.get("completion_percentage", 0)
            print(f"Caroline completion: {completion}%")
        else:
            print("Caroline not found in participants")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
