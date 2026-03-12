"""
Test Iteration 13: Attendance Page (Saisie Globale des Séances)
Tests for trainings endpoints and attendance feature
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# ===================== AUTH FIXTURES =====================

@pytest.fixture(scope="session")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="session")
def auth_token(api_client):
    """Get authentication token with test credentials"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": "test@challenge.com",
        "password": "Test1234!"
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Authentication failed - test@challenge.com not found")


@pytest.fixture(scope="session")
def authenticated_client(api_client, auth_token):
    """Session with auth header"""
    api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
    return api_client


# ===================== TRAININGS ENDPOINT TESTS =====================

class TestTrainingsEndpoints:
    """Tests for /api/trainings endpoints"""

    def test_get_trainings_returns_list(self, authenticated_client):
        """GET /api/trainings - Returns list of training records"""
        response = authenticated_client.get(f"{BASE_URL}/api/trainings")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"GET /api/trainings returned {len(data)} records")

    def test_get_trainings_by_year(self, authenticated_client):
        """GET /api/trainings?year=2024 - Returns training records filtered by year"""
        response = authenticated_client.get(f"{BASE_URL}/api/trainings?year=2024")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0, "Expected seed data for 2024"
        
        # Verify all records have the correct year
        for record in data:
            assert record.get("calendar_year") == 2024
        print(f"GET /api/trainings?year=2024 returned {len(data)} records")

    def test_get_trainings_by_week(self, authenticated_client):
        """GET /api/trainings?year=2024&week=45 - Returns training records for specific week"""
        response = authenticated_client.get(f"{BASE_URL}/api/trainings?year=2024&week=45")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Verify all records have the correct week
        for record in data:
            assert record.get("calendar_week") == 45
            assert record.get("calendar_year") == 2024
        print(f"GET /api/trainings?year=2024&week=45 returned {len(data)} records")

    def test_post_training_creates_record(self, authenticated_client):
        """POST /api/trainings - Creates or updates training record"""
        # Get a member to use
        members_response = authenticated_client.get(f"{BASE_URL}/api/members")
        assert members_response.status_code == 200
        members = members_response.json()
        assert len(members) > 0, "No members found for testing"
        member_id = members[0].get("id")

        # Create training record
        payload = {
            "member_id": member_id,
            "calendar_year": 2024,
            "calendar_week": 53,  # Use week 53 to avoid conflicts
            "trainings_count": 3
        }
        response = authenticated_client.post(f"{BASE_URL}/api/trainings", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        # Data assertions
        assert data.get("member_id") == member_id
        assert data.get("calendar_year") == 2024
        assert data.get("calendar_week") == 53
        assert data.get("trainings_count") == 3
        assert "id" in data
        print(f"POST /api/trainings created record: {data['id']}")

    def test_post_training_updates_existing_record(self, authenticated_client):
        """POST /api/trainings - Updates existing record (upsert behavior)"""
        # Get a member
        members_response = authenticated_client.get(f"{BASE_URL}/api/members")
        members = members_response.json()
        member_id = members[0].get("id")

        # Create initial record
        payload = {
            "member_id": member_id,
            "calendar_year": 2024,
            "calendar_week": 53,
            "trainings_count": 3
        }
        response1 = authenticated_client.post(f"{BASE_URL}/api/trainings", json=payload)
        assert response1.status_code == 200

        # Update same record
        payload["trainings_count"] = 5
        response2 = authenticated_client.post(f"{BASE_URL}/api/trainings", json=payload)
        assert response2.status_code == 200
        data = response2.json()
        
        # Verify update
        assert data.get("trainings_count") == 5
        print(f"POST /api/trainings updated record, trainings_count now: {data['trainings_count']}")

    def test_training_record_structure(self, authenticated_client):
        """Verify training record has required fields"""
        response = authenticated_client.get(f"{BASE_URL}/api/trainings?year=2024")
        assert response.status_code == 200
        data = response.json()
        assert len(data) > 0
        
        record = data[0]
        required_fields = ["id", "member_id", "calendar_year", "calendar_week", "trainings_count"]
        for field in required_fields:
            assert field in record, f"Missing field: {field}"
        
        # No MongoDB _id should be present
        assert "_id" not in record
        print(f"Training record structure valid: {list(record.keys())}")


# ===================== TRAINING SUMMARY ENDPOINT TESTS =====================

class TestTrainingSummaryEndpoint:
    """Tests for /api/trainings/summary/{member_id} endpoint"""

    def test_get_training_summary(self, authenticated_client):
        """GET /api/trainings/summary/{member_id} - Returns member training summary"""
        # Get a member
        members_response = authenticated_client.get(f"{BASE_URL}/api/members")
        members = members_response.json()
        member_id = members[0].get("id")

        response = authenticated_client.get(f"{BASE_URL}/api/trainings/summary/{member_id}")
        assert response.status_code == 200
        data = response.json()
        
        # Validate summary structure
        assert data.get("member_id") == member_id
        assert "total_trainings" in data
        assert "weeks_tracked" in data
        assert "avg_per_week" in data
        assert "engagement_level" in data
        assert "details" in data
        
        # Validate data types
        assert isinstance(data["total_trainings"], int)
        assert isinstance(data["weeks_tracked"], int)
        assert isinstance(data["avg_per_week"], (int, float))
        assert data["engagement_level"] in ["Faible", "Moyen", "Bon", "Excellent"]
        print(f"Training summary for {member_id}: {data['total_trainings']} total, {data['avg_per_week']} avg/week, engagement: {data['engagement_level']}")

    def test_get_training_summary_by_year(self, authenticated_client):
        """GET /api/trainings/summary/{member_id}?year=2024 - Returns summary filtered by year"""
        members_response = authenticated_client.get(f"{BASE_URL}/api/members")
        members = members_response.json()
        member_id = members[0].get("id")

        response = authenticated_client.get(f"{BASE_URL}/api/trainings/summary/{member_id}?year=2024")
        assert response.status_code == 200
        data = response.json()
        
        # All details should be from 2024
        for detail in data.get("details", []):
            assert detail.get("calendar_year") == 2024
        print(f"Training summary for 2024: {data['weeks_tracked']} weeks tracked")


# ===================== MEMBERS ENDPOINT TESTS =====================

class TestMembersForAttendance:
    """Tests for members data needed by attendance page"""

    def test_get_members_returns_list(self, authenticated_client):
        """GET /api/members - Returns list of members for attendance grid"""
        response = authenticated_client.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0, "Expected seed members data"
        print(f"GET /api/members returned {len(data)} members")

    def test_member_has_required_fields_for_attendance(self, authenticated_client):
        """Verify members have fields needed for attendance grid (id, name, membership)"""
        response = authenticated_client.get(f"{BASE_URL}/api/members")
        members = response.json()
        
        member = members[0]
        assert "id" in member
        assert "name" in member
        assert "membership" in member
        
        # No MongoDB _id
        assert "_id" not in member
        print(f"Member structure valid: {member['name']} - {member['membership']}")


# ===================== INTEGRATION TESTS =====================

class TestAttendanceIntegration:
    """Integration tests for attendance page data flow"""

    def test_attendance_data_flow(self, authenticated_client):
        """Test complete attendance data flow: get members + get trainings + update training"""
        # 1. Get members
        members_response = authenticated_client.get(f"{BASE_URL}/api/members")
        assert members_response.status_code == 200
        members = members_response.json()
        assert len(members) > 0
        member = members[0]

        # 2. Get trainings for year
        trainings_response = authenticated_client.get(f"{BASE_URL}/api/trainings?year=2024")
        assert trainings_response.status_code == 200
        trainings = trainings_response.json()

        # 3. Update training for member
        update_payload = {
            "member_id": member["id"],
            "calendar_year": 2024,
            "calendar_week": 50,
            "trainings_count": 4
        }
        update_response = authenticated_client.post(f"{BASE_URL}/api/trainings", json=update_payload)
        assert update_response.status_code == 200
        updated = update_response.json()
        assert updated["trainings_count"] == 4

        # 4. Verify by re-fetching
        verify_response = authenticated_client.get(
            f"{BASE_URL}/api/trainings?member_id={member['id']}&year=2024&week=50"
        )
        assert verify_response.status_code == 200
        verify_data = verify_response.json()
        assert len(verify_data) > 0
        assert verify_data[0]["trainings_count"] == 4
        print("Attendance data flow test PASSED")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
