"""
Multi-Club / Franchise Migration Tests - Iteration 63
Tests the multi-tenant architecture with 4 clubs:
- Transform Versoix (all existing data)
- Transform Grand Saconnex (empty)
- Transform Servette (empty)
- Transform Lausanne (empty)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://sports-saas-pilot-1.preview.emergentagent.com').rstrip('/')

# Club IDs discovered from API
VERSOIX_CLUB_ID = "0a327bf5-c759-49eb-87e4-551913f78bdb"
GRAND_SACONNEX_CLUB_ID = "3933cca5-ed80-42b9-ac91-6120f8f06ed4"
SERVETTE_CLUB_ID = "9bfdb209-066d-4d11-b195-a6b9533b8cb8"
LAUSANNE_CLUB_ID = "c6a2bd8b-24ad-4bf5-8de1-50bbf69e2e5c"


@pytest.fixture(scope="module")
def super_admin_token():
    """Get Super Admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "antoine.paucod@the-coach.pro",
        "password": "test123"
    })
    assert response.status_code == 200, f"Super Admin login failed: {response.text}"
    data = response.json()
    assert data.get("user", {}).get("role") == "super_admin", "User is not super_admin"
    return data["access_token"]


@pytest.fixture(scope="module")
def manager_token():
    """Get Manager authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "test@crossfit.ch",
        "password": "test123"
    })
    assert response.status_code == 200, f"Manager login failed: {response.text}"
    return response.json()["access_token"]


class TestLoginResponses:
    """Test that login returns correct multi-club data"""
    
    def test_super_admin_login_returns_4_club_ids(self):
        """Super Admin should see 4 clubs in login response"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "antoine.paucod@the-coach.pro",
            "password": "test123"
        })
        assert response.status_code == 200
        user = response.json()["user"]
        
        assert user["role"] == "super_admin"
        assert len(user["club_ids"]) == 4, f"Expected 4 club_ids, got {len(user['club_ids'])}"
        assert user["active_club_id"] == VERSOIX_CLUB_ID
    
    def test_manager_login_returns_1_club_id(self):
        """Manager should only see Transform Versoix"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@crossfit.ch",
            "password": "test123"
        })
        assert response.status_code == 200
        user = response.json()["user"]
        
        assert user["role"] == "manager"
        assert len(user["club_ids"]) == 1, f"Expected 1 club_id, got {len(user['club_ids'])}"
        assert user["club_ids"][0] == VERSOIX_CLUB_ID
        assert user["active_club_id"] == VERSOIX_CLUB_ID


class TestClubsEndpoint:
    """Test GET /api/clubs endpoint"""
    
    def test_super_admin_sees_4_clubs(self, super_admin_token):
        """Super Admin should see all 4 clubs"""
        response = requests.get(f"{BASE_URL}/api/clubs", headers={
            "Authorization": f"Bearer {super_admin_token}"
        })
        assert response.status_code == 200
        clubs = response.json()
        
        assert len(clubs) == 4, f"Expected 4 clubs, got {len(clubs)}"
        club_names = [c["name"] for c in clubs]
        assert "Transform Versoix" in club_names
        assert "Transform Grand Saconnex" in club_names
        assert "Transform Servette" in club_names
        assert "Transform Lausanne" in club_names
    
    def test_manager_sees_1_club(self, manager_token):
        """Manager should only see Transform Versoix"""
        response = requests.get(f"{BASE_URL}/api/clubs", headers={
            "Authorization": f"Bearer {manager_token}"
        })
        assert response.status_code == 200
        clubs = response.json()
        
        assert len(clubs) == 1, f"Expected 1 club, got {len(clubs)}"
        assert clubs[0]["name"] == "Transform Versoix"


class TestMembersWithClubFilter:
    """Test GET /api/members with X-Club-Id header"""
    
    def test_versoix_has_325_members(self, super_admin_token):
        """Transform Versoix should have 325 members (all migrated data)"""
        response = requests.get(f"{BASE_URL}/api/members", headers={
            "Authorization": f"Bearer {super_admin_token}",
            "X-Club-Id": VERSOIX_CLUB_ID
        })
        assert response.status_code == 200
        members = response.json()
        
        assert len(members) == 325, f"Expected 325 members for Versoix, got {len(members)}"
    
    def test_grand_saconnex_has_0_members(self, super_admin_token):
        """Transform Grand Saconnex should have 0 members (empty club)"""
        response = requests.get(f"{BASE_URL}/api/members", headers={
            "Authorization": f"Bearer {super_admin_token}",
            "X-Club-Id": GRAND_SACONNEX_CLUB_ID
        })
        assert response.status_code == 200
        members = response.json()
        
        assert len(members) == 0, f"Expected 0 members for Grand Saconnex, got {len(members)}"
    
    def test_servette_has_0_members(self, super_admin_token):
        """Transform Servette should have 0 members (empty club)"""
        response = requests.get(f"{BASE_URL}/api/members", headers={
            "Authorization": f"Bearer {super_admin_token}",
            "X-Club-Id": SERVETTE_CLUB_ID
        })
        assert response.status_code == 200
        members = response.json()
        
        assert len(members) == 0, f"Expected 0 members for Servette, got {len(members)}"
    
    def test_lausanne_has_0_members(self, super_admin_token):
        """Transform Lausanne should have 0 members (empty club)"""
        response = requests.get(f"{BASE_URL}/api/members", headers={
            "Authorization": f"Bearer {super_admin_token}",
            "X-Club-Id": LAUSANNE_CLUB_ID
        })
        assert response.status_code == 200
        members = response.json()
        
        assert len(members) == 0, f"Expected 0 members for Lausanne, got {len(members)}"


class TestKPIsWithClubFilter:
    """Test GET /api/monthly-kpis with X-Club-Id header"""
    
    def test_versoix_has_27_kpis(self, super_admin_token):
        """Transform Versoix should have 27 KPIs"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis", headers={
            "Authorization": f"Bearer {super_admin_token}",
            "X-Club-Id": VERSOIX_CLUB_ID
        })
        assert response.status_code == 200
        kpis = response.json()
        
        assert len(kpis) == 27, f"Expected 27 KPIs for Versoix, got {len(kpis)}"
    
    def test_grand_saconnex_has_0_kpis(self, super_admin_token):
        """Transform Grand Saconnex should have 0 KPIs (empty club)"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis", headers={
            "Authorization": f"Bearer {super_admin_token}",
            "X-Club-Id": GRAND_SACONNEX_CLUB_ID
        })
        assert response.status_code == 200
        kpis = response.json()
        
        assert len(kpis) == 0, f"Expected 0 KPIs for Grand Saconnex, got {len(kpis)}"


class TestClubSwitchEndpoint:
    """Test PUT /api/clubs/switch endpoint"""
    
    def test_super_admin_can_switch_clubs(self, super_admin_token):
        """Super Admin should be able to switch to any club"""
        # Switch to Grand Saconnex
        response = requests.put(f"{BASE_URL}/api/clubs/switch", headers={
            "Authorization": f"Bearer {super_admin_token}",
            "Content-Type": "application/json"
        }, json={"club_id": GRAND_SACONNEX_CLUB_ID})
        
        assert response.status_code == 200
        data = response.json()
        assert data["club_id"] == GRAND_SACONNEX_CLUB_ID
        assert data["club_name"] == "Transform Grand Saconnex"
        
        # Switch back to Versoix
        response = requests.put(f"{BASE_URL}/api/clubs/switch", headers={
            "Authorization": f"Bearer {super_admin_token}",
            "Content-Type": "application/json"
        }, json={"club_id": VERSOIX_CLUB_ID})
        
        assert response.status_code == 200
        data = response.json()
        assert data["club_id"] == VERSOIX_CLUB_ID
        assert data["club_name"] == "Transform Versoix"
    
    def test_manager_cannot_switch_to_other_club(self, manager_token):
        """Manager should not be able to switch to a club they don't have access to"""
        response = requests.put(f"{BASE_URL}/api/clubs/switch", headers={
            "Authorization": f"Bearer {manager_token}",
            "Content-Type": "application/json"
        }, json={"club_id": GRAND_SACONNEX_CLUB_ID})
        
        assert response.status_code == 403, f"Expected 403 Forbidden, got {response.status_code}"


