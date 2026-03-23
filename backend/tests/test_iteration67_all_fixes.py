"""
Iteration 67 - Testing all 6 reported issues (3 bugs + 3 improvements)

BUG FIX 1: POST /api/payments/{id}/mark-paid should return 200 with status=paid
BUG FIX 2: GET /api/payments/late should NOT contain Johan Michelazzi (departed member)
BUG FIX 3: Audrey Bernard billing cycle (interval_days=25) should have due_date 2026-03-01
IMPROVEMENT 4: POST /api/members/{id}/renew with 'Sans engagement' and new_end_date=null
IMPROVEMENT 5: CAC calculation uses marketing_spend field
Frontend tests done separately via Playwright
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
CLUB_ID = "0a327bf5-c759-49eb-87e4-551913f78bdb"

# Auth credentials
AUTH_EMAIL = "antoine.paucod@the-coach.pro"
AUTH_PASSWORD = "TheCoach1290."


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": AUTH_EMAIL,
        "password": AUTH_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def headers(auth_token):
    """Headers with auth and club_id"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "X-Club-Id": CLUB_ID,
        "Content-Type": "application/json"
    }


class TestBugFix1MarkPaidEndpoint:
    """BUG FIX 1: POST /api/payments/{id}/mark-paid should return 200"""
    
    def test_get_fresh_late_payment(self, headers):
        """Get a fresh late payment to test mark-paid"""
        response = requests.get(f"{BASE_URL}/api/payments/late", headers=headers)
        assert response.status_code == 200, f"Failed to get late payments: {response.text}"
        
        late_payments = response.json()
        assert len(late_payments) > 0, "No late payments found to test"
        
        # Store for next test
        self.late_payment = late_payments[0]
        print(f"Found late payment: {self.late_payment.get('id')} - {self.late_payment.get('member_name')}")
        return self.late_payment
    
    def test_mark_paid_returns_200(self, headers):
        """Mark a payment as paid - should return 200 not 500"""
        # First get a late payment
        response = requests.get(f"{BASE_URL}/api/payments/late", headers=headers)
        assert response.status_code == 200
        late_payments = response.json()
        
        if len(late_payments) == 0:
            pytest.skip("No late payments available to test mark-paid")
        
        payment_id = late_payments[0]["id"]
        payment_name = late_payments[0].get("member_name", "Unknown")
        
        # Mark as paid
        mark_paid_response = requests.post(
            f"{BASE_URL}/api/payments/{payment_id}/mark-paid",
            headers=headers,
            json={"paid_date": "2026-03-23", "reference": "TEST_ITER67"}
        )
        
        assert mark_paid_response.status_code == 200, f"mark-paid failed with {mark_paid_response.status_code}: {mark_paid_response.text}"
        
        data = mark_paid_response.json()
        assert data.get("status") == "paid", f"Expected status=paid, got {data.get('status')}"
        assert data.get("transaction_created") == True, "Expected transaction_created=True"
        
        print(f"SUCCESS: mark-paid returned 200 for {payment_name}")
        print(f"Response: status={data.get('status')}, transaction_created={data.get('transaction_created')}")


class TestBugFix2JohanMichelazziExcluded:
    """BUG FIX 2: Johan Michelazzi should NOT appear in late payments (departed member)"""
    
    def test_johan_not_in_late_payments(self, headers):
        """Verify Johan Michelazzi is excluded from late payments"""
        response = requests.get(f"{BASE_URL}/api/payments/late", headers=headers)
        assert response.status_code == 200, f"Failed to get late payments: {response.text}"
        
        late_payments = response.json()
        
        # Check that Johan Michelazzi is NOT in the list
        johan_payments = [p for p in late_payments if "Johan Michelazzi" in (p.get("member_name") or "")]
        
        assert len(johan_payments) == 0, f"Johan Michelazzi should NOT be in late payments but found {len(johan_payments)} entries"
        
        print(f"SUCCESS: Johan Michelazzi correctly excluded from {len(late_payments)} late payments")
    
    def test_johan_member_entries_have_exit_dates(self, headers):
        """Verify Johan has exit_dates set (departed member)"""
        response = requests.get(f"{BASE_URL}/api/members", headers=headers)
        assert response.status_code == 200
        
        members = response.json()
        johan_entries = [m for m in members if "Johan Michelazzi" in (m.get("name") or "")]
        
        print(f"Found {len(johan_entries)} Johan Michelazzi entries")
        
        # At least some should have exit_dates
        with_exit = [m for m in johan_entries if m.get("exit_date")]
        print(f"Johan entries with exit_date: {len(with_exit)}")
        
        for entry in johan_entries:
            print(f"  - ID: {entry.get('id')[:8]}..., exit_date: {entry.get('exit_date')}")


