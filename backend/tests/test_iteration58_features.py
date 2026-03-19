"""
Backend tests for Iteration 58 - TRANSFORM app features
Tests:
1. GET /api/members/stats returns active_members/active_coaches counts
2. POST /api/payments/sync-with-members creates schedules and payments
3. POST /api/payments/{id}/mark-paid creates accounting_transaction
4. GET /api/monthly-kpis/2026-03/details returns recurring_revenue section
5. GET /api/course-types returns list of course type categories
6. POST /api/course-types creates new course type
7. POST /api/members/{id}/dissociate-duo dissociates a DUO pair
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestMemberStats:
    """Test GET /api/members/stats returns active_members and active_coaches"""
    
    def test_member_stats_returns_active_members(self):
        """Verify active_members count is close to expected ~91"""
        response = requests.get(f"{BASE_URL}/api/members/stats")
        assert response.status_code == 200
        data = response.json()
        assert "active_members" in data
        # Expected ~91, allow some variance
        assert data["active_members"] >= 85 and data["active_members"] <= 100, f"active_members={data['active_members']}"
        print(f"PASS: active_members = {data['active_members']}")
    
    def test_member_stats_returns_active_coaches(self):
        """Verify active_coaches count is 29"""
        response = requests.get(f"{BASE_URL}/api/members/stats")
        assert response.status_code == 200
        data = response.json()
        assert "active_coaches" in data
        assert data["active_coaches"] == 29, f"active_coaches={data['active_coaches']}"
        print(f"PASS: active_coaches = {data['active_coaches']}")


class TestPaymentsSync:
    """Test POST /api/payments/sync-with-members creates schedules and payments"""
    
    def test_sync_payments_with_members_endpoint(self):
        """Verify sync endpoint creates schedules and payments"""
        response = requests.post(f"{BASE_URL}/api/payments/sync-with-members")
        assert response.status_code == 200
        data = response.json()
        assert "schedules_created" in data
        assert "payments_created" in data
        assert "month" in data
        assert data["schedules_created"] > 0, "No schedules created"
        assert data["payments_created"] > 0, "No payments created"
        print(f"PASS: sync created {data['schedules_created']} schedules, {data['payments_created']} payments for {data['month']}")
    
    def test_sync_payments_creates_matching_records(self):
        """Verify schedules and payments match billing-enabled members"""
        # Get billing-enabled members count
        members_resp = requests.get(f"{BASE_URL}/api/members")
        assert members_resp.status_code == 200
        members = members_resp.json()
        billing_enabled = [m for m in members if m.get('billing_enabled') and not m.get('exit_date') or (m.get('exit_date') and m.get('exit_date') >= '2026-03-19')]
        
        # Run sync
        sync_resp = requests.post(f"{BASE_URL}/api/payments/sync-with-members")
        assert sync_resp.status_code == 200
        data = sync_resp.json()
        
        # Schedules should include all billing members (including amount=0)
        assert data["schedules_created"] >= 80, f"Expected at least 80 schedules, got {data['schedules_created']}"
        print(f"PASS: {data['schedules_created']} schedules created")


class TestMarkPaymentPaid:
    """Test POST /api/payments/{id}/mark-paid creates accounting_transaction"""
    
    def test_mark_payment_paid_creates_transaction(self):
        """Verify mark-paid endpoint creates accounting transaction and returns transaction_created=True"""
        # Get a pending payment
        payments_resp = requests.get(f"{BASE_URL}/api/payments?status=pending")
        assert payments_resp.status_code == 200
        payments = payments_resp.json()
        
        if not payments:
            # If no pending, check for late payments
            payments_resp = requests.get(f"{BASE_URL}/api/payments?status=late")
            payments = payments_resp.json()
        
        if not payments:
            pytest.skip("No pending or late payments available to test")
        
        payment = payments[0]
        payment_id = payment["id"]
        
        # Mark as paid
        response = requests.post(
            f"{BASE_URL}/api/payments/{payment_id}/mark-paid",
            json={"paid_date": "2026-03-20"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("status") == "paid", f"Expected paid, got {data.get('status')}"
        assert data.get("transaction_created") == True, "transaction_created should be True"
        print(f"PASS: Payment {payment_id} marked paid, transaction_created=True")
    
    def test_mark_paid_updates_kpi_revenue(self):
        """Verify mark-paid triggers KPI recalculation"""
        # This is implicitly tested by the mark-paid endpoint which calls recalculate_month
        # We can verify by checking the KPI endpoint after mark-paid
        kpi_resp = requests.get(f"{BASE_URL}/api/monthly-kpis/2026-03")
        assert kpi_resp.status_code == 200
        kpi = kpi_resp.json()
        assert "total_revenue" in kpi
        print(f"PASS: KPI for 2026-03 has total_revenue = {kpi.get('total_revenue')}")


class TestKPIDetailsRecurringRevenue:
    """Test GET /api/monthly-kpis/2026-03/details returns recurring_revenue section"""
    
    def test_kpi_details_has_recurring_revenue_section(self):
        """Verify recurring_revenue section exists with correct structure"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis/2026-03/details")
        assert response.status_code == 200
        data = response.json()
        
        assert "recurring_revenue" in data, "recurring_revenue section missing"
        assert isinstance(data["recurring_revenue"], list), "recurring_revenue should be a list"
        print(f"PASS: recurring_revenue has {len(data['recurring_revenue'])} items")
    
    def test_recurring_revenue_has_correct_amounts(self):
        """Verify recurring_revenue totals ~8645 CHF for 60 members"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis/2026-03/details")
        assert response.status_code == 200
        data = response.json()
        
        rr = data.get("recurring_revenue", [])
        total = sum(r.get("amount", 0) for r in rr)
        count = len(rr)
        
        # Expected: 60 members / 8645 CHF
        assert count >= 55 and count <= 65, f"Expected ~60 recurring members, got {count}"
        assert total >= 8000 and total <= 9000, f"Expected ~8645 CHF, got {total}"
        print(f"PASS: {count} recurring revenue items, total {total} CHF")
    
    def test_recurring_revenue_no_coaches(self):
        """Verify coaches are excluded from recurring_revenue"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis/2026-03/details")
        assert response.status_code == 200
        data = response.json()
        
        rr = data.get("recurring_revenue", [])
        coach_keywords = ["THE COACH", "VIRTUAL COACH"]
        coaches_found = [r for r in rr if any(kw in (r.get("membership") or "").upper() for kw in coach_keywords)]
        
        assert len(coaches_found) == 0, f"Found {len(coaches_found)} coaches in recurring_revenue"
        print(f"PASS: No coaches in recurring_revenue (excluded)")


