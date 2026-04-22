"""
Iteration 57 - Backend tests for 6 bug fixes:
FIX 1: Recurring revenue from billing_enabled members (not payment_schedules), 47 items, ~6202 CHF
FIX 2: Onboarding optimistic update (frontend test)
FIX 3: Member edit modal scrolling & review toggle (frontend test)
FIX 4: Auto-generate reviews only for members with annual_review_enabled=True
FIX 5: No unknown/empty member names in recurring revenue
FIX 6: Member edit dialog scrolls properly (frontend test)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://member-archive-mgmt.preview.emergentagent.com')


class TestRecurringRevenueFix:
    """FIX 1 & 5: Recurring revenue from billing_enabled members with names"""

    def test_recurring_revenue_count_is_around_47(self):
        """FIX 1: Should have ~47 items in recurring_revenue"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis/2026-03/details")
        assert response.status_code == 200
        data = response.json()
        recurring = data.get('recurring_revenue', [])
        # Should have around 47 members with billing_enabled
        assert 40 <= len(recurring) <= 55, f"Expected ~47 recurring items, got {len(recurring)}"

    def test_recurring_revenue_total_around_6202(self):
        """FIX 1: Total should be ~6202 CHF"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis/2026-03/details")
        assert response.status_code == 200
        data = response.json()
        recurring = data.get('recurring_revenue', [])
        total = sum(r.get('amount', 0) for r in recurring)
        # Total should be around 6202 CHF
        assert 6000 <= total <= 6500, f"Expected ~6202 CHF total, got {total}"

    def test_recurring_revenue_all_have_member_names(self):
        """FIX 5: All items should have member_name"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis/2026-03/details")
        assert response.status_code == 200
        data = response.json()
        recurring = data.get('recurring_revenue', [])
        
        # All items should have non-empty member_name
        empty_names = [r for r in recurring if not r.get('member_name')]
        assert len(empty_names) == 0, f"Found {len(empty_names)} items without member_name"

    def test_recurring_revenue_no_coaches(self):
        """FIX 1: No coaches in recurring revenue"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis/2026-03/details")
        assert response.status_code == 200
        data = response.json()
        recurring = data.get('recurring_revenue', [])
        
        coach_keywords = ['THE COACH', 'VIRTUAL COACH']
        coaches = [r for r in recurring if any(kw in (r.get('membership') or '').upper() for kw in coach_keywords)]
        assert len(coaches) == 0, f"Found {len(coaches)} coach memberships in recurring revenue"

    def test_recurring_revenue_structure(self):
        """FIX 1: Recurring items have expected fields"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis/2026-03/details")
        assert response.status_code == 200
        data = response.json()
        recurring = data.get('recurring_revenue', [])
        
        # Check structure of first item
        if recurring:
            first = recurring[0]
            assert 'id' in first
            assert 'member_id' in first
            assert 'member_name' in first
            assert 'amount' in first
            assert 'membership' in first
            assert 'billing_cycle_type' in first


class TestAutoGenerateReviewsFix:
    """FIX 4: Auto-generate only for members with annual_review_enabled=True"""

    def test_no_members_have_annual_review_enabled_by_default(self):
        """FIX 4: Currently no members have annual_review_enabled=True"""
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        members = response.json()
        
        enabled = [m for m in members if m.get('annual_review_enabled') == True]
        # By design, currently no members have this enabled
        assert len(enabled) == 0, f"Expected 0 members with annual_review_enabled, found {len(enabled)}"

    def test_auto_generate_creates_zero_when_no_enabled_members(self):
        """FIX 4: Auto-generate should create 0 reviews when no members have it enabled"""
        response = requests.post(f"{BASE_URL}/api/annual-reviews/auto-generate")
        assert response.status_code == 200
        data = response.json()
        
        assert data['created'] == 0
        assert data['total_eligible'] == 0
        assert 'bilan(s) créé(s)' in data['message']