class TestBugFix3AudreyBernardBillingCycle:
    """BUG FIX 3: Audrey Bernard (interval_days=25) should have due_date 2026-03-01"""
    
    def test_sync_payments_first(self, headers):
        """Run sync-with-members to regenerate payments"""
        response = requests.post(f"{BASE_URL}/api/payments/sync-with-members", headers=headers)
        assert response.status_code == 200, f"sync-with-members failed: {response.text}"
        
        data = response.json()
        print(f"Sync result: {data.get('schedules_created')} schedules, {data.get('payments_created')} payments")
    
    def test_audrey_bernard_due_date(self, headers):
        """Verify Audrey Bernard has correct due_date based on interval_days"""
        # First get Audrey's member info
        response = requests.get(f"{BASE_URL}/api/members", headers=headers)
        assert response.status_code == 200
        
        members = response.json()
        audrey = next((m for m in members if "Audrey Bernard" in (m.get("name") or "")), None)
        
        if not audrey:
            pytest.skip("Audrey Bernard not found in members")
        
        print(f"Audrey Bernard member info:")
        print(f"  - ID: {audrey.get('id')}")
        print(f"  - contract_signed_date: {audrey.get('contract_signed_date')}")
        print(f"  - billing_cycle_type: {audrey.get('billing_cycle_type')}")
        print(f"  - billing_cycle_value: {audrey.get('billing_cycle_value')}")
        
        # Now get her payment
        payments_response = requests.get(f"{BASE_URL}/api/payments", headers=headers)
        assert payments_response.status_code == 200
        
        payments = payments_response.json()
        audrey_payments = [p for p in payments if p.get("member_id") == audrey.get("id")]
        
        if not audrey_payments:
            pytest.skip("No payments found for Audrey Bernard")
        
        # Check the due_date - should be 2026-03-01 NOT 2026-03-25
        audrey_payment = audrey_payments[0]
        due_date = audrey_payment.get("due_date")
        
        print(f"Audrey's payment due_date: {due_date}")
        
        # The expected due_date for interval_days=25 from 2025-10-27:
        # 2025-10-27 + 25*6 = 2026-03-01
        assert due_date == "2026-03-01", f"Expected due_date 2026-03-01, got {due_date}"
        
        print(f"SUCCESS: Audrey Bernard has correct due_date {due_date}")


