"""
Iteration 8: Test 4 new features for Sheet KPI Buddy
- ExpiringSubscriptions: Members CRUD, expiring list, renewal
- SixWeeksChallenge: Challenge CRUD, participants management, check-ins
- KPICourses: Course CRUD, weekly attendance, summary
- KPIClient: Trainings CRUD, member engagement summary
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://sports-kpi-hub.preview.emergentagent.com').rstrip('/')


class TestMembersCRUD:
    """Feature 1: ExpiringSubscriptions - Member management with dates and renewal"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Cleanup test data after each test class"""
        yield
        # Cleanup test members
        response = requests.get(f"{BASE_URL}/api/members")
        if response.status_code == 200:
            for member in response.json():
                if member.get('name', '').startswith('TEST_'):
                    requests.delete(f"{BASE_URL}/api/members/{member['id']}")
    
    def test_get_members_list(self):
        """GET /api/members - should return list of members"""
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            member = data[0]
            assert "id" in member
            assert "name" in member
            assert "membership" in member
            assert "subscription_end_date" in member
            print(f"Members count: {len(data)}")
    
    def test_get_expiring_members(self):
        """GET /api/members/expiring?days=30 - should return members expiring soon"""
        response = requests.get(f"{BASE_URL}/api/members/expiring?days=30")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Expiring members (30 days): {len(data)}")
    
    def test_create_member(self):
        """POST /api/members - should create a new member"""
        payload = {
            "name": "TEST_New Member",
            "email": "test_new@example.com",
            "phone": "+41 79 000 0000",
            "membership": "Annuel",
            "member_type": "Membres Généraux Récurrents",
            "contract_signed_date": "2024-01-01",
            "subscription_end_date": "2025-01-01",
            "cash_collected": 1200
        }
        response = requests.post(f"{BASE_URL}/api/members", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == payload["name"]
        assert data["email"] == payload["email"]
        assert data["membership"] == payload["membership"]
        assert "id" in data
        print(f"Created member ID: {data['id']}")
        
        # Verify persistence
        get_response = requests.get(f"{BASE_URL}/api/members/{data['id']}")
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched["name"] == payload["name"]
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/members/{data['id']}")
    
    def test_update_member(self):
        """PUT /api/members/{id} - should update member details"""
        # Create test member first
        create_payload = {
            "name": "TEST_Update Member",
            "email": "test_update@example.com",
            "membership": "6 Mois",
            "member_type": "Membres PIF",
            "contract_signed_date": "2024-06-01",
            "subscription_end_date": "2024-12-01"
        }
        create_resp = requests.post(f"{BASE_URL}/api/members", json=create_payload)
        assert create_resp.status_code == 200
        member_id = create_resp.json()["id"]
        
        # Update
        update_payload = {"name": "TEST_Updated Name", "membership": "Annuel"}
        response = requests.put(f"{BASE_URL}/api/members/{member_id}", json=update_payload)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "TEST_Updated Name"
        assert data["membership"] == "Annuel"
        
        # Verify persistence
        get_resp = requests.get(f"{BASE_URL}/api/members/{member_id}")
        assert get_resp.json()["name"] == "TEST_Updated Name"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/members/{member_id}")
    
    def test_delete_member(self):
        """DELETE /api/members/{id} - should delete member"""
        # Create test member
        create_resp = requests.post(f"{BASE_URL}/api/members", json={
            "name": "TEST_Delete Member",
            "membership": "Mensuel"
        })
        member_id = create_resp.json()["id"]
        
        # Delete
        response = requests.delete(f"{BASE_URL}/api/members/{member_id}")
        assert response.status_code == 200
        
        # Verify removed
        get_resp = requests.get(f"{BASE_URL}/api/members/{member_id}")
        assert get_resp.status_code == 404
    
    def test_renew_member_subscription(self):
        """POST /api/members/{id}/renew - should renew member subscription"""
        # Create test member
        create_resp = requests.post(f"{BASE_URL}/api/members", json={
            "name": "TEST_Renew Member",
            "membership": "Annuel",
            "subscription_end_date": "2024-12-31"
        })
        member_id = create_resp.json()["id"]
        
        # Renew
        renew_payload = {
            "new_end_date": "2025-12-31",
            "renewal_duration": "12 mois",
            "notes": "Annual renewal test"
        }
        response = requests.post(f"{BASE_URL}/api/members/{member_id}/renew", json=renew_payload)
        assert response.status_code == 200
        data = response.json()
        # API returns {"member": {...}, "message": "..."}
        assert data["member"]["subscription_end_date"] == "2025-12-31"
        assert "message" in data
        
        # Check renewal history
        history_resp = requests.get(f"{BASE_URL}/api/members/{member_id}/renewals")
        assert history_resp.status_code == 200
        renewals = history_resp.json()
        assert len(renewals) >= 1
        assert renewals[0]["renewal_duration"] == "12 mois"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/members/{member_id}")


class TestChallengesCRUD:
    """Feature 2: SixWeeksChallenge - Challenge and participant management"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Cleanup test data after each test class"""
        yield
        # Cleanup test challenges
        response = requests.get(f"{BASE_URL}/api/challenges")
        if response.status_code == 200:
            for challenge in response.json():
                if challenge.get('name', '').startswith('TEST_'):
                    requests.delete(f"{BASE_URL}/api/challenges/{challenge['id']}")
    
    def test_get_challenges_list(self):
        """GET /api/challenges - should return list of challenges"""
        response = requests.get(f"{BASE_URL}/api/challenges")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            challenge = data[0]
            assert "id" in challenge
            assert "name" in challenge
            assert "start_date" in challenge
            assert "is_active" in challenge
        print(f"Challenges count: {len(data)}")
    
    def test_get_challenge_detail(self):
        """GET /api/challenges/{id} - should return challenge with participants"""
        # Get existing challenge
        list_resp = requests.get(f"{BASE_URL}/api/challenges")
        challenges = list_resp.json()
        if len(challenges) > 0:
            challenge_id = challenges[0]["id"]
            response = requests.get(f"{BASE_URL}/api/challenges/{challenge_id}")
            assert response.status_code == 200
            data = response.json()
            assert "participants" in data
            assert isinstance(data["participants"], list)
            print(f"Challenge '{data['name']}' has {len(data['participants'])} participants")
    
    def test_create_challenge(self):
        """POST /api/challenges - should create a new challenge"""
        payload = {
            "name": "TEST_Challenge Spring 2025",
            "start_date": "2025-03-01",
            "end_date": "2025-04-12",
            "is_active": True
        }
        response = requests.post(f"{BASE_URL}/api/challenges", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == payload["name"]
        assert data["start_date"] == payload["start_date"]
        assert data["is_active"] == True
        assert "id" in data
        print(f"Created challenge ID: {data['id']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/challenges/{data['id']}")
    
    def test_add_participant_to_challenge(self):
        """POST /api/challenges/{id}/participants - should add participant"""
        # Create test challenge
        challenge_resp = requests.post(f"{BASE_URL}/api/challenges", json={
            "name": "TEST_Participant Challenge",
            "start_date": "2025-01-01",
            "is_active": True
        })
        challenge_id = challenge_resp.json()["id"]
        
        # Get a member ID
        members_resp = requests.get(f"{BASE_URL}/api/members")
        members = members_resp.json()
        if len(members) == 0:
            pytest.skip("No members available for participant test")
        
        member = members[0]
        
        # Add participant - NOTE: challenge_id is required in body
        participant_payload = {
            "challenge_id": challenge_id,  # Required by ChallengeParticipantCreate
            "member_id": member["id"],
            "member_name": member["name"]
        }
        response = requests.post(f"{BASE_URL}/api/challenges/{challenge_id}/participants", json=participant_payload)
        assert response.status_code == 200
        data = response.json()
        assert data["member_id"] == member["id"]
        assert "id" in data
        
        # Verify in challenge detail
        detail_resp = requests.get(f"{BASE_URL}/api/challenges/{challenge_id}")
        participants = detail_resp.json()["participants"]
        assert len(participants) >= 1
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/challenges/{challenge_id}")
    
    def test_update_participant_checkins(self):
        """PUT /api/challenges/{id}/participants/{pid} - should update weekly check-ins"""
        # Create test challenge and participant
        challenge_resp = requests.post(f"{BASE_URL}/api/challenges", json={
            "name": "TEST_Checkin Challenge",
            "start_date": "2025-01-01",
            "is_active": True
        })
        challenge_id = challenge_resp.json()["id"]
        
        members_resp = requests.get(f"{BASE_URL}/api/members")
        if len(members_resp.json()) == 0:
            pytest.skip("No members available")
        member = members_resp.json()[0]
        
        # NOTE: challenge_id is required in body
        participant_resp = requests.post(f"{BASE_URL}/api/challenges/{challenge_id}/participants", json={
            "challenge_id": challenge_id,
            "member_id": member["id"],
            "member_name": member["name"]
        })
        participant_id = participant_resp.json()["id"]
        
        # Update check-ins
        update_payload = {"week1": True, "week2": True, "week3": True}
        response = requests.put(f"{BASE_URL}/api/challenges/{challenge_id}/participants/{participant_id}", json=update_payload)
        assert response.status_code == 200
        data = response.json()
        assert data["week1"] == True
        assert data["week2"] == True
        assert data["week3"] == True
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/challenges/{challenge_id}")


class TestCoursesCRUD:
    """Feature 3: KPICourses - Course management with weekly attendance"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Cleanup test data after each test class"""
        yield
        # Cleanup test courses
        response = requests.get(f"{BASE_URL}/api/courses?year=2025&month=1")
        if response.status_code == 200:
            for course in response.json():
                if course.get('course_name', '').startswith('TEST_'):
                    requests.delete(f"{BASE_URL}/api/courses/{course['id']}")
    
    def test_get_courses_list(self):
        """GET /api/courses - should return courses for given month"""
        response = requests.get(f"{BASE_URL}/api/courses?year=2024&month=12")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            course = data[0]
            assert "id" in course
            assert "course_name" in course
            assert "day_of_week" in course
            assert "time_slot" in course
            assert "week1_attendance" in course
        print(f"Courses for Dec 2024: {len(data)}")
    
    def test_get_courses_summary(self):
        """GET /api/courses/summary/{year}/{month} - should return monthly summary"""
        response = requests.get(f"{BASE_URL}/api/courses/summary/2024/12")
        assert response.status_code == 200
        data = response.json()
        assert "total_courses" in data
        assert "avg_attendance_rate" in data
        assert "total_expenses" in data
        assert "month_name" in data
        print(f"Summary: {data['total_courses']} courses, {data['avg_attendance_rate']}% avg attendance")
    
    def test_create_course(self):
        """POST /api/courses - should create a new course"""
        payload = {
            "year": 2025,
            "month": 1,
            "day_of_week": "Lundi",
            "time_slot": "10:00",
            "course_name": "TEST_Morning Yoga",
            "instructor": "Coach Alex",
            "max_capacity": 15
        }
        response = requests.post(f"{BASE_URL}/api/courses", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["course_name"] == payload["course_name"]
        assert data["day_of_week"] == payload["day_of_week"]
        assert data["max_capacity"] == payload["max_capacity"]
        assert "id" in data
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/courses/{data['id']}")
    
    def test_update_course_attendance(self):
        """PUT /api/courses/{id} - should update weekly attendance"""
        # Create test course
        create_resp = requests.post(f"{BASE_URL}/api/courses", json={
            "year": 2025,
            "month": 1,
            "day_of_week": "Mardi",
            "time_slot": "18:00",
            "course_name": "TEST_Evening CrossFit",
            "max_capacity": 12
        })
        course_id = create_resp.json()["id"]
        
        # Update attendance
        update_payload = {
            "week1_attendance": 10,
            "week2_attendance": 11,
            "week3_attendance": 9,
            "week4_attendance": 12
        }
        response = requests.put(f"{BASE_URL}/api/courses/{course_id}", json=update_payload)
        assert response.status_code == 200
        data = response.json()
        assert data["week1_attendance"] == 10
        assert data["week2_attendance"] == 11
        
        # Verify attendance rate recalculation
        assert data["attendance_rate"] > 0
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/courses/{course_id}")
    
    def test_delete_course(self):
        """DELETE /api/courses/{id} - should delete course"""
        create_resp = requests.post(f"{BASE_URL}/api/courses", json={
            "year": 2025,
            "month": 1,
            "course_name": "TEST_Delete Course",
            "day_of_week": "Vendredi",
            "time_slot": "07:00"
        })
        course_id = create_resp.json()["id"]
        
        response = requests.delete(f"{BASE_URL}/api/courses/{course_id}")
        assert response.status_code == 200
        
        # Verify removed
        get_resp = requests.get(f"{BASE_URL}/api/courses/{course_id}")
        assert get_resp.status_code == 404


class TestTrainingsClientKPI:
    """Feature 4: KPIClient - Weekly trainings and member engagement"""
    
    def test_get_trainings_list(self):
        """GET /api/trainings - should return trainings for given year"""
        response = requests.get(f"{BASE_URL}/api/trainings?year=2024")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            training = data[0]
            assert "member_id" in training
            assert "calendar_year" in training
            assert "calendar_week" in training
            assert "trainings_count" in training
        print(f"Trainings for 2024: {len(data)}")
    
    def test_create_or_update_training(self):
        """POST /api/trainings - should upsert weekly training record"""
        # Get a member ID
        members_resp = requests.get(f"{BASE_URL}/api/members")
        members = members_resp.json()
        if len(members) == 0:
            pytest.skip("No members available for training test")
        
        member_id = members[0]["id"]
        
        # Create training
        payload = {
            "member_id": member_id,
            "calendar_year": 2025,
            "calendar_week": 1,
            "trainings_count": 4
        }
        response = requests.post(f"{BASE_URL}/api/trainings", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["trainings_count"] == 4
        
        # Upsert same week with different count
        payload["trainings_count"] = 5
        response2 = requests.post(f"{BASE_URL}/api/trainings", json=payload)
        assert response2.status_code == 200
        assert response2.json()["trainings_count"] == 5
    
    def test_get_training_summary(self):
        """GET /api/trainings/summary/{member_id} - should return member engagement stats"""
        members_resp = requests.get(f"{BASE_URL}/api/members")
        members = members_resp.json()
        if len(members) == 0:
            pytest.skip("No members available")
        
        member_id = members[0]["id"]
        
        response = requests.get(f"{BASE_URL}/api/trainings/summary/{member_id}?year=2024")
        assert response.status_code == 200
        data = response.json()
        assert "total_trainings" in data
        assert "weeks_tracked" in data
        assert "avg_per_week" in data
        assert "engagement_level" in data
        
        # Engagement level should be one of expected values
        assert data["engagement_level"] in ["Excellent", "Bon", "Moyen", "Faible"]
        print(f"Member engagement: {data['engagement_level']} ({data['avg_per_week']} avg/week)")


class TestInstructorsCRUD:
    """Instructors API for Course KPIs"""
    
    def test_get_instructors_list(self):
        """GET /api/instructors - should return list of instructors"""
        response = requests.get(f"{BASE_URL}/api/instructors")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            instructor = data[0]
            assert "id" in instructor
            assert "name" in instructor
            assert "hourly_rate" in instructor
        print(f"Instructors count: {len(data)}")
    
    def test_get_active_instructors_only(self):
        """GET /api/instructors?active_only=true - should filter active instructors"""
        response = requests.get(f"{BASE_URL}/api/instructors?active_only=true")
        assert response.status_code == 200
        data = response.json()
        for instructor in data:
            assert instructor["is_active"] == True


class TestSeedData:
    """Verify seed data exists for demo"""
    
    def test_seed_data_exists(self):
        """Verify seed data is properly populated"""
        # Check members
        members_resp = requests.get(f"{BASE_URL}/api/members")
        assert members_resp.status_code == 200
        assert len(members_resp.json()) >= 10, "Expected at least 10 seeded members"
        
        # Check challenges
        challenges_resp = requests.get(f"{BASE_URL}/api/challenges")
        assert challenges_resp.status_code == 200
        assert len(challenges_resp.json()) >= 1, "Expected at least 1 seeded challenge"
        
        # Check courses
        courses_resp = requests.get(f"{BASE_URL}/api/courses?year=2024&month=12")
        assert courses_resp.status_code == 200
        assert len(courses_resp.json()) >= 8, "Expected at least 8 seeded courses"
        
        # Check instructors
        instructors_resp = requests.get(f"{BASE_URL}/api/instructors")
        assert instructors_resp.status_code == 200
        assert len(instructors_resp.json()) >= 4, "Expected at least 4 seeded instructors"
        
        print("All seed data verified!")
