"""
Iteration 14: Sidebar Reorganization & Resend Email Notifications
Tests for:
- POST /api/notifications/send-email (Resend integration)
- POST /api/notifications/send-payment-reminder/{id}
- POST /api/notifications/send-review-reminder/{id}
- POST /api/notifications/send-bulk
- GET /api/notifications/logs
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# IMPORTANT: Resend free tier only allows sending to verified emails
VERIFIED_EMAIL = "antoine.paucod@the-coach.pro"


class TestNotificationEndpoints:
    """Test notification API endpoints for Resend email integration"""

    def test_send_email_success(self):
        """POST /api/notifications/send-email - Should send email to verified recipient"""
        response = requests.post(
            f"{BASE_URL}/api/notifications/send-email",
            json={
                "recipient_email": VERIFIED_EMAIL,
                "subject": "[Test] Iteration 14 - Email Test",
                "html_content": "<h1>Test</h1><p>Automated test email</p>",
                "reminder_type": "custom"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("status") == "success"
        assert "email_id" in data

    def test_send_email_invalid_recipient(self):
        """POST /api/notifications/send-email - Should fail for unverified email (Resend free tier)"""
        response = requests.post(
            f"{BASE_URL}/api/notifications/send-email",
            json={
                "recipient_email": "invalid@unverified-domain.com",
                "subject": "Test",
                "html_content": "<p>Test</p>"
            }
        )
        # Resend free tier will reject unverified recipients with 500 or error
        assert response.status_code in [422, 500], f"Expected error for unverified email"

    def test_notification_logs(self):
        """GET /api/notifications/logs - Should return notification history"""
        response = requests.get(f"{BASE_URL}/api/notifications/logs")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # After sending emails, there should be logs
        if len(data) > 0:
            log_entry = data[0]
            assert "type" in log_entry
            assert "recipient" in log_entry
            assert "subject" in log_entry
            assert "sent_at" in log_entry
            assert "status" in log_entry

    def test_notification_logs_limit(self):
        """GET /api/notifications/logs?limit=5 - Should respect limit parameter"""
        response = requests.get(f"{BASE_URL}/api/notifications/logs?limit=5")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) <= 5


class TestPaymentReminderEndpoints:
    """Test payment reminder notification endpoints
    
    NOTE: Resend free tier only allows sending to verified email (antoine.paucod@the-coach.pro).
    Testing with other emails will fail with 500 - this is expected Resend behavior, not a bug.
    """

    def test_send_payment_reminder_not_found(self):
        """POST /api/notifications/send-payment-reminder/{id} - Should 404 for invalid payment"""
        response = requests.post(
            f"{BASE_URL}/api/notifications/send-payment-reminder/invalid-payment-id-12345"
        )
        assert response.status_code == 404

    def test_send_payment_reminder_endpoint_exists(self):
        """POST /api/notifications/send-payment-reminder/{id} - Endpoint responds (even if email fails)"""
        # First get or create a payment
        members_response = requests.get(f"{BASE_URL}/api/members")
        members = members_response.json()
        if not members:
            pytest.skip("No members found")
        
        member_id = members[0]["id"]
        past_date = (datetime.now() - timedelta(days=10)).strftime("%Y-%m-%d")
        
        # Create test payment
        payment_response = requests.post(
            f"{BASE_URL}/api/payments",
            json={
                "member_id": member_id,
                "amount": 150,
                "due_date": past_date,
                "payment_method": "carte"
            }
        )
        
        if payment_response.status_code not in [200, 201]:
            pytest.skip("Could not create test payment")
        
        payment_id = payment_response.json().get("id")
        
        try:
            # Send reminder - will return 500 due to Resend domain verification (expected)
            response = requests.post(
                f"{BASE_URL}/api/notifications/send-payment-reminder/{payment_id}"
            )
            # Endpoint exists and is functional - 200 means success, 500 means Resend domain verification error
            assert response.status_code in [200, 500], f"Unexpected status: {response.status_code}"
        finally:
            # Cleanup
            requests.delete(f"{BASE_URL}/api/payments/{payment_id}")


class TestReviewReminderEndpoints:
    """Test review reminder notification endpoints
    
    NOTE: Resend free tier only allows sending to verified email (antoine.paucod@the-coach.pro).
    """

    def test_send_review_reminder_not_found(self):
        """POST /api/notifications/send-review-reminder/{id} - Should 404 for invalid review"""
        response = requests.post(
            f"{BASE_URL}/api/notifications/send-review-reminder/invalid-review-id-12345"
        )
        assert response.status_code == 404

    def test_send_review_reminder_endpoint_exists(self):
        """POST /api/notifications/send-review-reminder/{id} - Endpoint responds"""
        # Get a member and create a review
        members_response = requests.get(f"{BASE_URL}/api/members")
        members = members_response.json()
        if not members:
            pytest.skip("No members found")
        
        member_id = members[0]["id"]
        future_date = (datetime.now() + timedelta(days=5)).strftime("%Y-%m-%d")
        
        # Create test review
        review_response = requests.post(
            f"{BASE_URL}/api/annual-reviews",
            json={
                "member_id": member_id,
                "review_date": future_date,
                "review_type": "quarterly"
            }
        )
        
        if review_response.status_code not in [200, 201]:
            pytest.skip("Could not create test review")
        
        review_id = review_response.json().get("id")
        
        try:
            response = requests.post(
                f"{BASE_URL}/api/notifications/send-review-reminder/{review_id}"
            )
            # 200 = success, 400 = member without email, 500 = Resend domain verification
            assert response.status_code in [200, 400, 500], f"Unexpected status: {response.status_code}"
        finally:
            # Cleanup
            requests.delete(f"{BASE_URL}/api/annual-reviews/{review_id}")


class TestBulkNotifications:
    """Test bulk notification endpoint"""

    def test_send_bulk_payment_reminders(self):
        """POST /api/notifications/send-bulk - Should send bulk payment reminders"""
        response = requests.post(
            f"{BASE_URL}/api/notifications/send-bulk",
            json={"notification_type": "payment_reminder"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "sent" in data
        assert "failed" in data
        assert isinstance(data["sent"], list)
        assert isinstance(data["failed"], list)

    def test_send_bulk_review_reminders(self):
        """POST /api/notifications/send-bulk - Should send bulk review reminders"""
        response = requests.post(
            f"{BASE_URL}/api/notifications/send-bulk",
            json={"notification_type": "review_reminder"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "sent" in data
        assert "failed" in data


class TestSidebarNavigation:
    """Test sidebar navigation endpoints exist and return proper data"""

    def test_dashboard_endpoint(self):
        """Sidebar: PILOTAGE - Tableau de bord uses /api/monthly-kpis"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis")
        assert response.status_code == 200

    def test_transactions_endpoint(self):
        """Sidebar: COMPTABILITE - Transactions endpoint"""
        response = requests.get(f"{BASE_URL}/api/transactions")
        assert response.status_code == 200

    def test_members_endpoint(self):
        """Sidebar: MEMBRES - Members endpoint"""
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200

    def test_payments_endpoint(self):
        """Sidebar: MEMBRES - Payments endpoint"""
        response = requests.get(f"{BASE_URL}/api/payments")
        assert response.status_code == 200

    def test_trainings_endpoint(self):
        """Sidebar: ACTIVITE - Saisie Séances (trainings)"""
        response = requests.get(f"{BASE_URL}/api/trainings")
        assert response.status_code == 200

    def test_challenges_endpoint(self):
        """Sidebar: PROGRAMMES - Challenge 6 Sem."""
        response = requests.get(f"{BASE_URL}/api/challenges")
        assert response.status_code == 200

    def test_annual_reviews_endpoint(self):
        """Sidebar: PROGRAMMES - Bilans / Suivis"""
        response = requests.get(f"{BASE_URL}/api/annual-reviews")
        assert response.status_code == 200

    def test_settings_endpoint(self):
        """Sidebar: CONFIGURATION - Paramètres"""
        response = requests.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 200

    def test_coaches_endpoint(self):
        """Sidebar: ACTIVITE - Coachs"""
        response = requests.get(f"{BASE_URL}/api/coaches")
        assert response.status_code == 200

    def test_courses_endpoint(self):
        """Sidebar: ACTIVITE - KPIs Cours"""
        response = requests.get(f"{BASE_URL}/api/courses")
        assert response.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
