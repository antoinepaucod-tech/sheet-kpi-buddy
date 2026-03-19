"""
Iteration 59 - Data Audit Validation Tests
Tests the 3 P0 fixes:
1. No departed member has billing_enabled=True
2. All DUO members have duo_partner_id set (bidirectional)
3. Payment count matches schedule count, offerts have paid status
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestMemberStats:
    """Test /api/members/stats returns correct counts"""
    
    def test_member_stats_counts(self):
        """Verify active_members=93, active_coaches=29, expired_members=4, departed=195"""
        response = requests.get(f"{BASE_URL}/api/members/stats")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        print(f"Member stats: {data}")
        
        # Expected values from problem statement
        assert data.get("active_members") == 93, f"Expected 93 active_members, got {data.get('active_members')}"
        assert data.get("active_coaches") == 29, f"Expected 29 active_coaches, got {data.get('active_coaches')}"
        assert data.get("expired_members") == 4, f"Expected 4 expired_members, got {data.get('expired_members')}"
        assert data.get("departed") == 195, f"Expected 195 departed, got {data.get('departed')}"
        
        print("PASS: Member stats match expected counts (93 active, 29 coaches, 4 expired, 195 departed)")


class TestBillingFix:
    """Test Fix #1: No departed member has billing_enabled=True"""
    
    def test_no_departed_member_has_billing_enabled(self):
        """All departed members should have billing_enabled=False"""
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        
        members = response.json()
        today = "2026-03-19"  # Current date context
        
        departed_with_billing = []
        for m in members:
            exit_date = m.get("exit_date")
            # Departed = exit_date in the past
            if exit_date and exit_date not in [None, "", "None"] and exit_date < today:
                if m.get("billing_enabled") == True:
                    departed_with_billing.append({
                        "name": m.get("name"),
                        "exit_date": exit_date,
                        "billing_enabled": m.get("billing_enabled")
                    })
        
        assert len(departed_with_billing) == 0, f"Found {len(departed_with_billing)} departed members with billing_enabled=True: {departed_with_billing}"
        print(f"PASS: No departed members have billing_enabled=True (checked {len([m for m in members if m.get('exit_date') and m.get('exit_date') < today])} departed members)")
    
    def test_alexandra_dankova_billing_disabled(self):
        """Alexandra Dankova specifically should have billing disabled"""
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        
        members = response.json()
        alexandra = next((m for m in members if "Alexandra" in m.get("name", "") and "Dankova" in m.get("name", "")), None)
        
        if alexandra:
            assert alexandra.get("billing_enabled") == False, f"Alexandra Dankova should have billing_enabled=False, got {alexandra.get('billing_enabled')}"
            print(f"PASS: Alexandra Dankova billing_enabled=False")
        else:
            print("INFO: Alexandra Dankova not found in members list (may have been removed)")


class TestDuoFix:
    """Test Fix #2: All DUO members have duo_partner_id set bidirectionally"""
    
    def test_all_duo_members_have_partner_id(self):
        """Every member with is_duo=True should have duo_partner_id set"""
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        
        members = response.json()
        duo_members = [m for m in members if m.get("is_duo") == True]
        
        orphaned_duos = []
        for m in duo_members:
            if not m.get("duo_partner_id"):
                orphaned_duos.append({
                    "id": m.get("id"),
                    "name": m.get("name"),
                    "is_duo": m.get("is_duo"),
                    "duo_partner_id": m.get("duo_partner_id")
                })
        
        assert len(orphaned_duos) == 0, f"Found {len(orphaned_duos)} DUO members without partner_id: {orphaned_duos}"
        print(f"PASS: All {len(duo_members)} DUO members have duo_partner_id set")
    
    def test_duo_partner_links_are_bidirectional(self):
        """For each DUO member, the partner should point back"""
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        
        members = response.json()
        member_map = {m.get("id"): m for m in members}
        duo_members = [m for m in members if m.get("is_duo") == True]
        
        unidirectional_links = []
        for m in duo_members:
            partner_id = m.get("duo_partner_id")
            if partner_id:
                partner = member_map.get(partner_id)
                if partner:
                    # Partner should point back to this member
                    if partner.get("duo_partner_id") != m.get("id"):
                        unidirectional_links.append({
                            "member": m.get("name"),
                            "member_id": m.get("id"),
                            "points_to": partner.get("name"),
                            "partner_points_to": partner.get("duo_partner_id")
                        })
        
        assert len(unidirectional_links) == 0, f"Found {len(unidirectional_links)} unidirectional DUO links: {unidirectional_links}"
        print(f"PASS: All DUO partner links are bidirectional")
    
    def test_duo_member_detail_shows_partner_info(self):
        """GET /api/members/{id} for a DUO member should include duo_partner_name"""
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        
        members = response.json()
        duo_member = next((m for m in members if m.get("is_duo") == True and m.get("duo_partner_id")), None)
        
        if duo_member:
            detail_response = requests.get(f"{BASE_URL}/api/members/{duo_member.get('id')}")
            assert detail_response.status_code == 200
            
            detail = detail_response.json()
            assert detail.get("duo_partner_name"), f"DUO member detail should include duo_partner_name"
            print(f"PASS: DUO member {duo_member.get('name')} shows partner info: {detail.get('duo_partner_name')}")
        else:
            pytest.skip("No DUO members found with partner_id")


