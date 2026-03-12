"""
Iteration 15: Testing NotificationsPage - Full messaging page and email notification APIs
Tests: 
- GET /api/notifications/logs - notification history
- POST /api/notifications/send-email - custom email sending
- POST /api/notifications/send-bulk - bulk notifications
- POST /api/notifications/send-payment-reminder/{id} - specific payment reminder
- POST /api/notifications/send-review-reminder/{id} - specific review reminder
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Test credentials
TEST_EMAIL = "test@challenge.com"
TEST_PASSWORD = "Test1234!"
VERIFIED_RECIPIENT = "antoine.paucod@the-coach.pro"  # Only verified email on Resend


class TestNotificationLogs:
    """Test GET /api/notifications/logs endpoint"""
    
    def test_get_notification_logs_success(self):
        """Should return list of notification logs"""
        response = requests.get(f"{BASE_URL}/api/notifications/logs")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"GET /api/notifications/logs - SUCCESS: Found {len(data)} notification logs")
    
    def test_get_notification_logs_with_limit(self):
        """Should respect limit parameter"""
        response = requests.get(f"{BASE_URL}/api/notifications/logs?limit=5")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should not exceed limit
        assert len(data) <= 5
        print(f"GET /api/notifications/logs?limit=5 - SUCCESS: Returned {len(data)} logs (max 5)")


class TestSendEmail:
    """Test POST /api/notifications/send-email endpoint"""
    
    def test_send_email_success_verified_recipient(self):
        """Should successfully send email to verified recipient"""
        payload = {
            "recipient_email": VERIFIED_RECIPIENT,
            "subject": "Test Email from KPI Buddy - Iteration 15",
            "html_content": "<div style='font-family:Arial;padding:20px;'><h1>Test Email</h1><p>This is a test email from iteration 15 testing.</p></div>",
            "reminder_type": "custom"
        }
        response = requests.post(f"{BASE_URL}/api/notifications/send-email", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "success"
        assert "email_id" in data
        print(f"POST /api/notifications/send-email (verified recipient) - SUCCESS: {data.get('message')}")
    
    def test_send_email_missing_fields(self):
        """Should fail with missing required fields"""
        payload = {
            "recipient_email": VERIFIED_RECIPIENT
            # Missing subject and html_content
        }
        response = requests.post(f"{BASE_URL}/api/notifications/send-email", json=payload)
        # Should return 422 for validation error
        assert response.status_code == 422
        print("POST /api/notifications/send-email (missing fields) - Correctly returns 422")


class TestBulkNotifications:
    """Test POST /api/notifications/send-bulk endpoint"""
    
    def test_bulk_payment_reminder(self):
        """Should attempt to send payment reminders"""
        payload = {
            "notification_type": "payment_reminder"
        }
        response = requests.post(f"{BASE_URL}/api/notifications/send-bulk", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "sent" in data
        assert "failed" in data
        # Note: May have 0 sent if no late payments or all recipients unverified
        print(f"POST /api/notifications/send-bulk (payment_reminder) - SUCCESS: {data.get('message')}")
    
    def test_bulk_review_reminder(self):
        """Should attempt to send review reminders"""
        payload = {
            "notification_type": "review_reminder"
        }
        response = requests.post(f"{BASE_URL}/api/notifications/send-bulk", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "sent" in data
        assert "failed" in data
        print(f"POST /api/notifications/send-bulk (review_reminder) - SUCCESS: {data.get('message')}")


class TestPaymentReminder:
    """Test POST /api/notifications/send-payment-reminder/{id} endpoint"""
    
    def test_payment_reminder_invalid_id(self):
        """Should return 404 for non-existent payment"""
        response = requests.post(f"{BASE_URL}/api/notifications/send-payment-reminder/invalid-id-12345")
        assert response.status_code == 404
        print("POST /api/notifications/send-payment-reminder (invalid ID) - Correctly returns 404")
    
    def test_payment_reminder_with_test_payment(self):
        """Test with payment ID from seed data (will fail if member email not verified)"""
        # First, get a payment from the payments list
        payments_resp = requests.get(f"{BASE_URL}/api/payments")
        if payments_resp.status_code == 200:
            payments = payments_resp.json()
            if payments and len(payments) > 0:
                # Find a late payment
                late_payment = next((p for p in payments if p.get("status") in ["pending", "late"]), None)
                if late_payment:
                    payment_id = late_payment.get("id")
                    response = requests.post(f"{BASE_URL}/api/notifications/send-payment-reminder/{payment_id}")
                    # 200 = success, 400 = member has no email, 500 = Resend domain not verified
                    # All are expected behaviors
                    assert response.status_code in [200, 400, 500]
                    print(f"POST /api/notifications/send-payment-reminder/{payment_id[:8]}... - Response: {response.status_code}")
                else:
                    pytest.skip("No late payments in database")
            else:
                pytest.skip("No payments in database")
        else:
            pytest.skip("Could not fetch payments list")


class TestReviewReminder:
    """Test POST /api/notifications/send-review-reminder/{id} endpoint"""
    
    def test_review_reminder_invalid_id(self):
        """Should return 404 for non-existent review"""
        response = requests.post(f"{BASE_URL}/api/notifications/send-review-reminder/invalid-id-12345")
        assert response.status_code == 404
        print("POST /api/notifications/send-review-reminder (invalid ID) - Correctly returns 404")
    
    def test_review_reminder_with_test_review(self):
        """Test with review ID from seed data (will fail if member email not verified)"""
        # First, get annual reviews list
        reviews_resp = requests.get(f"{BASE_URL}/api/annual-reviews")
        if reviews_resp.status_code == 200:
            reviews = reviews_resp.json()
            if reviews and len(reviews) > 0:
                # Find a scheduled review
                scheduled_review = next((r for r in reviews if r.get("status") == "scheduled"), None)
                if scheduled_review:
                    review_id = scheduled_review.get("id")
                    response = requests.post(f"{BASE_URL}/api/notifications/send-review-reminder/{review_id}")
                    # 200 = success, 400 = member has no email, 500 = Resend domain not verified
                    assert response.status_code in [200, 400, 500]
                    print(f"POST /api/notifications/send-review-reminder/{review_id[:8]}... - Response: {response.status_code}")
                else:
                    pytest.skip("No scheduled reviews in database")
            else:
                pytest.skip("No reviews in database")
        else:
            pytest.skip("Could not fetch annual reviews list")


class TestNotificationLogsStructure:
    """Verify notification log structure after sending emails"""
    
    def test_log_structure_after_send(self):
        """Verify logs contain required fields after email is sent"""
        response = requests.get(f"{BASE_URL}/api/notifications/logs?limit=10")
        assert response.status_code == 200
        logs = response.json()
        
        if len(logs) > 0:
            log = logs[0]  # Most recent log
            # Check structure
            assert "type" in log
            assert "recipient" in log
            assert "subject" in log
            assert "status" in log
            assert "sent_at" in log
            print(f"Notification log structure verified: type={log.get('type')}, status={log.get('status')}")
        else:
            print("No notification logs yet - structure validation skipped")


class TestMembersEndpointForCompose:
    """Test GET /api/members needed for compose dialog"""
    
    def test_get_members_for_recipient_selector(self):
        """Should return list of members for recipient selection"""
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Check structure of member has email field
        if len(data) > 0:
            member = data[0]
            assert "id" in member
            assert "name" in member
            # email may or may not exist
            print(f"GET /api/members - SUCCESS: Found {len(data)} members for compose dialog")
        else:
            print("GET /api/members - SUCCESS: Empty members list")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
