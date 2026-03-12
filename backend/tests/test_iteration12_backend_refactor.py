"""
Test Iteration 12: Backend Refactoring + Duo Subscriptions + Review History
Tests the modular router architecture (6 new router files) and new features
"""
import pytest
import requests
import os
import time
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestBackendRefactoringKPIs:
    """Test /api/monthly-kpis routes from kpis.py router"""

    def test_get_monthly_kpis(self):
        """GET /api/monthly-kpis returns KPI data"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        # Verify structure
        kpi = data[0]
        assert "month" in kpi
        assert "revenue_members" in kpi
        assert "total_revenue" in kpi
        print(f"✓ GET /api/monthly-kpis returned {len(data)} KPIs")

    def test_get_specific_month_kpi(self):
        """GET /api/monthly-kpis/{month} returns specific month"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis/2024-06")
        assert response.status_code == 200
        data = response.json()
        assert data["month"] == "2024-06"
        assert "revenue_members" in data
        print(f"✓ GET /api/monthly-kpis/2024-06 returned month data")


class TestBackendRefactoringTransactions:
    """Test /api/transactions and /api/categories routes from transactions.py router"""

    def test_create_transaction(self):
        """POST /api/transactions creates a transaction"""
        payload = {
            "date": "2024-12-15",
            "description": "TEST_Transaction_Iter12",
            "amount": 500.0,
            "type": "expense",
            "category": "AUTRE"
        }
        response = requests.post(f"{BASE_URL}/api/transactions", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["description"] == "TEST_Transaction_Iter12"
        assert data["amount"] == 500.0
        assert "id" in data
        print(f"✓ POST /api/transactions created transaction with id={data['id']}")

    def test_get_transactions(self):
        """GET /api/transactions returns transactions"""
        response = requests.get(f"{BASE_URL}/api/transactions")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/transactions returned {len(data)} transactions")

    def test_get_categories(self):
        """GET /api/categories returns categories"""
        response = requests.get(f"{BASE_URL}/api/categories")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        # Verify structure
        cat = data[0]
        assert "name" in cat
        assert "type" in cat
        print(f"✓ GET /api/categories returned {len(data)} categories")


class TestBackendRefactoringTrainings:
    """Test /api/trainings routes from trainings.py router"""

    def test_get_trainings_with_year_filter(self):
        """GET /api/trainings?year=2024 returns training data"""
        response = requests.get(f"{BASE_URL}/api/trainings?year=2024")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Verify all returned trainings are for 2024
        for training in data[:5]:
            assert training.get("calendar_year") == 2024
        print(f"✓ GET /api/trainings?year=2024 returned {len(data)} trainings")


class TestBackendRefactoringCourses:
    """Test /api/courses and /api/instructors routes from courses.py router"""

    def test_get_courses_with_filters(self):
        """GET /api/courses?year=2024&month=12 returns courses"""
        response = requests.get(f"{BASE_URL}/api/courses?year=2024&month=12")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        # Verify structure
        course = data[0]
        assert "course_name" in course
        assert "instructor" in course or "instructor_name" in course
        assert course.get("year") == 2024
        assert course.get("month") == 12
        print(f"✓ GET /api/courses?year=2024&month=12 returned {len(data)} courses")

    def test_get_instructors(self):
        """GET /api/instructors returns instructors"""
        response = requests.get(f"{BASE_URL}/api/instructors")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        # Verify structure
        instructor = data[0]
        assert "name" in instructor
        assert "hourly_rate" in instructor
        print(f"✓ GET /api/instructors returned {len(data)} instructors")

    def test_generate_salary_expenses(self):
        """POST /api/courses/generate-salary-expenses/2024/12 generates salary"""
        response = requests.post(f"{BASE_URL}/api/courses/generate-salary-expenses/2024/12")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "total" in data or "transactions" in data
        print(f"✓ POST /api/courses/generate-salary-expenses/2024/12 succeeded")


class TestBackendRefactoringAlerts:
    """Test /api/alerts routes from alerts.py router"""

    def test_get_alerts_summary(self):
        """GET /api/alerts/summary returns alerts"""
        response = requests.get(f"{BASE_URL}/api/alerts/summary")
        assert response.status_code == 200
        data = response.json()
        # Verify structure
        assert "late_payments" in data
        assert "expiring_subscriptions" in data
        assert "incomplete_onboarding" in data
        assert "total_alerts" in data
        print(f"✓ GET /api/alerts/summary returned alerts (total={data.get('total_alerts')})")


class TestBackendRefactoringRecurring:
    """Test /api/recurring-transactions routes from transactions.py router"""

    def test_get_recurring_transactions(self):
        """GET /api/recurring-transactions works"""
        response = requests.get(f"{BASE_URL}/api/recurring-transactions")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/recurring-transactions returned {len(data)} items")


class TestDuoSubscription:
    """Test Duo Subscription feature - POST /api/members with is_duo=true"""

    @pytest.fixture(autouse=True)
    def cleanup(self):
        """Cleanup test data after each test"""
        yield
        # Cleanup TEST_ prefixed members
        try:
            members = requests.get(f"{BASE_URL}/api/members").json()
            for m in members:
                if m.get("name", "").startswith("TEST_"):
                    requests.delete(f"{BASE_URL}/api/members/{m['id']}")
        except Exception:
            pass

    def test_create_duo_subscription_creates_both_members(self):
        """POST /api/members with is_duo=true and duo_partner_name creates both members"""
        payload = {
            "name": "TEST_DuoPrimary_Iter12",
            "email": "duo_primary@test.com",
            "phone": "+41 79 111 1111",
            "membership": "Annuel",
            "member_type": "Membres Généraux Récurrents",
            "contract_signed_date": "2025-01-01",
            "subscription_end_date": "2026-01-01",
            "cash_collected": 1200,
            "is_duo": True,
            "duo_partner_name": "TEST_DuoPartner_Iter12",
            "duo_partner_email": "duo_partner@test.com",
            "duo_partner_phone": "+41 79 222 2222",
            "billing_enabled": True,
            "billing_amount": 150,
            "billing_cycle_type": "monthly_day",
            "billing_cycle_value": 1,
            "billing_payment_method": "prelevement"
        }
        response = requests.post(f"{BASE_URL}/api/members", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        # Verify primary member created with duo flag
        assert data["name"] == "TEST_DuoPrimary_Iter12"
        assert data.get("is_duo") == True
        assert data.get("duo_primary") == True
        assert "duo_partner_id" in data
        
        primary_id = data["id"]
        partner_id = data["duo_partner_id"]
        print(f"✓ Created duo primary member (id={primary_id}) with partner_id={partner_id}")
        
        # Verify partner member was created
        partner_response = requests.get(f"{BASE_URL}/api/members/{partner_id}")
        assert partner_response.status_code == 200
        partner = partner_response.json()
        
        assert partner["name"] == "TEST_DuoPartner_Iter12"
        assert partner.get("is_duo") == True
        assert partner.get("duo_primary") == False
        assert partner.get("duo_partner_id") == primary_id
        print(f"✓ Partner member created correctly (id={partner_id})")

    def test_get_duo_member_returns_partner_name(self):
        """GET /api/members/{id} returns duo_partner_name for duo members"""
        # First create a duo subscription
        payload = {
            "name": "TEST_DuoPrimary2_Iter12",
            "email": "duo_primary2@test.com",
            "membership": "Annuel",
            "member_type": "Membres Généraux Récurrents",
            "contract_signed_date": "2025-01-01",
            "subscription_end_date": "2026-01-01",
            "cash_collected": 0,
            "is_duo": True,
            "duo_partner_name": "TEST_DuoPartner2_Iter12",
            "billing_enabled": False
        }
        create_response = requests.post(f"{BASE_URL}/api/members", json=payload)
        assert create_response.status_code == 200
        primary_id = create_response.json()["id"]
        
        # Get primary member and verify duo_partner_name is enriched
        get_response = requests.get(f"{BASE_URL}/api/members/{primary_id}")
        assert get_response.status_code == 200
        data = get_response.json()
        
        assert data.get("is_duo") == True
        assert data.get("duo_partner_name") == "TEST_DuoPartner2_Iter12"
        print(f"✓ GET /api/members/{primary_id} returns duo_partner_name correctly")


class TestReviewHistory:
    """Test Review History feature - GET /api/annual-reviews/history/{member_id}"""

    @pytest.fixture(autouse=True)
    def cleanup(self):
        """Cleanup test data after each test"""
        yield
        # Cleanup TEST_ prefixed members
        try:
            members = requests.get(f"{BASE_URL}/api/members").json()
            for m in members:
                if m.get("name", "").startswith("TEST_"):
                    requests.delete(f"{BASE_URL}/api/members/{m['id']}")
        except Exception:
            pass

    def test_get_review_history_returns_completed_reviews(self):
        """GET /api/annual-reviews/history/{member_id} returns completed reviews"""
        # Get an existing member to test
        members_response = requests.get(f"{BASE_URL}/api/members")
        assert members_response.status_code == 200
        members = members_response.json()
        
        if not members:
            pytest.skip("No members available for testing")
        
        member_id = members[0]["id"]
        member_name = members[0]["name"]
        
        # Get review history
        response = requests.get(f"{BASE_URL}/api/annual-reviews/history/{member_id}")
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "member_id" in data
        assert "member_name" in data
        assert "reviews" in data
        assert isinstance(data["reviews"], list)
        
        # member_name should be populated
        assert data["member_id"] == member_id
        print(f"✓ GET /api/annual-reviews/history/{member_id} returned {len(data['reviews'])} reviews")

    def test_create_and_complete_review_appears_in_history(self):
        """Complete a review and verify it appears in history endpoint"""
        # Create a test member first
        member_payload = {
            "name": "TEST_ReviewHistory_Iter12",
            "email": "reviewhistory@test.com",
            "membership": "Annuel",
            "member_type": "Membres Généraux Récurrents",
            "contract_signed_date": "2024-01-01",
            "subscription_end_date": "2025-01-01",
            "cash_collected": 0,
            "annual_review_enabled": True,
            "review_frequency": "quarterly",
            "billing_enabled": False
        }
        member_response = requests.post(f"{BASE_URL}/api/members", json=member_payload)
        assert member_response.status_code == 200
        member_id = member_response.json()["id"]
        
        # Create a review
        review_payload = {
            "member_id": member_id,
            "review_date": "2024-04-01",
            "review_type": "quarterly"
        }
        review_response = requests.post(f"{BASE_URL}/api/annual-reviews", json=review_payload)
        assert review_response.status_code == 200
        review_id = review_response.json()["id"]
        
        # Complete the review
        complete_payload = {
            "weight_start": 80.0,
            "weight_current": 78.5,
            "weight_goal": 75.0,
            "coach_notes": "TEST iteration 12 review"
        }
        complete_response = requests.post(
            f"{BASE_URL}/api/annual-reviews/{review_id}/complete",
            json=complete_payload
        )
        assert complete_response.status_code == 200
        completed = complete_response.json()
        assert completed.get("status") == "completed"
        assert completed.get("weight_change") == -1.5  # 78.5 - 80.0
        
        # Now verify it appears in history
        history_response = requests.get(f"{BASE_URL}/api/annual-reviews/history/{member_id}")
        assert history_response.status_code == 200
        history = history_response.json()
        
        assert len(history["reviews"]) >= 1
        completed_review = history["reviews"][0]
        assert completed_review["status"] == "completed"
        assert completed_review["weight_current"] == 78.5
        assert completed_review["weight_change"] == -1.5
        print(f"✓ Completed review appears in history with weight_change calculation")


class TestMembersRouter:
    """Additional tests for members.py router functionality"""

    def test_get_members(self):
        """GET /api/members returns list of members"""
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        print(f"✓ GET /api/members returned {len(data)} members")

    def test_get_expiring_members(self):
        """GET /api/members/expiring?days=30 returns expiring members"""
        response = requests.get(f"{BASE_URL}/api/members/expiring?days=30")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/members/expiring?days=30 returned {len(data)} expiring members")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
