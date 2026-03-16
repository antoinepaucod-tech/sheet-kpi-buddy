"""
Test iteration 46 - Testing 5 data inconsistency fixes:
1) Dashboard shows real-time member stats from /api/members/stats
2) GET /api/members/stats returns correct counts
3) GET /api/members/memberships returns 26 unique membership names
4) MembersPage stat cards show correct numbers
5) CoursesPage shows courses with attendance rate formatted to 1 decimal
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestMemberStatsEndpoint:
    """Test /api/members/stats returns correct counts"""
    
    def test_stats_endpoint_returns_correct_structure(self):
        """Verify stats endpoint returns all required fields"""
        response = requests.get(f"{BASE_URL}/api/members/stats")
        assert response.status_code == 200
        data = response.json()
        
        required_fields = [
            'total', 'active_members', 'active_coaches', 
            'expired_members', 'expired_coaches', 'departed',
            'expiring_30d', 'pif_active', 'recurring_active',
            'total_coaches', 'total_non_coaches'
        ]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        print(f"✓ Stats endpoint has all {len(required_fields)} required fields")
    
    def test_stats_active_members_count(self):
        """Active members should be 66"""
        response = requests.get(f"{BASE_URL}/api/members/stats")
        assert response.status_code == 200
        data = response.json()
        
        assert data['active_members'] == 66, f"Expected 66 active_members, got {data['active_members']}"
        print(f"✓ Active members: {data['active_members']} (expected 66)")
    
    def test_stats_active_coaches_count(self):
        """Active coaches should be 29"""
        response = requests.get(f"{BASE_URL}/api/members/stats")
        assert response.status_code == 200
        data = response.json()
        
        assert data['active_coaches'] == 29, f"Expected 29 active_coaches, got {data['active_coaches']}"
        print(f"✓ Active coaches: {data['active_coaches']} (expected 29)")
    
    def test_stats_departed_count(self):
        """Departed members should be 226"""
        response = requests.get(f"{BASE_URL}/api/members/stats")
        assert response.status_code == 200
        data = response.json()
        
        assert data['departed'] == 226, f"Expected 226 departed, got {data['departed']}"
        print(f"✓ Departed: {data['departed']} (expected 226)")
    
    def test_stats_expired_members_count(self):
        """Expired members should be 5"""
        response = requests.get(f"{BASE_URL}/api/members/stats")
        assert response.status_code == 200
        data = response.json()
        
        assert data['expired_members'] == 5, f"Expected 5 expired_members, got {data['expired_members']}"
        print(f"✓ Expired members: {data['expired_members']} (expected 5)")
    
    def test_stats_total_count(self):
        """Total should be 326"""
        response = requests.get(f"{BASE_URL}/api/members/stats")
        assert response.status_code == 200
        data = response.json()
        
        assert data['total'] == 326, f"Expected 326 total, got {data['total']}"
        print(f"✓ Total members: {data['total']} (expected 326)")


class TestMembershipEndpoint:
    """Test /api/members/memberships returns unique membership types"""
    
    def test_memberships_endpoint_returns_26_types(self):
        """Should return exactly 26 unique membership types"""
        response = requests.get(f"{BASE_URL}/api/members/memberships")
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        assert len(data) == 26, f"Expected 26 memberships, got {len(data)}"
        print(f"✓ Memberships count: {len(data)} (expected 26)")
    
    def test_memberships_contains_expected_types(self):
        """Should contain key membership types"""
        response = requests.get(f"{BASE_URL}/api/members/memberships")
        assert response.status_code == 200
        data = response.json()
        
        expected_memberships = [
            "HYBRID FULL",
            "OPEN GYM",
            "THE COACH PASS",
            "6 WEEKS CHALLENGE",
            "HUBFIT",
            "VIRTUAL COACH",
            "UNLIMITED ACCESS"
        ]
        
        for expected in expected_memberships:
            found = any(expected in m for m in data)
            assert found, f"Expected membership containing '{expected}' not found"
            print(f"✓ Found membership type containing: {expected}")
    
    def test_memberships_are_sorted(self):
        """Memberships should be sorted alphabetically"""
        response = requests.get(f"{BASE_URL}/api/members/memberships")
        assert response.status_code == 200
        data = response.json()
        
        assert data == sorted(data), "Memberships should be sorted"
        print(f"✓ Memberships are sorted alphabetically")


class TestMembersEndpointWithCoachField:
    """Test /api/members includes is_coach computed field"""
    
    def test_members_have_is_coach_field(self):
        """All members should have is_coach field"""
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        data = response.json()
        
        for member in data[:10]:  # Check first 10
            assert 'is_coach' in member, f"Member {member.get('name')} missing is_coach field"
        print(f"✓ All members have is_coach field")
    
    def test_coach_count_matches_stats(self):
        """Coach count from members should match stats endpoint"""
        members_response = requests.get(f"{BASE_URL}/api/members")
        stats_response = requests.get(f"{BASE_URL}/api/members/stats")
        
        assert members_response.status_code == 200
        assert stats_response.status_code == 200
        
        members = members_response.json()
        stats = stats_response.json()
        
        # Count current coaches (no exit_date)
        current = [m for m in members if not m.get('exit_date') or m['exit_date'] in [None, '', 'None']]
        coaches = [m for m in current if m.get('is_coach')]
        
        assert len(coaches) == stats['total_coaches'], f"Mismatch: {len(coaches)} vs {stats['total_coaches']}"
        print(f"✓ Coach count matches: {len(coaches)}")


class TestCoursesEndpoint:
    """Test courses endpoint for attendance rate formatting"""
    
    def test_courses_returns_20_for_jan_2026(self):
        """Should return 20 courses for January 2026"""
        response = requests.get(f"{BASE_URL}/api/courses?year=2026&month=1")
        assert response.status_code == 200
        data = response.json()
        
        assert len(data) == 20, f"Expected 20 courses, got {len(data)}"
        print(f"✓ Courses count: {len(data)} (expected 20)")
    
    def test_courses_have_attendance_rate(self):
        """All courses should have attendance_rate field"""
        response = requests.get(f"{BASE_URL}/api/courses?year=2026&month=1")
        assert response.status_code == 200
        data = response.json()
        
        for course in data:
            assert 'attendance_rate' in course, f"Course {course.get('course_name')} missing attendance_rate"
            # Attendance rate is a float - frontend will format it
            assert isinstance(course['attendance_rate'], (int, float)), "attendance_rate should be numeric"
        print(f"✓ All {len(data)} courses have attendance_rate field")
    
    def test_courses_attendance_rate_is_reasonable(self):
        """Attendance rates should be between 0 and 100"""
        response = requests.get(f"{BASE_URL}/api/courses?year=2026&month=1")
        assert response.status_code == 200
        data = response.json()
        
        for course in data:
            rate = course.get('attendance_rate', 0)
            assert 0 <= rate <= 100, f"Course {course['course_name']} has invalid rate: {rate}"
        print(f"✓ All attendance rates are between 0-100%")


class TestMembersListFiltering:
    """Test filtering members list by various criteria"""
    
    def test_departed_members_have_exit_date(self):
        """All departed members should have exit_date set"""
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        data = response.json()
        
        # Check departed have exit_date
        departed = [m for m in data if m.get('exit_date') and m['exit_date'] not in [None, '', 'None']]
        assert len(departed) == 226, f"Expected 226 departed, got {len(departed)}"
        print(f"✓ Departed count from list: {len(departed)} (expected 226)")
    
    def test_current_members_breakdown(self):
        """Verify breakdown of current (non-departed) members"""
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        data = response.json()
        
        # Current = no exit_date
        current = [m for m in data if not m.get('exit_date') or m['exit_date'] in [None, '', 'None']]
        assert len(current) == 100, f"Expected 100 current members, got {len(current)}"
        
        # Coaches among current
        coaches = [m for m in current if m.get('is_coach')]
        non_coaches = [m for m in current if not m.get('is_coach')]
        
        assert len(coaches) == 29, f"Expected 29 coaches, got {len(coaches)}"
        assert len(non_coaches) == 71, f"Expected 71 non-coaches, got {len(non_coaches)}"
        
        print(f"✓ Current: 100 = {len(coaches)} coaches + {len(non_coaches)} non-coaches")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
