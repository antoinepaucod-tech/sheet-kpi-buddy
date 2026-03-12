"""
Iteration 26 - Test 4 P1 Challenge features:
1. Check-in goal buttons in challenge form (1x-5x/sem)
2. Training-based weekly progression in challenge detail  
3. Participant weekly cells show green checkmarks when trainings >= goal
4. Auto-add to challenge when member has 'challenge' in membership
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')


class TestChallengeTrainingIntegration:
    """Test challenge participants enriched with training data from weekly_trainings collection"""
    
    def test_challenge_list_returns_checkins_goal(self):
        """Verify challenges list includes checkins_goal field"""
        response = requests.get(f"{BASE_URL}/api/challenges")
        assert response.status_code == 200
        challenges = response.json()
        assert len(challenges) > 0
        
        # Find the test challenge
        challenge = next((c for c in challenges if c['name'] == 'Challenge Hiver 2024'), None)
        assert challenge is not None, "Challenge Hiver 2024 should exist"
        assert 'checkins_goal' in challenge, "Challenge should have checkins_goal field"
        assert challenge['checkins_goal'] == 3, "Default goal should be 3"
        
    def test_challenge_detail_enriches_participants_with_training_data(self):
        """Verify GET /api/challenges/{id} enriches participants with week1_trainings through week6_trainings"""
        # Get challenge ID
        response = requests.get(f"{BASE_URL}/api/challenges")
        assert response.status_code == 200
        challenges = response.json()
        challenge = next((c for c in challenges if c['name'] == 'Challenge Hiver 2024'), None)
        assert challenge is not None
        challenge_id = challenge['id']
        
        # Get challenge detail
        response = requests.get(f"{BASE_URL}/api/challenges/{challenge_id}")
        assert response.status_code == 200
        detail = response.json()
        
        # Verify participants exist
        assert 'participants' in detail
        assert len(detail['participants']) >= 5, "Should have at least 5 participants"
        
        # Verify each participant has training data fields
        for participant in detail['participants']:
            for week in range(1, 7):
                key = f"week{week}_trainings"
                assert key in participant, f"Participant {participant['member_name']} should have {key}"
                assert isinstance(participant[key], int), f"{key} should be an integer"
                
    def test_training_data_has_non_zero_values(self):
        """Verify training data is populated with actual values (not all zeros)"""
        # Get challenge detail
        response = requests.get(f"{BASE_URL}/api/challenges")
        challenge = response.json()[0]
        
        response = requests.get(f"{BASE_URL}/api/challenges/{challenge['id']}")
        detail = response.json()
        
        # Check at least some participants have non-zero training values
        total_trainings = 0
        for p in detail['participants']:
            for w in range(1, 7):
                total_trainings += p.get(f"week{w}_trainings", 0)
        
        assert total_trainings > 0, "Should have some training data from weekly_trainings collection"
        print(f"Total trainings found: {total_trainings}")
        
    def test_challenge_update_with_checkins_goal(self):
        """Verify challenge can be updated with different checkins_goal values (1-5)"""
        # Get challenge
        response = requests.get(f"{BASE_URL}/api/challenges")
        challenge = response.json()[0]
        challenge_id = challenge['id']
        
        # Test updating with different goal values
        for goal in [1, 2, 3, 4, 5]:
            update_data = {
                "name": challenge['name'],
                "start_date": challenge['start_date'],
                "end_date": challenge.get('end_date'),
                "is_active": challenge['is_active'],
                "challenge_type": challenge.get('challenge_type', 'fixed'),
                "checkins_goal": goal
            }
            response = requests.put(f"{BASE_URL}/api/challenges/{challenge_id}", json=update_data)
            assert response.status_code == 200
            updated = response.json()
            assert updated['checkins_goal'] == goal, f"Goal should be updated to {goal}"
        
        # Reset to 3
        update_data['checkins_goal'] = 3
        requests.put(f"{BASE_URL}/api/challenges/{challenge_id}", json=update_data)


class TestAutoAddChallengeParticipant:
    """Test auto-addition of members to challenge when membership contains 'challenge'"""
    
    def test_create_member_with_challenge_membership_auto_adds_to_challenge(self):
        """Creating a member with 'challenge' in membership should auto-add them to active challenge"""
        import uuid
        test_name = f"TEST_Challenge_Member_{uuid.uuid4().hex[:6]}"
        
        # Create member with challenge membership
        member_data = {
            "name": test_name,
            "email": f"{test_name.lower()}@test.com",
            "phone": "+41 79 999 9999",
            "membership": "6 Semaines Challenge",  # Contains 'challenge'
            "member_type": "Membres Généraux Récurrents",
            "contract_signed_date": "2026-01-01",
            "subscription_end_date": "2026-02-15",
            "cash_collected": 200,
            "billing_enabled": False,
            "billing_amount": 0,
            "annual_review_enabled": False
        }
        
        response = requests.post(f"{BASE_URL}/api/members", json=member_data)
        assert response.status_code == 200, f"Failed to create member: {response.text}"
        created_member = response.json()
        member_id = created_member['id']
        
        try:
            # Check if member was auto-added to active challenge
            response = requests.get(f"{BASE_URL}/api/challenges?active_only=true")
            challenges = response.json()
            
            if len(challenges) > 0:
                active_challenge = challenges[0]
                response = requests.get(f"{BASE_URL}/api/challenges/{active_challenge['id']}")
                challenge_detail = response.json()
                
                # Check if member is in participants
                participant_ids = [p['member_id'] for p in challenge_detail['participants']]
                assert member_id in participant_ids, "Member with 'challenge' membership should be auto-added to active challenge"
                print(f"SUCCESS: Member {test_name} was auto-added to challenge {active_challenge['name']}")
        finally:
            # Cleanup: delete the test member
            requests.delete(f"{BASE_URL}/api/members/{member_id}")


class TestMembersWithChallengeEmoji:
    """Test that members list returns membership field to identify challenge members for 🔥 emoji display"""
    
    def test_members_have_membership_field(self):
        """Verify members list includes membership field for emoji display logic"""
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        members = response.json()
        
        for member in members:
            assert 'membership' in member, f"Member {member['name']} should have membership field"
            
    def test_challenge_member_exists_for_emoji(self):
        """Verify there's at least one member with 'challenge' in membership for 🔥 emoji"""
        response = requests.get(f"{BASE_URL}/api/members")
        members = response.json()
        
        challenge_members = [m for m in members if m['membership'] and 'challenge' in m['membership'].lower()]
        assert len(challenge_members) > 0, "Should have at least one member with 'challenge' in membership"
        
        for cm in challenge_members:
            print(f"Challenge member found: {cm['name']} - {cm['membership']}")


class TestCreateChallengeWithGoal:
    """Test creating a new challenge with custom checkins_goal"""
    
    def test_create_challenge_with_custom_goal(self):
        """Create challenge with checkins_goal of 4 and verify"""
        import uuid
        test_name = f"TEST_Goal_Challenge_{uuid.uuid4().hex[:6]}"
        
        challenge_data = {
            "name": test_name,
            "start_date": "2026-02-01",
            "end_date": "2026-03-15",
            "is_active": False,
            "challenge_type": "fixed",
            "checkins_goal": 4
        }
        
        response = requests.post(f"{BASE_URL}/api/challenges", json=challenge_data)
        assert response.status_code == 200
        created = response.json()
        
        try:
            assert created['name'] == test_name
            assert created['checkins_goal'] == 4, "Custom goal should be saved"
            
            # Verify GET returns the goal
            response = requests.get(f"{BASE_URL}/api/challenges/{created['id']}")
            assert response.status_code == 200
            detail = response.json()
            assert detail['checkins_goal'] == 4
        finally:
            # Cleanup
            requests.delete(f"{BASE_URL}/api/challenges/{created['id']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
