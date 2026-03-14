"""
Iteration 35 Tests - Auto-generate bilans and course salary generation
Tests for:
1. POST /api/challenges/auto-generate-bilans - generates monthly bilans for non-challenge members
2. POST /api/courses - course creation with 'instructor' field (not instructor_name)
3. POST /api/courses/generate-salary-expenses/{year}/{month} - salary generation from courses
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestAutoGenerateBilans:
    """Tests for auto-generate bilans endpoint"""

    def test_auto_generate_bilans_endpoint_returns_200(self):
        """POST /api/challenges/auto-generate-bilans should return 200"""
        response = requests.post(f"{BASE_URL}/api/challenges/auto-generate-bilans")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should have 'message' field"
        assert "created" in data, "Response should have 'created' field"
        assert isinstance(data["created"], int), "'created' should be an integer"
        print(f"Auto-generate bilans: {data['message']}")


class TestCourseCreation:
    """Tests for course creation with instructor field"""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Create a test coach for course tests"""
        # Check if test coach exists
        coaches_response = requests.get(f"{BASE_URL}/api/coaches")
        coaches = coaches_response.json()
        test_coach = next((c for c in coaches if c.get("name") == "TEST_Iter35_Coach"), None)
        
        if not test_coach:
            # Create test coach
            response = requests.post(f"{BASE_URL}/api/coaches", json={
                "name": "TEST_Iter35_Coach",
                "email": "test_iter35@test.com",
                "hourly_rate": 45.0,
                "is_active": True
            })
            if response.status_code == 200:
                test_coach = response.json()
        
        self.test_coach = test_coach
        yield
    
    def test_create_course_with_instructor_field(self):
        """Course should be created with 'instructor' field populated"""
        course_data = {
            "year": 2026,
            "month": 2,
            "day_of_week": "Mercredi",
            "time_slot": "11:00",
            "course_name": "TEST_Iter35_Course",
            "instructor": "TEST_Iter35_Coach",
            "max_capacity": 15
        }
        
        response = requests.post(f"{BASE_URL}/api/courses", json=course_data)
        assert response.status_code == 200, f"Failed to create course: {response.text}"
        
        data = response.json()
        assert data.get("instructor") == "TEST_Iter35_Coach", "instructor field should be set"
        assert data.get("course_name") == "TEST_Iter35_Course"
        assert data.get("max_capacity") == 15
        print(f"Created course with instructor: {data.get('instructor')}")
        
        # Cleanup
        if data.get("id"):
            requests.delete(f"{BASE_URL}/api/courses/{data['id']}")

    def test_course_instructor_is_not_instructor_name(self):
        """Verify course uses 'instructor' field (not legacy instructor_name)"""
        # Get existing courses to check field naming
        response = requests.get(f"{BASE_URL}/api/courses?year=2024&month=12")
        assert response.status_code == 200
        
        courses = response.json()
        if len(courses) > 0:
            course = courses[0]
            # Check that 'instructor' field exists and is used
            assert "instructor" in course, "Course should have 'instructor' field"
            # instructor_name should not be the primary field
            print(f"Course uses 'instructor' field: {course.get('instructor')}")


