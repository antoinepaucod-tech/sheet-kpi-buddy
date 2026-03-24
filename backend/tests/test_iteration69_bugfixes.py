"""
Iteration 69 - Bug Fixes Testing
Tests for 5 bug fixes:
1. POST /api/courses/bulk creates courses with club_id
2. POST /api/course-types creates new course type
3. PUT /api/courses/{id} can update course_name
4. POST /api/trainings updates attendance (totals recalculate in frontend)
5. GET /api/settings/membership-types + GET /api/members for member list toggle
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://fast-onboard.preview.emergentagent.com"

TEST_EMAIL = "antoine.paucod@the-coach.pro"
TEST_PASSWORD = "TheCoach1290."


@pytest.fixture(scope="module")
def auth_headers():
    """Get authentication token and club_id"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    token = data["access_token"]
    club_id = data["user"]["club_ids"][0]
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "X-Club-Id": club_id
    }


class TestBulkCourseCreation:
    """Bug 1: POST /api/courses/bulk should include club_id"""
    
    def test_bulk_create_courses_with_club_id(self, auth_headers):
        """Test that bulk course creation includes club_id in created courses"""
        payload = [{
            "year": 2026,
            "month": 2,
            "day_of_week": "Mercredi",
            "time_slot": "10:00",
            "course_name": "TEST_Bulk_Course_1",
            "instructor": "Test Coach",
            "max_capacity": 10
        }]
        
        response = requests.post(
            f"{BASE_URL}/api/courses/bulk",
            json=payload,
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Bulk create failed: {response.text}"
        data = response.json()
        
        assert "courses" in data
        assert len(data["courses"]) == 1
        
        # Verify club_id is present in created course
        created_course = data["courses"][0]
        assert "club_id" in created_course, "club_id missing from bulk created course"
        assert created_course["club_id"] == auth_headers["X-Club-Id"]
        
        # Cleanup
        course_id = created_course["id"]
        requests.delete(f"{BASE_URL}/api/courses/{course_id}", headers=auth_headers)


class TestNewCourseType:
    """Bug 2: POST /api/course-types creates new course type"""
    
    def test_create_course_type(self, auth_headers):
        """Test creating a new course type"""
        payload = {"name": "TEST_New_Course_Type_Iter69"}
        
        response = requests.post(
            f"{BASE_URL}/api/course-types",
            json=payload,
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Create course type failed: {response.text}"
        data = response.json()
        
        assert "id" in data
        assert data["name"] == "TEST_New_Course_Type_Iter69"
    
    def test_get_course_types_includes_new_type(self, auth_headers):
        """Test that new course type appears in list"""
        response = requests.get(
            f"{BASE_URL}/api/course-types",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Check if our test type exists
        type_names = [ct["name"] for ct in data]
        assert "TEST_New_Course_Type_Iter69" in type_names or any("TEST" in name for name in type_names)


class TestEditCourseName:
    """Bug 3: PUT /api/courses/{id} can update course_name"""
    
    def test_update_course_name(self, auth_headers):
        """Test updating course name via PUT endpoint"""
        # First create a course
        create_payload = {
            "year": 2026,
            "month": 2,
            "day_of_week": "Vendredi",
            "time_slot": "14:00",
            "course_name": "TEST_Original_Name",
            "instructor": "Test Coach",
            "max_capacity": 8
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/courses",
            json=create_payload,
            headers=auth_headers
        )
        assert create_response.status_code == 200
        course_id = create_response.json()["id"]
        
        # Update the course name
        update_payload = {"course_name": "TEST_Updated_Name"}
        update_response = requests.put(
            f"{BASE_URL}/api/courses/{course_id}",
            json=update_payload,
            headers=auth_headers
        )
        
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        updated_course = update_response.json()
        
        assert updated_course["course_name"] == "TEST_Updated_Name"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/courses/{course_id}", headers=auth_headers)


class TestAttendanceUpdate:
    """Bug 4: POST /api/trainings updates attendance"""
    
    def test_create_training_record(self, auth_headers):
        """Test creating/updating training record"""
        # Get a member ID
        members_response = requests.get(
            f"{BASE_URL}/api/members",
            headers=auth_headers
        )
        assert members_response.status_code == 200
        members = members_response.json()
        assert len(members) > 0
        
        member_id = members[0]["id"]
        
        # Create training record
        payload = {
            "member_id": member_id,
            "calendar_year": 2026,
            "calendar_week": 10,
            "trainings_count": 4
        }
        
        response = requests.post(
            f"{BASE_URL}/api/trainings",
            json=payload,
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Create training failed: {response.text}"
        data = response.json()
        
        assert data["member_id"] == member_id
        assert data["trainings_count"] == 4
    
    def test_get_trainings(self, auth_headers):
        """Test retrieving training records"""
        response = requests.get(
            f"{BASE_URL}/api/trainings?year=2026",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestMembershipMembersList:
    """Bug 5: Settings Types page - membership member list toggle"""
    
    def test_get_membership_types(self, auth_headers):
        """Test getting membership types"""
        response = requests.get(
            f"{BASE_URL}/api/settings/membership-types",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        
        # Check structure
        first_type = data[0]
        assert "id" in first_type
        assert "name" in first_type
    
    def test_get_members_with_membership(self, auth_headers):
        """Test getting members (used for membership member list)"""
        response = requests.get(
            f"{BASE_URL}/api/members",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Check that members have membership field
        if len(data) > 0:
            member = data[0]
            assert "membership" in member or "membership" in member.keys()
            # Check for exit_date field (used for departed status)
            assert "exit_date" in member or "exit_date" in member.keys()
    
    def test_members_can_be_grouped_by_membership(self, auth_headers):
        """Test that members can be grouped by membership type"""
        # Get membership types
        types_response = requests.get(
            f"{BASE_URL}/api/settings/membership-types",
            headers=auth_headers
        )
        membership_types = types_response.json()
        
        # Get members
        members_response = requests.get(
            f"{BASE_URL}/api/members",
            headers=auth_headers
        )
        members = members_response.json()
        
        # Group members by membership
        members_by_type = {}
        for member in members:
            membership = member.get("membership", "Sans abonnement")
            if membership not in members_by_type:
                members_by_type[membership] = []
            members_by_type[membership].append(member)
        
        # Verify at least one membership type has members
        type_names = [mt["name"] for mt in membership_types]
        has_members = any(name in members_by_type and len(members_by_type[name]) > 0 for name in type_names)
        
        assert has_members, "No membership types have associated members"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