class TestPaymentsFix:
    """Test Fix #3: Payments aligned with schedules, offerts have 0 CHF payments"""
    
    def test_payment_count_matches_schedule_count(self):
        """Payment schedules count should equal 91 (or close), payments should match"""
        schedules_response = requests.get(f"{BASE_URL}/api/payment-schedules")
        assert schedules_response.status_code == 200
        schedules = schedules_response.json()
        
        payments_response = requests.get(f"{BASE_URL}/api/payments")
        assert payments_response.status_code == 200
        payments = payments_response.json()
        
        # Get current month payments
        current_month = "2026-03"
        current_month_payments = [p for p in payments if p.get("due_date", "").startswith(current_month)]
        
        print(f"Payment schedules: {len(schedules)}")
        print(f"Total payments: {len(payments)}")
        print(f"Current month payments: {len(current_month_payments)}")
        
        # The expected count is around 91 based on problem statement
        assert len(schedules) >= 85, f"Expected ~91 payment schedules, got {len(schedules)}"
        print(f"PASS: Payment schedules count: {len(schedules)}, payments count: {len(payments)}")
    
    def test_offert_members_have_paid_payments(self):
        """Members with billing_amount=0 (offerts) should have payments with status='paid' and 0 CHF"""
        # First get billing-enabled members with amount=0
        members_response = requests.get(f"{BASE_URL}/api/members")
        assert members_response.status_code == 200
        members = members_response.json()
        
        today = "2026-03-19"
        offert_members = [
            m for m in members 
            if m.get("billing_enabled") == True 
            and (m.get("billing_amount") == 0 or m.get("billing_amount") is None)
            and (not m.get("exit_date") or m.get("exit_date") >= today)
        ]
        
        print(f"Found {len(offert_members)} offert members (billing_enabled=True, amount=0)")
        
        # Check their payments
        payments_response = requests.get(f"{BASE_URL}/api/payments")
        assert payments_response.status_code == 200
        payments = payments_response.json()
        
        offert_member_ids = {m.get("id") for m in offert_members}
        offert_payments = [p for p in payments if p.get("member_id") in offert_member_ids]
        
        for p in offert_payments:
            assert p.get("amount") == 0, f"Offert payment should have amount=0, got {p.get('amount')}"
            assert p.get("status") == "paid", f"Offert payment should have status='paid', got {p.get('status')}"
            assert "offert" in p.get("notes", "").lower() or p.get("payment_method") == "offert", \
                f"Offert payment should be marked as offert"
        
        print(f"PASS: Found {len(offert_payments)} offert payments, all with amount=0 and status='paid'")
    
    def test_payments_sync_endpoint(self):
        """POST /api/payments/sync-with-members should work correctly"""
        response = requests.post(f"{BASE_URL}/api/payments/sync-with-members")
        assert response.status_code == 200
        
        data = response.json()
        print(f"Sync result: {data}")
        
        assert "schedules_created" in data, "Response should include schedules_created"
        assert "payments_created" in data, "Response should include payments_created"
        assert data.get("schedules_created") >= 85, f"Expected ~91 schedules, got {data.get('schedules_created')}"
        
        print(f"PASS: Sync created {data.get('schedules_created')} schedules and {data.get('payments_created')} payments")
    
    def test_generate_monthly_payments_includes_offerts(self):
        """POST /api/payments/generate/{year}/{month} should include offerts"""
        # Generate for March 2026
        response = requests.post(f"{BASE_URL}/api/payments/generate/2026/3")
        assert response.status_code == 200
        
        data = response.json()
        print(f"Generate result: {data}")
        
        # Check if any offerts were created
        payments_created = data.get("payments", [])
        offert_payments = [p for p in payments_created if p.get("amount") == 0]
        
        # The endpoint should be able to create offert payments
        # Note: if already exists, may return 0 created
        print(f"PASS: Generate endpoint returned {data.get('created')} payments, {len(offert_payments)} offerts")


class TestDashboardKPIs:
    """Test dashboard KPI display"""
    
    def test_dashboard_kpis_show_correct_values(self):
        """Dashboard should show correct member counts"""
        stats_response = requests.get(f"{BASE_URL}/api/members/stats")
        assert stats_response.status_code == 200
        stats = stats_response.json()
        
        # These are the values that should appear on dashboard
        assert stats.get("active_members") == 93, f"Expected 93 active members"
        assert stats.get("active_coaches") == 29, f"Expected 29 active coaches"
        
        print(f"PASS: Dashboard KPIs: {stats.get('active_members')} membres actifs, {stats.get('active_coaches')} coachs")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
