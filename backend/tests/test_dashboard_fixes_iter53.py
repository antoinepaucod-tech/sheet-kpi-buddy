"""
Iteration 53 - Dashboard Fixes Tests
Tests for 3 critical fixes:
1. Cash Collected = 0 when close = 0 (sales funnel)
2. Real-time member stats from /api/members/stats
3. ROAS removed from KPI cards and objectives (frontend only)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCashCollectedFix:
    """Test that cash_collected = 0 when close = 0 in sales funnel"""
    
    def test_march_2026_cash_collected_zero(self):
        """GET /api/monthly-kpis/2026-03 - cash_collected should be 0 when close=0"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis/2026-03")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("close") == 0, f"Expected close=0, got {data.get('close')}"
        assert data.get("cash_collected") == 0, f"Expected cash_collected=0, got {data.get('cash_collected')}"
        print(f"✅ PASS: close={data.get('close')}, cash_collected={data.get('cash_collected')}")
    
    def test_recalculate_sets_cash_collected_zero(self):
        """POST /api/monthly-kpis/2026-03/recalculate - should set cash_collected=0 when close=0"""
        response = requests.post(f"{BASE_URL}/api/monthly-kpis/2026-03/recalculate")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("close") == 0, f"Expected close=0, got {data.get('close')}"
        assert data.get("cash_collected") == 0, f"Expected cash_collected=0, got {data.get('cash_collected')}"
        print(f"✅ PASS: After recalculate - close={data.get('close')}, cash_collected={data.get('cash_collected')}")
    
    def test_monthly_kpis_list_march_cash_zero(self):
        """GET /api/monthly-kpis - March 2026 should have cash_collected=0"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        march_kpi = next((k for k in data if k.get("month") == "2026-03"), None)
        assert march_kpi is not None, "March 2026 KPI not found"
        assert march_kpi.get("cash_collected") == 0, f"Expected cash_collected=0, got {march_kpi.get('cash_collected')}"
        print(f"✅ PASS: List endpoint - March 2026 cash_collected={march_kpi.get('cash_collected')}")


class TestMemberStatsAPI:
    """Test real-time member stats endpoint"""
    
    def test_member_stats_endpoint(self):
        """GET /api/members/stats - should return real-time member counts"""
        response = requests.get(f"{BASE_URL}/api/members/stats")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Verify expected fields exist
        assert "active_members" in data, "Missing active_members field"
        assert "active_coaches" in data, "Missing active_coaches field"
        assert "departed" in data, "Missing departed field"
        assert "expired_members" in data, "Missing expired_members field"
        
        # Verify values are integers and positive
        assert isinstance(data["active_members"], int), "active_members should be int"
        assert isinstance(data["active_coaches"], int), "active_coaches should be int"
        assert data["active_members"] >= 0, "active_members should be >= 0"
        assert data["active_coaches"] >= 0, "active_coaches should be >= 0"
        
        print(f"✅ PASS: Member stats - active_members={data['active_members']}, active_coaches={data['active_coaches']}")
    
    def test_member_stats_active_members_count(self):
        """GET /api/members/stats - active_members should be 97"""
        response = requests.get(f"{BASE_URL}/api/members/stats")
        assert response.status_code == 200
        
        data = response.json()
        assert data["active_members"] == 97, f"Expected 97 active members, got {data['active_members']}"
        print(f"✅ PASS: active_members = 97")
    
    def test_member_stats_active_coaches_count(self):
        """GET /api/members/stats - active_coaches should be 32"""
        response = requests.get(f"{BASE_URL}/api/members/stats")
        assert response.status_code == 200
        
        data = response.json()
        assert data["active_coaches"] == 32, f"Expected 32 active coaches, got {data['active_coaches']}"
        print(f"✅ PASS: active_coaches = 32")


class TestKPIDetailsEndpoint:
    """Test KPI details endpoint for sales funnel data"""
    
    def test_kpi_details_cash_collected(self):
        """GET /api/monthly-kpis/2026-03/details - verify funnel data"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis/2026-03/details")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        kpi = data.get("kpi", {})
        
        # Verify cash_collected is 0 in details
        assert kpi.get("cash_collected") == 0, f"Expected cash_collected=0, got {kpi.get('cash_collected')}"
        assert kpi.get("close") == 0, f"Expected close=0, got {kpi.get('close')}"
        
        print(f"✅ PASS: KPI details - close={kpi.get('close')}, cash_collected={kpi.get('cash_collected')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
