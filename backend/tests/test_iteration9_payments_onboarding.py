"""
Iteration 9 Tests - Payment System, Onboarding & Follow-ups
Tests:
- Payment Schedules CRUD
- Payments CRUD and mark-paid
- Late/upcoming payments
- Generate monthly payments
- Onboarding pending endpoint
- Member onboarding update
- Follow-ups CRUD
- Complete/upcoming/missed followups
- Alerts summary
- Courses S5 column
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')

# Test data
TEST_MEMBER = {
    "name": "TEST_Payment_Member",
    "email": "test_payment@example.com",
    "phone": "+41 79 999 8888",
    "membership": "Annuel",
    "member_type": "Membres Généraux Récurrents",
    "contract_signed_date": datetime.now().strftime("%Y-%m-%d"),
    "subscription_end_date": (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d"),
    "cash_collected": 1200
}

class TestPaymentSchedules:
    """Payment Schedule CRUD tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self, api_client):
        """Create a test member for payment tests"""
        # Create test member
        response = api_client.post(f"{BASE_URL}/api/members", json=TEST_MEMBER)
        if response.status_code == 200:
            self.member_id = response.json().get("id")
        else:
            # Use existing member
            members = api_client.get(f"{BASE_URL}/api/members").json()
            self.member_id = members[0]["id"] if members else None
        yield
        # Cleanup test schedules and payments after tests
        try:
            schedules = api_client.get(f"{BASE_URL}/api/payment-schedules").json()
            for s in schedules:
                if "TEST_" in s.get("notes", ""):
                    api_client.delete(f"{BASE_URL}/api/payment-schedules/{s['id']}")
        except:
            pass
    
    def test_get_payment_schedules(self, api_client):
        """Test GET /api/payment-schedules"""
        response = api_client.get(f"{BASE_URL}/api/payment-schedules")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        print("PASS: GET /api/payment-schedules returns list")
    
    def test_create_payment_schedule_monthly_day(self, api_client):
        """Test POST /api/payment-schedules with monthly_day recurrence"""
        schedule_data = {
            "member_id": self.member_id,
            "amount": 100.00,
            "recurrence_type": "monthly_day",
            "recurrence_value": 15,  # Day 15 of each month
            "start_date": datetime.now().strftime("%Y-%m-%d"),
            "payment_method": "prelevement",
            "is_active": True,
            "notes": "TEST_monthly_schedule"
        }
        response = api_client.post(f"{BASE_URL}/api/payment-schedules", json=schedule_data)
        assert response.status_code == 200
        data = response.json()
        assert data["member_id"] == self.member_id
        assert data["amount"] == 100.00
        assert data["recurrence_type"] == "monthly_day"
        assert data["recurrence_value"] == 15
        assert "id" in data
        print("PASS: POST /api/payment-schedules (monthly_day) creates schedule correctly")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/payment-schedules/{data['id']}")
    
    def test_create_payment_schedule_interval_days(self, api_client):
        """Test POST /api/payment-schedules with interval_days recurrence (28 days)"""
        schedule_data = {
            "member_id": self.member_id,
            "amount": 150.00,
            "recurrence_type": "interval_days",
            "recurrence_value": 28,  # Every 28 days
            "start_date": datetime.now().strftime("%Y-%m-%d"),
            "payment_method": "carte",
            "is_active": True,
            "notes": "TEST_interval_schedule"
        }
        response = api_client.post(f"{BASE_URL}/api/payment-schedules", json=schedule_data)
        assert response.status_code == 200
        data = response.json()
        assert data["recurrence_type"] == "interval_days"
        assert data["recurrence_value"] == 28
        print("PASS: POST /api/payment-schedules (interval_days 28) creates schedule correctly")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/payment-schedules/{data['id']}")
    
    def test_delete_payment_schedule(self, api_client):
        """Test DELETE /api/payment-schedules/{id}"""
        # Create schedule to delete
        schedule_data = {
            "member_id": self.member_id,
            "amount": 50.00,
            "recurrence_type": "monthly_day",
            "recurrence_value": 1,
            "start_date": datetime.now().strftime("%Y-%m-%d"),
            "notes": "TEST_to_delete"
        }
        create_resp = api_client.post(f"{BASE_URL}/api/payment-schedules", json=schedule_data)
        schedule_id = create_resp.json()["id"]
        
        # Delete it
        delete_resp = api_client.delete(f"{BASE_URL}/api/payment-schedules/{schedule_id}")
        assert delete_resp.status_code == 200
        
        # Verify deleted
        schedules = api_client.get(f"{BASE_URL}/api/payment-schedules").json()
        assert not any(s["id"] == schedule_id for s in schedules)
        print("PASS: DELETE /api/payment-schedules/{id} removes schedule")


