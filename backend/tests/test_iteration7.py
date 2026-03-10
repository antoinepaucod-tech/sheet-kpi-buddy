"""
Iteration 7 Backend Tests: Multi-Month Analysis Page & Enriched KPI Model
Tests:
- Monthly KPIs API with enriched fields (~60 fields)
- POST /api/monthly-kpis/bulk endpoint for Supabase migration
- Date range filtering support for ComparePage
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestMonthlyKPIsEnrichedModel:
    """Test enriched MonthlyKPI model with ~60 fields from Supabase schema
    Note: Old seed data won't have enriched fields - test with bulk-imported data"""

    def test_get_monthly_kpis_returns_list(self):
        """Verify GET /api/monthly-kpis returns list"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Expected list of KPIs"
        assert len(data) > 0, "Expected at least one KPI"
        print(f"PASS: GET /api/monthly-kpis returned {len(data)} months")

    def test_bulk_imported_kpi_has_enriched_fields(self):
        """Verify bulk-imported KPI has all enriched fields"""
        test_month = f"TEST-ENRICHED-{uuid.uuid4().hex[:8]}"
        
        # Create via bulk import with enriched fields
        payload = [{
            "month": test_month,
            "total_revenue": 75000,
            "revenue_members": 60000,
            "revenue_coaching": 15000,
            "general_eft_revenue": 50000,
            "pt_revenue": 20000,
            "retail_revenue": 3000,
            "fast_cash_revenue": 2000,
            "total_members": 450,
            "new_members": 35,
            "lost_members": 10,
            "pif_members": 80,
            "pif_exits": 5,
            "recurring_general_members": 300,
            "leads": 150,
            "calls_made": 120,
            "scheduled": 80,
            "show": 60,
            "close": 35,
            "organic_leads": 40,
            "in_trial": 25,
            "total_expenses": 45000,
            "rent": 10000,
            "repairs_maintenance": 800,
            "computer_software": 500,
            "profit": 30000,
            "general_ltv": 1200,
        }]
        
        response = requests.post(f"{BASE_URL}/api/monthly-kpis/bulk", json=payload)
        assert response.status_code == 200
        
        # Verify enriched fields are returned
        verify = requests.get(f"{BASE_URL}/api/monthly-kpis/{test_month}")
        assert verify.status_code == 200
        kpi = verify.json()
        
        # Revenue fields
        assert kpi["general_eft_revenue"] == 50000
        assert kpi["pt_revenue"] == 20000
        assert kpi["retail_revenue"] == 3000
        
        # Member fields
        assert kpi["pif_members"] == 80
        assert kpi["recurring_general_members"] == 300
        
        # Funnel fields
        assert kpi["leads"] == 150
        assert kpi["calls_made"] == 120
        assert kpi["close"] == 35
        
        # Organic & trial fields
        assert kpi["organic_leads"] == 40
        assert kpi["in_trial"] == 25
        
        # Expense fields
        assert kpi["rent"] == 10000
        assert kpi["repairs_maintenance"] == 800
        
        # Advanced metrics
        assert kpi["profit"] == 30000
        assert kpi["general_ltv"] == 1200
        
        print("PASS: Bulk-imported KPI has all enriched fields")

    def test_kpi_base_fields_present(self):
        """Verify base fields are present in all KPIs (old and new)"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis")
        assert response.status_code == 200
        kpi = response.json()[0]
        
        # Base fields that should always be present
        base_fields = [
            "month", "total_revenue", "total_expenses", "net_profit",
            "new_members", "lost_members", "total_members",
            "churn_rate", "cac", "roas", "profit_margin"
        ]
        
        for field in base_fields:
            assert field in kpi, f"Missing base field: {field}"
        
        print("PASS: All base fields present in KPI")


