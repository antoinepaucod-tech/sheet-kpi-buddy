"""
Iteration 10 Tests: Billing Cycle & Annual Review Features

Tests:
1. Member creation with billing_cycle_type and billing_cycle_value
2. Auto-creation of payment_schedule when billing_enabled=true
3. Auto-creation of annual_review when annual_review_enabled=true
4. Member update with billing cycle changes
5. Simple renewal (without billing cycle update)
6. Renewal with billing cycle modification
7. Auto-creation of new annual_review on renewal if annual_review_enabled
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestMemberCreationWithBillingCycle:
    """Test member creation with billing cycle fields"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.api = requests.Session()
        self.api.headers.update({"Content-Type": "application/json"})
        self.created_member_id = None
        yield
        # Cleanup
        if self.created_member_id:
            self.api.delete(f"{BASE_URL}/api/members/{self.created_member_id}")
    
    def test_create_member_with_monthly_day_billing(self):
        """Test creating member with monthly_day billing cycle"""
        today = datetime.now()
        member_data = {
            "name": "TEST_BillingMember_Monthly",
            "email": "test_billing_monthly@example.com",
            "phone": "+41 79 111 1111",
            "membership": "Annuel",
            "member_type": "Membres Généraux Récurrents",
            "contract_signed_date": today.strftime("%Y-%m-%d"),
            "subscription_end_date": (today + timedelta(days=365)).strftime("%Y-%m-%d"),
            "cash_collected": 0,
            "billing_enabled": True,
            "billing_amount": 150.0,
            "billing_cycle_type": "monthly_day",
            "billing_cycle_value": 15,  # 15th of each month
            "billing_payment_method": "prelevement",
            "annual_review_enabled": False
        }
        
        response = self.api.post(f"{BASE_URL}/api/members", json=member_data)
        assert response.status_code == 200, f"Failed to create member: {response.text}"
        
        data = response.json()
        self.created_member_id = data.get("id")
        
        # Verify member data
        assert data["name"] == member_data["name"]
        assert data["billing_enabled"] == True
        assert data["billing_amount"] == 150.0
        assert data["billing_cycle_type"] == "monthly_day"
        assert data["billing_cycle_value"] == 15
        assert data["billing_payment_method"] == "prelevement"
        print(f"✓ Member created with monthly_day billing cycle (day 15): {data['id']}")
    
    def test_create_member_with_interval_days_billing(self):
        """Test creating member with interval_days billing cycle"""
        today = datetime.now()
        member_data = {
            "name": "TEST_BillingMember_Interval",
            "email": "test_billing_interval@example.com",
            "phone": "+41 79 222 2222",
            "membership": "Annuel",
            "member_type": "Membres PT",
            "contract_signed_date": today.strftime("%Y-%m-%d"),
            "subscription_end_date": (today + timedelta(days=365)).strftime("%Y-%m-%d"),
            "cash_collected": 0,
            "billing_enabled": True,
            "billing_amount": 200.0,
            "billing_cycle_type": "interval_days",
            "billing_cycle_value": 28,  # Every 28 days
            "billing_payment_method": "carte",
            "annual_review_enabled": False
        }
        
        response = self.api.post(f"{BASE_URL}/api/members", json=member_data)
        assert response.status_code == 200, f"Failed to create member: {response.text}"
        
        data = response.json()
        self.created_member_id = data.get("id")
        
        # Verify member data
        assert data["billing_cycle_type"] == "interval_days"
        assert data["billing_cycle_value"] == 28
        print(f"✓ Member created with interval_days billing cycle (28 days): {data['id']}")


