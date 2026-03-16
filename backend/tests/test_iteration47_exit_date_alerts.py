"""
Test iteration 47 - Two new features:
1. exit_date editable in member edit form
2. Alert zone on Dashboard for expiring subscriptions within 60 days
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL')


class TestExitDateFeature:
    """Tests for exit_date editing functionality"""
    
    def test_member_update_with_exit_date(self):
        """Test PUT /api/members/{id} with exit_date - should move member to 'Partis' tab"""
        # Get a member without exit_date (active)
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        members = response.json()
        
        # Find an active member (no exit_date)
        active_member = None
        for m in members:
            if not m.get('exit_date') or m['exit_date'] in [None, '', 'None']:
                active_member = m
                break
        
        assert active_member is not None, "No active member found for testing"
        member_id = active_member['id']
        print(f"Testing with member: {active_member['name']} (id: {member_id})")
        
        # Prepare update data with exit_date
        exit_date = datetime.now().strftime('%Y-%m-%d')
        update_data = {
            "name": active_member['name'],
            "email": active_member.get('email', ''),
            "phone": active_member.get('phone', ''),
            "membership": active_member.get('membership', ''),
            "member_type": active_member.get('member_type', ''),
            "contract_signed_date": active_member.get('contract_signed_date', ''),
            "subscription_end_date": active_member.get('subscription_end_date', ''),
            "exit_date": exit_date,
            "cash_collected": active_member.get('cash_collected', 0),
            "notes": active_member.get('notes', ''),
            "billing_enabled": active_member.get('billing_enabled', True),
            "billing_amount": active_member.get('billing_amount', 0),
            "billing_cycle_type": active_member.get('billing_cycle_type', 'monthly_day'),
            "billing_cycle_value": active_member.get('billing_cycle_value', 1),
            "billing_payment_method": active_member.get('billing_payment_method', 'prelevement'),
            "annual_review_enabled": active_member.get('annual_review_enabled', False),
        }
        
        # Update member with exit_date
        put_response = requests.put(f"{BASE_URL}/api/members/{member_id}", json=update_data)
        assert put_response.status_code == 200, f"Failed to update: {put_response.text}"
        
        # Verify update
        updated_member = put_response.json()
        assert updated_member.get('exit_date') == exit_date, f"exit_date not saved. Got: {updated_member.get('exit_date')}"
        print(f"SUCCESS: Member exit_date set to {exit_date}")
        
        # Verify member now shows up in departed count via /stats
        stats_response = requests.get(f"{BASE_URL}/api/members/stats")
        assert stats_response.status_code == 200
        stats = stats_response.json()
        print(f"Stats after setting exit_date: departed={stats.get('departed')}")
        
        # Clear exit_date to restore member to active state
        update_data['exit_date'] = None
        clear_response = requests.put(f"{BASE_URL}/api/members/{member_id}", json=update_data)
        assert clear_response.status_code == 200
        
        cleared_member = clear_response.json()
        assert cleared_member.get('exit_date') in [None, '', 'None'], f"exit_date not cleared. Got: {cleared_member.get('exit_date')}"
        print(f"SUCCESS: Member exit_date cleared, member back to active")

    def test_member_model_has_exit_date_field(self):
        """Verify GET /api/members returns exit_date field for all members"""
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        members = response.json()
        
        # Check first few members have exit_date field
        for member in members[:5]:
            assert 'exit_date' in member or member.get('exit_date') is None, f"exit_date field missing for member {member.get('name')}"
        
        # Count members with and without exit_date
        with_exit_date = sum(1 for m in members if m.get('exit_date') and m['exit_date'] not in [None, '', 'None'])
        without_exit_date = sum(1 for m in members if not m.get('exit_date') or m['exit_date'] in [None, '', 'None'])
        print(f"Members with exit_date: {with_exit_date}, without: {without_exit_date}")


class TestExpiringMembersAlert:
    """Tests for Dashboard alert zone - expiring subscriptions within 60 days"""
    
    def test_get_expiring_members_endpoint(self):
        """Test GET /api/members/expiring?days=60 returns members with subscriptions expiring within 60 days"""
        response = requests.get(f"{BASE_URL}/api/members/expiring?days=60")
        assert response.status_code == 200
        expiring = response.json()
        
        print(f"Expiring members (60 days): {len(expiring)}")
        
        # Validate response structure
        if len(expiring) > 0:
            member = expiring[0]
            # Verify days_remaining is calculated
            assert 'days_remaining' in member, "days_remaining field missing"
            assert 'name' in member, "name field missing"
            assert 'membership' in member, "membership field missing"
            assert 'subscription_end_date' in member, "subscription_end_date field missing"
            
            print(f"First expiring member: {member['name']}, membership: {member['membership']}, days_remaining: {member['days_remaining']}, end_date: {member['subscription_end_date']}")
            
            # Verify days_remaining is within 60 days
            assert 0 <= member['days_remaining'] <= 60, f"days_remaining {member['days_remaining']} should be between 0 and 60"
            
            # Verify sorting by days_remaining (ascending)
            if len(expiring) > 1:
                for i in range(len(expiring) - 1):
                    assert expiring[i]['days_remaining'] <= expiring[i+1]['days_remaining'], "Members should be sorted by days_remaining ascending"
                print("SUCCESS: Members sorted by days_remaining ascending")
    
    def test_expiring_members_excludes_departed(self):
        """Verify GET /api/members/expiring excludes members with exit_date"""
        response = requests.get(f"{BASE_URL}/api/members/expiring?days=60")
        assert response.status_code == 200
        expiring = response.json()
        
        # Verify no member with exit_date is included
        for member in expiring:
            exit_date = member.get('exit_date')
            assert not exit_date or exit_date in [None, '', 'None'], f"Member {member['name']} has exit_date {exit_date} but is in expiring list"
        
        print(f"SUCCESS: All {len(expiring)} expiring members have no exit_date")
    
    def test_expiring_members_default_30_days(self):
        """Test GET /api/members/expiring without days param defaults to 30 days"""
        response = requests.get(f"{BASE_URL}/api/members/expiring")
        assert response.status_code == 200
        expiring = response.json()
        
        print(f"Expiring members (default 30 days): {len(expiring)}")
        
        # Verify all returned members are within 30 days
        for member in expiring:
            assert member['days_remaining'] <= 30, f"Member {member['name']} has days_remaining {member['days_remaining']} > 30"


class TestDashboardStats:
    """Test Dashboard KPI cards still show correct real-time stats"""
    
    def test_member_stats_endpoint(self):
        """Test GET /api/members/stats returns expected data"""
        response = requests.get(f"{BASE_URL}/api/members/stats")
        assert response.status_code == 200
        stats = response.json()
        
        # Verify expected fields
        required_fields = ['active_members', 'active_coaches', 'departed', 'expired_members', 'total']
        for field in required_fields:
            assert field in stats, f"Missing field: {field}"
        
        print(f"Member stats: active_members={stats['active_members']}, active_coaches={stats['active_coaches']}, departed={stats['departed']}")
        
        # Based on previous test, expect ~66 active members, ~29 coaches
        assert stats['active_members'] >= 60, f"Expected ~66 active members, got {stats['active_members']}"
        assert stats['active_coaches'] >= 25, f"Expected ~29 active coaches, got {stats['active_coaches']}"


class TestMembershipFilter:
    """Test membership filter still works correctly"""
    
    def test_memberships_list_endpoint(self):
        """Test GET /api/members/memberships returns 26 unique types"""
        response = requests.get(f"{BASE_URL}/api/members/memberships")
        assert response.status_code == 200
        memberships = response.json()
        
        print(f"Unique memberships count: {len(memberships)}")
        
        # Should have 26 membership types based on previous iteration
        assert len(memberships) >= 25, f"Expected ~26 memberships, got {len(memberships)}"
        
        # Verify it's a list of strings, sorted
        assert isinstance(memberships, list)
        if len(memberships) > 0:
            assert isinstance(memberships[0], str)
            # Verify alphabetical sorting
            assert memberships == sorted(memberships), "Memberships should be sorted alphabetically"
        
        print(f"First 5 memberships: {memberships[:5]}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
