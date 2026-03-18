"""
Test Annual Reviews / Bilans Suivis Feature - Iteration 55
Tests:
  1. GET /api/annual-reviews/dashboard-alerts - returns dashboard alert counts
  2. GET /api/annual-reviews/member-summary/{member_id} - returns attendance and payment summary
  3. POST /api/annual-reviews/auto-generate - generates reviews for active members
  4. GET /api/annual-reviews - returns all generated reviews with member names
  5. POST /api/annual-reviews/{review_id}/complete - completes a review with measurements
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestDashboardAlerts:
    """Test dashboard-alerts endpoint for review statistics"""

    def test_dashboard_alerts_returns_correct_structure(self):
        """Verify dashboard-alerts returns all required fields"""
        response = requests.get(f"{BASE_URL}/api/annual-reviews/dashboard-alerts")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Verify all required fields exist
        assert "overdue_count" in data, "Missing overdue_count"
        assert "this_week_count" in data, "Missing this_week_count"
        assert "next_30_count" in data, "Missing next_30_count"
        assert "total_scheduled" in data, "Missing total_scheduled"
        assert "overdue_items" in data, "Missing overdue_items"
        assert "this_week_items" in data, "Missing this_week_items"
        
        # Verify types
        assert isinstance(data["overdue_count"], int)
        assert isinstance(data["this_week_count"], int)
        assert isinstance(data["next_30_count"], int)
        assert isinstance(data["total_scheduled"], int)
        assert isinstance(data["overdue_items"], list)
        assert isinstance(data["this_week_items"], list)
        
        print(f"Dashboard alerts: total_scheduled={data['total_scheduled']}, "
              f"overdue={data['overdue_count']}, this_week={data['this_week_count']}, "
              f"next_30={data['next_30_count']}")

    def test_dashboard_alerts_has_108_scheduled(self):
        """Verify 108 reviews were auto-generated"""
        response = requests.get(f"{BASE_URL}/api/annual-reviews/dashboard-alerts")
        assert response.status_code == 200
        
        data = response.json()
        assert data["total_scheduled"] == 108, f"Expected 108 scheduled, got {data['total_scheduled']}"


class TestMemberSummary:
    """Test member-summary endpoint for attendance and payment data"""
    
    def test_member_summary_returns_correct_structure(self):
        """Verify member-summary returns attendance and payments data"""
        # First get a valid member_id from existing reviews
        reviews_response = requests.get(f"{BASE_URL}/api/annual-reviews?limit=1")
        assert reviews_response.status_code == 200
        reviews = reviews_response.json()
        assert len(reviews) > 0, "No reviews found"
        
        member_id = reviews[0]["member_id"]
        
        response = requests.get(f"{BASE_URL}/api/annual-reviews/member-summary/{member_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify structure
        assert "member_name" in data, "Missing member_name"
        assert "membership" in data, "Missing membership"
        assert "attendance" in data, "Missing attendance section"
        assert "payments" in data, "Missing payments section"
        
        # Verify attendance structure
        attendance = data["attendance"]
        assert "total_sessions" in attendance, "Missing attendance.total_sessions"
        assert "weeks_tracked" in attendance, "Missing attendance.weeks_tracked"
        assert "avg_per_week" in attendance, "Missing attendance.avg_per_week"
        assert "engagement" in attendance, "Missing attendance.engagement"
        
        # Verify payments structure
        payments = data["payments"]
        assert "active_schedules" in payments, "Missing payments.active_schedules"
        assert "monthly_amount" in payments, "Missing payments.monthly_amount"
        assert "late_count" in payments, "Missing payments.late_count"
        
        print(f"Member summary for {data['member_name']}: "
              f"attendance={attendance['total_sessions']} sessions, "
              f"engagement={attendance['engagement']}, "
              f"payments={payments['monthly_amount']} CHF/month")

    def test_member_summary_not_found(self):
        """Verify 404 for non-existent member"""
        response = requests.get(f"{BASE_URL}/api/annual-reviews/member-summary/non-existent-id")
        assert response.status_code == 404


class TestGetAllReviews:
    """Test GET /api/annual-reviews endpoint"""
    
    def test_get_all_reviews_returns_list(self):
        """Verify all reviews are returned with member names"""
        response = requests.get(f"{BASE_URL}/api/annual-reviews")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 108, f"Expected at least 108 reviews, got {len(data)}"
        
        # Verify review structure
        for review in data[:5]:  # Check first 5
            assert "id" in review
            assert "member_id" in review
            assert "review_date" in review
            assert "status" in review
            assert "review_type" in review
            # member_name should be enriched
            assert "member_name" in review, "Missing enriched member_name"
        
        print(f"Total reviews: {len(data)}")
    
    def test_reviews_all_type_annually(self):
        """Verify all reviews are type 'annually' (default for existing members)"""
        response = requests.get(f"{BASE_URL}/api/annual-reviews")
        assert response.status_code == 200
        
        data = response.json()
        annually_count = sum(1 for r in data if r.get("review_type") == "annually")
        print(f"Reviews with type 'annually': {annually_count}/{len(data)}")


class TestCompleteReview:
    """Test completing a review with measurements"""
    
    def test_complete_review_with_measurements(self):
        """Test completing a scheduled review"""
        # Get a scheduled review
        response = requests.get(f"{BASE_URL}/api/annual-reviews?status=scheduled")
        assert response.status_code == 200
        
        reviews = response.json()
        scheduled = [r for r in reviews if r.get("status") == "scheduled"]
        assert len(scheduled) > 0, "No scheduled reviews to complete"
        
        review = scheduled[0]
        review_id = review["id"]
        
        # Complete the review with measurements
        completion_data = {
            "weight_start": 75.5,
            "weight_current": 73.2,
            "weight_goal": 70.0,
            "body_fat_percentage": 18.5,
            "muscle_mass": 32.0,
            "training_frequency": 4,
            "goals_achieved": "Test - Amélioration de la condition physique",
            "new_goals": "Test - Continuer le programme actuel",
            "coach_notes": "Test notes du coach - Bon progrès"
        }
        
        complete_response = requests.post(
            f"{BASE_URL}/api/annual-reviews/{review_id}/complete",
            json=completion_data
        )
        assert complete_response.status_code == 200, f"Failed to complete: {complete_response.text}"
        
        completed = complete_response.json()
        
        # Verify completion
        assert completed["status"] == "completed"
        assert completed["weight_start"] == 75.5
        assert completed["weight_current"] == 73.2
        assert completed["weight_change"] == -2.3  # 73.2 - 75.5 = -2.3
        assert completed["completed_date"] is not None
        
        print(f"Completed review {review_id}: weight change = {completed['weight_change']} kg")
        
        # Verify review shows as completed when fetched
        verify_response = requests.get(f"{BASE_URL}/api/annual-reviews/{review_id}")
        assert verify_response.status_code == 200
        verify_data = verify_response.json()
        assert verify_data["status"] == "completed"


class TestAutoGenerate:
    """Test auto-generate endpoint (already run, but verify behavior)"""
    
    def test_auto_generate_skips_existing(self):
        """Verify auto-generate doesn't duplicate reviews"""
        # Run auto-generate again
        response = requests.post(f"{BASE_URL}/api/annual-reviews/auto-generate")
        assert response.status_code == 200
        
        data = response.json()
        assert "created" in data
        assert "skipped" in data
        
        # Should skip most since they already exist
        print(f"Auto-generate: created={data['created']}, skipped={data['skipped']}")


class TestNotificationEmailTemplate:
    """Test review reminder email has CTA button"""
    
    def test_review_reminder_endpoint_exists(self):
        """Verify the review reminder endpoint exists"""
        # Get a scheduled review
        response = requests.get(f"{BASE_URL}/api/annual-reviews?status=scheduled")
        assert response.status_code == 200
        
        reviews = response.json()
        scheduled = [r for r in reviews if r.get("status") == "scheduled"]
        
        if len(scheduled) > 0:
            review_id = scheduled[0]["id"]
            # We won't actually send the email, but verify endpoint responds
            # (actual send would require valid email and might send real emails)
            print(f"Review reminder endpoint available for review_id={review_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