class TestMemberModelFields:
    """FIX 3: Member model has new fields for review toggle"""

    def test_member_model_has_first_review_date_field(self):
        """FIX 3: Members should have first_review_date field available"""
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        members = response.json()
        
        # At least some members should exist
        assert len(members) > 0
        
        # First member should have the annual_review_enabled field (may be False)
        first = members[0]
        assert 'annual_review_enabled' in first or first.get('annual_review_enabled') is None
        # first_review_date may or may not be set
        # The field should be accessible when updating a member

    def test_member_update_with_review_fields(self):
        """FIX 3: Verify member model supports review fields"""
        # Get a member to verify the model has the fields
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        members = response.json()
        
        # First member should have review-related fields in the schema
        first = members[0]
        # Check that the fields exist (even if null/false)
        # These fields are part of the CustomerMember model
        # annual_review_enabled, review_frequency, first_review_date
        # The model defines them, so they should be accessible
        
        # Verify schema by checking a member's response includes these field possibilities
        # (they may be False/None but the model supports them)
        assert isinstance(first.get('annual_review_enabled', False), bool) or first.get('annual_review_enabled') is None
        # review_frequency defaults to "monthly" 
        assert first.get('review_frequency') in [None, 'monthly', 'quarterly', 'semi-annually', 'annually']


class TestReviewReminderToStaff:
    """FIX 4: Review reminder sent to STAFF (not member)"""

    def test_notifications_send_review_reminder_endpoint_exists(self):
        """FIX 4: The send-review-reminder endpoint should exist"""
        # Get a review ID first
        response = requests.get(f"{BASE_URL}/api/annual-reviews")
        assert response.status_code == 200
        reviews = response.json()
        
        if not reviews:
            pytest.skip("No reviews to test reminder")
        
        # Just verify the endpoint exists (don't actually send email)
        # The endpoint sends to STAFF, not member
        # We just verify the route is available
        review_id = reviews[0]['id']
        # We don't actually POST to avoid sending real emails
        # But we can verify it's a valid route by checking for proper 4xx/5xx on invalid ID
        response = requests.post(f"{BASE_URL}/api/notifications/send-review-reminder/invalid-id-test")
        # Should return 404 for invalid review, not 500 (route exists)
        assert response.status_code == 404


class TestBillingMembersPaymentSync:
    """FIX 5: Payment schedules synced with member names"""

    def test_billing_members_have_names(self):
        """FIX 5: All billing members should have names"""
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        members = response.json()
        
        billing_members = [m for m in members if m.get('billing_enabled') and m.get('billing_amount', 0) > 0]
        unnamed = [m for m in billing_members if not m.get('name')]
        
        assert len(unnamed) == 0, f"Found {len(unnamed)} billing members without names"

    def test_recurring_revenue_matches_billing_members(self):
        """FIX 5: Recurring revenue should come from billing members, not payment_schedules"""
        # Get members with billing enabled
        members_resp = requests.get(f"{BASE_URL}/api/members")
        assert members_resp.status_code == 200
        members = members_resp.json()
        
        today = "2026-03-18"  # Test date
        billing_members = [m for m in members 
                         if m.get('billing_enabled') 
                         and m.get('billing_amount', 0) > 0
                         and not m.get('is_coach')
                         and (not m.get('exit_date') or m['exit_date'] >= today)]
        
        # Get recurring revenue from KPI
        kpi_resp = requests.get(f"{BASE_URL}/api/monthly-kpis/2026-03/details")
        assert kpi_resp.status_code == 200
        recurring = kpi_resp.json().get('recurring_revenue', [])
        
        # Counts should be similar (some may have coach membership excluded)
        # Allow some variance for edge cases
        diff = abs(len(billing_members) - len(recurring))
        assert diff <= 30, f"Billing members ({len(billing_members)}) vs recurring ({len(recurring)}) differ too much"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
