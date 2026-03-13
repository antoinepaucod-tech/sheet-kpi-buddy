"""
Iteration 27: P2 Renewal Feature Tests
Tests for:
1. Renew endpoint with new_membership field updates member's membership type
2. Auto-add member to active challenge when renewing with challenge-type membership
3. Renew endpoint updates billing fields correctly
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestRenewalMembershipChange:
    """Test renewal with membership type change"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.test_member_id = None
        yield
        # Cleanup: delete test member
        if self.test_member_id:
            requests.delete(f"{BASE_URL}/api/members/{self.test_member_id}")
    
    def test_renew_updates_membership_type(self):
        """Renewing with new_membership should update member's membership type"""
        # Create a test member
        member_data = {
            "name": "TEST_RenewMembershipChange",
            "email": "test_renew_change@example.com",
            "membership": "Mensuel",
            "member_type": "Membres Généraux Récurrents",
            "contract_signed_date": "2024-01-01",
            "subscription_end_date": "2025-01-15",
            "billing_enabled": False
        }
        create_resp = requests.post(f"{BASE_URL}/api/members", json=member_data)
        assert create_resp.status_code == 200, f"Failed to create member: {create_resp.text}"
        created = create_resp.json()
        self.test_member_id = created["id"]
        
        # Renew with new membership type
        renew_payload = {
            "new_end_date": "2026-01-15",
            "renewal_duration": "12 mois",
            "new_membership": "Annuel PT",
            "new_member_type": "Membres PT"
        }
        renew_resp = requests.post(f"{BASE_URL}/api/members/{self.test_member_id}/renew", json=renew_payload)
        assert renew_resp.status_code == 200, f"Failed to renew: {renew_resp.text}"
        
        # Verify membership was updated
        get_resp = requests.get(f"{BASE_URL}/api/members/{self.test_member_id}")
        assert get_resp.status_code == 200
        updated_member = get_resp.json()
        
        assert updated_member["membership"] == "Annuel PT", f"Membership not updated: {updated_member['membership']}"
        assert updated_member["member_type"] == "Membres PT", f"Member type not updated: {updated_member['member_type']}"
        assert updated_member["subscription_end_date"] == "2026-01-15"
        print("PASS: Renewal with new_membership correctly updates membership type")
    
    def test_renew_without_membership_change(self):
        """Renewing without new_membership should keep original membership type"""
        # Create a test member
        member_data = {
            "name": "TEST_RenewNoChange",
            "email": "test_renew_nochange@example.com",
            "membership": "6 Mois",
            "member_type": "Membres PIF",
            "contract_signed_date": "2024-06-01",
            "subscription_end_date": "2025-01-01",
            "billing_enabled": False
        }
        create_resp = requests.post(f"{BASE_URL}/api/members", json=member_data)
        assert create_resp.status_code == 200
        created = create_resp.json()
        self.test_member_id = created["id"]
        
        # Renew without changing membership
        renew_payload = {
            "new_end_date": "2025-07-01",
            "renewal_duration": "6 mois"
        }
        renew_resp = requests.post(f"{BASE_URL}/api/members/{self.test_member_id}/renew", json=renew_payload)
        assert renew_resp.status_code == 200
        
        # Verify membership was NOT changed
        get_resp = requests.get(f"{BASE_URL}/api/members/{self.test_member_id}")
        assert get_resp.status_code == 200
        updated_member = get_resp.json()
        
        assert updated_member["membership"] == "6 Mois", f"Membership should remain '6 Mois', got: {updated_member['membership']}"
        assert updated_member["member_type"] == "Membres PIF"
        print("PASS: Renewal without new_membership keeps original membership")