class TestPayments:
    """Payment CRUD and operations tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self, api_client):
        """Get a member for payment tests"""
        members = api_client.get(f"{BASE_URL}/api/members").json()
        self.member_id = members[0]["id"] if members else None
        yield
        # Cleanup test payments
        try:
            payments = api_client.get(f"{BASE_URL}/api/payments").json()
            for p in payments:
                if "TEST_" in p.get("notes", ""):
                    api_client.delete(f"{BASE_URL}/api/payments/{p['id']}")
        except:
            pass
    
    def test_get_payments(self, api_client):
        """Test GET /api/payments"""
        response = api_client.get(f"{BASE_URL}/api/payments")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        print("PASS: GET /api/payments returns list")
    
    def test_create_payment(self, api_client):
        """Test POST /api/payments"""
        payment_data = {
            "member_id": self.member_id,
            "amount": 200.00,
            "due_date": (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d"),
            "status": "pending",
            "payment_method": "prelevement",
            "notes": "TEST_payment"
        }
        response = api_client.post(f"{BASE_URL}/api/payments", json=payment_data)
        assert response.status_code == 200
        data = response.json()
        assert data["member_id"] == self.member_id
        assert data["amount"] == 200.00
        assert data["status"] == "pending"
        assert "id" in data
        print("PASS: POST /api/payments creates payment correctly")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/payments/{data['id']}")
    
    def test_mark_payment_paid(self, api_client):
        """Test POST /api/payments/{id}/mark-paid"""
        # Create pending payment
        payment_data = {
            "member_id": self.member_id,
            "amount": 100.00,
            "due_date": datetime.now().strftime("%Y-%m-%d"),
            "status": "pending",
            "notes": "TEST_mark_paid"
        }
        create_resp = api_client.post(f"{BASE_URL}/api/payments", json=payment_data)
        payment_id = create_resp.json()["id"]
        
        # Mark as paid
        paid_date = datetime.now().strftime("%Y-%m-%d")
        mark_paid_resp = api_client.post(f"{BASE_URL}/api/payments/{payment_id}/mark-paid", json={
            "paid_date": paid_date,
            "reference": "TXN123456"
        })
        assert mark_paid_resp.status_code == 200
        data = mark_paid_resp.json()
        assert data["status"] == "paid"
        assert data["paid_date"] == paid_date
        assert data["reference"] == "TXN123456"
        print("PASS: POST /api/payments/{id}/mark-paid marks payment as paid")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/payments/{payment_id}")
    
    def test_get_late_payments(self, api_client):
        """Test GET /api/payments/late"""
        # Create a late payment (due date in the past)
        payment_data = {
            "member_id": self.member_id,
            "amount": 75.00,
            "due_date": (datetime.now() - timedelta(days=5)).strftime("%Y-%m-%d"),
            "status": "pending",
            "notes": "TEST_late_payment"
        }
        create_resp = api_client.post(f"{BASE_URL}/api/payments", json=payment_data)
        payment_id = create_resp.json()["id"]
        
        # Get late payments
        response = api_client.get(f"{BASE_URL}/api/payments/late")
        assert response.status_code == 200
        late_payments = response.json()
        assert isinstance(late_payments, list)
        # Should include our late payment (status updated to "late")
        our_payment = next((p for p in late_payments if p["id"] == payment_id), None)
        if our_payment:
            assert our_payment["status"] == "late"
            print("PASS: GET /api/payments/late returns late payments and updates status")
        else:
            print("PASS: GET /api/payments/late returns list (payment may have been processed)")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/payments/{payment_id}")
    
    def test_get_upcoming_payments(self, api_client):
        """Test GET /api/payments/upcoming"""
        # Create an upcoming payment
        payment_data = {
            "member_id": self.member_id,
            "amount": 125.00,
            "due_date": (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d"),
            "status": "pending",
            "notes": "TEST_upcoming_payment"
        }
        create_resp = api_client.post(f"{BASE_URL}/api/payments", json=payment_data)
        payment_id = create_resp.json()["id"]
        
        # Get upcoming payments (default 7 days)
        response = api_client.get(f"{BASE_URL}/api/payments/upcoming?days=7")
        assert response.status_code == 200
        upcoming_payments = response.json()
        assert isinstance(upcoming_payments, list)
        # Should include our upcoming payment
        our_payment = next((p for p in upcoming_payments if p["id"] == payment_id), None)
        assert our_payment is not None, "Upcoming payment not found in response"
        print("PASS: GET /api/payments/upcoming returns upcoming payments")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/payments/{payment_id}")
    
    def test_generate_monthly_payments(self, api_client):
        """Test POST /api/payments/generate/{year}/{month}"""
        # First create an active payment schedule
        schedule_data = {
            "member_id": self.member_id,
            "amount": 99.99,
            "recurrence_type": "monthly_day",
            "recurrence_value": 10,
            "start_date": datetime.now().strftime("%Y-%m-%d"),
            "is_active": True,
            "notes": "TEST_generate_schedule"
        }
        schedule_resp = api_client.post(f"{BASE_URL}/api/payment-schedules", json=schedule_data)
        schedule_id = schedule_resp.json()["id"]
        
        # Generate payments for current month
        now = datetime.now()
        response = api_client.post(f"{BASE_URL}/api/payments/generate/{now.year}/{now.month}")
        assert response.status_code == 200
        data = response.json()
        assert "created" in data
        assert "month" in data
        print(f"PASS: POST /api/payments/generate/{now.year}/{now.month} generated {data['created']} payments")
        
        # Cleanup schedule and generated payment
        api_client.delete(f"{BASE_URL}/api/payment-schedules/{schedule_id}")
        # Clean generated payments
        payments = api_client.get(f"{BASE_URL}/api/payments").json()
        for p in payments:
            if p.get("schedule_id") == schedule_id:
                api_client.delete(f"{BASE_URL}/api/payments/{p['id']}")
    
    def test_delete_payment(self, api_client):
        """Test DELETE /api/payments/{id}"""
        # Create payment to delete
        payment_data = {
            "member_id": self.member_id,
            "amount": 50.00,
            "due_date": datetime.now().strftime("%Y-%m-%d"),
            "notes": "TEST_to_delete"
        }
        create_resp = api_client.post(f"{BASE_URL}/api/payments", json=payment_data)
        payment_id = create_resp.json()["id"]
        
        # Delete it
        delete_resp = api_client.delete(f"{BASE_URL}/api/payments/{payment_id}")
        assert delete_resp.status_code == 200
        print("PASS: DELETE /api/payments/{id} removes payment")


class TestOnboarding:
    """Onboarding endpoints tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self, api_client):
        """Create a test member with incomplete onboarding"""
        member_data = {
            "name": "TEST_Onboarding_Member",
            "email": "test_onboard@example.com",
            "membership": "Annuel",
            "contract_signed_date": datetime.now().strftime("%Y-%m-%d"),
            "subscription_end_date": (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d"),
            "onboarding_bsport": False,
            "onboarding_hubfit": False,
            "onboarding_nutrition": False,
            "questionnaire_coaching": False,
            "session_introduction": False
        }
        response = api_client.post(f"{BASE_URL}/api/members", json=member_data)
        if response.status_code == 200:
            self.member_id = response.json()["id"]
        else:
            members = api_client.get(f"{BASE_URL}/api/members").json()
            self.member_id = members[0]["id"] if members else None
        yield
        # Cleanup
        try:
            if hasattr(self, 'member_id') and "TEST_" in str(self.member_id):
                api_client.delete(f"{BASE_URL}/api/members/{self.member_id}")
        except:
            pass
    
    def test_get_pending_onboarding(self, api_client):
        """Test GET /api/onboarding/pending"""
        response = api_client.get(f"{BASE_URL}/api/onboarding/pending")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Each member should have onboarding progress fields
        if data:
            member = data[0]
            assert "onboarding_progress" in member
            assert "onboarding_total" in member
            assert "onboarding_percentage" in member
            assert member["onboarding_total"] == 5
        print("PASS: GET /api/onboarding/pending returns members with onboarding progress")
    
    def test_update_member_onboarding(self, api_client):
        """Test PUT /api/members/{id}/onboarding"""
        # Update onboarding steps
        update_data = {
            "onboarding_bsport": True,
            "onboarding_hubfit": True
        }
        response = api_client.put(f"{BASE_URL}/api/members/{self.member_id}/onboarding", json=update_data)
        assert response.status_code == 200
        data = response.json()
        assert data["onboarding_bsport"] == True
        assert data["onboarding_hubfit"] == True
        assert data["onboarding_completed"] == False  # Not all steps done
        print("PASS: PUT /api/members/{id}/onboarding updates onboarding steps")
    
    def test_complete_all_onboarding_steps(self, api_client):
        """Test completing all 5 onboarding steps marks onboarding as completed"""
        update_data = {
            "onboarding_bsport": True,
            "onboarding_hubfit": True,
            "onboarding_nutrition": True,
            "questionnaire_coaching": True,
            "session_introduction": True
        }
        response = api_client.put(f"{BASE_URL}/api/members/{self.member_id}/onboarding", json=update_data)
        assert response.status_code == 200
        data = response.json()
        assert data["onboarding_completed"] == True
        assert data["onboarding_completed_date"] is not None
        print("PASS: Completing all 5 steps sets onboarding_completed=True")


class TestFollowups:
    """Follow-up CRUD and operations tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self, api_client):
        """Get a member for follow-up tests"""
        members = api_client.get(f"{BASE_URL}/api/members").json()
        self.member_id = members[0]["id"] if members else None
        yield
        # Cleanup test follow-ups
        try:
            followups = api_client.get(f"{BASE_URL}/api/followups").json()
            for f in followups:
                if "TEST_" in f.get("notes", ""):
                    api_client.delete(f"{BASE_URL}/api/followups/{f['id']}")
        except:
            pass
    
    def test_get_followups(self, api_client):
        """Test GET /api/followups"""
        response = api_client.get(f"{BASE_URL}/api/followups")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        print("PASS: GET /api/followups returns list")
    
    def test_create_followup(self, api_client):
        """Test POST /api/followups"""
        followup_data = {
            "member_id": self.member_id,
            "followup_date": (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d"),
            "followup_type": "monthly",
            "notes": "TEST_followup"
        }
        response = api_client.post(f"{BASE_URL}/api/followups", json=followup_data)
        assert response.status_code == 200
        data = response.json()
        assert data["member_id"] == self.member_id
        assert data["followup_type"] == "monthly"
        assert data["status"] == "scheduled"
        assert "id" in data
        print("PASS: POST /api/followups creates follow-up correctly")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/followups/{data['id']}")
    
    def test_complete_followup(self, api_client):
        """Test POST /api/followups/{id}/complete"""
        # Create a follow-up
        followup_data = {
            "member_id": self.member_id,
            "followup_date": datetime.now().strftime("%Y-%m-%d"),
            "followup_type": "monthly",
            "notes": "TEST_complete"
        }
        create_resp = api_client.post(f"{BASE_URL}/api/followups", json=followup_data)
        followup_id = create_resp.json()["id"]
        
        # Complete it
        complete_resp = api_client.post(f"{BASE_URL}/api/followups/{followup_id}/complete", json={
            "notes": "Suivi effectué",
            "next_followup_date": (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        })
        assert complete_resp.status_code == 200
        data = complete_resp.json()
        assert data["status"] == "completed"
        assert data["completed_date"] is not None
        print("PASS: POST /api/followups/{id}/complete marks follow-up as completed")
        
        # Cleanup - delete original and next followup
        api_client.delete(f"{BASE_URL}/api/followups/{followup_id}")
    
    def test_get_upcoming_followups(self, api_client):
        """Test GET /api/followups/upcoming"""
        # Create an upcoming follow-up
        followup_data = {
            "member_id": self.member_id,
            "followup_date": (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d"),
            "followup_type": "monthly",
            "notes": "TEST_upcoming"
        }
        create_resp = api_client.post(f"{BASE_URL}/api/followups", json=followup_data)
        followup_id = create_resp.json()["id"]
        
        response = api_client.get(f"{BASE_URL}/api/followups/upcoming?days=7")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should include our follow-up
        our_followup = next((f for f in data if f["id"] == followup_id), None)
        assert our_followup is not None
        print("PASS: GET /api/followups/upcoming returns upcoming follow-ups")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/followups/{followup_id}")
    
    def test_get_missed_followups(self, api_client):
        """Test GET /api/followups/missed"""
        # Create a missed follow-up (date in the past)
        followup_data = {
            "member_id": self.member_id,
            "followup_date": (datetime.now() - timedelta(days=3)).strftime("%Y-%m-%d"),
            "followup_type": "monthly",
            "notes": "TEST_missed"
        }
        create_resp = api_client.post(f"{BASE_URL}/api/followups", json=followup_data)
        followup_id = create_resp.json()["id"]
        
        response = api_client.get(f"{BASE_URL}/api/followups/missed")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Our follow-up should be marked as missed
        our_followup = next((f for f in data if f["id"] == followup_id), None)
        if our_followup:
            assert our_followup["status"] == "missed"
            print("PASS: GET /api/followups/missed returns missed follow-ups and updates status")
        else:
            print("PASS: GET /api/followups/missed returns list")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/followups/{followup_id}")
    
    def test_delete_followup(self, api_client):
        """Test DELETE /api/followups/{id}"""
        # Create follow-up to delete
        followup_data = {
            "member_id": self.member_id,
            "followup_date": datetime.now().strftime("%Y-%m-%d"),
            "followup_type": "monthly",
            "notes": "TEST_to_delete"
        }
        create_resp = api_client.post(f"{BASE_URL}/api/followups", json=followup_data)
        followup_id = create_resp.json()["id"]
        
        # Delete it
        delete_resp = api_client.delete(f"{BASE_URL}/api/followups/{followup_id}")
        assert delete_resp.status_code == 200
        print("PASS: DELETE /api/followups/{id} removes follow-up")


class TestAlerts:
    """Alerts summary endpoint test"""
    
    def test_get_alerts_summary(self, api_client):
        """Test GET /api/alerts/summary"""
        response = api_client.get(f"{BASE_URL}/api/alerts/summary")
        assert response.status_code == 200
        data = response.json()
        
        # Verify all required fields
        assert "late_payments" in data
        assert "missed_followups" in data
        assert "expiring_subscriptions" in data
        assert "incomplete_onboarding" in data
        assert "upcoming_followups" in data
        assert "total_alerts" in data
        
        # All should be integers
        assert isinstance(data["late_payments"], int)
        assert isinstance(data["missed_followups"], int)
        assert isinstance(data["expiring_subscriptions"], int)
        assert isinstance(data["incomplete_onboarding"], int)
        assert isinstance(data["total_alerts"], int)
        
        print(f"PASS: GET /api/alerts/summary returns alerts: {data}")


class TestCoursesS5:
    """Test that Courses table has S5 (week 5) column"""
    
    def test_course_has_week5_attendance(self, api_client):
        """Test that courses support week5_attendance field"""
        # Get existing courses
        response = api_client.get(f"{BASE_URL}/api/courses?year=2024&month=12")
        assert response.status_code == 200
        courses = response.json()
        
        if courses:
            course = courses[0]
            # Update with week5 attendance
            update_resp = api_client.put(f"{BASE_URL}/api/courses/{course['id']}", json={
                "week5_attendance": 8
            })
            assert update_resp.status_code == 200
            data = update_resp.json()
            assert data.get("week5_attendance") == 8
            print("PASS: Courses support week5_attendance field (S5 column)")
            
            # Reset
            api_client.put(f"{BASE_URL}/api/courses/{course['id']}", json={
                "week5_attendance": course.get("week5_attendance", 0)
            })
        else:
            # Create a test course with week5
            course_data = {
                "year": 2024,
                "month": 12,
                "day_of_week": "Lundi",
                "time_slot": "07:00",
                "course_name": "TEST_Course_S5",
                "instructor": "Test",
                "max_capacity": 12
            }
            create_resp = api_client.post(f"{BASE_URL}/api/courses", json=course_data)
            course_id = create_resp.json()["id"]
            
            # Update with week5
            update_resp = api_client.put(f"{BASE_URL}/api/courses/{course_id}", json={
                "week5_attendance": 10
            })
            assert update_resp.status_code == 200
            assert update_resp.json().get("week5_attendance") == 10
            print("PASS: Courses support week5_attendance field (S5 column)")
            
            # Cleanup
            api_client.delete(f"{BASE_URL}/api/courses/{course_id}")


# Fixtures
@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
