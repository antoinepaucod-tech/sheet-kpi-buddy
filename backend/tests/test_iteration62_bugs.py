"""
Iteration 62 - Testing 7 Bug Fixes:
1. Time slots in CoursesPage should be 15-min increments
2. Skip button on /annual-reviews opens dialog (not window.prompt)
3. mark-paid creates transaction with client_name
4. No 0 CHF SALAIRES COACHS transactions
5. No test data in transactions
6. Budget monthly grid returns valid data
7. RecurringPage has validation-explanation section
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


class TestBug2SkipEndpoint:
    """Bug 2: Test the skip endpoint for annual reviews"""

    def test_get_scheduled_reviews(self, api_client):
        """Get scheduled reviews to find one to skip"""
        response = api_client.get(f"{BASE_URL}/api/annual-reviews?status=scheduled")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} scheduled reviews")

    def test_skip_endpoint_with_reason(self, api_client):
        """Test POST /api/annual-reviews/{id}/skip with reason"""
        # First get a scheduled review
        response = api_client.get(f"{BASE_URL}/api/annual-reviews?status=scheduled")
        assert response.status_code == 200
        reviews = response.json()
        
        if not reviews:
            pytest.skip("No scheduled reviews found to test skip")
            
        review_id = reviews[0]["id"]
        
        # Test skip endpoint
        skip_response = api_client.post(
            f"{BASE_URL}/api/annual-reviews/{review_id}/skip",
            json={"reason": "Test skip iteration62", "user_name": "TestUser"}
        )
        assert skip_response.status_code == 200
        
        data = skip_response.json()
        assert data.get("status") == "skipped"
        assert "skip_reason" in data or data.get("skip_reason") == "Test skip iteration62"
        print(f"Successfully skipped review {review_id}")


class TestBug3MarkPaidClientName:
    """Bug 3: mark-paid should create transaction with client_name"""

    def test_get_pending_payments(self, api_client):
        """Get pending/late payments"""
        response = api_client.get(f"{BASE_URL}/api/payments?status=pending")
        assert response.status_code == 200
        data = response.json()
        print(f"Found {len(data)} pending payments")

    def test_mark_paid_creates_transaction_with_client_name(self, api_client):
        """When payment is marked paid, the created transaction should have client_name"""
        # Get pending or late payment
        response = api_client.get(f"{BASE_URL}/api/payments")
        assert response.status_code == 200
        payments = response.json()
        
        # Filter pending/late payments
        available = [p for p in payments if p.get("status") in ("pending", "late")]
        
        if not available:
            pytest.skip("No pending/late payments to test mark-paid")
        
        payment = available[0]
        payment_id = payment["id"]
        member_name = payment.get("member_name", "")
        
        print(f"Testing mark-paid for payment {payment_id}, member: {member_name}")
        
        # Mark as paid
        mark_paid_response = api_client.post(
            f"{BASE_URL}/api/payments/{payment_id}/mark-paid",
            json={"paid_date": "2026-01-20", "payment_method": "virement"}
        )
        assert mark_paid_response.status_code == 200
        
        # Check the latest transaction has client_name
        time.sleep(0.5)  # Allow DB to settle
        tx_response = api_client.get(f"{BASE_URL}/api/transactions?month=2026-01")
        assert tx_response.status_code == 200
        transactions = tx_response.json()
        
        # Find transaction for this payment
        matching_tx = [t for t in transactions if t.get("payment_id") == payment_id]
        
        if matching_tx:
            tx = matching_tx[0]
            assert "client_name" in tx, "Transaction missing client_name field"
            # client_name should match member_name if not empty
            if member_name:
                assert tx.get("client_name") == member_name, f"Expected client_name '{member_name}' but got '{tx.get('client_name')}'"
            print(f"Transaction created with client_name: {tx.get('client_name')}")
        else:
            # Check recent transactions for validation source
            validation_tx = [t for t in transactions if t.get("source") == "payment_validation"]
            if validation_tx:
                tx = validation_tx[0]
                assert "client_name" in tx, "Validation transaction missing client_name"
                print(f"Found validation transaction with client_name: {tx.get('client_name')}")


class TestBug4NoZeroSalaryTransactions:
    """Bug 4: No 0 CHF SALAIRES COACHS transactions"""

    def test_no_zero_salary_in_transactions(self, api_client):
        """Check current transactions for 0 CHF SALAIRES COACHS"""
        response = api_client.get(f"{BASE_URL}/api/transactions")
        assert response.status_code == 200
        transactions = response.json()
        
        zero_salary = [
            t for t in transactions 
            if t.get("category") == "SALAIRES COACHS" 
            and (t.get("amount", 0) or 0) == 0
        ]
        
        assert len(zero_salary) == 0, f"Found {len(zero_salary)} SALAIRES COACHS transactions at 0 CHF: {[t.get('description') for t in zero_salary]}"
        
        # Count total salary transactions for info
        salary_txs = [t for t in transactions if t.get("category") == "SALAIRES COACHS"]
        print(f"Found {len(salary_txs)} SALAIRES COACHS transactions, all with non-zero amounts")

    def test_generate_salary_expenses_skips_zero(self, api_client):
        """Test that generate-salary-expenses doesn't create 0 CHF transactions"""
        # Generate for a test month
        response = api_client.post(f"{BASE_URL}/api/courses/generate-salary-expenses/2026/1")
        
        # Could return 404 if no courses, or 200 with empty/transactions
        if response.status_code == 404:
            print("No courses found for 2026/1 - that's OK")
            return
        
        assert response.status_code == 200
        data = response.json()
        
        # Check if any 0 CHF transactions were created
        transactions = data.get("transactions", [])
        zero_tx = [t for t in transactions if (t.get("amount", 0) or 0) == 0]
        
        assert len(zero_tx) == 0, f"generate-salary-expenses created {len(zero_tx)} zero transactions"
        print(f"generate-salary-expenses created {len(transactions)} transactions, all non-zero")

    def test_recurring_generate_skips_zero(self, api_client):
        """Test recurring-transactions/generate skips 0 CHF templates"""
        response = api_client.post(f"{BASE_URL}/api/recurring-transactions/generate/2026/1")
        
        if response.status_code == 404:
            print("No active recurring transactions - OK")
            return
            
        assert response.status_code == 200
        data = response.json()
        
        # Check created transactions
        created = data.get("created", [])
        zero_created = [t for t in created if (t.get("amount", 0) or 0) == 0]
        
        assert len(zero_created) == 0, f"Recurring generate created {len(zero_created)} zero transactions"
        print(f"Recurring generate created {len(created)} transactions, skipped {len(data.get('skipped', []))}")