class TestRenewalChallengeAutoAdd:
    """Test auto-add to challenge when renewing to challenge membership"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.test_member_id = None
        yield
        # Cleanup
        if self.test_member_id:
            # Remove from challenge participants
            requests.delete(f"{BASE_URL}/api/members/{self.test_member_id}")
    
    def test_renew_to_challenge_auto_adds_to_active_challenge(self):
        """Renewing to a challenge-type membership should auto-add to active challenge"""
        # Create a test member with non-challenge membership
        member_data = {
            "name": "TEST_RenewToChallenge",
            "email": "test_challenge_renew@example.com",
            "membership": "Mensuel",
            "member_type": "Membres Généraux Récurrents",
            "contract_signed_date": "2024-10-01",
            "subscription_end_date": "2025-01-10",
            "billing_enabled": False
        }
        create_resp = requests.post(f"{BASE_URL}/api/members", json=member_data)
        assert create_resp.status_code == 200
        created = create_resp.json()
        self.test_member_id = created["id"]
        
        # Get active challenge
        challenges_resp = requests.get(f"{BASE_URL}/api/challenges")
        assert challenges_resp.status_code == 200
        challenges = challenges_resp.json()
        active_challenge = next((c for c in challenges if c.get("is_active")), None)
        
        if not active_challenge:
            print("SKIP: No active challenge found - cannot test auto-add")
            return
        
        challenge_id = active_challenge["id"]
        
        # Get challenge detail with participants (participants are included in challenge detail)
        challenge_detail_resp = requests.get(f"{BASE_URL}/api/challenges/{challenge_id}")
        assert challenge_detail_resp.status_code == 200
        challenge_detail = challenge_detail_resp.json()
        participants_before = challenge_detail.get("participants", [])
        member_in_challenge_before = any(p["member_id"] == self.test_member_id for p in participants_before)
        assert not member_in_challenge_before, "Member should not be in challenge before renewal"
        
        # Renew with challenge membership type
        renew_payload = {
            "new_end_date": "2025-03-01",
            "renewal_duration": "6 semaines",
            "new_membership": "6 Weeks Challenge",
            "new_member_type": "Membres Généraux Récurrents"
        }
        renew_resp = requests.post(f"{BASE_URL}/api/members/{self.test_member_id}/renew", json=renew_payload)
        assert renew_resp.status_code == 200
        
        # Verify member was auto-added to challenge
        challenge_detail_after_resp = requests.get(f"{BASE_URL}/api/challenges/{challenge_id}")
        assert challenge_detail_after_resp.status_code == 200
        challenge_detail_after = challenge_detail_after_resp.json()
        participants_after = challenge_detail_after.get("participants", [])
        member_in_challenge_after = any(p["member_id"] == self.test_member_id for p in participants_after)
        
        assert member_in_challenge_after, "Member should be auto-added to challenge after renewal"
        print(f"PASS: Member auto-added to challenge '{active_challenge['name']}' after renewal to challenge membership")


class TestRenewalBillingUpdate:
    """Test renewal with billing update"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.test_member_id = None
        yield
        if self.test_member_id:
            requests.delete(f"{BASE_URL}/api/members/{self.test_member_id}")
    
    def test_renew_updates_billing_fields(self):
        """Renewing with billing update should update billing fields"""
        # Create a test member with billing
        member_data = {
            "name": "TEST_RenewBilling",
            "email": "test_billing_renew@example.com",
            "membership": "Annuel",
            "member_type": "Membres Généraux Récurrents",
            "contract_signed_date": "2024-01-01",
            "subscription_end_date": "2025-01-01",
            "billing_enabled": True,
            "billing_amount": 100,
            "billing_cycle_type": "monthly_day",
            "billing_cycle_value": 1,
            "billing_payment_method": "prelevement"
        }
        create_resp = requests.post(f"{BASE_URL}/api/members", json=member_data)
        assert create_resp.status_code == 200
        created = create_resp.json()
        self.test_member_id = created["id"]
        
        # Renew with updated billing
        renew_payload = {
            "new_end_date": "2026-01-01",
            "renewal_duration": "12 mois",
            "billing_amount": 150,
            "billing_cycle_type": "interval_days",
            "billing_cycle_value": 30,
            "billing_payment_method": "carte"
        }
        renew_resp = requests.post(f"{BASE_URL}/api/members/{self.test_member_id}/renew", json=renew_payload)
        assert renew_resp.status_code == 200
        
        # Verify billing was updated
        get_resp = requests.get(f"{BASE_URL}/api/members/{self.test_member_id}")
        assert get_resp.status_code == 200
        updated_member = get_resp.json()
        
        assert updated_member.get("billing_amount") == 150, f"Billing amount not updated: {updated_member.get('billing_amount')}"
        assert updated_member.get("billing_cycle_type") == "interval_days"
        assert updated_member.get("billing_cycle_value") == 30
        assert updated_member.get("billing_payment_method") == "carte"
        print("PASS: Renewal correctly updates billing fields")


class TestRenewalHistoryRecord:
    """Test that renewal creates history record"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.test_member_id = None
        yield
        if self.test_member_id:
            requests.delete(f"{BASE_URL}/api/members/{self.test_member_id}")
    
    def test_renewal_creates_history_record(self):
        """Renewal should create a history record with previous and new end dates"""
        # Create test member
        member_data = {
            "name": "TEST_RenewHistory",
            "email": "test_history@example.com",
            "membership": "Annuel",
            "member_type": "Membres Généraux Récurrents",
            "contract_signed_date": "2024-01-01",
            "subscription_end_date": "2025-01-01",
            "billing_enabled": False
        }
        create_resp = requests.post(f"{BASE_URL}/api/members", json=member_data)
        assert create_resp.status_code == 200
        created = create_resp.json()
        self.test_member_id = created["id"]
        
        # Renew
        renew_payload = {
            "new_end_date": "2026-01-01",
            "renewal_duration": "12 mois",
            "notes": "Test renewal note"
        }
        renew_resp = requests.post(f"{BASE_URL}/api/members/{self.test_member_id}/renew", json=renew_payload)
        assert renew_resp.status_code == 200
        
        # Get renewals history
        history_resp = requests.get(f"{BASE_URL}/api/members/{self.test_member_id}/renewals")
        assert history_resp.status_code == 200
        history = history_resp.json()
        
        assert len(history) >= 1, "Should have at least one renewal record"
        latest_renewal = history[0]
        assert latest_renewal["previous_end_date"] == "2025-01-01"
        assert latest_renewal["new_end_date"] == "2026-01-01"
        assert latest_renewal["renewal_duration"] == "12 mois"
        assert latest_renewal["notes"] == "Test renewal note"
        print("PASS: Renewal creates proper history record")


class TestExpiringMembers:
    """Test expiring members endpoint"""
    
    def test_get_expiring_members(self):
        """Should return members expiring within specified days"""
        resp = requests.get(f"{BASE_URL}/api/members/expiring?days=30")
        assert resp.status_code == 200
        expiring = resp.json()
        
        # Just validate structure
        assert isinstance(expiring, list)
        
        # If there are expiring members, check they have days_remaining
        for member in expiring:
            assert "days_remaining" in member
            assert member["days_remaining"] <= 30
            assert "name" in member
            assert "subscription_end_date" in member
        
        print(f"PASS: Found {len(expiring)} expiring members within 30 days")
