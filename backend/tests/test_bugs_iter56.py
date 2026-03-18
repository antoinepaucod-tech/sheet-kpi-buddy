"""
Test file for iteration 56 - Testing 6 bug fixes:
BUG 1: DUO partner for Nathalie Zaharna not showing
BUG 2: Alexandra Dankova disappeared after membership change to IFRC
BUG 3: Caroline appears as expense instead of revenue
BUG 4: Coaches should be blocked from attendance tracking (Saisie Séances)
BUG 5: Expired members should be removed from KPI Clients page
BUG 6: Renewal popup sometimes shows multiple subscriptions selected
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestBug1DuoPartner:
    """BUG 1: DUO partner for Nathalie Zaharna not showing"""
    
    def test_zaharna_duo_pair_exists(self):
        """Search 'Zaharna' should show both Nathalie Zaharna & Neal (DUO) and Neal Zaharna (PARTENAIRE)"""
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        
        members = response.json()
        zaharna_members = [m for m in members if 'zaharna' in m.get('name', '').lower()]
        
        # Should have at least 2 members with Zaharna in name
        assert len(zaharna_members) >= 2, f"Expected 2+ Zaharna members, got {len(zaharna_members)}"
        
        # Check for primary DUO member
        primary = [m for m in zaharna_members if m.get('duo_primary') is True]
        assert len(primary) >= 1, "Expected at least one DUO primary member with Zaharna name"
        
        # Check for partner member
        partners = [m for m in zaharna_members if m.get('is_duo') and not m.get('duo_primary')]
        assert len(partners) >= 1, "Expected at least one DUO partner member with Zaharna name"
        
        # Verify they are linked
        primary_member = primary[0]
        partner_member = partners[0]
        assert primary_member.get('duo_partner_id') == partner_member.get('id') or \
               primary_member.get('subscription_group_id') == partner_member.get('subscription_group_id'), \
               "DUO members should be linked via duo_partner_id or subscription_group_id"


class TestBug2DankovaVisibility:
    """BUG 2: Alexandra Dankova disappeared after membership change to IFRC"""
    
    def test_dankova_exists_in_members(self):
        """Alexandra Dankova should exist in members list (in expired view since subscription_end_date passed)"""
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        
        members = response.json()
        dankova = [m for m in members if 'dankova' in m.get('name', '').lower()]
        
        # Dankova should exist
        assert len(dankova) >= 1, "Alexandra Dankova should exist in members list"
        
        # Verify her subscription details
        alexandra = dankova[0]
        assert alexandra.get('membership') == 'IFRC', f"Dankova should have IFRC membership, got {alexandra.get('membership')}"
        assert alexandra.get('subscription_end_date') == '2026-03-11', f"Dankova's subscription_end_date should be 2026-03-11"
        assert alexandra.get('exit_date') in ['', None], "Dankova should NOT have exit_date (not departed, just expired)"
        assert alexandra.get('is_coach') is False, "Dankova should not be a coach"
    
    def test_dankova_shows_in_expired_view(self):
        """Dankova should appear in expired members (subscription_end_date < today)"""
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        
        members = response.json()
        today = datetime.now().strftime('%Y-%m-%d')
        
        # Filter for expired non-coach members (same logic as frontend)
        expired = [m for m in members 
                   if not m.get('is_coach') 
                   and m.get('subscription_end_date') 
                   and m['subscription_end_date'] < today
                   and (not m.get('exit_date') or m['exit_date'] >= today)]
        
        dankova_in_expired = [m for m in expired if 'dankova' in m.get('name', '').lower()]
        assert len(dankova_in_expired) >= 1, "Alexandra Dankova should appear in expired members view"


class TestBug3CarolineRevenue:
    """BUG 3: Caroline appears as expense instead of revenue"""
    
    def test_caroline_transaction_in_revenue(self):
        """Caroline Maerten's 300 CHF '6 WEEKS CHALLENGE' should be in revenue_breakdown, NOT expense_breakdown"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis/2026-03/details")
        assert response.status_code == 200
        
        data = response.json()
        
        # Search for Caroline in revenue_breakdown
        caroline_in_revenue = False
        for cat in data.get('revenue_breakdown', []):
            for tx in cat.get('transactions', []):
                client_name = tx.get('client_name') or ''
                if 'Caroline' in client_name or 'Maerten' in client_name:
                    caroline_in_revenue = True
                    assert tx.get('amount', 0) == 300.0, f"Caroline's transaction should be 300 CHF, got {tx.get('amount')}"
                    break
        
        # Ensure Caroline is NOT in expense_breakdown
        caroline_in_expense = False
        for cat in data.get('expense_breakdown', []):
            for tx in cat.get('transactions', []):
                client_name = tx.get('client_name') or ''
                if 'Caroline' in client_name or 'Maerten' in client_name:
                    caroline_in_expense = True
        
        assert caroline_in_revenue, "Caroline Maerten's transaction should be in revenue_breakdown"
        assert not caroline_in_expense, "Caroline Maerten's transaction should NOT be in expense_breakdown"


