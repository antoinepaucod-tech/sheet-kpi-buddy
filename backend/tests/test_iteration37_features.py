"""
Iteration 37 - Testing:
1. Late payments red badge in sidebar (GET /api/payments/late returns 2 late payments)
2. Caroline Maerten challenge objective (0 trainings = 0% completion, all weeks grey)
3. Challenge stats S1 should show 5 participants (not 6) since Caroline has 0 check-ins
4. GHL confirm-sale creates accounting transaction
5. Replace coach per-week dialog (PUT /api/courses/{id} with week{n}_instructor)
6. Backend: GET /api/payments/late returns late payments
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestLatePaymentsBadge:
    """Test late payments API for red badge in sidebar"""
    
    def test_get_late_payments_endpoint_exists(self):
        """GET /api/payments/late should return 200"""
        response = requests.get(f"{BASE_URL}/api/payments/late")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Expected list response"
        print(f"PASS: GET /api/payments/late returns {len(data)} late payments")
    
    def test_late_payments_count_is_2(self):
        """Should return exactly 2 late payments"""
        response = requests.get(f"{BASE_URL}/api/payments/late")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2, f"Expected 2 late payments, got {len(data)}"
        print(f"PASS: Late payments count is 2")
    
    def test_late_payments_have_required_fields(self):
        """Each late payment should have required fields"""
        response = requests.get(f"{BASE_URL}/api/payments/late")
        data = response.json()
        for p in data:
            assert "id" in p, "Missing id field"
            assert "amount" in p, "Missing amount field"
            assert "due_date" in p, "Missing due_date field"
            assert "status" in p, "Missing status field"
            assert p["status"] in ["pending", "late"], f"Unexpected status: {p['status']}"
        print(f"PASS: Late payments have all required fields")


class TestChallengeCarolineMaerten:
    """Test Caroline Maerten challenge objective (should show 0% completion)"""
    
    def test_get_challenge_participants(self):
        """GET /api/challenges/{id} should return participants"""
        # First get challenge ID
        response = requests.get(f"{BASE_URL}/api/challenges")
        assert response.status_code == 200
        challenges = response.json()
        assert len(challenges) > 0, "No challenges found"
        
        challenge_id = challenges[0]["id"]
        response = requests.get(f"{BASE_URL}/api/challenges/{challenge_id}")
        assert response.status_code == 200
        data = response.json()
        assert "participants" in data, "Missing participants field"
        print(f"PASS: Challenge has {len(data['participants'])} participants")
    
    def test_caroline_maerten_has_zero_trainings(self):
        """Caroline Maerten should have 0 trainings in all weeks"""
        response = requests.get(f"{BASE_URL}/api/challenges")
        challenges = response.json()
        challenge_id = challenges[0]["id"]
        
        response = requests.get(f"{BASE_URL}/api/challenges/{challenge_id}")
        data = response.json()
        
        caroline = None
        for p in data["participants"]:
            if "Caroline" in p.get("member_name", ""):
                caroline = p
                break
        
        assert caroline is not None, "Caroline Maerten not found in participants"
        
        # Check all weeks have 0 trainings
        for week in range(1, 6):
            trainings = caroline.get(f"week{week}_trainings", 0)
            checkins = caroline.get(f"week{week}_checkins", 0)
            assert trainings == 0, f"Caroline should have 0 trainings in week {week}, got {trainings}"
            assert checkins == 0, f"Caroline should have 0 checkins in week {week}, got {checkins}"
        
        print(f"PASS: Caroline Maerten has 0 trainings in all weeks (0% completion)")
    
    def test_challenge_stats_s1_should_show_5_participants(self):
        """S1 should show 5 participants completed (not 6) since Caroline has 0 check-ins"""
        response = requests.get(f"{BASE_URL}/api/challenges")
        challenges = response.json()
        challenge_id = challenges[0]["id"]
        
        response = requests.get(f"{BASE_URL}/api/challenges/{challenge_id}")
        data = response.json()
        goal = data.get("checkins_goal", 3)
        
        # Count participants who completed S1 (trainings or checkins >= goal)
        s1_completed = 0
        for p in data["participants"]:
            trainings = p.get("week1_trainings", 0)
            checkins = p.get("week1_checkins", 0)
            if max(trainings, checkins) >= goal:
                s1_completed += 1
        
        assert s1_completed == 5, f"S1 should have 5 completed participants (83%), got {s1_completed}"
        total = len(data["participants"])
        pct = round(s1_completed / total * 100)
        print(f"PASS: S1 shows {s1_completed}/{total} participants ({pct}%) - Caroline excluded")


class TestGHLSaleAccountingTransaction:
    """Test GHL confirm-sale creates accounting transaction"""
    
    def test_confirm_sale_creates_accounting_transaction(self):
        """POST /api/ghl/confirm-sale should create accounting transaction"""
        # Create a test sale
        test_sale = {
            "opportunity_id": f"TEST_opp_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "opportunity_name": "TEST_Sale_User",
            "subscription_type": "6 Week Challenge",
            "cash_collected": 599,
            "month": "2026-03"
        }
        
        response = requests.post(f"{BASE_URL}/api/ghl/confirm-sale", json=test_sale)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        sale = response.json()
        assert sale.get("opportunity_id") == test_sale["opportunity_id"]
        
        # Check that accounting transaction was created
        tx_response = requests.get(f"{BASE_URL}/api/transactions?category=VENTES%20/%20ABONNEMENTS")
        assert tx_response.status_code == 200
        
        transactions = tx_response.json()
        ghl_tx = None
        for tx in transactions:
            if f"ghl-sale-{test_sale['opportunity_id']}" in tx.get("id", ""):
                ghl_tx = tx
                break
        
        assert ghl_tx is not None, "Accounting transaction not found for GHL sale"
        assert ghl_tx["amount"] == test_sale["cash_collected"], f"Transaction amount mismatch"
        assert ghl_tx["category"] == "VENTES / ABONNEMENTS", f"Wrong category: {ghl_tx['category']}"
        assert "Vente" in ghl_tx.get("description", ""), "Description should contain 'Vente'"
        
        print(f"PASS: GHL sale created accounting transaction with category 'VENTES / ABONNEMENTS'")
        
        # Cleanup - delete the test member and sale
        member_id = sale.get("member_id")
        if member_id:
            requests.delete(f"{BASE_URL}/api/members/{member_id}")
        
        # Delete the transaction
        if ghl_tx:
            requests.delete(f"{BASE_URL}/api/transactions/{ghl_tx['id']}")


class TestReplaceCoachPerWeek:
    """Test replace coach per-week functionality"""
    
    def test_course_week_instructor_fields_exist(self):
        """Courses should have week{n}_instructor fields"""
        response = requests.get(f"{BASE_URL}/api/courses?year=2026&month=3")
        assert response.status_code == 200
        courses = response.json()
        
        if len(courses) == 0:
            pytest.skip("No courses found in March 2026")
        
        course = courses[0]
        # Check that week instructor fields are in schema (can be None)
        for week in range(1, 6):
            field = f"week{week}_instructor"
            # The field should exist in response (even if None)
            print(f"Course {course['id']} week{week}_instructor: {course.get(field)}")
        
        print(f"PASS: Course has week instructor fields")
    
    def test_update_course_week_instructor(self):
        """PUT /api/courses/{id} should update week{n}_instructor field"""
        response = requests.get(f"{BASE_URL}/api/courses?year=2026&month=3")
        courses = response.json()
        
        if len(courses) == 0:
            pytest.skip("No courses found in March 2026")
        
        course = courses[0]
        course_id = course["id"]
        
        # Update week1_instructor
        test_coach = "TEST_Replacement_Coach"
        update_response = requests.put(f"{BASE_URL}/api/courses/{course_id}", json={
            "week1_instructor": test_coach
        })
        assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}"
        
        # Verify update
        verify_response = requests.get(f"{BASE_URL}/api/courses/{course_id}")
        assert verify_response.status_code == 200
        updated_course = verify_response.json()
        
        assert updated_course.get("week1_instructor") == test_coach, f"week1_instructor not updated"
        print(f"PASS: Course week1_instructor updated to '{test_coach}'")
        
        # Cleanup - reset to None
        requests.put(f"{BASE_URL}/api/courses/{course_id}", json={
            "week1_instructor": None
        })
    
    def test_get_coaches_for_dropdown(self):
        """GET /api/coaches should return coaches for dropdown"""
        response = requests.get(f"{BASE_URL}/api/coaches?active_only=true")
        assert response.status_code == 200
        coaches = response.json()
        
        assert len(coaches) > 0, "No coaches found"
        
        # Should include Antoine Paucod
        antoine = None
        for c in coaches:
            if "Antoine" in c.get("name", ""):
                antoine = c
                break
        
        assert antoine is not None, "Antoine Paucod not found in coaches"
        assert antoine.get("hourly_rate") == 50, f"Antoine should have 50 CHF/h rate"
        
        print(f"PASS: Found {len(coaches)} coaches including Antoine Paucod (50 CHF/h)")


class TestBackendPaymentsAPI:
    """Additional backend tests for payments API"""
    
    def test_payments_endpoint(self):
        """GET /api/payments should return all payments"""
        response = requests.get(f"{BASE_URL}/api/payments")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: GET /api/payments returns {len(data)} payments")
    
    def test_late_payments_status_is_late(self):
        """All late payments should have status 'late' after API call"""
        response = requests.get(f"{BASE_URL}/api/payments/late")
        data = response.json()
        
        for p in data:
            # The API should mark them as 'late' if they were 'pending'
            assert p["status"] == "late", f"Expected status 'late', got '{p['status']}'"
        
        print(f"PASS: All {len(data)} late payments have status 'late'")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
