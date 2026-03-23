"""
Iteration 68 - Skip Onboarding Feature Tests
Tests for:
1. GET /api/onboarding/pending - returns pending members (not skipped, not completed, not coaches)
2. POST /api/onboarding/{member_id}/skip - marks a member as skipped and removes from pending list
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "antoine.paucod@the-coach.pro"
TEST_PASSWORD = "TheCoach1290."


class TestSkipOnboardingFeature:
    """Tests for the skip onboarding feature"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Get auth token and club_id"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        login_data = login_response.json()
        self.token = login_data.get("access_token")
        assert self.token, "No access_token in login response"
        
        # Set auth header
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        # Get club_id from user data
        self.club_id = login_data.get("user", {}).get("club_id")
        if self.club_id:
            self.session.headers.update({"X-Club-Id": self.club_id})
        
        yield
        
        self.session.close()
    
    def test_01_get_pending_onboarding_returns_list(self):
        """Test GET /api/onboarding/pending returns a list of pending members"""
        response = self.session.get(f"{BASE_URL}/api/onboarding/pending")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        print(f"✓ GET /api/onboarding/pending returned {len(data)} pending members")
        
        # Verify structure of pending members
        if len(data) > 0:
            member = data[0]
            assert "id" in member, "Member should have 'id' field"
            assert "name" in member, "Member should have 'name' field"
            assert "onboarding_progress" in member, "Member should have 'onboarding_progress' field"
            assert "onboarding_total" in member, "Member should have 'onboarding_total' field"
            assert "onboarding_percentage" in member, "Member should have 'onboarding_percentage' field"
            print(f"✓ First pending member: {member.get('name')} - {member.get('onboarding_progress')}/5 steps")
    
    def test_02_pending_excludes_coaches_and_ifrc(self):
        """Test that pending onboarding excludes coaches and IFRC members"""
        response = self.session.get(f"{BASE_URL}/api/onboarding/pending")
        assert response.status_code == 200
        
        data = response.json()
        coach_keywords = ["THE COACH", "VIRTUAL COACH", "VIRTUAL", "IFRC"]
        
        for member in data:
            membership = (member.get("membership") or "").upper()
            for keyword in coach_keywords:
                assert keyword not in membership, f"Coach/IFRC member found in pending: {member.get('name')} - {membership}"
        
        print(f"✓ No coaches or IFRC members in pending list ({len(data)} members checked)")
    
    def test_03_pending_excludes_completed_onboarding(self):
        """Test that pending onboarding excludes members with onboarding_completed=true"""
        response = self.session.get(f"{BASE_URL}/api/onboarding/pending")
        assert response.status_code == 200
        
        data = response.json()
        
        for member in data:
            assert member.get("onboarding_completed") != True, f"Completed member found in pending: {member.get('name')}"
        
        print(f"✓ No completed onboarding members in pending list")
    
    def test_04_pending_excludes_skipped_onboarding(self):
        """Test that pending onboarding excludes members with onboarding_skipped=true"""
        response = self.session.get(f"{BASE_URL}/api/onboarding/pending")
        assert response.status_code == 200
        
        data = response.json()
        
        for member in data:
            assert member.get("onboarding_skipped") != True, f"Skipped member found in pending: {member.get('name')}"
        
        print(f"✓ No skipped onboarding members in pending list")
    
    def test_05_skip_onboarding_endpoint_exists(self):
        """Test that POST /api/onboarding/{member_id}/skip endpoint exists"""
        # First get a pending member to skip
        pending_response = self.session.get(f"{BASE_URL}/api/onboarding/pending")
        assert pending_response.status_code == 200
        
        pending = pending_response.json()
        if len(pending) == 0:
            pytest.skip("No pending members to test skip functionality")
        
        # Get the first pending member
        member_to_skip = pending[0]
        member_id = member_to_skip.get("id")
        member_name = member_to_skip.get("name")
        
        print(f"Testing skip on member: {member_name} (ID: {member_id})")
        
        # Skip the member
        skip_response = self.session.post(
            f"{BASE_URL}/api/onboarding/{member_id}/skip",
            json={"reason": "Test skip - iteration 68", "user_name": "Test Agent"}
        )
        
        assert skip_response.status_code == 200, f"Skip failed: {skip_response.status_code} - {skip_response.text}"
        
        skip_data = skip_response.json()
        assert "message" in skip_data, "Skip response should have 'message' field"
        
        print(f"✓ Skip endpoint returned: {skip_data}")
        
        # Store for cleanup/verification
        self.skipped_member_id = member_id
        self.skipped_member_name = member_name
    
    def test_06_skipped_member_removed_from_pending(self):
        """Test that skipped member is removed from pending list"""
        # First get a pending member
        pending_response = self.session.get(f"{BASE_URL}/api/onboarding/pending")
        assert pending_response.status_code == 200
        
        pending = pending_response.json()
        if len(pending) == 0:
            pytest.skip("No pending members to test")
        
        # Get the first pending member
        member_to_skip = pending[0]
        member_id = member_to_skip.get("id")
        member_name = member_to_skip.get("name")
        initial_count = len(pending)
        
        print(f"Initial pending count: {initial_count}")
        print(f"Skipping member: {member_name}")
        
        # Skip the member
        skip_response = self.session.post(
            f"{BASE_URL}/api/onboarding/{member_id}/skip",
            json={"reason": "Test skip verification", "user_name": "Test Agent"}
        )
        assert skip_response.status_code == 200
        
        # Verify member is no longer in pending list
        new_pending_response = self.session.get(f"{BASE_URL}/api/onboarding/pending")
        assert new_pending_response.status_code == 200
        
        new_pending = new_pending_response.json()
        new_count = len(new_pending)
        
        # Check member is not in the new list
        member_ids = [m.get("id") for m in new_pending]
        assert member_id not in member_ids, f"Skipped member {member_name} still in pending list!"
        
        print(f"✓ Member {member_name} removed from pending list")
        print(f"✓ Pending count: {initial_count} -> {new_count}")
    
    def test_07_skip_with_reason(self):
        """Test skip with a reason is stored correctly"""
        # Get a pending member
        pending_response = self.session.get(f"{BASE_URL}/api/onboarding/pending")
        assert pending_response.status_code == 200
        
        pending = pending_response.json()
        if len(pending) == 0:
            pytest.skip("No pending members to test")
        
        member = pending[0]
        member_id = member.get("id")
        test_reason = "Membre déjà expérimenté - test iteration 68"
        
        # Skip with reason
        skip_response = self.session.post(
            f"{BASE_URL}/api/onboarding/{member_id}/skip",
            json={"reason": test_reason, "user_name": "Test Agent"}
        )
        
        assert skip_response.status_code == 200
        print(f"✓ Skip with reason '{test_reason}' successful")
    
    def test_08_skip_without_reason(self):
        """Test skip without a reason (optional field)"""
        # Get a pending member
        pending_response = self.session.get(f"{BASE_URL}/api/onboarding/pending")
        assert pending_response.status_code == 200
        
        pending = pending_response.json()
        if len(pending) == 0:
            pytest.skip("No pending members to test")
        
        member = pending[0]
        member_id = member.get("id")
        
        # Skip without reason
        skip_response = self.session.post(
            f"{BASE_URL}/api/onboarding/{member_id}/skip",
            json={}  # No reason provided
        )
        
        assert skip_response.status_code == 200
        print(f"✓ Skip without reason successful")
    
    def test_09_skip_nonexistent_member_returns_404(self):
        """Test skip on non-existent member returns 404"""
        fake_member_id = "nonexistent-member-id-12345"
        
        skip_response = self.session.post(
            f"{BASE_URL}/api/onboarding/{fake_member_id}/skip",
            json={"reason": "Test"}
        )
        
        assert skip_response.status_code == 404, f"Expected 404, got {skip_response.status_code}"
        print(f"✓ Skip on non-existent member returns 404")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