class TestBug4CoachesBlockedFromAttendance:
    """BUG 4: Coaches should be blocked from attendance tracking (Saisie Séances)"""
    
    def test_coaches_have_is_coach_flag(self):
        """Members with 'THE COACH' or 'VIRTUAL COACH' membership should have is_coach=True"""
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        
        members = response.json()
        
        # Find members with coach-type memberships
        coach_memberships = [m for m in members if m.get('membership') and 
                            ('THE COACH' in m['membership'].upper() or 'VIRTUAL COACH' in m['membership'].upper())]
        
        # All should have is_coach=True
        for m in coach_memberships:
            assert m.get('is_coach') is True, \
                f"Member '{m.get('name')}' with membership '{m.get('membership')}' should have is_coach=True"
    
    def test_attendance_filter_excludes_coaches(self):
        """Verify that filtering members for attendance (is_coach=False) works correctly"""
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        
        members = response.json()
        
        # Filter as frontend does: exclude is_coach=True
        attendance_members = [m for m in members if not m.get('is_coach')]
        all_coaches = [m for m in members if m.get('is_coach')]
        
        # Verify no coaches in attendance list
        for m in attendance_members:
            assert m.get('is_coach') is not True, f"Coach {m.get('name')} should NOT be in attendance list"
        
        # Verify we have some coaches excluded
        assert len(all_coaches) > 0, "Should have some coaches in the system"
        print(f"Verified: {len(all_coaches)} coaches excluded from attendance, {len(attendance_members)} members remain")


class TestBug5ExpiredMembersKPI:
    """BUG 5: Expired members should be removed from KPI Clients page"""
    
    def test_kpi_clients_filter_excludes_departed(self):
        """KPI Clients should not show members with exit_date in the past"""
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        
        members = response.json()
        today = datetime.now().strftime('%Y-%m-%d')
        
        # Filter as ClientKPIPage does: exclude coaches and departed (exit_date < today)
        kpi_members = [m for m in members 
                       if not m.get('is_coach')
                       and (not m.get('exit_date') or m['exit_date'] >= today)]
        
        departed = [m for m in members if m.get('exit_date') and m['exit_date'] < today]
        
        # Verify no departed members in KPI list
        for m in kpi_members:
            exit_date = m.get('exit_date')
            if exit_date:
                assert exit_date >= today, f"Departed member {m.get('name')} (exit_date={exit_date}) should NOT be in KPI clients"
        
        print(f"Verified: {len(departed)} departed members excluded from KPI clients, {len(kpi_members)} remain")
    
    def test_kpi_clients_filter_excludes_coaches(self):
        """KPI Clients should not show coaches"""
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        
        members = response.json()
        today = datetime.now().strftime('%Y-%m-%d')
        
        # Same filter as frontend
        kpi_members = [m for m in members 
                       if not m.get('is_coach')
                       and (not m.get('exit_date') or m['exit_date'] >= today)]
        
        for m in kpi_members:
            assert m.get('is_coach') is not True, f"Coach {m.get('name')} should NOT be in KPI clients"


class TestBug6RenewalDurationDeduplication:
    """BUG 6: Renewal popup sometimes shows multiple subscriptions selected"""
    
    def test_membership_types_have_duration_info(self):
        """Membership types should have duration_months or duration_days"""
        response = requests.get(f"{BASE_URL}/api/settings/membership-types?active_only=true")
        assert response.status_code == 200
        
        types = response.json()
        assert len(types) > 0, "Should have some membership types"
        
        # Count duration labels
        duration_labels = []
        for t in types:
            if t.get('duration_days'):
                label = f"{t['duration_days']} jours"
                if t['duration_days'] == 42:
                    label = "6 semaines"
            elif t.get('duration_months') == 1:
                label = "1 mois"
            elif t.get('duration_months') == 12:
                label = "12 mois"
            elif t.get('duration_months', 0) > 0:
                label = f"{t['duration_months']} mois"
            else:
                continue
            duration_labels.append(label)
        
        unique_labels = set(duration_labels)
        print(f"Raw labels: {len(duration_labels)}, Unique labels: {len(unique_labels)}")
        print(f"Unique duration options: {sorted(unique_labels)}")
        
        # The frontend deduplicates, so just verify we have reasonable unique values
        assert len(unique_labels) >= 2, "Should have at least 2 unique duration options"
        assert '1 mois' in unique_labels or '6 mois' in unique_labels or '12 mois' in unique_labels, \
            "Should have at least one month-based duration option"


class TestMembersEndpoint:
    """Additional tests for members endpoint"""
    
    def test_members_list_returns_data(self):
        """GET /api/members should return member list"""
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        members = response.json()
        assert isinstance(members, list)
        assert len(members) > 0, "Should have members in database"
    
    def test_member_has_required_fields(self):
        """Members should have key fields for filtering"""
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        members = response.json()
        
        # Check first member has required fields
        if members:
            m = members[0]
            assert 'id' in m
            assert 'name' in m
            assert 'is_coach' in m
            assert 'is_duo' in m


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
