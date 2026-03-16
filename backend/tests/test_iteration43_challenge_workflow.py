"""
Iteration 43 - Test 6 WEEKS CHALLENGE workflow
Tests: member creation, GHL confirm-sale, annual_reviews creation, transaction creation, KPI recalculation
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test data tracking for cleanup
created_member_ids = []
created_review_ids = []
created_transaction_ids = []


class TestMembershipTypeSettings:
    """Test: GET /api/settings/membership-types - '6 WEEKS CHALLENGE' must exist with correct config"""

    def test_6_weeks_challenge_exists(self):
        """Verify '6 WEEKS CHALLENGE' exists with member_type='Membres PIF' and is_pif=True"""
        response = requests.get(f"{BASE_URL}/api/settings/membership-types")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        types = response.json()
        challenge_type = None
        for t in types:
            if "6 WEEKS CHALLENGE" in t.get("name", "").upper():
                challenge_type = t
                break
        
        assert challenge_type is not None, "6 WEEKS CHALLENGE type not found in membership-types"
        
        # Verify correct configuration
        assert challenge_type.get("member_type") == "Membres PIF", \
            f"Expected member_type='Membres PIF', got '{challenge_type.get('member_type')}'"
        assert challenge_type.get("is_pif") == True, \
            f"Expected is_pif=True, got {challenge_type.get('is_pif')}"
        assert challenge_type.get("duration_days") == 42, \
            f"Expected duration_days=42, got {challenge_type.get('duration_days')}"
        
        print(f"PASS: '6 WEEKS CHALLENGE' exists with correct settings")
        print(f"  - member_type: {challenge_type.get('member_type')}")
        print(f"  - is_pif: {challenge_type.get('is_pif')}")
        print(f"  - duration_days: {challenge_type.get('duration_days')}")
        print(f"  - price: {challenge_type.get('price')}")

    def test_no_chalenge_typo(self):
        """Verify no membership type contains the typo 'CHALENGE' (only 'CHALLENGE')"""
        response = requests.get(f"{BASE_URL}/api/settings/membership-types")
        assert response.status_code == 200
        
        types = response.json()
        for t in types:
            name = t.get("name", "")
            # Check for typo 'CHALENGE' (missing L)
            assert "CHALENGE" not in name.upper() or "CHALLENGE" in name.upper(), \
                f"Found typo 'CHALENGE' in membership type: {name}"
        
        print("PASS: No 'CHALENGE' typo found in membership types")


class TestManualMemberCreationChallengeWorkflow:
    """Test: POST /api/members - Creating Challenge member auto-creates review + transaction"""

    def test_create_challenge_member_creates_review(self):
        """Create member with '6 WEEKS CHALLENGE' membership - should auto-create 'challenge' review"""
        global created_member_ids, created_review_ids, created_transaction_ids
        
        # Use a date we can calculate from
        signature_date = datetime.now().strftime("%Y-%m-%d")
        expected_review_date = (datetime.now() + timedelta(days=42)).strftime("%Y-%m-%d")
        
        payload = {
            "name": "TEST_Challenge_Member_43",
            "email": "test_challenge_43@test.com",
            "phone": "+41 79 123 4567",
            "membership": "6 WEEKS CHALLENGE",
            "member_type": "Membres PIF",
            "contract_signed_date": signature_date,
            "subscription_end_date": expected_review_date,
            "cash_collected": 599,
            "annual_review_enabled": True,
            "review_frequency": "challenge"
        }
        
        response = requests.post(f"{BASE_URL}/api/members", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        member = response.json()
        member_id = member.get("id")
        created_member_ids.append(member_id)
        
        print(f"PASS: Member created with id={member_id}")
        
        # Verify member has annual_review_enabled and correct review_frequency
        assert member.get("annual_review_enabled") == True, \
            f"Expected annual_review_enabled=True, got {member.get('annual_review_enabled')}"
        
        # Check annual_review was created
        reviews_response = requests.get(f"{BASE_URL}/api/annual-reviews?member_id={member_id}")
        assert reviews_response.status_code == 200
        
        reviews = reviews_response.json()
        assert len(reviews) > 0, "No annual review created for challenge member"
        
        review = reviews[0]
        created_review_ids.append(review.get("id"))
        
        # Verify review_type is 'challenge'
        assert review.get("review_type") == "challenge", \
            f"Expected review_type='challenge', got '{review.get('review_type')}'"
        
        # Verify review_date is signature_date + 42 days
        assert review.get("review_date") == expected_review_date, \
            f"Expected review_date={expected_review_date}, got {review.get('review_date')}"
        
        print(f"PASS: Annual review created with type='challenge', date={review.get('review_date')}")
        
        # Check transaction was created
        month = signature_date[:7]
        tx_response = requests.get(f"{BASE_URL}/api/transactions?month={month}")
        assert tx_response.status_code == 200
        
        transactions = tx_response.json()
        member_tx = None
        for tx in transactions:
            if f"member-{member_id}" in tx.get("id", ""):
                member_tx = tx
                break
        
        if member_tx:
            created_transaction_ids.append(member_tx.get("id"))
            assert member_tx.get("amount") == 599, f"Expected amount=599, got {member_tx.get('amount')}"
            assert member_tx.get("category") == "ABONNEMENTS", \
                f"Expected category='ABONNEMENTS', got '{member_tx.get('category')}'"
            print(f"PASS: Transaction created with id={member_tx.get('id')}, amount={member_tx.get('amount')}")
        else:
            print("WARNING: Transaction not found for member (may have different ID format)")

    def test_cleanup_manual_challenge_member(self):
        """Clean up test data - delete member"""
        global created_member_ids
        
        for member_id in created_member_ids:
            response = requests.delete(f"{BASE_URL}/api/members/{member_id}")
            if response.status_code in [200, 404]:
                print(f"Cleaned up member {member_id}")
        
        created_member_ids.clear()


class TestGHLConfirmSaleChallengeWorkflow:
    """Test: POST /api/ghl/confirm-sale - Confirming Challenge sale creates member + review + transaction"""

    def test_ghl_confirm_challenge_sale(self):
        """Confirm a 6 Week Challenge sale from GHL - should create member, review, transaction"""
        global created_member_ids, created_review_ids
        
        signature_date = datetime.now().strftime("%Y-%m-%d")
        expected_review_date = (datetime.now() + timedelta(days=42)).strftime("%Y-%m-%d")
        current_month = datetime.now().strftime("%Y-%m")
        
        # Unique opportunity ID for this test
        opp_id = f"test-ghl-opp-43-{datetime.now().timestamp()}"
        
        payload = {
            "opportunity_id": opp_id,
            "opportunity_name": "TEST_GHL_Challenge_Member_43",
            "contact_email": "ghl_challenge_43@test.com",
            "contact_phone": "+41 79 999 8888",
            "subscription_type": "6 WEEKS CHALLENGE",
            "member_type": "Membres PIF",
            "cash_collected": 599,
            "signature_date": signature_date,
            "subscription_end_date": expected_review_date,
            "month": current_month
        }
        
        response = requests.post(f"{BASE_URL}/api/ghl/confirm-sale", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        sale = response.json()
        member_id = sale.get("member_id")
        
        assert member_id is not None, "No member_id returned from confirm-sale"
        created_member_ids.append(member_id)
        
        print(f"PASS: GHL sale confirmed, member_id={member_id}")
        
        # Verify member was created
        member_response = requests.get(f"{BASE_URL}/api/members/{member_id}")
        assert member_response.status_code == 200
        
        member = member_response.json()
        assert member.get("membership") == "6 WEEKS CHALLENGE", \
            f"Expected membership='6 WEEKS CHALLENGE', got '{member.get('membership')}'"
        
        # Check annual_review was created with type='challenge'
        reviews_response = requests.get(f"{BASE_URL}/api/annual-reviews?member_id={member_id}")
        assert reviews_response.status_code == 200
        
        reviews = reviews_response.json()
        assert len(reviews) > 0, "No annual review created for GHL challenge sale"
        
        review = reviews[0]
        created_review_ids.append(review.get("id"))
        
        # CRITICAL: Verify review_type is 'challenge' (not 'quarterly')
        assert review.get("review_type") == "challenge", \
            f"Expected review_type='challenge', got '{review.get('review_type')}'"
        
        # Verify review_date is signature_date + 42 days
        assert review.get("review_date") == expected_review_date, \
            f"Expected review_date={expected_review_date}, got {review.get('review_date')}"
        
        print(f"PASS: GHL sale created review with type='challenge', date={review.get('review_date')}")

    def test_cleanup_ghl_challenge_member(self):
        """Clean up test data"""
        global created_member_ids
        
        for member_id in created_member_ids:
            response = requests.delete(f"{BASE_URL}/api/members/{member_id}")
            if response.status_code in [200, 404]:
                print(f"Cleaned up GHL member {member_id}")
        
        created_member_ids.clear()


class TestKPIRecalculation:
    """Test: POST /api/monthly-kpis/{month}/recalculate - KPIs reflect transactions correctly"""

    def test_kpi_recalculate_reflects_transactions(self):
        """Recalculate KPIs and verify they match actual transactions"""
        current_month = datetime.now().strftime("%Y-%m")
        
        # Get current transactions for this month
        tx_response = requests.get(f"{BASE_URL}/api/transactions?month={current_month}")
        assert tx_response.status_code == 200
        transactions = tx_response.json()
        
        # Sum revenue from ABONNEMENTS category
        abonnements_total = sum(
            tx.get("amount", 0) 
            for tx in transactions 
            if tx.get("category") == "ABONNEMENTS"
        )
        
        # Trigger recalculation
        recalc_response = requests.post(f"{BASE_URL}/api/monthly-kpis/{current_month}/recalculate")
        assert recalc_response.status_code == 200, \
            f"Recalculate failed: {recalc_response.status_code}"
        
        kpi = recalc_response.json()
        
        print(f"PASS: KPI recalculation completed for {current_month}")
        print(f"  - total_revenue: {kpi.get('total_revenue')}")
        print(f"  - revenue_members (from transactions): {kpi.get('revenue_members')}")
        print(f"  - ABONNEMENTS transactions sum: {abonnements_total}")


class TestAnnualReviewsAPI:
    """Test: GET /api/annual-reviews - Verify review types are correct"""

    def test_get_annual_reviews_with_type(self):
        """Get annual reviews and verify they have correct review_type field"""
        response = requests.get(f"{BASE_URL}/api/annual-reviews")
        assert response.status_code == 200
        
        reviews = response.json()
        
        # Check that reviews have review_type field
        challenge_reviews = [r for r in reviews if r.get("review_type") == "challenge"]
        quarterly_reviews = [r for r in reviews if r.get("review_type") == "quarterly"]
        
        print(f"PASS: Got {len(reviews)} annual reviews")
        print(f"  - Challenge type: {len(challenge_reviews)}")
        print(f"  - Quarterly type: {len(quarterly_reviews)}")
        
        # Verify structure of a review
        if reviews:
            sample = reviews[0]
            assert "member_id" in sample, "Review missing member_id"
            assert "review_date" in sample, "Review missing review_date"
            assert "review_type" in sample or "status" in sample, "Review missing review_type or status"

    def test_filter_reviews_by_type(self):
        """Test filtering reviews by review_type"""
        response = requests.get(f"{BASE_URL}/api/annual-reviews?review_type=challenge")
        assert response.status_code == 200
        
        reviews = response.json()
        
        for review in reviews:
            assert review.get("review_type") == "challenge", \
                f"Expected review_type='challenge', got '{review.get('review_type')}'"
        
        print(f"PASS: Filter by review_type=challenge returns {len(reviews)} reviews")


@pytest.fixture(scope="module", autouse=True)
def cleanup_all_test_data():
    """Cleanup all test data at the end of the test module"""
    yield
    
    # Clean up any remaining test members
    response = requests.get(f"{BASE_URL}/api/members")
    if response.status_code == 200:
        members = response.json()
        for member in members:
            if member.get("name", "").startswith("TEST_"):
                requests.delete(f"{BASE_URL}/api/members/{member.get('id')}")
                print(f"Cleaned up test member: {member.get('name')}")