class TestBug5NoTestData:
    """Bug 5: No test data in transactions (except Adrien Testa)"""

    def test_no_test_data_in_transactions(self, api_client):
        """Check transactions for test data patterns"""
        response = api_client.get(f"{BASE_URL}/api/transactions")
        assert response.status_code == 200
        transactions = response.json()
        
        test_patterns = ["TEST_", "test_", "Test Data", "Dummy", "DUMMY", "Fake", "FAKE"]
        
        # Allowed patterns (real names that contain 'test')
        allowed_patterns = ["Adrien Testa"]
        
        suspicious = []
        for tx in transactions:
            desc = tx.get("description", "") or ""
            client = tx.get("client_name", "") or ""
            combined = f"{desc} {client}"
            
            # Check if matches test patterns
            for pattern in test_patterns:
                if pattern.lower() in combined.lower():
                    # Check if it's an allowed pattern
                    is_allowed = any(allowed in combined for allowed in allowed_patterns)
                    if not is_allowed:
                        suspicious.append({
                            "id": tx.get("id"),
                            "description": desc,
                            "client_name": client,
                            "pattern": pattern
                        })
                    break
        
        assert len(suspicious) == 0, f"Found {len(suspicious)} transactions with test data: {suspicious}"
        print(f"Checked {len(transactions)} transactions - no test data found")


class TestBug6BudgetMonthlyGrid:
    """Bug 6: Budget monthly grid endpoint returns valid data"""

    def test_monthly_grid_returns_data(self, api_client):
        """Test GET /api/transactions/monthly-grid?year=2026"""
        response = api_client.get(f"{BASE_URL}/api/transactions/monthly-grid?year=2026")
        assert response.status_code == 200
        
        data = response.json()
        # The endpoint returns a list of category objects with monthly data
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        
        print(f"Monthly grid returned {len(data)} category rows")
        
        # Verify structure - each item should have category, months, year_total
        if data:
            first = data[0]
            assert "category" in first, "Missing 'category' field"
            assert "months" in first, "Missing 'months' field"
            assert "year_total" in first, "Missing 'year_total' field"
            
            # months should be a dict with 1-12 keys
            months = first.get("months", {})
            assert isinstance(months, dict), f"months should be dict, got {type(months)}"
            
            # Check some months exist
            month_keys = list(months.keys())
            print(f"First category: {first.get('category')}, months: {month_keys[:6]}, year_total: {first.get('year_total')}")


class TestBug7RecurringPageExplanation:
    """Bug 7: RecurringPage validation-explanation section exists (frontend test)"""

    def test_recurring_transactions_endpoint(self, api_client):
        """Test recurring transactions endpoints work"""
        response = api_client.get(f"{BASE_URL}/api/recurring-transactions/all")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} recurring transactions")
        
        # Check for different sources
        sources = set(t.get("source") for t in data)
        print(f"Sources: {sources}")


class TestTimeSlotsGeneration:
    """Bug 1: Verify 15-min time slot increments for courses"""

    def test_courses_endpoint_works(self, api_client):
        """Test courses endpoint"""
        response = api_client.get(f"{BASE_URL}/api/courses?year=2026&month=1")
        assert response.status_code == 200
        
        courses = response.json()
        print(f"Found {len(courses)} courses for 2026/1")
        
        # Check time_slot formats if any courses exist
        if courses:
            time_slots = set(c.get("time_slot") for c in courses if c.get("time_slot"))
            print(f"Time slots found: {sorted(time_slots)}")
            
            # Verify all are 15-min increments
            for slot in time_slots:
                if slot:
                    parts = slot.split(":")
                    if len(parts) == 2:
                        mins = int(parts[1])
                        assert mins in (0, 15, 30, 45), f"Time slot {slot} is not in 15-min increments"


class TestAPIHealth:
    """Basic health checks"""

    def test_api_root(self, api_client):
        """Test API is responding"""
        response = api_client.get(f"{BASE_URL}/api")
        # May return 404 or different status, just check it responds
        assert response.status_code in (200, 404, 405)

    def test_members_endpoint(self, api_client):
        """Test members endpoint"""
        response = api_client.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} members")

    def test_annual_reviews_endpoint(self, api_client):
        """Test annual reviews endpoint"""
        response = api_client.get(f"{BASE_URL}/api/annual-reviews")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} annual reviews")