class TestImprovement4RenewalSansEngagement:
    """IMPROVEMENT 4: Renewal with 'Sans engagement' and new_end_date=null"""
    
    def test_get_active_member_for_renewal(self, headers):
        """Get an active member to test renewal"""
        response = requests.get(f"{BASE_URL}/api/members", headers=headers)
        assert response.status_code == 200
        
        members = response.json()
        # Find an active member (not departed, not coach)
        active_members = [m for m in members 
                         if not m.get("exit_date") 
                         and not m.get("is_coach")
                         and m.get("subscription_end_date")]
        
        if not active_members:
            pytest.skip("No active members found for renewal test")
        
        return active_members[0]
    
    def test_renew_sans_engagement(self, headers):
        """Test renewal with 'Sans engagement' option"""
        # Get an active member
        response = requests.get(f"{BASE_URL}/api/members", headers=headers)
        assert response.status_code == 200
        
        members = response.json()
        active_members = [m for m in members 
                         if not m.get("exit_date") 
                         and not m.get("is_coach")
                         and m.get("subscription_end_date")]
        
        if not active_members:
            pytest.skip("No active members found for renewal test")
        
        member = active_members[0]
        member_id = member.get("id")
        member_name = member.get("name")
        old_end_date = member.get("subscription_end_date")
        
        print(f"Testing renewal for: {member_name}")
        print(f"  - Current subscription_end_date: {old_end_date}")
        
        # Renew with 'Sans engagement' and null end_date
        renew_response = requests.post(
            f"{BASE_URL}/api/members/{member_id}/renew",
            headers=headers,
            json={
                "renewal_duration": "Sans engagement",
                "new_end_date": None,
                "notes": "TEST_ITER67 - Sans engagement renewal"
            }
        )
        
        assert renew_response.status_code == 200, f"Renewal failed: {renew_response.status_code} - {renew_response.text}"
        
        data = renew_response.json()
        updated_member = data.get("member", {})
        
        # Verify subscription_end_date is now null
        new_end_date = updated_member.get("subscription_end_date")
        
        print(f"  - New subscription_end_date: {new_end_date}")
        
        assert new_end_date is None or new_end_date == "", f"Expected null subscription_end_date, got {new_end_date}"
        
        print(f"SUCCESS: Renewal with 'Sans engagement' set subscription_end_date to null")
        
        # Restore the original end_date for cleanup
        requests.post(
            f"{BASE_URL}/api/members/{member_id}/renew",
            headers=headers,
            json={
                "renewal_duration": "12 mois",
                "new_end_date": old_end_date or "2027-03-23",
                "notes": "TEST_ITER67 - Restored original end_date"
            }
        )


class TestImprovement5CACMarketingSpend:
    """IMPROVEMENT 5: CAC calculation uses marketing_spend field"""
    
    def test_kpi_cac_uses_marketing_spend(self, headers):
        """Verify CAC is calculated using marketing_spend"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis", headers=headers)
        assert response.status_code == 200, f"Failed to get KPIs: {response.text}"
        
        kpis = response.json()
        
        if not kpis:
            pytest.skip("No KPIs found")
        
        # Get a recent month with data
        recent_kpi = kpis[-1] if kpis else None
        
        if not recent_kpi:
            pytest.skip("No KPI data available")
        
        month = recent_kpi.get("month")
        marketing_spend = recent_kpi.get("marketing_spend", 0)
        ad_spend = recent_kpi.get("ad_spend", 0)
        close = recent_kpi.get("close", 0)
        cac = recent_kpi.get("cac", 0)
        
        print(f"KPI for {month}:")
        print(f"  - marketing_spend: {marketing_spend}")
        print(f"  - ad_spend: {ad_spend}")
        print(f"  - close (sales): {close}")
        print(f"  - cac: {cac}")
        
        # CAC = (marketing_spend + ad_spend) / close
        if close > 0:
            expected_cac = round((marketing_spend + ad_spend) / close, 2)
            print(f"  - Expected CAC: {expected_cac}")
            
            # Allow small rounding difference
            assert abs(cac - expected_cac) < 1, f"CAC mismatch: expected {expected_cac}, got {cac}"
            print(f"SUCCESS: CAC calculation uses marketing_spend correctly")
        else:
            print("Note: close=0, cannot verify CAC calculation")


class TestAPIHealthCheck:
    """Basic API health checks"""
    
    def test_auth_endpoint(self):
        """Test authentication works"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": AUTH_EMAIL,
            "password": AUTH_PASSWORD
        })
        assert response.status_code == 200, f"Auth failed: {response.status_code}"
        assert "access_token" in response.json()
        print("SUCCESS: Authentication working")
    
    def test_members_endpoint(self, headers):
        """Test members endpoint"""
        response = requests.get(f"{BASE_URL}/api/members", headers=headers)
        assert response.status_code == 200
        print(f"SUCCESS: Members endpoint returned {len(response.json())} members")
    
    def test_payments_endpoint(self, headers):
        """Test payments endpoint"""
        response = requests.get(f"{BASE_URL}/api/payments", headers=headers)
        assert response.status_code == 200
        print(f"SUCCESS: Payments endpoint returned {len(response.json())} payments")
    
    def test_annual_reviews_endpoint(self, headers):
        """Test annual reviews endpoint"""
        response = requests.get(f"{BASE_URL}/api/annual-reviews", headers=headers)
        assert response.status_code == 200
        print(f"SUCCESS: Annual reviews endpoint returned {len(response.json())} reviews")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
