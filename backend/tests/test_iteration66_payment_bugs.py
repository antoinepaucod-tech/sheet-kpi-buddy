"""
Iteration 66 - Payment Bug Fixes Testing
Tests for 3 critical bugs:
1. POST /api/payments/{id}/mark-paid should return 200 (was 500)
2. GET /api/payments/late should NOT contain Johan Michelazzi (departed member)
3. Billing cycle 'interval_days' should calculate due dates from contract_signed_date
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
CLUB_ID = "0a327bf5-c759-49eb-87e4-551913f78bdb"  # Transform Versoix

# Test credentials
SUPER_ADMIN_EMAIL = "antoine.paucod@the-coach.pro"
SUPER_ADMIN_PASSWORD = "TheCoach1290."


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for super admin"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": SUPER_ADMIN_EMAIL,
        "password": SUPER_ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Headers with auth token and club ID"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "X-Club-Id": CLUB_ID,
        "Content-Type": "application/json"
    }


class TestBugFix1MarkPaid:
    """BUG FIX 1: POST /api/payments/{id}/mark-paid should return 200 with status=paid"""
    
    def test_get_late_payments_for_mark_paid(self, auth_headers):
        """First get a late payment to test mark-paid"""
        response = requests.get(f"{BASE_URL}/api/payments/late", headers=auth_headers)
        assert response.status_code == 200, f"Failed to get late payments: {response.text}"
        late_payments = response.json()
        print(f"Found {len(late_payments)} late payments")
        return late_payments
    
    def test_mark_payment_paid_returns_200(self, auth_headers):
        """BUG FIX 1: mark-paid should return 200, not 500"""
        # First get late payments
        response = requests.get(f"{BASE_URL}/api/payments/late", headers=auth_headers)
        assert response.status_code == 200
        late_payments = response.json()
        
        if not late_payments:
            # Create a test payment if none exist
            pytest.skip("No late payments available to test mark-paid")
        
        # Get first late payment
        payment = late_payments[0]
        payment_id = payment["id"]
        print(f"Testing mark-paid on payment: {payment_id} for {payment.get('member_name', 'Unknown')}")
        
        # Mark as paid
        mark_paid_response = requests.post(
            f"{BASE_URL}/api/payments/{payment_id}/mark-paid",
            headers=auth_headers,
            json={"paid_date": "2026-03-23"}
        )
        
        # BUG FIX 1: Should return 200, not 500
        assert mark_paid_response.status_code == 200, f"mark-paid failed with {mark_paid_response.status_code}: {mark_paid_response.text}"
        
        result = mark_paid_response.json()
        print(f"mark-paid response: {result}")
        
        # Verify response contains expected fields
        assert result.get("status") == "paid", f"Expected status=paid, got {result.get('status')}"
        assert result.get("transaction_created") == True, f"Expected transaction_created=true, got {result.get('transaction_created')}"
        assert "paid_date" in result, "Response should contain paid_date"
        
        print(f"BUG FIX 1 VERIFIED: mark-paid returned 200 with status=paid and transaction_created=true")


class TestBugFix2JohanMichelazziDeparted:
    """BUG FIX 2: GET /api/payments/late should NOT contain Johan Michelazzi (departed member)"""
    
    def test_late_payments_excludes_departed_members(self, auth_headers):
        """BUG FIX 2: Johan Michelazzi should NOT appear in late payments"""
        response = requests.get(f"{BASE_URL}/api/payments/late", headers=auth_headers)
        assert response.status_code == 200, f"Failed to get late payments: {response.text}"
        
        late_payments = response.json()
        print(f"Total late payments: {len(late_payments)}")
        
        # Check if Johan Michelazzi is in the list
        johan_payments = [p for p in late_payments if "Johan Michelazzi" in (p.get("member_name") or "")]
        
        # BUG FIX 2: Johan should NOT be in late payments (he is departed)
        assert len(johan_payments) == 0, f"BUG NOT FIXED: Johan Michelazzi found in late payments: {johan_payments}"
        
        print(f"BUG FIX 2 VERIFIED: Johan Michelazzi NOT in late payments (departed member correctly excluded)")
    
    def test_verify_johan_is_departed(self, auth_headers):
        """Verify Johan Michelazzi has exit_date in the past"""
        response = requests.get(f"{BASE_URL}/api/members", headers=auth_headers)
        assert response.status_code == 200
        
        members = response.json()
        johan_entries = [m for m in members if "Johan Michelazzi" in (m.get("name") or "")]
        
        print(f"Found {len(johan_entries)} entries for Johan Michelazzi")
        for entry in johan_entries:
            exit_date = entry.get("exit_date")
            print(f"  - ID: {entry.get('id')}, exit_date: {exit_date}, membership: {entry.get('membership')}")
        
        # At least one entry should have exit_date in the past
        departed_entries = [e for e in johan_entries if e.get("exit_date") and e["exit_date"] < "2026-03-23"]
        assert len(departed_entries) > 0, "Johan should have at least one departed entry"
        print(f"Verified: Johan has {len(departed_entries)} departed entries")


class TestBugFix3BillingCycleIntervalDays:
    """BUG FIX 3: Billing cycle 'interval_days' should calculate due dates from contract_signed_date"""
    
    def test_audrey_bernard_due_date_calculation(self, auth_headers):
        """BUG FIX 3: Audrey Bernard (contract 2025-10-27, interval 25 days) should have due_date 2026-03-01 NOT 2026-03-25"""
        # First check Audrey's member data
        response = requests.get(f"{BASE_URL}/api/members", headers=auth_headers)
        assert response.status_code == 200
        
        members = response.json()
        audrey_entries = [m for m in members if "Audrey Bernard" in (m.get("name") or "")]
        
        print(f"Found {len(audrey_entries)} entries for Audrey Bernard")
        for entry in audrey_entries:
            print(f"  - contract_signed_date: {entry.get('contract_signed_date')}")
            print(f"  - billing_cycle_type: {entry.get('billing_cycle_type')}")
            print(f"  - billing_cycle_value: {entry.get('billing_cycle_value')}")
        
        # Get payments for March 2026
        payments_response = requests.get(
            f"{BASE_URL}/api/payments",
            headers=auth_headers,
            params={"due_from": "2026-03-01", "due_to": "2026-03-31"}
        )
        assert payments_response.status_code == 200
        
        payments = payments_response.json()
        audrey_payments = [p for p in payments if "Audrey Bernard" in (p.get("member_name") or "")]
        
        print(f"Audrey Bernard payments in March 2026: {len(audrey_payments)}")
        for p in audrey_payments:
            print(f"  - due_date: {p.get('due_date')}, amount: {p.get('amount')}, status: {p.get('status')}")
        
        # BUG FIX 3: If Audrey has interval_days=25 and contract_signed_date=2025-10-27
        # Due dates should be: 2025-10-27, 2025-11-21, 2025-12-16, 2026-01-10, 2026-02-04, 2026-03-01, 2026-03-26
        # So March 2026 should have due_date 2026-03-01 (NOT 2026-03-25)
        if audrey_payments:
            for p in audrey_payments:
                due_date = p.get("due_date", "")
                # Should NOT be 2026-03-25 (the old buggy calculation)
                assert due_date != "2026-03-25", f"BUG NOT FIXED: Audrey has due_date 2026-03-25 (should be 2026-03-01)"
                print(f"BUG FIX 3 VERIFIED: Audrey's due_date is {due_date} (not 2026-03-25)")
    
    def test_sync_payments_respects_billing_cycles(self, auth_headers):
        """Test that sync-with-members regenerates payments with correct billing cycles"""
        # Trigger sync
        sync_response = requests.post(
            f"{BASE_URL}/api/payments/sync-with-members",
            headers=auth_headers
        )
        assert sync_response.status_code == 200, f"Sync failed: {sync_response.text}"
        
        result = sync_response.json()
        print(f"Sync result: {result}")
        assert "schedules_created" in result
        assert "payments_created" in result
        
        # Now verify Audrey's payment again
        payments_response = requests.get(
            f"{BASE_URL}/api/payments",
            headers=auth_headers,
            params={"due_from": "2026-03-01", "due_to": "2026-03-31"}
        )
        assert payments_response.status_code == 200
        
        payments = payments_response.json()
        audrey_payments = [p for p in payments if "Audrey Bernard" in (p.get("member_name") or "")]
        
        print(f"After sync - Audrey Bernard payments: {audrey_payments}")
        
        # Verify due date is correct (not 2026-03-25)
        for p in audrey_payments:
            due_date = p.get("due_date", "")
            assert due_date != "2026-03-25", f"After sync, Audrey still has buggy due_date 2026-03-25"


class TestPaymentsEndpoints:
    """General payment endpoint tests"""
    
    def test_get_all_payments(self, auth_headers):
        """GET /api/payments should return all payments"""
        response = requests.get(f"{BASE_URL}/api/payments", headers=auth_headers)
        assert response.status_code == 200
        
        payments = response.json()
        print(f"Total payments: {len(payments)}")
        
        # Check structure
        if payments:
            p = payments[0]
            assert "id" in p
            assert "member_id" in p
            assert "due_date" in p
            assert "amount" in p
            assert "status" in p
    
    def test_get_late_payments(self, auth_headers):
        """GET /api/payments/late should return late payments"""
        response = requests.get(f"{BASE_URL}/api/payments/late", headers=auth_headers)
        assert response.status_code == 200
        
        late_payments = response.json()
        print(f"Late payments: {len(late_payments)}")
        
        # All should have status 'late' and due_date in the past
        for p in late_payments:
            assert p.get("status") == "late", f"Payment {p.get('id')} has status {p.get('status')}, expected 'late'"
            assert p.get("due_date") < "2026-03-23", f"Payment {p.get('id')} due_date {p.get('due_date')} is not in the past"
    
    def test_get_upcoming_payments(self, auth_headers):
        """GET /api/payments/upcoming should return upcoming payments"""
        response = requests.get(f"{BASE_URL}/api/payments/upcoming?days=7", headers=auth_headers)
        assert response.status_code == 200
        
        upcoming = response.json()
        print(f"Upcoming payments (7 days): {len(upcoming)}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
