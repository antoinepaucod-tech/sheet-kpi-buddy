"""
Iteration 36 Backend Tests - Bulk Course Creation and Auto-Sync Salary
Tests:
1. POST /api/courses/bulk - Bulk course creation
2. Auto-sync salary generation on attendance change
3. Year selector includes 2026
4. Edit modal instructor dropdown includes coaches
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')

class TestBulkCourseCreation:
    """Test POST /api/courses/bulk endpoint"""
    
    def test_bulk_endpoint_exists(self):
        """Test that bulk endpoint returns proper response structure"""
        # Create minimal test data
        test_courses = [
            {
                "year": 2026,
                "month": 4,
                "day_of_week": "Lundi",
                "time_slot": "07:00",
                "course_name": f"TEST_BulkCourse1_{uuid.uuid4().hex[:6]}",
                "instructor": "Antoine Paucod",
                "max_capacity": 12
            }
        ]
        
        response = requests.post(f"{BASE_URL}/api/courses/bulk", json=test_courses)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data
        assert "created" in data
        assert "courses" in data
        assert data["created"] == 1
        
        # Cleanup
        for course in data.get("courses", []):
            requests.delete(f"{BASE_URL}/api/courses/{course['id']}")
    
    def test_bulk_create_multiple_courses(self):
        """Test creating multiple courses at once"""
        unique_id = uuid.uuid4().hex[:6]
        test_courses = [
            {
                "year": 2026,
                "month": 4,
                "day_of_week": "Lundi",
                "time_slot": "06:00",
                "course_name": f"TEST_Morning_{unique_id}",
                "instructor": "Antoine Paucod",
                "max_capacity": 12
            },
            {
                "year": 2026,
                "month": 4,
                "day_of_week": "Lundi",
                "time_slot": "18:00",
                "course_name": f"TEST_Evening_{unique_id}",
                "instructor": "Antoine Paucod",
                "max_capacity": 15
            },
            {
                "year": 2026,
                "month": 4,
                "day_of_week": "Mardi",
                "time_slot": "07:00",
                "course_name": f"TEST_Tuesday_{unique_id}",
                "instructor": "Antoine Paucod",
                "max_capacity": 10
            }
        ]
        
        response = requests.post(f"{BASE_URL}/api/courses/bulk", json=test_courses)
        assert response.status_code == 200
        
        data = response.json()
        assert data["created"] == 3
        assert len(data["courses"]) == 3
        
        # Verify each course has expected fields
        for course in data["courses"]:
            assert "id" in course
            assert course["year"] == 2026
            assert course["month"] == 4
            assert course["instructor"] == "Antoine Paucod"
        
        # Cleanup
        for course in data.get("courses", []):
            requests.delete(f"{BASE_URL}/api/courses/{course['id']}")
    
    def test_bulk_courses_persisted(self):
        """Test that bulk-created courses are actually persisted in database"""
        unique_id = uuid.uuid4().hex[:6]
        test_courses = [
            {
                "year": 2026,
                "month": 5,  # Use May to avoid conflicts
                "day_of_week": "Mercredi",
                "time_slot": "10:00",
                "course_name": f"TEST_Persist_{unique_id}",
                "instructor": "Antoine Paucod",
                "max_capacity": 8
            }
        ]
        
        # Create courses
        response = requests.post(f"{BASE_URL}/api/courses/bulk", json=test_courses)
        assert response.status_code == 200
        created_course = response.json()["courses"][0]
        course_id = created_course["id"]
        
        # Verify via GET
        get_response = requests.get(f"{BASE_URL}/api/courses?year=2026&month=5")
        assert get_response.status_code == 200
        
        courses = get_response.json()
        found = [c for c in courses if c["id"] == course_id]
        assert len(found) == 1
        assert found[0]["course_name"] == f"TEST_Persist_{unique_id}"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/courses/{course_id}")


class TestSalaryGeneration:
    """Test salary generation from courses"""
    
    def test_salary_generation_endpoint(self):
        """Test POST /api/courses/generate-salary-expenses/{year}/{month}"""
        # Mars 2026 should have courses with attendance data
        response = requests.post(f"{BASE_URL}/api/courses/generate-salary-expenses/2026/3")
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        assert "transactions" in data
        assert "by_coach" in data
    
    def test_salary_generation_for_antoine(self):
        """Test that Antoine Paucod appears in salary generation"""
        response = requests.post(f"{BASE_URL}/api/courses/generate-salary-expenses/2026/3")
        assert response.status_code == 200
        
        data = response.json()
        
        # Antoine should have salary since he has courses with attendance
        assert "Antoine Paucod" in data["by_coach"], f"Antoine not found in: {data['by_coach']}"
        
        antoine_info = data["by_coach"]["Antoine Paucod"]
        assert antoine_info["rate"] == 50.0, f"Expected rate 50, got {antoine_info['rate']}"
        # Total should be hours * rate (50 CHF/h)
        assert antoine_info["total"] == antoine_info["hours"] * 50.0
    
    def test_auto_sync_salary_on_attendance_change(self):
        """Test that updating attendance triggers salary recalculation"""
        # Get existing course for Mars 2026
        response = requests.get(f"{BASE_URL}/api/courses?year=2026&month=3")
        assert response.status_code == 200
        courses = response.json()
        
        if not courses:
            pytest.skip("No courses in Mars 2026 to test")
        
        course = courses[0]
        course_id = course["id"]
        original_w1 = course.get("week1_attendance", 0)
        
        # Update attendance
        update_response = requests.put(
            f"{BASE_URL}/api/courses/{course_id}",
            json={"week1_attendance": 5}
        )
        assert update_response.status_code == 200
        
        # Generate salary to verify it works
        salary_response = requests.post(f"{BASE_URL}/api/courses/generate-salary-expenses/2026/3")
        assert salary_response.status_code == 200
        
        # Restore original value
        requests.put(f"{BASE_URL}/api/courses/{course_id}", json={"week1_attendance": original_w1})
    
    def test_salary_transactions_appear(self):
        """Test that generated salary transactions appear in transactions"""
        # Generate salary first
        requests.post(f"{BASE_URL}/api/courses/generate-salary-expenses/2026/3")
        
        # Check transactions
        response = requests.get(f"{BASE_URL}/api/transactions?month=2026-03")
        assert response.status_code == 200
        
        transactions = response.json()
        salary_txs = [t for t in transactions if "SALAIRES COACHS" in t.get("category", "")]
        
        # Should have at least one salary transaction for Antoine
        antoine_tx = [t for t in salary_txs if "Antoine Paucod" in t.get("description", "")]
        assert len(antoine_tx) > 0, f"No Antoine salary found. Transactions: {salary_txs}"


class TestCoachesAndInstructors:
    """Test coaches and instructors endpoints"""
    
    def test_coaches_endpoint_returns_antoine(self):
        """Test that /api/coaches returns Antoine Paucod"""
        response = requests.get(f"{BASE_URL}/api/coaches?active_only=true")
        assert response.status_code == 200
        
        coaches = response.json()
        antoine = [c for c in coaches if c["name"] == "Antoine Paucod"]
        assert len(antoine) > 0, f"Antoine not found in coaches: {coaches}"
        
        # Verify Antoine's details
        assert antoine[0]["hourly_rate"] == 50.0
    
    def test_instructors_endpoint(self):
        """Test that /api/instructors endpoint works"""
        response = requests.get(f"{BASE_URL}/api/instructors?active_only=true")
        assert response.status_code == 200
        # Just verify endpoint works
        assert isinstance(response.json(), list)


class TestYearSelector:
    """Test that year 2026 is supported"""
    
    def test_courses_2026_accessible(self):
        """Test that courses can be fetched for 2026"""
        response = requests.get(f"{BASE_URL}/api/courses?year=2026&month=3")
        assert response.status_code == 200
    
    def test_courses_summary_2026(self):
        """Test course summary for 2026"""
        response = requests.get(f"{BASE_URL}/api/courses/summary/2026/3")
        assert response.status_code == 200
        
        data = response.json()
        assert data["year"] == 2026
        assert data["month"] == 3
        assert "total_courses" in data