class TestPaymentScheduleAutoCreation:
    """Test automatic payment_schedule creation when billing_enabled=true"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.api = requests.Session()
        self.api.headers.update({"Content-Type": "application/json"})
        self.created_member_id = None
        yield
        # Cleanup
        if self.created_member_id:
            # Delete payment schedules first
            schedules_resp = self.api.get(f"{BASE_URL}/api/payment-schedules?member_id={self.created_member_id}")
            if schedules_resp.status_code == 200:
                for sched in schedules_resp.json():
                    self.api.delete(f"{BASE_URL}/api/payment-schedules/{sched['id']}")
            self.api.delete(f"{BASE_URL}/api/members/{self.created_member_id}")
    
    def test_payment_schedule_created_on_member_creation(self):
        """Test that payment_schedule is auto-created when billing_enabled=true"""
        today = datetime.now()
        member_data = {
            "name": "TEST_ScheduleAutoCreate",
            "email": "test_schedule@example.com",
            "membership": "Annuel",
            "member_type": "Membres Généraux Récurrents",
            "contract_signed_date": today.strftime("%Y-%m-%d"),
            "subscription_end_date": (today + timedelta(days=365)).strftime("%Y-%m-%d"),
            "billing_enabled": True,
            "billing_amount": 99.0,
            "billing_cycle_type": "monthly_day",
            "billing_cycle_value": 5,
            "billing_payment_method": "virement",
            "annual_review_enabled": False
        }
        
        response = self.api.post(f"{BASE_URL}/api/members", json=member_data)
        assert response.status_code == 200, f"Failed to create member: {response.text}"
        
        data = response.json()
        self.created_member_id = data.get("id")
        
        # Check payment schedule was created
        schedules_resp = self.api.get(f"{BASE_URL}/api/payment-schedules?member_id={self.created_member_id}")
        assert schedules_resp.status_code == 200
        
        schedules = schedules_resp.json()
        assert len(schedules) >= 1, "No payment schedule created"
        
        schedule = schedules[0]
        assert schedule["member_id"] == self.created_member_id
        assert schedule["amount"] == 99.0
        assert schedule["recurrence_type"] == "monthly_day"
        assert schedule["recurrence_value"] == 5
        assert schedule["payment_method"] == "virement"
        assert schedule["is_active"] == True
        print(f"✓ Payment schedule auto-created: {schedule['id']}")
    
    def test_no_schedule_when_billing_disabled(self):
        """Test that no payment_schedule is created when billing_enabled=false"""
        today = datetime.now()
        member_data = {
            "name": "TEST_NoBillingSchedule",
            "email": "test_nobilling@example.com",
            "membership": "6 Semaines",
            "member_type": "Membres PIF",
            "contract_signed_date": today.strftime("%Y-%m-%d"),
            "subscription_end_date": (today + timedelta(days=42)).strftime("%Y-%m-%d"),
            "billing_enabled": False,
            "billing_amount": 0,
            "annual_review_enabled": False
        }
        
        response = self.api.post(f"{BASE_URL}/api/members", json=member_data)
        assert response.status_code == 200
        
        data = response.json()
        self.created_member_id = data.get("id")
        
        # Check no payment schedule was created
        schedules_resp = self.api.get(f"{BASE_URL}/api/payment-schedules?member_id={self.created_member_id}")
        assert schedules_resp.status_code == 200
        
        schedules = schedules_resp.json()
        assert len(schedules) == 0, "Payment schedule should not be created when billing_enabled=false"
        print("✓ No payment schedule created when billing_enabled=false")


class TestAnnualReviewAutoCreation:
    """Test automatic annual_review creation when annual_review_enabled=true"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.api = requests.Session()
        self.api.headers.update({"Content-Type": "application/json"})
        self.created_member_id = None
        yield
        # Cleanup
        if self.created_member_id:
            # Delete annual reviews first
            reviews_resp = self.api.get(f"{BASE_URL}/api/annual-reviews?member_id={self.created_member_id}")
            if reviews_resp.status_code == 200:
                for review in reviews_resp.json():
                    self.api.delete(f"{BASE_URL}/api/annual-reviews/{review['id']}")
            # Delete payment schedules
            schedules_resp = self.api.get(f"{BASE_URL}/api/payment-schedules?member_id={self.created_member_id}")
            if schedules_resp.status_code == 200:
                for sched in schedules_resp.json():
                    self.api.delete(f"{BASE_URL}/api/payment-schedules/{sched['id']}")
            self.api.delete(f"{BASE_URL}/api/members/{self.created_member_id}")
    
    def test_annual_review_created_on_member_creation(self):
        """Test that annual_review is auto-created when annual_review_enabled=true"""
        today = datetime.now()
        contract_date = today.strftime("%Y-%m-%d")
        
        member_data = {
            "name": "TEST_AnnualReviewMember",
            "email": "test_annual_review@example.com",
            "membership": "Annuel",
            "member_type": "Membres PT",
            "contract_signed_date": contract_date,
            "subscription_end_date": (today + timedelta(days=365)).strftime("%Y-%m-%d"),
            "billing_enabled": False,
            "annual_review_enabled": True
        }
        
        response = self.api.post(f"{BASE_URL}/api/members", json=member_data)
        assert response.status_code == 200, f"Failed to create member: {response.text}"
        
        data = response.json()
        self.created_member_id = data.get("id")
        
        # Check annual_review_date is set (1 year from contract date)
        assert "annual_review_date" in data
        expected_review_date = (today + timedelta(days=365)).strftime("%Y-%m-%d")
        assert data["annual_review_date"] == expected_review_date, f"Expected {expected_review_date}, got {data.get('annual_review_date')}"
        
        # Check annual review record was created
        reviews_resp = self.api.get(f"{BASE_URL}/api/annual-reviews?member_id={self.created_member_id}")
        assert reviews_resp.status_code == 200
        
        reviews = reviews_resp.json()
        assert len(reviews) >= 1, "No annual review created"
        
        review = reviews[0]
        assert review["member_id"] == self.created_member_id
        assert review["review_date"] == expected_review_date
        assert review["status"] == "scheduled"
        print(f"✓ Annual review auto-created for {expected_review_date}: {review['id']}")
    
    def test_no_annual_review_when_disabled(self):
        """Test that no annual_review is created when annual_review_enabled=false"""
        today = datetime.now()
        member_data = {
            "name": "TEST_NoAnnualReview",
            "email": "test_no_annual@example.com",
            "membership": "Mensuel",
            "member_type": "Membres Généraux Récurrents",
            "contract_signed_date": today.strftime("%Y-%m-%d"),
            "subscription_end_date": (today + timedelta(days=30)).strftime("%Y-%m-%d"),
            "billing_enabled": False,
            "annual_review_enabled": False
        }
        
        response = self.api.post(f"{BASE_URL}/api/members", json=member_data)
        assert response.status_code == 200
        
        data = response.json()
        self.created_member_id = data.get("id")
        
        # Check no annual review was created
        reviews_resp = self.api.get(f"{BASE_URL}/api/annual-reviews?member_id={self.created_member_id}")
        assert reviews_resp.status_code == 200
        
        reviews = reviews_resp.json()
        assert len(reviews) == 0, "Annual review should not be created when annual_review_enabled=false"
        print("✓ No annual review created when annual_review_enabled=false")


