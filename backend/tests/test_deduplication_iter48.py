"""
Test suite for member deduplication and KPI card overflow fixes - Iteration 48
Tests the following features:
1. GET /api/members/stats returns deduplicated counts
2. GET /api/members returns is_coach_also=true for dual subscription members
3. GET /api/members returns is_duplicate=true for duplicate entries
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestMemberStatsDeduplication:
    """Test /api/members/stats endpoint returns correct deduplicated counts"""
    
    def test_stats_endpoint_returns_200(self):
        """Verify stats endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/members/stats")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: /api/members/stats returns 200")
    
    def test_stats_active_members_count(self):
        """Verify active_members count is 59 (deduplicated)"""
        response = requests.get(f"{BASE_URL}/api/members/stats")
        assert response.status_code == 200
        data = response.json()
        
        assert "active_members" in data, "active_members field missing"
        assert data["active_members"] == 59, f"Expected 59 active_members, got {data['active_members']}"
        print(f"PASS: active_members = {data['active_members']} (expected 59)")
    
    def test_stats_active_coaches_count(self):
        """Verify active_coaches count is 29"""
        response = requests.get(f"{BASE_URL}/api/members/stats")
        assert response.status_code == 200
        data = response.json()
        
        assert "active_coaches" in data, "active_coaches field missing"
        assert data["active_coaches"] == 29, f"Expected 29 active_coaches, got {data['active_coaches']}"
        print(f"PASS: active_coaches = {data['active_coaches']} (expected 29)")
    
    def test_stats_expired_members_count(self):
        """Verify expired_members count is 5"""
        response = requests.get(f"{BASE_URL}/api/members/stats")
        assert response.status_code == 200
        data = response.json()
        
        assert "expired_members" in data, "expired_members field missing"
        assert data["expired_members"] == 5, f"Expected 5 expired_members, got {data['expired_members']}"
        print(f"PASS: expired_members = {data['expired_members']} (expected 5)")
    
    def test_stats_departed_count(self):
        """Verify departed count is 226"""
        response = requests.get(f"{BASE_URL}/api/members/stats")
        assert response.status_code == 200
        data = response.json()
        
        assert "departed" in data, "departed field missing"
        assert data["departed"] == 226, f"Expected 226 departed, got {data['departed']}"
        print(f"PASS: departed = {data['departed']} (expected 226)")


