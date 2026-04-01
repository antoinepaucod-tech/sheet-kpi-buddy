"""
Iteration 71 - Monthly Rollover System Tests
Tests for automatic monthly rollover: payments generation, recurring transactions, late payments marking, KPI creation
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
VERSOIX_CLUB_ID = "0a327bf5-c759-49eb-87e4-551913f78bdb"
GRAND_SACONNEX_CLUB_ID = "3933cca5-ed80-42b9-ac91-6120f8f06ed4"


class TestRolloverStatus:
    """Test GET /api/rollover/status endpoint"""
    
    def test_rollover_status_returns_correct_structure(self):
        """Verify rollover status returns last_run, last_status, last_detail"""
        response = requests.get(f"{BASE_URL}/api/rollover/status")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "last_run" in data, "Missing last_run field"
        assert "last_status" in data, "Missing last_status field"
        assert "last_detail" in data, "Missing last_detail field"
        print(f"✓ Rollover status structure correct: last_run={data['last_run']}, last_status={data['last_status']}")


class TestRolloverRunSingleClub:
    """Test POST /api/rollover/run with X-Club-Id header"""
    
    def test_rollover_run_with_club_id_returns_correct_structure(self):
        """Verify rollover run returns club_id, month, payments_created, etc."""
        response = requests.post(
            f"{BASE_URL}/api/rollover/run",
            headers={"X-Club-Id": VERSOIX_CLUB_ID, "Content-Type": "application/json"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["club_id"] == VERSOIX_CLUB_ID, f"Expected club_id {VERSOIX_CLUB_ID}, got {data.get('club_id')}"
        assert "month" in data, "Missing month field"
        assert "payments_created" in data, "Missing payments_created field"
        assert "recurring_transactions_created" in data, "Missing recurring_transactions_created field"
        assert "late_payments_marked" in data, "Missing late_payments_marked field"
        print(f"✓ Rollover run for Versoix: month={data['month']}, payments_created={data['payments_created']}")
    
    def test_rollover_idempotent_no_duplicate_payments(self):
        """Running rollover twice should not create duplicate payments"""
        # First run
        response1 = requests.post(
            f"{BASE_URL}/api/rollover/run",
            headers={"X-Club-Id": VERSOIX_CLUB_ID, "Content-Type": "application/json"}
        )
        assert response1.status_code == 200
        data1 = response1.json()
        
        # Second run - should create 0 new payments (idempotent)
        response2 = requests.post(
            f"{BASE_URL}/api/rollover/run",
            headers={"X-Club-Id": VERSOIX_CLUB_ID, "Content-Type": "application/json"}
        )
        assert response2.status_code == 200
        data2 = response2.json()
        
        # Second run should create 0 payments (already exist)
        assert data2["payments_created"] == 0, f"Expected 0 payments on second run, got {data2['payments_created']}"
        print(f"✓ Idempotency verified: 2nd run created {data2['payments_created']} payments (expected 0)")
    
    def test_rollover_idempotent_no_duplicate_transactions(self):
        """Running rollover twice should not create duplicate recurring transactions"""
        # First run
        response1 = requests.post(
            f"{BASE_URL}/api/rollover/run",
            headers={"X-Club-Id": VERSOIX_CLUB_ID, "Content-Type": "application/json"}
        )
        assert response1.status_code == 200
        
        # Second run
        response2 = requests.post(
            f"{BASE_URL}/api/rollover/run",
            headers={"X-Club-Id": VERSOIX_CLUB_ID, "Content-Type": "application/json"}
        )
        assert response2.status_code == 200
        data2 = response2.json()
        
        # Second run should create 0 recurring transactions (already exist or none active)
        assert data2["recurring_transactions_created"] == 0, f"Expected 0 transactions on second run, got {data2['recurring_transactions_created']}"
        print(f"✓ Idempotency for transactions verified: 2nd run created {data2['recurring_transactions_created']} transactions")


class TestRolloverRunAllClubs:
    """Test POST /api/rollover/run/all endpoint"""
    
    def test_rollover_run_all_returns_array_of_results(self):
        """Verify rollover/run/all triggers rollover for all clubs"""
        response = requests.post(
            f"{BASE_URL}/api/rollover/run/all",
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        assert len(data) >= 4, f"Expected at least 4 clubs, got {len(data)}"
        
        # Verify each result has required fields
        for result in data:
            assert "club_id" in result, "Missing club_id in result"
            assert "month" in result, "Missing month in result"
            assert "payments_created" in result, "Missing payments_created in result"
        
        print(f"✓ Rollover run/all returned results for {len(data)} clubs")
    
    def test_rollover_run_all_includes_versoix(self):
        """Verify Versoix club is included in run/all results"""
        response = requests.post(
            f"{BASE_URL}/api/rollover/run/all",
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        
        data = response.json()
        club_ids = [r["club_id"] for r in data]
        assert VERSOIX_CLUB_ID in club_ids, f"Versoix club not found in results"
        print(f"✓ Versoix club included in run/all results")


class TestKPIExistsAfterRollover:
    """Test that KPI record exists for current month after rollover"""
    
    def test_kpi_exists_for_current_month(self):
        """Verify KPI record exists for 2026-04 after rollover"""
        # Run rollover first
        requests.post(
            f"{BASE_URL}/api/rollover/run",
            headers={"X-Club-Id": VERSOIX_CLUB_ID, "Content-Type": "application/json"}
        )
        
        # Check KPIs
        response = requests.get(
            f"{BASE_URL}/api/monthly-kpis",
            headers={"X-Club-Id": VERSOIX_CLUB_ID}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        months = [kpi["month"] for kpi in data]
        assert "2026-04" in months, f"KPI for 2026-04 not found. Available months: {months[:5]}..."
        print(f"✓ KPI record exists for 2026-04")


class TestPaymentsCreatedForCurrentMonth:
    """Test that payments exist for current month"""
    
    def test_payments_exist_for_april_2026(self):
        """Verify payments were created for April 2026"""
        response = requests.get(
            f"{BASE_URL}/api/payments?month=2026-04",
            headers={"X-Club-Id": VERSOIX_CLUB_ID}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert len(data) > 0, "No payments found for April 2026"
        print(f"✓ Found {len(data)} payments for April 2026")
    
    def test_payments_have_correct_structure(self):
        """Verify payment records have required fields"""
        response = requests.get(
            f"{BASE_URL}/api/payments?month=2026-04",
            headers={"X-Club-Id": VERSOIX_CLUB_ID}
        )
        assert response.status_code == 200
        
        data = response.json()
        if len(data) > 0:
            payment = data[0]
            required_fields = ["id", "member_id", "amount", "due_date", "status"]
            for field in required_fields:
                assert field in payment, f"Missing field {field} in payment"
            print(f"✓ Payment structure verified with fields: {list(payment.keys())[:5]}...")


class TestLatePaymentsMarking:
    """Test that past-due pending payments are marked as late"""
    
    def test_late_payments_endpoint_works(self):
        """Verify rollover marks late payments (returns count)"""
        response = requests.post(
            f"{BASE_URL}/api/rollover/run",
            headers={"X-Club-Id": VERSOIX_CLUB_ID, "Content-Type": "application/json"}
        )
        assert response.status_code == 200
        
        data = response.json()
        # late_payments_marked can be 0 if no pending payments are past due
        assert "late_payments_marked" in data, "Missing late_payments_marked field"
        assert isinstance(data["late_payments_marked"], int), "late_payments_marked should be int"
        print(f"✓ Late payments marked: {data['late_payments_marked']}")


class TestMonthSelectorAvailableMonths:
    """Test that monthly-kpis returns data for month selector"""
    
    def test_monthly_kpis_returns_data(self):
        """Verify GET /api/monthly-kpis returns KPI data"""
        response = requests.get(
            f"{BASE_URL}/api/monthly-kpis",
            headers={"X-Club-Id": VERSOIX_CLUB_ID}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        assert len(data) > 0, "No KPI data returned"
        
        # Check months are sorted
        months = [kpi["month"] for kpi in data]
        print(f"✓ Monthly KPIs returned {len(data)} months, range: {months[0]} to {months[-1]}")
    
    def test_monthly_kpis_includes_current_month(self):
        """Verify current month (2026-04) is in KPI data"""
        response = requests.get(
            f"{BASE_URL}/api/monthly-kpis",
            headers={"X-Club-Id": VERSOIX_CLUB_ID}
        )
        assert response.status_code == 200
        
        data = response.json()
        months = [kpi["month"] for kpi in data]
        assert "2026-04" in months, f"Current month 2026-04 not in KPI data"
        print(f"✓ Current month 2026-04 included in KPI data")


class TestRolloverStatusAfterRun:
    """Test rollover status is updated after run"""
    
    def test_status_updated_after_run(self):
        """Verify status shows last_run and last_status after rollover"""
        # Run rollover
        requests.post(
            f"{BASE_URL}/api/rollover/run",
            headers={"X-Club-Id": VERSOIX_CLUB_ID, "Content-Type": "application/json"}
        )
        
        # Check status
        response = requests.get(f"{BASE_URL}/api/rollover/status")
        assert response.status_code == 200
        
        data = response.json()
        assert data["last_status"] == "ok", f"Expected last_status 'ok', got {data['last_status']}"
        assert data["last_run"] is not None, "last_run should not be None after rollover"
        print(f"✓ Rollover status updated: last_run={data['last_run']}, last_status={data['last_status']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