class TestMemberUpdateBillingCycle:
    """Test member update with billing cycle modifications"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.api = requests.Session()
        self.api.headers.update({"Content-Type": "application/json"})
        self.created_member_id = None
        yield
        # Cleanup
        if self.created_member_id:
            schedules_resp = self.api.get(f"{BASE_URL}/api/payment-schedules?member_id={self.created_member_id}")
            if schedules_resp.status_code == 200:
                for sched in schedules_resp.json():
                    self.api.delete(f"{BASE_URL}/api/payment-schedules/{sched['id']}")
            self.api.delete(f"{BASE_URL}/api/members/{self.created_member_id}")
    
    def test_update_billing_cycle(self):
        """Test updating member billing cycle"""
        today = datetime.now()
        
        # Create member
        create_data = {
            "name": "TEST_UpdateBilling",
            "email": "test_update_billing@example.com",
            "membership": "Annuel",
            "member_type": "Membres Généraux Récurrents",
            "contract_signed_date": today.strftime("%Y-%m-%d"),
            "subscription_end_date": (today + timedelta(days=365)).strftime("%Y-%m-%d"),
            "billing_enabled": True,
            "billing_amount": 100.0,
            "billing_cycle_type": "monthly_day",
            "billing_cycle_value": 1,
            "billing_payment_method": "prelevement",
            "annual_review_enabled": False
        }
        
        response = self.api.post(f"{BASE_URL}/api/members", json=create_data)
        assert response.status_code == 200
        data = response.json()
        self.created_member_id = data.get("id")
        
        # Update billing cycle
        update_data = {
            **create_data,
            "billing_amount": 120.0,
            "billing_cycle_type": "interval_days",
            "billing_cycle_value": 30,
            "billing_payment_method": "carte"
        }
        
        response = self.api.put(f"{BASE_URL}/api/members/{self.created_member_id}", json=update_data)
        assert response.status_code == 200
        
        updated = response.json()
        assert updated["billing_amount"] == 120.0
        assert updated["billing_cycle_type"] == "interval_days"
        assert updated["billing_cycle_value"] == 30
        assert updated["billing_payment_method"] == "carte"
        
        # Verify payment schedule was updated
        schedules_resp = self.api.get(f"{BASE_URL}/api/payment-schedules?member_id={self.created_member_id}")
        assert schedules_resp.status_code == 200
        schedules = schedules_resp.json()
        
        assert len(schedules) >= 1
        schedule = [s for s in schedules if s["is_active"]][0]
        assert schedule["amount"] == 120.0
        assert schedule["recurrence_type"] == "interval_days"
        assert schedule["recurrence_value"] == 30
        print("✓ Member billing cycle updated and payment schedule modified")


class TestMemberRenewal:
    """Test member renewal with and without billing cycle update"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.api = requests.Session()
        self.api.headers.update({"Content-Type": "application/json"})
        self.created_member_id = None
        yield
        # Cleanup
        if self.created_member_id:
            reviews_resp = self.api.get(f"{BASE_URL}/api/annual-reviews?member_id={self.created_member_id}")
            if reviews_resp.status_code == 200:
                for review in reviews_resp.json():
                    self.api.delete(f"{BASE_URL}/api/annual-reviews/{review['id']}")
            schedules_resp = self.api.get(f"{BASE_URL}/api/payment-schedules?member_id={self.created_member_id}")
            if schedules_resp.status_code == 200:
                for sched in schedules_resp.json():
                    self.api.delete(f"{BASE_URL}/api/payment-schedules/{sched['id']}")
            self.api.delete(f"{BASE_URL}/api/members/{self.created_member_id}")
    
    def test_simple_renewal(self):
        """Test simple renewal without billing cycle update"""
        today = datetime.now()
        old_end_date = (today + timedelta(days=30)).strftime("%Y-%m-%d")
        
        # Create member
        create_data = {
            "name": "TEST_SimpleRenewal",
            "email": "test_simple_renew@example.com",
            "membership": "Annuel",
            "member_type": "Membres Généraux Récurrents",
            "contract_signed_date": today.strftime("%Y-%m-%d"),
            "subscription_end_date": old_end_date,
            "billing_enabled": True,
            "billing_amount": 100.0,
            "billing_cycle_type": "monthly_day",
            "billing_cycle_value": 1,
            "billing_payment_method": "prelevement",
            "annual_review_enabled": False
        }
        
        response = self.api.post(f"{BASE_URL}/api/members", json=create_data)
        assert response.status_code == 200
        self.created_member_id = response.json().get("id")
        
        # Simple renewal
        new_end_date = (today + timedelta(days=395)).strftime("%Y-%m-%d")
        renew_data = {
            "new_end_date": new_end_date,
            "renewal_duration": "12 mois",
            "notes": "Simple renewal test"
        }
        
        response = self.api.post(f"{BASE_URL}/api/members/{self.created_member_id}/renew", json=renew_data)
        assert response.status_code == 200
        
        result = response.json()
        assert "member" in result
        assert result["member"]["subscription_end_date"] == new_end_date
        assert result["message"] == "Abonnement renouvelé"
        print("✓ Simple renewal completed successfully")
    
    def test_renewal_with_billing_update(self):
        """Test renewal with billing cycle modification"""
        today = datetime.now()
        old_end_date = (today + timedelta(days=30)).strftime("%Y-%m-%d")
        
        # Create member
        create_data = {
            "name": "TEST_RenewalWithBilling",
            "email": "test_renew_billing@example.com",
            "membership": "Annuel",
            "member_type": "Membres Généraux Récurrents",
            "contract_signed_date": today.strftime("%Y-%m-%d"),
            "subscription_end_date": old_end_date,
            "billing_enabled": True,
            "billing_amount": 80.0,
            "billing_cycle_type": "monthly_day",
            "billing_cycle_value": 10,
            "billing_payment_method": "prelevement",
            "annual_review_enabled": False
        }
        
        response = self.api.post(f"{BASE_URL}/api/members", json=create_data)
        assert response.status_code == 200
        self.created_member_id = response.json().get("id")
        
        # Renewal with billing update
        new_end_date = (today + timedelta(days=395)).strftime("%Y-%m-%d")
        renew_data = {
            "new_end_date": new_end_date,
            "renewal_duration": "12 mois",
            "notes": "Renewal with billing update",
            "billing_cycle_type": "interval_days",
            "billing_cycle_value": 28,
            "billing_amount": 95.0,
            "billing_payment_method": "carte"
        }
        
        response = self.api.post(f"{BASE_URL}/api/members/{self.created_member_id}/renew", json=renew_data)
        assert response.status_code == 200
        
        result = response.json()
        member = result["member"]
        
        # Verify member billing was updated
        assert member["billing_cycle_type"] == "interval_days"
        assert member["billing_cycle_value"] == 28
        assert member["billing_amount"] == 95.0
        assert member["billing_payment_method"] == "carte"
        
        # Verify payment schedule was updated
        schedules_resp = self.api.get(f"{BASE_URL}/api/payment-schedules?member_id={self.created_member_id}")
        assert schedules_resp.status_code == 200
        schedules = schedules_resp.json()
        active_schedules = [s for s in schedules if s["is_active"]]
        
        assert len(active_schedules) >= 1
        schedule = active_schedules[0]
        assert schedule["recurrence_type"] == "interval_days"
        assert schedule["recurrence_value"] == 28
        assert schedule["amount"] == 95.0
        print("✓ Renewal with billing cycle update completed successfully")
    
    def test_renewal_creates_annual_review(self):
        """Test that renewal creates new annual_review if annual_review_enabled"""
        today = datetime.now()
        old_end_date = (today + timedelta(days=30)).strftime("%Y-%m-%d")
        
        # Create member with annual_review_enabled
        create_data = {
            "name": "TEST_RenewalAnnualReview",
            "email": "test_renew_annual@example.com",
            "membership": "Annuel",
            "member_type": "Membres PT",
            "contract_signed_date": today.strftime("%Y-%m-%d"),
            "subscription_end_date": old_end_date,
            "billing_enabled": False,
            "annual_review_enabled": True
        }
        
        response = self.api.post(f"{BASE_URL}/api/members", json=create_data)
        assert response.status_code == 200
        self.created_member_id = response.json().get("id")
        
        # Get initial annual reviews count
        initial_reviews = self.api.get(f"{BASE_URL}/api/annual-reviews?member_id={self.created_member_id}").json()
        initial_count = len(initial_reviews)
        
        # Renewal
        new_end_date = (today + timedelta(days=395)).strftime("%Y-%m-%d")
        renew_data = {
            "new_end_date": new_end_date,
            "renewal_duration": "12 mois"
        }
        
        response = self.api.post(f"{BASE_URL}/api/members/{self.created_member_id}/renew", json=renew_data)
        assert response.status_code == 200
        
        # Check new annual review was created
        reviews_resp = self.api.get(f"{BASE_URL}/api/annual-reviews?member_id={self.created_member_id}")
        assert reviews_resp.status_code == 200
        reviews = reviews_resp.json()
        
        assert len(reviews) > initial_count, "New annual review should be created on renewal"
        
        # Find the new review (scheduled for new_end_date)
        new_review = next((r for r in reviews if r["review_date"] == new_end_date and r["status"] == "scheduled"), None)
        assert new_review is not None, f"Should have annual review scheduled for {new_end_date}"
        print(f"✓ New annual review created on renewal: {new_review['id']}")