class TestMemberIsCoachAlso:
    """Test /api/members returns is_coach_also=true for members with dual subscriptions"""
    
    def test_members_endpoint_returns_200(self):
        """Verify members endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: /api/members returns 200")
    
    def test_camille_astier_hubfit_has_is_coach_also(self):
        """Camille Astier's HUBFIT record should have is_coach_also=true"""
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        data = response.json()
        
        camille_hubfit = [m for m in data if m["name"] == "Camille Astier" and m["membership"] == "HUBFIT"]
        assert len(camille_hubfit) >= 1, "Camille Astier HUBFIT record not found"
        assert camille_hubfit[0].get("is_coach_also") == True, "is_coach_also should be True for Camille Astier HUBFIT"
        print("PASS: Camille Astier HUBFIT has is_coach_also=True")
    
    def test_johan_michelazzi_hubfit_has_is_coach_also(self):
        """Johan Michelazzi's HUBFIT record should have is_coach_also=true"""
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        data = response.json()
        
        johan_hubfit = [m for m in data if m["name"] == "Johan Michelazzi" and m["membership"] == "HUBFIT"]
        assert len(johan_hubfit) >= 1, "Johan Michelazzi HUBFIT record not found"
        assert johan_hubfit[0].get("is_coach_also") == True, "is_coach_also should be True for Johan Michelazzi HUBFIT"
        print("PASS: Johan Michelazzi HUBFIT has is_coach_also=True")
    
    def test_lucas_da_costa_hubfit_has_is_coach_also(self):
        """Lucas Da Costa's HUBFIT record should have is_coach_also=true"""
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        data = response.json()
        
        lucas_hubfit = [m for m in data if m["name"] == "Lucas Da Costa" and m["membership"] == "HUBFIT"]
        assert len(lucas_hubfit) >= 1, "Lucas Da Costa HUBFIT record not found"
        assert lucas_hubfit[0].get("is_coach_also") == True, "is_coach_also should be True for Lucas Da Costa HUBFIT"
        print("PASS: Lucas Da Costa HUBFIT has is_coach_also=True")
    
    def test_lea_ebebeden_hubfit_has_is_coach_also(self):
        """Léa Ebebeden's HUBFIT record should have is_coach_also=true"""
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        data = response.json()
        
        lea_hubfit = [m for m in data if m["name"] == "Léa Ebebeden" and m["membership"] == "HUBFIT"]
        assert len(lea_hubfit) >= 1, "Léa Ebebeden HUBFIT record not found"
        assert lea_hubfit[0].get("is_coach_also") == True, "is_coach_also should be True for Léa Ebebeden HUBFIT"
        print("PASS: Léa Ebebeden HUBFIT has is_coach_also=True")
    
    def test_taha_bentafat_hubfit_has_is_coach_also(self):
        """Taha Bentafat's HUBFIT record should have is_coach_also=true"""
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        data = response.json()
        
        taha_hubfit = [m for m in data if m["name"] == "Taha Bentafat" and m["membership"] == "HUBFIT"]
        assert len(taha_hubfit) >= 1, "Taha Bentafat HUBFIT record not found"
        assert taha_hubfit[0].get("is_coach_also") == True, "is_coach_also should be True for Taha Bentafat HUBFIT"
        print("PASS: Taha Bentafat HUBFIT has is_coach_also=True")
    
    def test_total_is_coach_also_count(self):
        """Verify exactly 5 members have is_coach_also=true"""
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        data = response.json()
        
        coach_also_members = [m for m in data if m.get("is_coach_also") == True]
        assert len(coach_also_members) == 5, f"Expected 5 members with is_coach_also=True, got {len(coach_also_members)}"
        print(f"PASS: Total members with is_coach_also=True = {len(coach_also_members)} (expected 5)")


class TestMemberIsDuplicate:
    """Test /api/members returns is_duplicate=true for duplicate entries"""
    
    def test_nicholas_schmale_duplicate(self):
        """Nicholas Schmale duplicate HUBFIT should have is_duplicate=true"""
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        data = response.json()
        
        nicholas_records = [m for m in data if "Nicholas Schmale" in m["name"]]
        duplicates = [m for m in nicholas_records if m.get("is_duplicate") == True]
        assert len(duplicates) >= 1, "Nicholas Schmale duplicate not flagged"
        print(f"PASS: Nicholas Schmale duplicate flagged ({len(duplicates)} record(s))")
    
    def test_salome_duo_duplicate(self):
        """Salomé DUO duplicate should have is_duplicate=true"""
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        data = response.json()
        
        salome_records = [m for m in data if "Salomé" in m["name"]]
        duplicates = [m for m in salome_records if m.get("is_duplicate") == True]
        assert len(duplicates) >= 1, "Salomé duplicate not flagged"
        print(f"PASS: Salomé duplicate flagged ({len(duplicates)} record(s))")
    
    def test_total_duplicate_count(self):
        """Verify total number of duplicates flagged"""
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        data = response.json()
        
        duplicates = [m for m in data if m.get("is_duplicate") == True]
        assert len(duplicates) == 2, f"Expected 2 duplicates, got {len(duplicates)}"
        print(f"PASS: Total duplicates = {len(duplicates)} (expected 2)")


class TestHealthCheck:
    """Basic health checks"""
    
    def test_api_health(self):
        """Verify API is healthy"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.status_code}"
        print("PASS: API health check")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