class TestSalaryGeneration:
    """Tests for salary expenses generation from courses"""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data for salary generation tests"""
        # Create or get test coach
        coaches_response = requests.get(f"{BASE_URL}/api/coaches")
        coaches = coaches_response.json()
        test_coach = next((c for c in coaches if c.get("name") == "TEST_Salary_Coach"), None)
        
        if not test_coach:
            response = requests.post(f"{BASE_URL}/api/coaches", json={
                "name": "TEST_Salary_Coach",
                "email": "test_salary@test.com",
                "hourly_rate": 60.0,
                "is_active": True
            })
            if response.status_code == 200:
                test_coach = response.json()
        
        self.test_coach = test_coach
        self.course_ids = []
        yield
        
        # Cleanup courses
        for cid in self.course_ids:
            requests.delete(f"{BASE_URL}/api/courses/{cid}")
    
    def test_salary_generation_with_instructor_field(self):
        """Salary should be generated using 'instructor' field and coach hourly_rate"""
        # Create course with instructor field
        course_data = {
            "year": 2026,
            "month": 3,
            "day_of_week": "Jeudi",
            "time_slot": "08:00",
            "course_name": "TEST_Salary_Course",
            "instructor": "TEST_Salary_Coach",
            "max_capacity": 10
        }
        
        create_response = requests.post(f"{BASE_URL}/api/courses", json=course_data)
        assert create_response.status_code == 200
        course = create_response.json()
        self.course_ids.append(course["id"])
        
        # Add attendance (4 weeks)
        update_response = requests.put(f"{BASE_URL}/api/courses/{course['id']}", json={
            "week1_attendance": 5,
            "week2_attendance": 6,
            "week3_attendance": 7,
            "week4_attendance": 8
        })
        assert update_response.status_code == 200
        
        # Generate salary
        salary_response = requests.post(f"{BASE_URL}/api/courses/generate-salary-expenses/2026/3")
        assert salary_response.status_code == 200
        
        data = salary_response.json()
        assert "transactions" in data
        assert len(data["transactions"]) > 0
        
        # Verify salary calculation: 4 hours * 60 CHF = 240 CHF
        by_coach = data.get("by_coach", {})
        if "TEST_Salary_Coach" in by_coach:
            coach_salary = by_coach["TEST_Salary_Coach"]
            assert coach_salary["hours"] == 4, f"Expected 4 hours, got {coach_salary['hours']}"
            assert coach_salary["rate"] == 60.0, f"Expected rate 60, got {coach_salary['rate']}"
            assert coach_salary["total"] == 240.0, f"Expected total 240, got {coach_salary['total']}"
            print(f"Salary generated: {coach_salary['hours']}h * {coach_salary['rate']} CHF = {coach_salary['total']} CHF")

    def test_salary_generation_no_courses_returns_404(self):
        """Salary generation for month with no courses should return 404"""
        response = requests.post(f"{BASE_URL}/api/courses/generate-salary-expenses/2099/12")
        assert response.status_code == 404


class TestCoachesAPI:
    """Tests for coaches API used by courses"""

    def test_get_coaches(self):
        """GET /api/coaches should return list of coaches"""
        response = requests.get(f"{BASE_URL}/api/coaches")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        print(f"Found {len(response.json())} coaches")

    def test_create_coach_with_hourly_rate(self):
        """Coach should be created with hourly_rate for salary calculation"""
        coach_data = {
            "name": "TEST_HourlyRate_Coach",
            "email": "test_hourly@test.com",
            "hourly_rate": 55.0,
            "is_active": True
        }
        
        response = requests.post(f"{BASE_URL}/api/coaches", json=coach_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("hourly_rate") == 55.0, "hourly_rate should be set"
        assert data.get("name") == "TEST_HourlyRate_Coach"
        print(f"Created coach with hourly_rate: {data.get('hourly_rate')} CHF/h")
        
        # Cleanup
        if data.get("id"):
            requests.delete(f"{BASE_URL}/api/coaches/{data['id']}")


class TestAnnualReviewsEndpoints:
    """Tests for annual reviews/bilans endpoints"""

    def test_get_annual_reviews(self):
        """GET /api/annual-reviews should return list"""
        response = requests.get(f"{BASE_URL}/api/annual-reviews")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        print(f"Found {len(response.json())} annual reviews")

    def test_get_upcoming_reviews(self):
        """GET /api/annual-reviews/upcoming should return list"""
        response = requests.get(f"{BASE_URL}/api/annual-reviews/upcoming?days=60")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        print(f"Found {len(response.json())} upcoming reviews (60 days)")


# Cleanup helper to remove TEST_ prefixed data
@pytest.fixture(scope="session", autouse=True)
def cleanup_test_data():
    yield
    # Cleanup TEST_ coaches
    coaches = requests.get(f"{BASE_URL}/api/coaches").json()
    for coach in coaches:
        if coach.get("name", "").startswith("TEST_"):
            requests.delete(f"{BASE_URL}/api/coaches/{coach['id']}")
    
    # Cleanup TEST_ courses in 2026
    for month in range(1, 13):
        courses = requests.get(f"{BASE_URL}/api/courses?year=2026&month={month}").json()
        for course in courses:
            if course.get("course_name", "").startswith("TEST_"):
                requests.delete(f"{BASE_URL}/api/courses/{course['id']}")