class TestRenewalHistory:
    """Test member renewal history tracking"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.api = requests.Session()
        self.api.headers.update({"Content-Type": "application/json"})
        self.created_member_id = None
        yield
        # Cleanup
        if self.created_member_id:
            self.api.delete(f"{BASE_URL}/api/members/{self.created_member_id}")
    
    def test_renewal_history_recorded(self):
        """Test that renewal history is recorded"""
        today = datetime.now()
        old_end_date = (today + timedelta(days=30)).strftime("%Y-%m-%d")
        
        # Create member
        create_data = {
            "name": "TEST_RenewalHistory",
            "email": "test_history@example.com",
            "membership": "Annuel",
            "member_type": "Membres Généraux Récurrents",
            "contract_signed_date": today.strftime("%Y-%m-%d"),
            "subscription_end_date": old_end_date,
            "billing_enabled": False,
            "annual_review_enabled": False
        }
        
        response = self.api.post(f"{BASE_URL}/api/members", json=create_data)
        assert response.status_code == 200
        self.created_member_id = response.json().get("id")
        
        # Renew
        new_end_date = (today + timedelta(days=395)).strftime("%Y-%m-%d")
        renew_data = {
            "new_end_date": new_end_date,
            "renewal_duration": "12 mois",
            "notes": "Test renewal history"
        }
        
        response = self.api.post(f"{BASE_URL}/api/members/{self.created_member_id}/renew", json=renew_data)
        assert response.status_code == 200
        
        # Check renewal history
        history_resp = self.api.get(f"{BASE_URL}/api/members/{self.created_member_id}/renewals")
        assert history_resp.status_code == 200
        
        history = history_resp.json()
        assert len(history) >= 1, "Renewal history should be recorded"
        
        renewal = history[0]
        assert renewal["member_id"] == self.created_member_id
        assert renewal["previous_end_date"] == old_end_date
        assert renewal["new_end_date"] == new_end_date
        assert renewal["renewal_duration"] == "12 mois"
        print(f"✓ Renewal history recorded: {renewal['id']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
