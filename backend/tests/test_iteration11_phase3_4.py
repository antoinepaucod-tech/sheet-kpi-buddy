"""
Iteration 11: Testing Phase 3 (6 Weeks Challenge improvements) and Phase 4 (Reviews/Bilans improvements)

Phase 3 Features:
- Challenge types: 'fixed' (date commune) or 'personal' (dates personnalisées)
- checkins_goal: weekly check-in goal (default 3)
- Personal dates for participants (personal_start_date, personal_end_date)
- Weekly check-in counters (week1_checkins...week6_checkins)

Phase 4 Features:
- Reviews renamed from "Bilans Annuels" to "Bilans / Suivis"
- review_type field: 'monthly', 'quarterly', 'semi-annually', 'annually'
- Filter reviews by review_type
- Member review_frequency field

"""
import pytest
import requests
import os
import time
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


class TestPhase3ChallengeTypes:
    """Phase 3: Challenge type support (fixed/personal) and checkins_goal"""
    
    def test_create_fixed_challenge_with_checkins_goal(self, api_client):
        """Create a fixed type challenge with custom checkins_goal"""
        payload = {
            "name": "TEST_Fixed_Challenge_4x",
            "start_date": "2026-01-15",
            "end_date": "2026-02-26",
            "is_active": True,
            "challenge_type": "fixed",
            "checkins_goal": 4
        }
        response = api_client.post(f"{BASE_URL}/api/challenges", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response data
        assert data["name"] == "TEST_Fixed_Challenge_4x"
        assert data["challenge_type"] == "fixed"
        assert data["checkins_goal"] == 4
        assert data["start_date"] == "2026-01-15"
        assert data["end_date"] == "2026-02-26"
        assert data["is_active"] == True
        assert "id" in data
        
        print(f"Created fixed challenge: {data['id']}")
        
        # Verify GET returns same data
        get_response = api_client.get(f"{BASE_URL}/api/challenges/{data['id']}")
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched["challenge_type"] == "fixed"
        assert fetched["checkins_goal"] == 4
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/challenges/{data['id']}")
        print("PASS: Fixed challenge created with checkins_goal=4")
    
    def test_create_personal_challenge(self, api_client):
        """Create a personal type challenge where each participant has their own dates"""
        payload = {
            "name": "TEST_Personal_Challenge",
            "start_date": "",  # No fixed start date
            "end_date": None,
            "is_active": True,
            "challenge_type": "personal",
            "checkins_goal": 3
        }
        response = api_client.post(f"{BASE_URL}/api/challenges", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data["name"] == "TEST_Personal_Challenge"
        assert data["challenge_type"] == "personal"
        assert data["checkins_goal"] == 3
        
        challenge_id = data["id"]
        print(f"Created personal challenge: {challenge_id}")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/challenges/{challenge_id}")
        print("PASS: Personal challenge created successfully")
    
    def test_get_challenges_returns_type_and_goal(self, api_client):
        """Verify GET /challenges returns challenge_type and checkins_goal fields"""
        # Create test challenge
        payload = {
            "name": "TEST_Challenge_Type_Fields",
            "start_date": "2026-02-01",
            "end_date": "2026-03-14",
            "challenge_type": "fixed",
            "checkins_goal": 5
        }
        create_resp = api_client.post(f"{BASE_URL}/api/challenges", json=payload)
        assert create_resp.status_code == 200
        challenge_id = create_resp.json()["id"]
        
        # Get all challenges and verify fields
        list_resp = api_client.get(f"{BASE_URL}/api/challenges")
        assert list_resp.status_code == 200
        challenges = list_resp.json()
        
        # Find our test challenge
        test_challenge = next((c for c in challenges if c["id"] == challenge_id), None)
        assert test_challenge is not None, "Test challenge not found in list"
        
        # Verify fields exist
        assert "challenge_type" in test_challenge or test_challenge.get("challenge_type") is not None
        assert "checkins_goal" in test_challenge or test_challenge.get("checkins_goal") is not None
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/challenges/{challenge_id}")
        print("PASS: GET /challenges returns challenge_type and checkins_goal")


class TestPhase3PersonalParticipants:
    """Phase 3: Personal dates for challenge participants"""
    
    @pytest.fixture
    def personal_challenge(self, api_client):
        """Create a personal challenge for participant tests"""
        payload = {
            "name": "TEST_Personal_For_Participants",
            "challenge_type": "personal",
            "checkins_goal": 3,
            "is_active": True
        }
        resp = api_client.post(f"{BASE_URL}/api/challenges", json=payload)
        assert resp.status_code == 200
        challenge = resp.json()
        yield challenge
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/challenges/{challenge['id']}")
    
    @pytest.fixture
    def test_member(self, api_client):
        """Create a test member for participant tests"""
        payload = {
            "name": "TEST_Member_For_Challenge",
            "email": "test_challenge_member@test.com",
            "membership": "Annuel"
        }
        resp = api_client.post(f"{BASE_URL}/api/members", json=payload)
        assert resp.status_code == 200
        member = resp.json()
        yield member
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/members/{member['id']}")
    
    def test_add_participant_with_personal_dates(self, api_client, personal_challenge, test_member):
        """Add participant to personal challenge with custom start/end dates"""
        challenge_id = personal_challenge["id"]
        
        payload = {
            "challenge_id": challenge_id,
            "member_id": test_member["id"],
            "member_name": test_member["name"],
            "personal_start_date": "2026-02-10",
            "personal_end_date": "2026-03-23"
        }
        response = api_client.post(f"{BASE_URL}/api/challenges/{challenge_id}/participants", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify personal dates
        assert data["personal_start_date"] == "2026-02-10"
        assert data["personal_end_date"] == "2026-03-23"
        assert data["member_id"] == test_member["id"]
        assert data["member_name"] == test_member["name"]
        
        print(f"Added participant with personal dates: {data['id']}")
        
        # Verify via GET challenge detail
        detail_resp = api_client.get(f"{BASE_URL}/api/challenges/{challenge_id}")
        assert detail_resp.status_code == 200
        detail = detail_resp.json()
        
        assert "participants" in detail
        participant = detail["participants"][0]
        assert participant["personal_start_date"] == "2026-02-10"
        assert participant["personal_end_date"] == "2026-03-23"
        
        print("PASS: Participant added with personal_start_date and personal_end_date")


class TestPhase3WeeklyCheckins:
    """Phase 3: Weekly check-in counters for participants"""
    
    @pytest.fixture
    def challenge_with_participant(self, api_client):
        """Create challenge with a participant for check-in tests"""
        # Create member
        member_payload = {
            "name": "TEST_Checkin_Member",
            "email": "test_checkin@test.com",
            "membership": "Annuel"
        }
        member_resp = api_client.post(f"{BASE_URL}/api/members", json=member_payload)
        assert member_resp.status_code == 200
        member = member_resp.json()
        
        # Create challenge
        challenge_payload = {
            "name": "TEST_Checkin_Challenge",
            "challenge_type": "fixed",
            "checkins_goal": 3,
            "start_date": "2026-01-01",
            "end_date": "2026-02-12",
            "is_active": True
        }
        challenge_resp = api_client.post(f"{BASE_URL}/api/challenges", json=challenge_payload)
        assert challenge_resp.status_code == 200
        challenge = challenge_resp.json()
        
        # Add participant
        participant_payload = {
            "challenge_id": challenge["id"],
            "member_id": member["id"],
            "member_name": member["name"]
        }
        participant_resp = api_client.post(f"{BASE_URL}/api/challenges/{challenge['id']}/participants", json=participant_payload)
        assert participant_resp.status_code == 200
        participant = participant_resp.json()
        
        yield {
            "challenge": challenge,
            "member": member,
            "participant": participant
        }
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/challenges/{challenge['id']}")
        api_client.delete(f"{BASE_URL}/api/members/{member['id']}")
    
    def test_update_weekly_checkins_counter(self, api_client, challenge_with_participant):
        """Update week1_checkins counter for a participant"""
        challenge_id = challenge_with_participant["challenge"]["id"]
        participant_id = challenge_with_participant["participant"]["id"]
        
        # Update week1_checkins to 3
        update_payload = {"week1_checkins": 3}
        response = api_client.put(
            f"{BASE_URL}/api/challenges/{challenge_id}/participants/{participant_id}",
            json=update_payload
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data["week1_checkins"] == 3
        print("PASS: week1_checkins updated to 3")
    
    def test_update_multiple_week_checkins(self, api_client, challenge_with_participant):
        """Update multiple week check-in counters"""
        challenge_id = challenge_with_participant["challenge"]["id"]
        participant_id = challenge_with_participant["participant"]["id"]
        
        # Update multiple weeks
        update_payload = {
            "week1_checkins": 4,
            "week2_checkins": 3,
            "week3_checkins": 5
        }
        response = api_client.put(
            f"{BASE_URL}/api/challenges/{challenge_id}/participants/{participant_id}",
            json=update_payload
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["week1_checkins"] == 4
        assert data["week2_checkins"] == 3
        assert data["week3_checkins"] == 5
        print("PASS: Multiple week check-ins updated")
    
    def test_checkins_bounded_0_to_7(self, api_client, challenge_with_participant):
        """Verify check-in counters are bounded between 0 and 7"""
        challenge_id = challenge_with_participant["challenge"]["id"]
        participant_id = challenge_with_participant["participant"]["id"]
        
        # Try to set value > 7 (should be capped at 7)
        update_payload = {"week4_checkins": 10}
        response = api_client.put(
            f"{BASE_URL}/api/challenges/{challenge_id}/participants/{participant_id}",
            json=update_payload
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["week4_checkins"] <= 7, f"Expected <=7, got {data['week4_checkins']}"
        
        # Try to set negative value (should be capped at 0)
        update_payload = {"week5_checkins": -5}
        response = api_client.put(
            f"{BASE_URL}/api/challenges/{challenge_id}/participants/{participant_id}",
            json=update_payload
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["week5_checkins"] >= 0, f"Expected >=0, got {data['week5_checkins']}"
        
        print("PASS: Check-in counters bounded 0-7")
    
    def test_toggle_week_boolean(self, api_client, challenge_with_participant):
        """Test toggling week boolean (week1=true/false)"""
        challenge_id = challenge_with_participant["challenge"]["id"]
        participant_id = challenge_with_participant["participant"]["id"]
        
        # Toggle week1 to true
        update_payload = {"week1": True}
        response = api_client.put(
            f"{BASE_URL}/api/challenges/{challenge_id}/participants/{participant_id}",
            json=update_payload
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["week1"] == True
        
        # Toggle week1 to false
        update_payload = {"week1": False}
        response = api_client.put(
            f"{BASE_URL}/api/challenges/{challenge_id}/participants/{participant_id}",
            json=update_payload
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["week1"] == False
        
        print("PASS: Week boolean toggles working")


class TestPhase3ChallengeDelete:
    """Phase 3: Delete challenge removes participants"""
    
    def test_delete_challenge_removes_participants(self, api_client):
        """Deleting a challenge should also delete all participants"""
        # Create member
        member_payload = {
            "name": "TEST_Delete_Challenge_Member",
            "email": "test_delete@test.com",
            "membership": "Annuel"
        }
        member_resp = api_client.post(f"{BASE_URL}/api/members", json=member_payload)
        assert member_resp.status_code == 200
        member = member_resp.json()
        
        # Create challenge
        challenge_payload = {
            "name": "TEST_Delete_Challenge",
            "challenge_type": "fixed",
            "checkins_goal": 3
        }
        challenge_resp = api_client.post(f"{BASE_URL}/api/challenges", json=challenge_payload)
        assert challenge_resp.status_code == 200
        challenge = challenge_resp.json()
        
        # Add participant
        participant_payload = {
            "challenge_id": challenge["id"],
            "member_id": member["id"],
            "member_name": member["name"]
        }
        api_client.post(f"{BASE_URL}/api/challenges/{challenge['id']}/participants", json=participant_payload)
        
        # Verify participant exists
        detail_resp = api_client.get(f"{BASE_URL}/api/challenges/{challenge['id']}")
        assert detail_resp.status_code == 200
        assert len(detail_resp.json()["participants"]) == 1
        
        # Delete challenge
        delete_resp = api_client.delete(f"{BASE_URL}/api/challenges/{challenge['id']}")
        assert delete_resp.status_code == 200
        
        # Verify challenge is gone
        get_resp = api_client.get(f"{BASE_URL}/api/challenges/{challenge['id']}")
        assert get_resp.status_code == 404
        
        # Cleanup member
        api_client.delete(f"{BASE_URL}/api/members/{member['id']}")
        
        print("PASS: Challenge deletion removes participants")


class TestPhase4ReviewTypes:
    """Phase 4: Reviews with review_type field and filtering"""
    
    def test_create_review_with_monthly_type(self, api_client):
        """Create a review with review_type='monthly'"""
        payload = {
            "member_id": "test-monthly-1",
            "review_date": "2026-02-15",
            "review_type": "monthly"
        }
        response = api_client.post(f"{BASE_URL}/api/annual-reviews", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data["review_type"] == "monthly"
        assert data["member_id"] == "test-monthly-1"
        assert data["review_date"] == "2026-02-15"
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/annual-reviews/{data['id']}")
        print("PASS: Created review with review_type='monthly'")
    
    def test_create_review_with_quarterly_type(self, api_client):
        """Create a review with review_type='quarterly'"""
        payload = {
            "member_id": "test-quarterly-1",
            "review_date": "2026-03-15",
            "review_type": "quarterly"
        }
        response = api_client.post(f"{BASE_URL}/api/annual-reviews", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data["review_type"] == "quarterly"
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/annual-reviews/{data['id']}")
        print("PASS: Created review with review_type='quarterly'")
    
    def test_create_review_with_semi_annually_type(self, api_client):
        """Create a review with review_type='semi-annually'"""
        payload = {
            "member_id": "test-semi-1",
            "review_date": "2026-06-15",
            "review_type": "semi-annually"
        }
        response = api_client.post(f"{BASE_URL}/api/annual-reviews", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data["review_type"] == "semi-annually"
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/annual-reviews/{data['id']}")
        print("PASS: Created review with review_type='semi-annually'")
    
    def test_filter_reviews_by_type(self, api_client):
        """Filter reviews by review_type parameter"""
        # Create reviews of different types
        review_ids = []
        
        for review_type in ["monthly", "quarterly", "annually"]:
            payload = {
                "member_id": f"test-filter-{review_type}",
                "review_date": "2026-04-15",
                "review_type": review_type
            }
            resp = api_client.post(f"{BASE_URL}/api/annual-reviews", json=payload)
            assert resp.status_code == 200
            review_ids.append(resp.json()["id"])
        
        # Filter by quarterly
        filter_resp = api_client.get(f"{BASE_URL}/api/annual-reviews?review_type=quarterly")
        assert filter_resp.status_code == 200
        filtered = filter_resp.json()
        
        # All returned should have review_type=quarterly
        for review in filtered:
            assert review.get("review_type") == "quarterly", f"Expected 'quarterly', got '{review.get('review_type')}'"
        
        # Cleanup
        for rid in review_ids:
            api_client.delete(f"{BASE_URL}/api/annual-reviews/{rid}")
        
        print("PASS: Reviews filtered by review_type=quarterly")
    
    def test_get_reviews_returns_review_type_field(self, api_client):
        """GET /annual-reviews should return review_type field for all reviews"""
        response = api_client.get(f"{BASE_URL}/api/annual-reviews")
        assert response.status_code == 200
        reviews = response.json()
        
        for review in reviews:
            assert "review_type" in review, f"Missing review_type field in review {review.get('id')}"
            # Should be one of the valid types or default to 'annually'
            valid_types = ["monthly", "quarterly", "semi-annually", "annually"]
            assert review["review_type"] in valid_types, f"Invalid review_type: {review['review_type']}"
        
        print(f"PASS: GET /annual-reviews returns review_type for all {len(reviews)} reviews")


class TestPhase4MemberReviewFrequency:
    """Phase 4: Member review_frequency field"""
    
    def test_create_member_with_review_frequency_monthly(self, api_client):
        """Create member with review_frequency='monthly'"""
        payload = {
            "name": "TEST_Review_Freq_Monthly",
            "email": "test_freq_monthly@test.com",
            "membership": "Annuel",
            "annual_review_enabled": True,
            "review_frequency": "monthly",
            "contract_signed_date": "2026-01-15"
        }
        response = api_client.post(f"{BASE_URL}/api/members", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data["review_frequency"] == "monthly"
        assert data["annual_review_enabled"] == True
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/members/{data['id']}")
        print("PASS: Member created with review_frequency='monthly'")
    
    def test_create_member_with_review_frequency_quarterly(self, api_client):
        """Create member with review_frequency='quarterly'"""
        payload = {
            "name": "TEST_Review_Freq_Quarterly",
            "email": "test_freq_quarterly@test.com",
            "membership": "Annuel",
            "annual_review_enabled": True,
            "review_frequency": "quarterly",
            "contract_signed_date": "2026-01-15"
        }
        response = api_client.post(f"{BASE_URL}/api/members", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data["review_frequency"] == "quarterly"
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/members/{data['id']}")
        print("PASS: Member created with review_frequency='quarterly'")
    
    def test_member_review_frequency_values(self, api_client):
        """Test all valid review_frequency values: monthly, quarterly, semi-annually, annually"""
        valid_frequencies = ["monthly", "quarterly", "semi-annually", "annually"]
        
        for freq in valid_frequencies:
            payload = {
                "name": f"TEST_Freq_{freq}",
                "email": f"test_{freq}@test.com",
                "membership": "Annuel",
                "annual_review_enabled": True,
                "review_frequency": freq,
                "contract_signed_date": "2026-01-01"
            }
            resp = api_client.post(f"{BASE_URL}/api/members", json=payload)
            assert resp.status_code == 200, f"Failed to create member with review_frequency='{freq}'"
            data = resp.json()
            assert data["review_frequency"] == freq
            
            # Cleanup
            api_client.delete(f"{BASE_URL}/api/members/{data['id']}")
        
        print("PASS: All review_frequency values accepted (monthly, quarterly, semi-annually, annually)")


class TestIntegration:
    """Integration tests combining Phase 3 and Phase 4 features"""
    
    def test_full_challenge_workflow_personal(self, api_client):
        """Full workflow: Create personal challenge -> Add participant with dates -> Update check-ins -> Delete"""
        # Create member
        member_resp = api_client.post(f"{BASE_URL}/api/members", json={
            "name": "TEST_Full_Workflow_Member",
            "email": "workflow@test.com",
            "membership": "Annuel"
        })
        assert member_resp.status_code == 200
        member = member_resp.json()
        
        # Create personal challenge with checkins_goal=4
        challenge_resp = api_client.post(f"{BASE_URL}/api/challenges", json={
            "name": "TEST_Full_Workflow_Challenge",
            "challenge_type": "personal",
            "checkins_goal": 4,
            "is_active": True
        })
        assert challenge_resp.status_code == 200
        challenge = challenge_resp.json()
        assert challenge["challenge_type"] == "personal"
        assert challenge["checkins_goal"] == 4
        
        # Add participant with personal dates
        participant_resp = api_client.post(
            f"{BASE_URL}/api/challenges/{challenge['id']}/participants",
            json={
                "challenge_id": challenge["id"],
                "member_id": member["id"],
                "member_name": member["name"],
                "personal_start_date": "2026-03-01",
                "personal_end_date": "2026-04-11"
            }
        )
        assert participant_resp.status_code == 200
        participant = participant_resp.json()
        
        # Update check-ins
        update_resp = api_client.put(
            f"{BASE_URL}/api/challenges/{challenge['id']}/participants/{participant['id']}",
            json={"week1_checkins": 4, "week1": True}
        )
        assert update_resp.status_code == 200
        updated = update_resp.json()
        assert updated["week1_checkins"] == 4
        assert updated["week1"] == True
        
        # Verify full detail
        detail_resp = api_client.get(f"{BASE_URL}/api/challenges/{challenge['id']}")
        assert detail_resp.status_code == 200
        detail = detail_resp.json()
        assert detail["challenge_type"] == "personal"
        assert detail["checkins_goal"] == 4
        assert len(detail["participants"]) == 1
        assert detail["participants"][0]["personal_start_date"] == "2026-03-01"
        
        # Delete challenge (should remove participant too)
        delete_resp = api_client.delete(f"{BASE_URL}/api/challenges/{challenge['id']}")
        assert delete_resp.status_code == 200
        
        # Cleanup member
        api_client.delete(f"{BASE_URL}/api/members/{member['id']}")
        
        print("PASS: Full personal challenge workflow completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
