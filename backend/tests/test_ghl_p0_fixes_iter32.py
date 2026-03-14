"""
Iteration 32 - P0 Bug Fixes Tests for GHL Integration
Tests verify:
1. POST /api/ghl/confirm-sale accepts new fields: signature_date, member_type, subscription_end_date, billing fields
2. Member created with contract_signed_date from signature_date
3. Member created with correct member_type
4. Member created with billing_enabled and billing fields when provided
5. Basic API health checks
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestGHLConfirmSaleNewFields:
    """Test that confirm-sale endpoint accepts and stores all new fields from P0 fix"""
    
    def test_confirm_sale_with_signature_date(self):
        """Confirm sale should accept signature_date and store as contract_signed_date"""
        unique_id = f"test_sig_date_{uuid.uuid4().hex[:8]}"
        
        payload = {
            "opportunity_id": unique_id,
            "opportunity_name": f"TEST_SignatureDate_{unique_id}",
            "contact_email": "test_sig@example.com",
            "contact_phone": "+41000000001",
            "subscription_type": "6 Week Challenge",
            "member_type": "Membres PIF",
            "cash_collected": 599,
            "signature_date": "2026-01-15",  # New field from P0 fix
            "subscription_end_date": "2026-02-26",
            "month": "2026-01"
        }
        
        response = requests.post(f"{BASE_URL}/api/ghl/confirm-sale", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        sale = response.json()
        assert sale.get('opportunity_id') == unique_id
        
        # Verify member was created with correct contract_signed_date
        members_response = requests.get(f"{BASE_URL}/api/members")
        assert members_response.status_code == 200
        
        members = members_response.json()
        test_member = None
        for m in members:
            if unique_id in m.get('name', ''):
                test_member = m
                break
        
        assert test_member is not None, f"Member with name containing {unique_id} not found"
        assert test_member.get('contract_signed_date') == '2026-01-15', \
            f"Expected contract_signed_date=2026-01-15, got {test_member.get('contract_signed_date')}"
        
        # Cleanup
        if test_member:
            requests.delete(f"{BASE_URL}/api/members/{test_member['id']}")
    
    def test_confirm_sale_with_member_type(self):
        """Confirm sale should accept and store member_type"""
        unique_id = f"test_member_type_{uuid.uuid4().hex[:8]}"
        
        payload = {
            "opportunity_id": unique_id,
            "opportunity_name": f"TEST_MemberType_{unique_id}",
            "contact_email": "test_type@example.com",
            "subscription_type": "Annuel",
            "member_type": "Membres PT",  # Specific member type
            "cash_collected": 2400,
            "signature_date": "2026-01-10",
            "subscription_end_date": "2027-01-10",
            "month": "2026-01"
        }
        
        response = requests.post(f"{BASE_URL}/api/ghl/confirm-sale", json=payload)
        assert response.status_code == 200
        
        # Verify member type was stored
        members_response = requests.get(f"{BASE_URL}/api/members")
        members = members_response.json()
        
        test_member = None
        for m in members:
            if unique_id in m.get('name', ''):
                test_member = m
                break
        
        assert test_member is not None
        assert test_member.get('member_type') == 'Membres PT', \
            f"Expected member_type=Membres PT, got {test_member.get('member_type')}"
        
        # Cleanup
        if test_member:
            requests.delete(f"{BASE_URL}/api/members/{test_member['id']}")
    
    def test_confirm_sale_with_subscription_end_date(self):
        """Confirm sale should accept and store subscription_end_date"""
        unique_id = f"test_end_date_{uuid.uuid4().hex[:8]}"
        
        payload = {
            "opportunity_id": unique_id,
            "opportunity_name": f"TEST_EndDate_{unique_id}",
            "contact_email": "test_end@example.com",
            "subscription_type": "6 Mois",
            "member_type": "Membres PIF",
            "cash_collected": 650,
            "signature_date": "2026-01-20",
            "subscription_end_date": "2026-07-20",  # 6 months later
            "month": "2026-01"
        }
        
        response = requests.post(f"{BASE_URL}/api/ghl/confirm-sale", json=payload)
        assert response.status_code == 200
        
        # Verify end date was stored
        members_response = requests.get(f"{BASE_URL}/api/members")
        members = members_response.json()
        
        test_member = None
        for m in members:
            if unique_id in m.get('name', ''):
                test_member = m
                break
        
        assert test_member is not None
        assert test_member.get('subscription_end_date') == '2026-07-20', \
            f"Expected subscription_end_date=2026-07-20, got {test_member.get('subscription_end_date')}"
        
        # Cleanup
        if test_member:
            requests.delete(f"{BASE_URL}/api/members/{test_member['id']}")
    
    def test_confirm_sale_with_billing_enabled(self):
        """Confirm sale should accept and store billing fields when billing_enabled=true"""
        unique_id = f"test_billing_{uuid.uuid4().hex[:8]}"
        
        payload = {
            "opportunity_id": unique_id,
            "opportunity_name": f"TEST_Billing_{unique_id}",
            "contact_email": "test_billing@example.com",
            "subscription_type": "Mensuel",
            "member_type": "Membres Généraux Récurrents",
            "cash_collected": 120,
            "signature_date": "2026-01-05",
            "subscription_end_date": "2026-02-05",
            "month": "2026-01",
            # Billing fields
            "billing_enabled": True,
            "billing_amount": 120,
            "billing_cycle_type": "monthly_day",
            "billing_cycle_value": 15,
            "billing_payment_method": "prelevement"
        }
        
        response = requests.post(f"{BASE_URL}/api/ghl/confirm-sale", json=payload)
        assert response.status_code == 200
        
        # Verify billing fields were stored
        members_response = requests.get(f"{BASE_URL}/api/members")
        members = members_response.json()
        
        test_member = None
        for m in members:
            if unique_id in m.get('name', ''):
                test_member = m
                break
        
        assert test_member is not None
        assert test_member.get('billing_enabled') == True, \
            f"Expected billing_enabled=True, got {test_member.get('billing_enabled')}"
        assert test_member.get('billing_amount') == 120, \
            f"Expected billing_amount=120, got {test_member.get('billing_amount')}"
        assert test_member.get('billing_cycle_type') == 'monthly_day', \
            f"Expected billing_cycle_type=monthly_day, got {test_member.get('billing_cycle_type')}"
        assert test_member.get('billing_cycle_value') == 15, \
            f"Expected billing_cycle_value=15, got {test_member.get('billing_cycle_value')}"
        assert test_member.get('billing_payment_method') == 'prelevement', \
            f"Expected billing_payment_method=prelevement, got {test_member.get('billing_payment_method')}"
        
        # Cleanup
        if test_member:
            requests.delete(f"{BASE_URL}/api/members/{test_member['id']}")
    
    def test_confirm_sale_without_billing(self):
        """Confirm sale should work without billing fields (PIF members)"""
        unique_id = f"test_no_billing_{uuid.uuid4().hex[:8]}"
        
        payload = {
            "opportunity_id": unique_id,
            "opportunity_name": f"TEST_NoBilling_{unique_id}",
            "subscription_type": "6 Week Challenge",
            "member_type": "Membres PIF",
            "cash_collected": 599,
            "signature_date": "2026-01-08",
            "subscription_end_date": "2026-02-19",
            "month": "2026-01"
            # No billing fields - PIF member doesn't need recurring billing
        }
        
        response = requests.post(f"{BASE_URL}/api/ghl/confirm-sale", json=payload)
        assert response.status_code == 200
        
        # Verify member was created
        members_response = requests.get(f"{BASE_URL}/api/members")
        members = members_response.json()
        
        test_member = None
        for m in members:
            if unique_id in m.get('name', ''):
                test_member = m
                break
        
        assert test_member is not None
        assert test_member.get('billing_enabled', False) == False, \
            "Expected billing_enabled=False for PIF member"
        
        # Cleanup
        if test_member:
            requests.delete(f"{BASE_URL}/api/members/{test_member['id']}")


class TestGHLConfirmSaleFullPayload:
    """Test confirm-sale with complete payload including all new fields"""
    
    def test_full_payload_creates_correct_member(self):
        """Complete payload with all fields should create member correctly"""
        unique_id = f"test_full_{uuid.uuid4().hex[:8]}"
        
        payload = {
            "opportunity_id": unique_id,
            "opportunity_name": f"TEST_FullPayload_{unique_id}",
            "contact_email": "test_full@example.com",
            "contact_phone": "+41123456789",
            "subscription_type": "3 Mois",
            "member_type": "Membres Généraux Récurrents",
            "cash_collected": 350,
            "signature_date": "2026-01-12",
            "subscription_end_date": "2026-04-12",
            "month": "2026-01",
            "billing_enabled": True,
            "billing_amount": 120,
            "billing_cycle_type": "interval_days",
            "billing_cycle_value": 30,
            "billing_payment_method": "carte"
        }
        
        response = requests.post(f"{BASE_URL}/api/ghl/confirm-sale", json=payload)
        assert response.status_code == 200
        
        # Verify all fields were stored correctly
        members_response = requests.get(f"{BASE_URL}/api/members")
        members = members_response.json()
        
        test_member = None
        for m in members:
            if unique_id in m.get('name', ''):
                test_member = m
                break
        
        assert test_member is not None, "Test member not found"
        
        # Verify all fields
        assert test_member.get('email') == 'test_full@example.com'
        assert test_member.get('phone') == '+41123456789'
        assert test_member.get('membership') == '3 Mois'
        assert test_member.get('member_type') == 'Membres Généraux Récurrents'
        assert test_member.get('cash_collected') == 350
        assert test_member.get('contract_signed_date') == '2026-01-12'
        assert test_member.get('subscription_end_date') == '2026-04-12'
        assert test_member.get('billing_enabled') == True
        assert test_member.get('billing_amount') == 120
        assert test_member.get('billing_cycle_type') == 'interval_days'
        assert test_member.get('billing_cycle_value') == 30
        assert test_member.get('billing_payment_method') == 'carte'
        
        # Cleanup
        if test_member:
            requests.delete(f"{BASE_URL}/api/members/{test_member['id']}")


class TestMemberRenewalBilling:
    """Test member renewal with billing cycle update"""
    
    def test_renewal_with_billing_update(self):
        """Renewal endpoint should accept billing cycle updates"""
        # First create a test member
        unique_id = f"test_renew_{uuid.uuid4().hex[:8]}"
        
        create_payload = {
            "name": f"TEST_Renewal_{unique_id}",
            "email": "test_renewal@example.com",
            "membership": "Annuel",
            "member_type": "Membres Généraux Récurrents",
            "contract_signed_date": "2025-01-01",
            "subscription_end_date": "2026-01-01",
            "cash_collected": 1200,
            "billing_enabled": True,
            "billing_amount": 100,
            "billing_cycle_type": "monthly_day",
            "billing_cycle_value": 1,
            "billing_payment_method": "prelevement"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/members", json=create_payload)
        assert create_response.status_code in [200, 201], f"Failed to create member: {create_response.text}"
        
        created_member = create_response.json()
        member_id = created_member.get('id')
        
        # Now renew with billing update
        renew_payload = {
            "new_end_date": "2027-01-01",
            "renewal_duration": "12 mois",
            "notes": "Test renewal with billing update",
            "billing_cycle_type": "monthly_day",
            "billing_cycle_value": 15,  # Change from 1st to 15th
            "billing_amount": 110,  # Price increase
            "billing_payment_method": "carte"
        }
        
        renew_response = requests.post(f"{BASE_URL}/api/members/{member_id}/renew", json=renew_payload)
        assert renew_response.status_code == 200, f"Renewal failed: {renew_response.text}"
        
        # Verify member was updated
        get_response = requests.get(f"{BASE_URL}/api/members/{member_id}")
        if get_response.status_code == 200:
            updated_member = get_response.json()
            assert updated_member.get('subscription_end_date') == '2027-01-01'
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/members/{member_id}")


class TestGHLSyncAndLastSync:
    """Test GHL sync endpoints still work correctly"""
    
    def test_ghl_last_sync(self):
        """GET /api/ghl/last-sync should return sync data"""
        response = requests.get(f"{BASE_URL}/api/ghl/last-sync")
        assert response.status_code == 200
        
        data = response.json()
        # Either we have a successful sync or no sync yet
        assert 'status' in data
    
    def test_ghl_sync_history(self):
        """GET /api/ghl/sync-history should return array"""
        response = requests.get(f"{BASE_URL}/api/ghl/sync-history")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)


class TestAPIHealthChecks:
    """Basic API health checks"""
    
    def test_root_endpoint(self):
        """GET / returns 200"""
        response = requests.get(f"{BASE_URL}/")
        assert response.status_code == 200
    
    def test_members_endpoint(self):
        """GET /api/members returns 200"""
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
    
    def test_monthly_kpis_endpoint(self):
        """GET /api/monthly-kpis returns 200"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis")
        assert response.status_code == 200


@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session