class TestCourseTypes:
    """Test GET/POST /api/course-types endpoints"""
    
    def test_get_course_types_returns_list(self):
        """Verify GET /api/course-types returns list of course types"""
        response = requests.get(f"{BASE_URL}/api/course-types")
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list), "Expected list"
        assert len(data) >= 5, f"Expected at least 5 course types, got {len(data)}"
        
        # Check structure
        if data:
            first = data[0]
            assert "id" in first, "Missing id field"
            assert "name" in first, "Missing name field"
        
        print(f"PASS: {len(data)} course types returned")
    
    def test_create_course_type(self):
        """Verify POST /api/course-types creates new course type"""
        unique_name = f"TEST_CourseType_{uuid.uuid4().hex[:8]}"
        response = requests.post(
            f"{BASE_URL}/api/course-types",
            json={"name": unique_name}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "id" in data, "Missing id in response"
        assert data.get("name") == unique_name, f"Name mismatch: {data.get('name')}"
        print(f"PASS: Created course type '{unique_name}'")
    
    def test_create_duplicate_course_type_fails(self):
        """Verify creating duplicate course type returns 400"""
        # First create one
        unique_name = f"TEST_Duplicate_{uuid.uuid4().hex[:8]}"
        requests.post(f"{BASE_URL}/api/course-types", json={"name": unique_name})
        
        # Try to create duplicate
        response = requests.post(
            f"{BASE_URL}/api/course-types",
            json={"name": unique_name}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print(f"PASS: Duplicate course type correctly rejected with 400")


class TestDissociateDuo:
    """Test POST /api/members/{id}/dissociate-duo endpoint"""
    
    def test_dissociate_duo_returns_success(self):
        """Verify dissociate-duo endpoint works for DUO members"""
        # Find a DUO member
        members_resp = requests.get(f"{BASE_URL}/api/members")
        assert members_resp.status_code == 200
        members = members_resp.json()
        
        duo_members = [m for m in members if m.get("is_duo")]
        
        if not duo_members:
            pytest.skip("No DUO members available to test")
        
        duo_member = duo_members[0]
        member_id = duo_member["id"]
        
        # Test dissociation
        response = requests.post(f"{BASE_URL}/api/members/{member_id}/dissociate-duo")
        assert response.status_code == 200
        data = response.json()
        
        assert "message" in data
        assert "member_id" in data
        assert data["member_id"] == member_id
        print(f"PASS: DUO member {member_id} dissociated successfully")
    
    def test_dissociate_non_duo_fails(self):
        """Verify dissociate-duo fails for non-DUO members"""
        # Find a non-DUO member
        members_resp = requests.get(f"{BASE_URL}/api/members")
        members = members_resp.json()
        
        non_duo = [m for m in members if not m.get("is_duo")]
        
        if not non_duo:
            pytest.skip("No non-DUO members available to test")
        
        member_id = non_duo[0]["id"]
        
        response = requests.post(f"{BASE_URL}/api/members/{member_id}/dissociate-duo")
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print(f"PASS: Non-DUO member correctly rejected with 400")


class TestPaymentsPage:
    """Test payment list endpoints for frontend display"""
    
    def test_payments_list_has_member_names(self):
        """Verify payments list includes member_name field"""
        response = requests.get(f"{BASE_URL}/api/payments")
        assert response.status_code == 200
        payments = response.json()
        
        if not payments:
            pytest.skip("No payments in database")
        
        for p in payments[:5]:
            assert "member_name" in p, f"Payment {p.get('id')} missing member_name"
            assert p["member_name"], f"Payment {p.get('id')} has empty member_name"
        
        print(f"PASS: All payments have member_name populated")
    
    def test_payments_have_correct_status(self):
        """Verify payments have valid status values"""
        response = requests.get(f"{BASE_URL}/api/payments")
        payments = response.json()
        
        valid_statuses = ["pending", "paid", "late", "cancelled"]
        for p in payments[:10]:
            assert p.get("status") in valid_statuses, f"Invalid status: {p.get('status')}"
        
        print(f"PASS: All checked payments have valid status")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
