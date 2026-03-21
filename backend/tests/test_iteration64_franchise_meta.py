"""
Iteration 64 - Franchise Dashboard & Meta API Integration Tests
Tests:
1. Super Admin login with restored password (TheCoach1290.)
2. Franchise Dashboard endpoints (dashboard, trends, ad-budgets)
3. Meta Marketing API endpoints (status, ad-spend, sync)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Test credentials
SUPER_ADMIN_EMAIL = "antoine.paucod@the-coach.pro"
SUPER_ADMIN_PASSWORD = "TheCoach1290."
MANAGER_EMAIL = "test@crossfit.ch"
MANAGER_PASSWORD = "test123"


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def super_admin_token(api_client):
    """Get Super Admin authentication token with new password"""
    response = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.fail(f"Super Admin login failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def manager_token(api_client):
    """Get Manager authentication token"""
    response = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": MANAGER_EMAIL, "password": MANAGER_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Manager login failed - skipping manager tests")


@pytest.fixture(scope="module")
def super_admin_client(api_client, super_admin_token):
    """Session with Super Admin auth header"""
    api_client.headers.update({"Authorization": f"Bearer {super_admin_token}"})
    return api_client


class TestSuperAdminLogin:
    """Test Super Admin login with restored password"""

    def test_super_admin_login_success(self, api_client):
        """Super Admin login with TheCoach1290. should succeed"""
        response = api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        
        user = data["user"]
        assert user["email"] == SUPER_ADMIN_EMAIL
        assert user["role"] == "super_admin"
        assert "club_ids" in user
        assert len(user["club_ids"]) == 4, f"Expected 4 clubs, got {len(user['club_ids'])}"
        print(f"✓ Super Admin login successful - role: {user['role']}, clubs: {len(user['club_ids'])}")

    def test_super_admin_login_wrong_password(self, api_client):
        """Super Admin login with old password should fail"""
        response = api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": "test123"}
        )
        assert response.status_code == 401, "Old password should not work"
        print("✓ Old password correctly rejected")


class TestFranchiseDashboard:
    """Test Franchise Dashboard endpoints - Super Admin only"""

    def test_franchise_dashboard_current_month(self, super_admin_client):
        """GET /api/franchise/dashboard should return aggregated KPIs"""
        response = super_admin_client.get(f"{BASE_URL}/api/franchise/dashboard?month=2026-03")
        assert response.status_code == 200, f"Dashboard failed: {response.text}"
        
        data = response.json()
        assert "month" in data
        assert "totals" in data
        assert "clubs" in data
        assert "club_count" in data
        
        totals = data["totals"]
        assert "total_revenue" in totals
        assert "total_expenses" in totals
        assert "ad_spend" in totals
        assert "total_members" in totals
        assert "net_profit" in totals
        
        print(f"✓ Franchise Dashboard: {data['club_count']} clubs, revenue: {totals['total_revenue']}, members: {totals['total_members']}")

    def test_franchise_dashboard_has_clubs(self, super_admin_client):
        """Dashboard should return data for all 4 clubs"""
        response = super_admin_client.get(f"{BASE_URL}/api/franchise/dashboard?month=2026-03")
        assert response.status_code == 200
        
        data = response.json()
        clubs = data["clubs"]
        assert len(clubs) == 4, f"Expected 4 clubs, got {len(clubs)}"
        
        for club in clubs:
            assert "club_id" in club
            assert "club_name" in club
            assert "total_revenue" in club
            assert "ad_spend" in club
            assert "active_members" in club
            print(f"  - {club['club_name']}: {club['active_members']} members, {club['total_revenue']} CHF")

    def test_franchise_trends(self, super_admin_client):
        """GET /api/franchise/trends should return monthly trend data"""
        response = super_admin_client.get(f"{BASE_URL}/api/franchise/trends?months=12")
        assert response.status_code == 200, f"Trends failed: {response.text}"
        
        data = response.json()
        assert "trends" in data
        assert "clubs" in data
        
        trends = data["trends"]
        assert isinstance(trends, list)
        
        if len(trends) > 0:
            trend = trends[0]
            assert "month" in trend
            assert "revenue" in trend
            assert "ad_spend" in trend
            print(f"✓ Franchise Trends: {len(trends)} months of data")
        else:
            print("✓ Franchise Trends: No trend data yet (empty)")

    def test_franchise_ad_budgets(self, super_admin_client):
        """GET /api/franchise/ad-budgets should return ad budget per club"""
        response = super_admin_client.get(f"{BASE_URL}/api/franchise/ad-budgets")
        assert response.status_code == 200, f"Ad budgets failed: {response.text}"
        
        data = response.json()
        assert "month" in data
        assert "total_spend" in data
        assert "clubs" in data
        
        clubs = data["clubs"]
        assert len(clubs) == 4, f"Expected 4 clubs, got {len(clubs)}"
        
        for club in clubs:
            assert "club_id" in club
            assert "club_name" in club
            assert "ad_spend" in club
            print(f"  - {club['club_name']}: ad_spend={club['ad_spend']}")
        
        print(f"✓ Franchise Ad Budgets: total_spend={data['total_spend']}")

    def test_franchise_dashboard_manager_forbidden(self, api_client, manager_token):
        """Manager should not access franchise dashboard"""
        api_client.headers.update({"Authorization": f"Bearer {manager_token}"})
        response = api_client.get(f"{BASE_URL}/api/franchise/dashboard")
        assert response.status_code == 200  # Returns 200 but with error message
        
        data = response.json()
        assert "error" in data
        assert "Super Admin" in data["error"]
        print("✓ Manager correctly denied access to franchise dashboard")


class TestMetaAPI:
    """Test Meta Marketing API integration endpoints"""

    def test_meta_status(self, super_admin_client):
        """GET /api/meta/status should return connection status"""
        response = super_admin_client.get(f"{BASE_URL}/api/meta/status")
        assert response.status_code == 200, f"Meta status failed: {response.text}"
        
        data = response.json()
        assert "connected" in data
        
        if data["connected"]:
            assert "ad_account_id" in data
            assert "current_month_spend" in data
            print(f"✓ Meta API Connected: account={data['ad_account_id']}, current_month_spend={data['current_month_spend']}")
        else:
            print(f"✓ Meta API Status: Not connected - {data.get('message', 'No message')}")

    def test_meta_ad_spend_current_month(self, super_admin_client):
        """GET /api/meta/ad-spend/2026/3 should return ad spend data"""
        response = super_admin_client.get(f"{BASE_URL}/api/meta/ad-spend/2026/3")
        assert response.status_code == 200, f"Meta ad-spend failed: {response.text}"
        
        data = response.json()
        assert "month" in data
        assert "spend" in data
        
        if "error" not in data:
            print(f"✓ Meta Ad Spend March 2026: {data['spend']} CHF")
            print(f"  - Impressions: {data.get('impressions', 0)}")
            print(f"  - Clicks: {data.get('clicks', 0)}")
        else:
            print(f"✓ Meta Ad Spend: {data.get('error', 'No data')}")

    def test_meta_ad_spend_past_month(self, super_admin_client):
        """GET /api/meta/ad-spend/2026/2 should return February data"""
        response = super_admin_client.get(f"{BASE_URL}/api/meta/ad-spend/2026/2")
        assert response.status_code == 200
        
        data = response.json()
        assert "month" in data
        print(f"✓ Meta Ad Spend February 2026: {data.get('spend', 0)} CHF")

    def test_meta_sync_ad_spend(self, super_admin_client):
        """POST /api/meta/sync-ad-spend should sync Meta data to KPIs"""
        response = super_admin_client.post(f"{BASE_URL}/api/meta/sync-ad-spend")
        assert response.status_code == 200, f"Meta sync failed: {response.text}"
        
        data = response.json()
        
        if "error" in data:
            print(f"✓ Meta Sync: {data['error']}")
        else:
            assert "synced" in data
            print(f"✓ Meta Sync: {data['synced']} months synced, total_months={data.get('total_months', 0)}")

    def test_meta_ad_spend_range(self, super_admin_client):
        """GET /api/meta/ad-spend-range should return range data"""
        response = super_admin_client.get(
            f"{BASE_URL}/api/meta/ad-spend-range",
            params={"date_start": "2026-01-01", "date_end": "2026-03-31", "time_increment": "monthly"}
        )
        assert response.status_code == 200, f"Meta range failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Meta Ad Spend Range: {len(data)} months of data")


class TestIntegration:
    """Integration tests - verify data flows correctly"""

    def test_franchise_dashboard_reflects_meta_sync(self, api_client, super_admin_token):
        """After Meta sync, franchise dashboard should show ad_spend"""
        # Use fresh super admin auth
        api_client.headers.update({"Authorization": f"Bearer {super_admin_token}"})
        
        # First sync Meta data
        sync_response = api_client.post(f"{BASE_URL}/api/meta/sync-ad-spend")
        assert sync_response.status_code == 200
        
        # Then check franchise dashboard
        dash_response = api_client.get(f"{BASE_URL}/api/franchise/dashboard?month=2026-03")
        assert dash_response.status_code == 200
        
        data = dash_response.json()
        assert "totals" in data, f"Response missing 'totals': {data}"
        totals = data["totals"]
        
        # Ad spend should be present (may be 0 if no data for this month)
        assert "ad_spend" in totals
        print(f"✓ Integration: Franchise dashboard ad_spend = {totals['ad_spend']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
