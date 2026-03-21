"""
Iteration 65 - Franchise Dashboard Bug Fixes Testing
Tests for:
1. Members/Coaches separation (was showing 120 combined, now 96 members + 24 coaches)
2. ROAS calculation (was incorrect, now 9.09x)
3. Meta metrics in ad budget table (impressions, clicks, CPC)
4. Text overflow in KPI cards (CSS fix)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestFranchiseDashboardBugFixes:
    """Test franchise dashboard bug fixes for iteration 65"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.token = None
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "antoine.paucod@the-coach.pro",
                "password": "TheCoach1290."
            }
        )
        if login_response.status_code == 200:
            self.token = login_response.json().get("access_token")
        yield
    
    def get_headers(self):
        return {
            "Authorization": f"Bearer {self.token}",
            "X-Club-Id": "0a327bf5-c759-49eb-87e4-551913f78bdb"
        }
    
    # Bug Fix 1: Members and Coaches Separation
    def test_members_coaches_separated_in_totals(self):
        """Bug fix: Members (96) and Coaches (24) should be separate, not combined (120)"""
        if not self.token:
            pytest.skip("Auth failed")
        
        response = requests.get(
            f"{BASE_URL}/api/franchise/dashboard?month=2026-03",
            headers=self.get_headers()
        )
        assert response.status_code == 200
        
        data = response.json()
        totals = data.get("totals", {})
        
        # Verify members and coaches are separate
        assert "total_members" in totals, "total_members field missing"
        assert "coach_members" in totals, "coach_members field missing"
        
        # Verify they are not combined (was 120, now should be ~96 members + ~24 coaches)
        total_members = totals.get("total_members", 0)
        coach_members = totals.get("coach_members", 0)
        
        assert total_members > 0, "total_members should be > 0"
        assert coach_members > 0, "coach_members should be > 0"
        assert total_members != 120, "total_members should not be 120 (combined value)"
        
        # Expected values based on data
        assert total_members == 96, f"Expected 96 members, got {total_members}"
        assert coach_members == 24, f"Expected 24 coaches, got {coach_members}"
        
        print(f"✓ Members: {total_members}, Coaches: {coach_members} (separated correctly)")
    
    def test_members_coaches_separated_per_club(self):
        """Bug fix: Each club should show separate member and coach counts"""
        if not self.token:
            pytest.skip("Auth failed")
        
        response = requests.get(
            f"{BASE_URL}/api/franchise/dashboard?month=2026-03",
            headers=self.get_headers()
        )
        assert response.status_code == 200
        
        data = response.json()
        clubs = data.get("clubs", [])
        
        # Find Transform Versoix (the club with data)
        versoix = next((c for c in clubs if "Versoix" in c.get("club_name", "")), None)
        assert versoix is not None, "Transform Versoix not found"
        
        # Verify separate counts
        assert "active_members" in versoix, "active_members field missing"
        assert "coach_members" in versoix, "coach_members field missing"
        
        assert versoix["active_members"] == 96, f"Expected 96 active members, got {versoix['active_members']}"
        assert versoix["coach_members"] == 24, f"Expected 24 coach members, got {versoix['coach_members']}"
        
        print(f"✓ Versoix: {versoix['active_members']} members, {versoix['coach_members']} coaches")
    
    # Bug Fix 2: ROAS Calculation
    def test_roas_calculation_correct(self):
        """Bug fix: ROAS should be calculated correctly (revenue / ad_spend)"""
        if not self.token:
            pytest.skip("Auth failed")
        
        response = requests.get(
            f"{BASE_URL}/api/franchise/dashboard?month=2026-03",
            headers=self.get_headers()
        )
        assert response.status_code == 200
        
        data = response.json()
        totals = data.get("totals", {})
        
        roas = totals.get("roas", 0)
        total_revenue = totals.get("total_revenue", 0)
        ad_spend = totals.get("ad_spend", 0)
        
        # ROAS should be > 0 when there's revenue and ad spend
        assert roas > 0, f"ROAS should be > 0, got {roas}"
        
        # Verify calculation: ROAS = revenue / ad_spend
        expected_roas = round(total_revenue / ad_spend, 2) if ad_spend > 0 else 0
        assert roas == expected_roas, f"ROAS mismatch: expected {expected_roas}, got {roas}"
        
        # Expected value based on data (10793 / 1187 ≈ 9.09)
        assert roas == 9.09, f"Expected ROAS 9.09, got {roas}"
        
        print(f"✓ ROAS: {roas}x (revenue: {total_revenue}, ad_spend: {ad_spend})")
    
    # Bug Fix 3: Meta Metrics in Ad Budget Table
    def test_meta_impressions_present(self):
        """Bug fix: Meta impressions should be present for clubs with data"""
        if not self.token:
            pytest.skip("Auth failed")
        
        response = requests.get(
            f"{BASE_URL}/api/franchise/dashboard?month=2026-03",
            headers=self.get_headers()
        )
        assert response.status_code == 200
        
        data = response.json()
        totals = data.get("totals", {})
        
        # Verify meta_impressions in totals
        assert "meta_impressions" in totals, "meta_impressions field missing in totals"
        assert totals["meta_impressions"] > 0, f"meta_impressions should be > 0, got {totals['meta_impressions']}"
        
        # Expected value
        assert totals["meta_impressions"] == 95413, f"Expected 95413 impressions, got {totals['meta_impressions']}"
        
        print(f"✓ Meta Impressions: {totals['meta_impressions']}")
    
    def test_meta_clicks_present(self):
        """Bug fix: Meta clicks should be present for clubs with data"""
        if not self.token:
            pytest.skip("Auth failed")
        
        response = requests.get(
            f"{BASE_URL}/api/franchise/dashboard?month=2026-03",
            headers=self.get_headers()
        )
        assert response.status_code == 200
        
        data = response.json()
        totals = data.get("totals", {})
        
        # Verify meta_clicks in totals
        assert "meta_clicks" in totals, "meta_clicks field missing in totals"
        assert totals["meta_clicks"] > 0, f"meta_clicks should be > 0, got {totals['meta_clicks']}"
        
        # Expected value
        assert totals["meta_clicks"] == 2024, f"Expected 2024 clicks, got {totals['meta_clicks']}"
        
        print(f"✓ Meta Clicks: {totals['meta_clicks']}")
    
    def test_meta_cpc_present(self):
        """Bug fix: Meta CPC should be calculated correctly"""
        if not self.token:
            pytest.skip("Auth failed")
        
        response = requests.get(
            f"{BASE_URL}/api/franchise/dashboard?month=2026-03",
            headers=self.get_headers()
        )
        assert response.status_code == 200
        
        data = response.json()
        totals = data.get("totals", {})
        
        # Verify meta_cpc in totals
        assert "meta_cpc" in totals, "meta_cpc field missing in totals"
        assert totals["meta_cpc"] > 0, f"meta_cpc should be > 0, got {totals['meta_cpc']}"
        
        # CPC = ad_spend / clicks
        ad_spend = totals.get("ad_spend", 0)
        clicks = totals.get("meta_clicks", 0)
        expected_cpc = round(ad_spend / clicks, 2) if clicks > 0 else 0
        
        assert totals["meta_cpc"] == expected_cpc, f"CPC mismatch: expected {expected_cpc}, got {totals['meta_cpc']}"
        
        print(f"✓ Meta CPC: {totals['meta_cpc']} CHF")
    
    def test_meta_metrics_per_club(self):
        """Bug fix: Meta metrics should be present per club in the clubs array"""
        if not self.token:
            pytest.skip("Auth failed")
        
        response = requests.get(
            f"{BASE_URL}/api/franchise/dashboard?month=2026-03",
            headers=self.get_headers()
        )
        assert response.status_code == 200
        
        data = response.json()
        clubs = data.get("clubs", [])
        
        # Find Transform Versoix
        versoix = next((c for c in clubs if "Versoix" in c.get("club_name", "")), None)
        assert versoix is not None, "Transform Versoix not found"
        
        # Verify meta metrics per club
        assert "meta_impressions" in versoix, "meta_impressions missing in club data"
        assert "meta_clicks" in versoix, "meta_clicks missing in club data"
        assert "meta_cpc" in versoix, "meta_cpc missing in club data"
        
        assert versoix["meta_impressions"] == 95413, f"Expected 95413 impressions for Versoix"
        assert versoix["meta_clicks"] == 2024, f"Expected 2024 clicks for Versoix"
        assert versoix["meta_cpc"] == 0.59, f"Expected 0.59 CPC for Versoix"
        
        print(f"✓ Versoix Meta: impressions={versoix['meta_impressions']}, clicks={versoix['meta_clicks']}, cpc={versoix['meta_cpc']}")
    
    # Additional validation tests
    def test_empty_clubs_have_zero_values(self):
        """Verify empty clubs show 0 values, not errors"""
        if not self.token:
            pytest.skip("Auth failed")
        
        response = requests.get(
            f"{BASE_URL}/api/franchise/dashboard?month=2026-03",
            headers=self.get_headers()
        )
        assert response.status_code == 200
        
        data = response.json()
        clubs = data.get("clubs", [])
        
        # Find empty clubs
        empty_clubs = [c for c in clubs if "Versoix" not in c.get("club_name", "")]
        
        for club in empty_clubs:
            assert club["active_members"] == 0, f"{club['club_name']} should have 0 members"
            assert club["coach_members"] == 0, f"{club['club_name']} should have 0 coaches"
            assert club["meta_impressions"] == 0, f"{club['club_name']} should have 0 impressions"
            assert club["meta_clicks"] == 0, f"{club['club_name']} should have 0 clicks"
            print(f"✓ {club['club_name']}: all values are 0 (as expected)")
    
    def test_dashboard_returns_4_clubs(self):
        """Verify dashboard returns all 4 clubs"""
        if not self.token:
            pytest.skip("Auth failed")
        
        response = requests.get(
            f"{BASE_URL}/api/franchise/dashboard?month=2026-03",
            headers=self.get_headers()
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("club_count") == 4, f"Expected 4 clubs, got {data.get('club_count')}"
        assert len(data.get("clubs", [])) == 4, f"Expected 4 clubs in array"
        
        print(f"✓ Dashboard returns {data['club_count']} clubs")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