class TestCategoriesWithClubFilter:
    """Test GET /api/categories with X-Club-Id header"""
    
    def test_versoix_has_categories(self, super_admin_token):
        """Transform Versoix should have categories"""
        response = requests.get(f"{BASE_URL}/api/categories", headers={
            "Authorization": f"Bearer {super_admin_token}",
            "X-Club-Id": VERSOIX_CLUB_ID
        })
        assert response.status_code == 200
        categories = response.json()
        
        assert len(categories) >= 40, f"Expected at least 40 categories for Versoix, got {len(categories)}"
    
    def test_grand_saconnex_has_0_categories(self, super_admin_token):
        """Transform Grand Saconnex should have 0 categories (empty club)"""
        response = requests.get(f"{BASE_URL}/api/categories", headers={
            "Authorization": f"Bearer {super_admin_token}",
            "X-Club-Id": GRAND_SACONNEX_CLUB_ID
        })
        assert response.status_code == 200
        categories = response.json()
        
        assert len(categories) == 0, f"Expected 0 categories for Grand Saconnex, got {len(categories)}"


class TestTransactionsWithClubFilter:
    """Test GET /api/transactions with X-Club-Id header"""
    
    def test_versoix_has_transactions(self, super_admin_token):
        """Transform Versoix should have transactions"""
        response = requests.get(f"{BASE_URL}/api/transactions", headers={
            "Authorization": f"Bearer {super_admin_token}",
            "X-Club-Id": VERSOIX_CLUB_ID
        })
        assert response.status_code == 200
        transactions = response.json()
        
        assert len(transactions) >= 3000, f"Expected at least 3000 transactions for Versoix, got {len(transactions)}"
    
    def test_grand_saconnex_has_0_transactions(self, super_admin_token):
        """Transform Grand Saconnex should have 0 transactions (empty club)"""
        response = requests.get(f"{BASE_URL}/api/transactions", headers={
            "Authorization": f"Bearer {super_admin_token}",
            "X-Club-Id": GRAND_SACONNEX_CLUB_ID
        })
        assert response.status_code == 200
        transactions = response.json()
        
        assert len(transactions) == 0, f"Expected 0 transactions for Grand Saconnex, got {len(transactions)}"


class TestMemberStatsWithClubFilter:
    """Test GET /api/members/stats with X-Club-Id header"""
    
    def test_versoix_member_stats(self, super_admin_token):
        """Transform Versoix should have proper member stats"""
        response = requests.get(f"{BASE_URL}/api/members/stats", headers={
            "Authorization": f"Bearer {super_admin_token}",
            "X-Club-Id": VERSOIX_CLUB_ID
        })
        assert response.status_code == 200
        stats = response.json()
        
        assert stats["total"] > 0, "Versoix should have members in stats"
    
    def test_grand_saconnex_member_stats_empty(self, super_admin_token):
        """Transform Grand Saconnex should have 0 in all stats"""
        response = requests.get(f"{BASE_URL}/api/members/stats", headers={
            "Authorization": f"Bearer {super_admin_token}",
            "X-Club-Id": GRAND_SACONNEX_CLUB_ID
        })
        assert response.status_code == 200
        stats = response.json()
        
        assert stats["total"] == 0, f"Grand Saconnex should have 0 total, got {stats['total']}"
        assert stats["active_members"] == 0