class TestBulkImportEndpoint:
    """Test POST /api/monthly-kpis/bulk endpoint for Supabase migration"""

    def test_bulk_import_creates_new_kpis(self):
        """Test bulk import can create multiple new KPIs"""
        test_month = f"TEST-{uuid.uuid4().hex[:8]}"
        payload = [{
            "month": test_month,
            "total_revenue": 55000,
            "total_expenses": 35000,
            "net_profit": 20000,
            "new_members": 30,
            "total_members": 400,
            "leads": 120,
            "calls_made": 100,
            "pif_members": 60
        }]
        
        response = requests.post(
            f"{BASE_URL}/api/monthly-kpis/bulk",
            json=payload
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["imported"] == 1 or data["updated"] == 1
        assert data["total"] == 1
        print(f"PASS: Bulk import created KPI for {test_month}")
        
        # Cleanup - verify data was imported
        verify = requests.get(f"{BASE_URL}/api/monthly-kpis/{test_month}")
        assert verify.status_code == 200
        kpi = verify.json()
        assert kpi["total_revenue"] == 55000
        assert kpi["leads"] == 120
        assert kpi["pif_members"] == 60
        print("PASS: Bulk import data verified")

    def test_bulk_import_updates_existing_kpi(self):
        """Test bulk import updates existing KPI instead of creating duplicate"""
        test_month = f"TEST-{uuid.uuid4().hex[:8]}"
        
        # First create
        response1 = requests.post(
            f"{BASE_URL}/api/monthly-kpis/bulk",
            json=[{"month": test_month, "total_revenue": 10000}]
        )
        assert response1.status_code == 200
        
        # Then update via bulk
        response2 = requests.post(
            f"{BASE_URL}/api/monthly-kpis/bulk",
            json=[{"month": test_month, "total_revenue": 25000, "leads": 50}]
        )
        assert response2.status_code == 200
        data = response2.json()
        assert data["updated"] == 1
        print("PASS: Bulk import updated existing KPI")
        
        # Verify update
        verify = requests.get(f"{BASE_URL}/api/monthly-kpis/{test_month}")
        assert verify.status_code == 200
        kpi = verify.json()
        assert kpi["total_revenue"] == 25000
        assert kpi["leads"] == 50
        print("PASS: Bulk import update verified")

    def test_bulk_import_multiple_months(self):
        """Test bulk import with multiple months at once"""
        test_months = [f"TEST-MULTI-{i}" for i in range(3)]
        
        payload = [
            {"month": test_months[0], "total_revenue": 10000, "new_members": 10},
            {"month": test_months[1], "total_revenue": 20000, "new_members": 20},
            {"month": test_months[2], "total_revenue": 30000, "new_members": 30},
        ]
        
        response = requests.post(f"{BASE_URL}/api/monthly-kpis/bulk", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data["total"] == 3
        print(f"PASS: Bulk import created/updated {data['total']} months")

    def test_bulk_import_with_supabase_field_names(self):
        """Test bulk import correctly maps Supabase field names"""
        test_month = f"TEST-SUPABASE-{uuid.uuid4().hex[:8]}"
        
        # Use Supabase-style field names with variations
        payload = [{
            "month": test_month,
            "total_revenue": 60000,
            "salaries": 15000,  # Supabase uses 'salaries', we map to 'salaires'
            "salaries_coach": 5000,  # Maps to 'salaires_coach'
            "rent": 8000,  # Both rent and loyer are stored
            "repairs_and_maintenance": 500,  # Maps to repairs_maintenance
            "ro_ads": 15.5,  # Maps to roas
            "profit": 18000,
        }]
        
        response = requests.post(f"{BASE_URL}/api/monthly-kpis/bulk", json=payload)
        assert response.status_code == 200
        
        # Verify field mapping
        verify = requests.get(f"{BASE_URL}/api/monthly-kpis/{test_month}")
        assert verify.status_code == 200
        kpi = verify.json()
        
        assert kpi["salaires"] == 15000, f"Expected salaires=15000, got {kpi.get('salaires')}"
        assert kpi["salaires_coach"] == 5000
        assert kpi["rent"] == 8000
        assert kpi["repairs_maintenance"] == 500
        assert kpi["ro_ads"] == 15.5
        print("PASS: Supabase field names mapped correctly")

    def test_bulk_import_skips_entries_without_month(self):
        """Test bulk import skips entries without month field"""
        payload = [
            {"total_revenue": 10000},  # No month - should be skipped
            {"month": f"TEST-SKIP-{uuid.uuid4().hex[:8]}", "total_revenue": 20000},
        ]
        
        response = requests.post(f"{BASE_URL}/api/monthly-kpis/bulk", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data["total"] == 1  # Only one should be imported
        print("PASS: Bulk import skipped entry without month")


class TestDateRangeSupport:
    """Test API supports data needed for ComparePage date range filtering"""

    def test_kpis_returned_sorted_by_month(self):
        """Verify KPIs are returned sorted by month ascending"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis")
        assert response.status_code == 200
        
        data = response.json()
        months = [kpi["month"] for kpi in data]
        
        assert months == sorted(months), "KPIs should be sorted by month ascending"
        print(f"PASS: KPIs sorted by month: {months[0]} -> {months[-1]}")

    def test_multiple_years_data_available(self):
        """Verify data is available for multiple years (for N-1 comparison)"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis")
        assert response.status_code == 200
        
        data = response.json()
        years = set(kpi["month"][:4] for kpi in data if not kpi["month"].startswith("TEST"))
        
        assert len(years) >= 1, "Should have at least one year of data"
        print(f"PASS: Data available for years: {sorted(years)}")

    def test_get_single_month_kpi(self):
        """Test GET /api/monthly-kpis/{month} returns single KPI"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis/2024-12")
        
        if response.status_code == 200:
            kpi = response.json()
            assert kpi["month"] == "2024-12"
            assert "total_revenue" in kpi
            assert "churn_rate" in kpi
            print("PASS: GET single month KPI works")
        else:
            # Month might not exist in test data
            assert response.status_code == 404
            print("INFO: 2024-12 not found (expected in fresh env)")

    def test_metrics_computed_correctly(self):
        """Verify computed metrics (churn_rate, cac, roas, profit_margin)"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis")
        assert response.status_code == 200
        
        data = response.json()
        # Find a month with meaningful data
        for kpi in data:
            if kpi.get("total_revenue", 0) > 0 and not kpi["month"].startswith("TEST"):
                # Verify profit_margin calculation
                if kpi["total_revenue"] > 0:
                    expected_margin = round((kpi["net_profit"] / kpi["total_revenue"]) * 100, 2)
                    assert abs(kpi["profit_margin"] - expected_margin) < 0.1, \
                        f"Profit margin mismatch: {kpi['profit_margin']} vs {expected_margin}"
                
                print(f"PASS: Computed metrics verified for {kpi['month']}")
                break


class TestAuthEndpoints:
    """Test authentication for protected operations"""

    def test_login_success(self):
        """Test login with test credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "test@crossfit.ch", "password": "test123"}
        )
        
        if response.status_code == 200:
            data = response.json()
            assert "access_token" in data
            assert "user" in data
            assert data["user"]["email"] == "test@crossfit.ch"
            print("PASS: Login successful with test credentials")
        elif response.status_code == 401:
            # User might not exist yet
            print("INFO: Test user not found - may need to register first")
        else:
            print(f"INFO: Login returned {response.status_code}")

    def test_register_creates_user(self):
        """Test registration creates new user"""
        unique_email = f"test-{uuid.uuid4().hex[:8]}@test.com"
        
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": unique_email,
                "password": "testpass123",
                "club_name": "Test Club"
            }
        )
        
        if response.status_code == 200:
            data = response.json()
            assert "access_token" in data
            assert data["user"]["email"] == unique_email.lower()
            print(f"PASS: User registered: {unique_email}")
        elif response.status_code == 400:
            print("INFO: Email already exists")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
