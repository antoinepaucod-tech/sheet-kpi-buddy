"""
Iteration 31 - Bug Fix Tests for GHL Integration
Tests verify:
1. Caroline Maerten has email+phone from GHL contact
2. KPI 2026-03 has correct revenue, active_members, pif_members, new_members
3. POST /api/ghl/sync updates active_members and pif_members
4. POST /api/ghl/confirm-sale creates member with email+phone, prevents duplicates
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestCarolineMaertenData:
    """Verify Caroline Maerten member data has email and phone from GHL"""
    
    def test_caroline_has_email(self):
        """Caroline Maerten should have email caro_maerten@hotmail.fr"""
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        
        members = response.json()
        caroline = None
        for m in members:
            if 'Caroline' in m.get('name', '') and 'Maerten' in m.get('name', ''):
                caroline = m
                break
        
        assert caroline is not None, "Caroline Maerten not found in members"
        assert caroline.get('email') == 'caro_maerten@hotmail.fr', f"Expected email caro_maerten@hotmail.fr, got {caroline.get('email')}"
    
    def test_caroline_has_phone(self):
        """Caroline Maerten should have phone +41754346114"""
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        
        members = response.json()
        caroline = None
        for m in members:
            if 'Caroline' in m.get('name', '') and 'Maerten' in m.get('name', ''):
                caroline = m
                break
        
        assert caroline is not None, "Caroline Maerten not found"
        assert caroline.get('phone') == '+41754346114', f"Expected phone +41754346114, got {caroline.get('phone')}"


class TestKPI202603:
    """Verify KPI for 2026-03 has correct values after bug fixes"""
    
    def test_kpi_total_revenue(self):
        """KPI 2026-03 should have total_revenue=599"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis/2026-03")
        assert response.status_code == 200
        
        kpi = response.json()
        assert kpi.get('total_revenue') == 599, f"Expected total_revenue=599, got {kpi.get('total_revenue')}"
    
    def test_kpi_active_members(self):
        """KPI 2026-03 should have active_members=2"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis/2026-03")
        assert response.status_code == 200
        
        kpi = response.json()
        assert kpi.get('active_members') == 2, f"Expected active_members=2, got {kpi.get('active_members')}"
    
    def test_kpi_pif_members(self):
        """KPI 2026-03 should have pif_members=1"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis/2026-03")
        assert response.status_code == 200
        
        kpi = response.json()
        assert kpi.get('pif_members') == 1, f"Expected pif_members=1, got {kpi.get('pif_members')}"
    
    def test_kpi_new_members(self):
        """KPI 2026-03 should have new_members=1"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis/2026-03")
        assert response.status_code == 200
        
        kpi = response.json()
        assert kpi.get('new_members') == 1, f"Expected new_members=1, got {kpi.get('new_members')}"
    
    def test_kpi_cash_collected(self):
        """KPI 2026-03 should have cash_collected=599"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis/2026-03")
        assert response.status_code == 200
        
        kpi = response.json()
        assert kpi.get('cash_collected') == 599, f"Expected cash_collected=599, got {kpi.get('cash_collected')}"


class TestGHLSync:
    """Test GHL sync endpoint functionality"""
    
    def test_sync_endpoint_works(self):
        """POST /api/ghl/sync returns success"""
        response = requests.post(f"{BASE_URL}/api/ghl/sync?start_date=2026-02-24&end_date=2026-03-14")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get('status') == 'success'
    
    def test_sync_returns_kpi_month(self):
        """Sync should return kpi_month=2026-03"""
        response = requests.post(f"{BASE_URL}/api/ghl/sync?start_date=2026-02-24&end_date=2026-03-14")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get('kpi_month') == '2026-03', f"Expected kpi_month=2026-03, got {data.get('kpi_month')}"
    
    def test_sync_returns_funnel_data(self):
        """Sync should return funnel with leads"""
        response = requests.post(f"{BASE_URL}/api/ghl/sync?start_date=2026-02-24&end_date=2026-03-14")
        assert response.status_code == 200
        
        data = response.json()
        funnel = data.get('funnel', {})
        assert 'new_leads' in funnel
        assert 'showed_sold' in funnel
    
    def test_sync_updates_kpi_active_members(self):
        """After sync, KPI should have updated active_members from DB count"""
        # First sync
        response = requests.post(f"{BASE_URL}/api/ghl/sync?start_date=2026-02-24&end_date=2026-03-14")
        assert response.status_code == 200
        
        # Then check KPI
        kpi_response = requests.get(f"{BASE_URL}/api/monthly-kpis/2026-03")
        assert kpi_response.status_code == 200
        
        kpi = kpi_response.json()
        # active_members should be >= 1 (at least Caroline is active)
        assert kpi.get('active_members', 0) >= 1, "active_members should be at least 1"


class TestGHLLastSync:
    """Test last sync endpoint"""
    
    def test_last_sync_returns_funnel_opportunities(self):
        """GET /api/ghl/last-sync should include funnel_opportunities"""
        response = requests.get(f"{BASE_URL}/api/ghl/last-sync")
        assert response.status_code == 200
        
        data = response.json()
        if data.get('status') == 'success':
            assert 'funnel_opportunities' in data or 'funnel' in data


class TestGHLConfirmSaleDuplicatePrevention:
    """Test that confirm-sale prevents duplicate members"""
    
    def test_confirm_sale_returns_existing_for_duplicate(self):
        """Confirming a sale that was already confirmed should return existing sale"""
        # Caroline's sale was already confirmed - try to confirm again
        payload = {
            "opportunity_id": "1K3SzLjR8FLhdkHPqqZx",  # Caroline's opportunity ID from GHL
            "opportunity_name": "Caroline Maerten",
            "contact_email": "caro_maerten@hotmail.fr",
            "contact_phone": "+41754346114",
            "subscription_type": "6 Week Challenge",
            "cash_collected": 599,
            "month": "2026-03"
        }
        response = requests.post(f"{BASE_URL}/api/ghl/confirm-sale", json=payload)
        
        # Should return 200 with existing sale data (idempotent)
        assert response.status_code == 200
        
        # Should not create duplicate member
        members_response = requests.get(f"{BASE_URL}/api/members")
        members = members_response.json()
        caroline_count = sum(1 for m in members if m.get('name') == 'Caroline Maerten')
        assert caroline_count == 1, f"Expected 1 Caroline Maerten, found {caroline_count}"


class TestHealthAndAPIs:
    """Basic API health checks"""
    
    def test_members_endpoint(self):
        """GET /api/members returns 200"""
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
    
    def test_monthly_kpis_endpoint(self):
        """GET /api/monthly-kpis returns 200"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis")
        assert response.status_code == 200
    
    def test_ghl_sales_endpoint(self):
        """GET /api/ghl/sales/2026-03 returns 200"""
        response = requests.get(f"{BASE_URL}/api/ghl/sales/2026-03")
        assert response.status_code == 200


@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session
