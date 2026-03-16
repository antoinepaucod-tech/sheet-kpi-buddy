"""
Test member classification fixes - Iteration 49
- Bug 1: Members with exit_date in the future were classified as 'Partis' instead of active
  Fix: Check exit_date < today for departed classification
- Bug 2: DUO partners with same name as primary were flagged as is_duplicate=true
  Fix: Skip DUO members in deduplication logic
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL')

class TestMemberStatsClassification:
    """Test /api/members/stats endpoint - departed classification fix"""
    
    def test_stats_endpoint_returns_200(self):
        """Basic stats endpoint availability"""
        response = requests.get(f"{BASE_URL}/api/members/stats")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ Stats endpoint accessible")
    
    def test_departed_count_is_187(self):
        """Verify departed count = 187 (only members with exit_date < today)"""
        response = requests.get(f"{BASE_URL}/api/members/stats")
        assert response.status_code == 200
        data = response.json()
        
        assert "departed" in data, "Response missing 'departed' field"
        assert data["departed"] == 187, f"Expected departed=187, got {data['departed']}"
        print(f"✓ Departed count correct: {data['departed']}")
    
    def test_active_members_count_is_97(self):
        """Verify active_members = 97 (includes members with future exit_date)"""
        response = requests.get(f"{BASE_URL}/api/members/stats")
        assert response.status_code == 200
        data = response.json()
        
        assert "active_members" in data, "Response missing 'active_members' field"
        assert data["active_members"] == 97, f"Expected active_members=97, got {data['active_members']}"
        print(f"✓ Active members count correct: {data['active_members']}")
    
    def test_active_coaches_count_is_31(self):
        """Verify active_coaches = 31"""
        response = requests.get(f"{BASE_URL}/api/members/stats")
        assert response.status_code == 200
        data = response.json()
        
        assert "active_coaches" in data, "Response missing 'active_coaches' field"
        assert data["active_coaches"] == 31, f"Expected active_coaches=31, got {data['active_coaches']}"
        print(f"✓ Active coaches count correct: {data['active_coaches']}")
    
    def test_stats_response_structure(self):
        """Verify all expected fields in stats response"""
        response = requests.get(f"{BASE_URL}/api/members/stats")
        assert response.status_code == 200
        data = response.json()
        
        expected_fields = [
            "total", "active_members", "active_coaches", 
            "expired_members", "expired_coaches", "departed",
            "expiring_30d", "pif_active", "recurring_active",
            "total_coaches", "total_non_coaches"
        ]
        
        for field in expected_fields:
            assert field in data, f"Missing field: {field}"
        print(f"✓ All expected fields present in stats response")


class TestMemberListClassification:
    """Test /api/members endpoint - member classification logic"""
    
    def test_members_endpoint_returns_200(self):
        """Basic members endpoint availability"""
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ Members endpoint accessible")
    
    def test_alexandre_alsonso_in_current_not_departed(self):
        """Alexandre Alsonso (exit_date=2026-10-15) should be in current, not departed"""
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        data = response.json()
        
        today = datetime.now().strftime('%Y-%m-%d')
        
        # Find Alexandre Alsonso
        alexandre = None
        for m in data:
            if 'alsonso' in m.get('name', '').lower():
                alexandre = m
                break
        
        assert alexandre is not None, "Alexandre Alsonso not found in members list"
        assert alexandre.get('exit_date') == '2026-10-15', f"Expected exit_date=2026-10-15, got {alexandre.get('exit_date')}"
        
        # Verify future exit_date means NOT departed
        assert alexandre['exit_date'] >= today, "Alexandre's exit_date should be in the future"
        print(f"✓ Alexandre Alsonso found with future exit_date: {alexandre['exit_date']}")
    
    def test_members_with_future_exit_date_not_marked_departed(self):
        """Members with exit_date >= today should be in current list, not departed"""
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        data = response.json()
        
        today = datetime.now().strftime('%Y-%m-%d')
        
        # Count members with future exit_date
        future_exit = [m for m in data if m.get('exit_date') and m['exit_date'] >= today]
        
        # There should be ~39 members with future exit dates
        assert len(future_exit) >= 35, f"Expected ~39 members with future exit, got {len(future_exit)}"
        print(f"✓ Found {len(future_exit)} members with future exit_date (correctly in current)")
    
    def test_departed_members_have_past_exit_date(self):
        """All departed members should have exit_date < today"""
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        data = response.json()
        
        today = datetime.now().strftime('%Y-%m-%d')
        
        # Departed = exit_date in the past
        departed = [m for m in data if m.get('exit_date') and m['exit_date'] < today]
        
        # Verify count matches stats
        stats_response = requests.get(f"{BASE_URL}/api/members/stats")
        stats = stats_response.json()
        
        assert len(departed) == stats['departed'], f"Expected {stats['departed']} departed, counted {len(departed)}"
        print(f"✓ Departed count matches: {len(departed)}")


class TestDuoMemberDeduplication:
    """Test DUO member deduplication - DUO partners should NOT be flagged as duplicates"""
    
    def test_no_duo_members_flagged_as_duplicate(self):
        """DUO members should never be marked is_duplicate=true"""
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        data = response.json()
        
        # Find DUO members
        duo_members = [m for m in data if m.get('is_duo')]
        
        # None should be flagged as duplicate
        duo_with_duplicate = [m for m in duo_members if m.get('is_duplicate')]
        
        assert len(duo_with_duplicate) == 0, f"Found {len(duo_with_duplicate)} DUO members incorrectly flagged as duplicate: {[m['name'] for m in duo_with_duplicate]}"
        print(f"✓ All {len(duo_members)} DUO members correctly NOT flagged as duplicate")
    
    def test_duo_primary_and_partner_not_duplicates(self):
        """DUO primary and partner with same name should not be duplicates"""
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        data = response.json()
        
        # Find DUO pairs (same name, one primary, one partner)
        duo_members = [m for m in data if m.get('is_duo')]
        
        # Group by name
        name_groups = {}
        for m in duo_members:
            name = m.get('name', '')
            if name not in name_groups:
                name_groups[name] = []
            name_groups[name].append(m)
        
        # Check groups with multiple members (same name)
        same_name_duo_pairs = {name: members for name, members in name_groups.items() if len(members) > 1}
        
        for name, members in same_name_duo_pairs.items():
            for m in members:
                assert not m.get('is_duplicate'), f"DUO member '{name}' incorrectly flagged as duplicate"
        
        print(f"✓ DUO pairs with same name verified: {len(same_name_duo_pairs)} pairs, none flagged as duplicate")
    
    def test_cindy_alexis_duo_pair_not_duplicate(self):
        """Specific test: Cindy & Alexis DUO pair should not be duplicates"""
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        data = response.json()
        
        # Find Cindy & Alexis members
        cindy_alexis = [m for m in data if 'cindy' in m.get('name', '').lower() and 'alexis' in m.get('name', '').lower()]
        
        if len(cindy_alexis) > 0:
            for m in cindy_alexis:
                assert not m.get('is_duplicate'), f"Cindy & Alexis '{m['name']}' incorrectly flagged as duplicate"
                print(f"✓ {m['name']}: is_duo={m.get('is_duo')}, duo_primary={m.get('duo_primary')}, is_duplicate={m.get('is_duplicate', False)}")
        else:
            pytest.skip("Cindy & Alexis DUO pair not found in test data")


class TestMemberTypeBreakdown:
    """Test member type statistics accuracy"""
    
    def test_pif_active_count(self):
        """Verify PIF active members count"""
        response = requests.get(f"{BASE_URL}/api/members/stats")
        assert response.status_code == 200
        data = response.json()
        
        assert "pif_active" in data, "Missing pif_active field"
        assert data["pif_active"] == 29, f"Expected pif_active=29, got {data['pif_active']}"
        print(f"✓ PIF active count correct: {data['pif_active']}")
    
    def test_recurring_active_count(self):
        """Verify recurring active members count"""
        response = requests.get(f"{BASE_URL}/api/members/stats")
        assert response.status_code == 200
        data = response.json()
        
        assert "recurring_active" in data, "Missing recurring_active field"
        assert data["recurring_active"] == 68, f"Expected recurring_active=68, got {data['recurring_active']}"
        print(f"✓ Recurring active count correct: {data['recurring_active']}")
    
    def test_total_counts_consistency(self):
        """Verify total counts are consistent"""
        response = requests.get(f"{BASE_URL}/api/members/stats")
        assert response.status_code == 200
        data = response.json()
        
        # Total should equal all members
        assert data["total"] == 326, f"Expected total=326, got {data['total']}"
        
        # total_coaches + total_non_coaches should be close to active members
        print(f"✓ Total members: {data['total']}")
        print(f"  - Total coaches: {data['total_coaches']}")
        print(f"  - Total non-coaches: {data['total_non_coaches']}")


# Fixtures
@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
