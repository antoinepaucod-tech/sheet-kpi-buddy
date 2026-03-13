"""
Iteration 30 Tests - 3 NEW features:
1. Date filters on GHL sync (POST /api/ghl/sync?start_date=X&end_date=Y)
2. PATCH /api/ghl/calls-made - Update calls_made field for a given month
3. PIF Churn % removed from KPIDetailedView (frontend only test)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestGHLSyncDateFilters:
    """Test GHL sync with date filters"""
    
    def test_sync_without_dates_returns_all_opportunities(self):
        """POST /api/ghl/sync without dates should return all opportunities (~684)"""
        response = requests.post(f"{BASE_URL}/api/ghl/sync")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("status") == "success", f"Expected status='success', got {data.get('status')}"
        assert "total_opportunities" in data, "Missing total_opportunities in response"
        assert data["total_opportunities"] > 0, "Expected some opportunities"
        print(f"Total opportunities (no date filter): {data['total_opportunities']}")
        
    def test_sync_with_date_range_filters_results(self):
        """POST /api/ghl/sync?start_date=2025-01-01&end_date=2025-12-31 should return filtered results"""
        response = requests.post(
            f"{BASE_URL}/api/ghl/sync",
            params={"start_date": "2025-01-01", "end_date": "2025-12-31"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("status") == "success", f"Expected status='success', got {data.get('status')}"
        
        # Should have date filters echoed back in response
        assert data.get("start_date") == "2025-01-01", f"Expected start_date='2025-01-01', got {data.get('start_date')}"
        assert data.get("end_date") == "2025-12-31", f"Expected end_date='2025-12-31', got {data.get('end_date')}"
        
        print(f"Total opportunities (2025 filter): {data['total_opportunities']}")
        
    def test_sync_with_partial_date_filter_start_only(self):
        """POST /api/ghl/sync?start_date=2026-01-01 returns opportunities from that date"""
        response = requests.post(
            f"{BASE_URL}/api/ghl/sync",
            params={"start_date": "2026-01-01"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("status") == "success"
        assert data.get("start_date") == "2026-01-01"
        assert data.get("end_date") is None
        print(f"Opportunities from 2026-01-01: {data['total_opportunities']}")
        
    def test_sync_with_partial_date_filter_end_only(self):
        """POST /api/ghl/sync?end_date=2024-12-31 returns opportunities until that date"""
        response = requests.post(
            f"{BASE_URL}/api/ghl/sync",
            params={"end_date": "2024-12-31"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("status") == "success"
        assert data.get("start_date") is None
        assert data.get("end_date") == "2024-12-31"
        print(f"Opportunities until 2024-12-31: {data['total_opportunities']}")


class TestGHLCallsMade:
    """Test PATCH /api/ghl/calls-made endpoint"""
    
    def test_update_calls_made_success(self):
        """PATCH /api/ghl/calls-made with month and calls_made updates KPI"""
        test_month = "2026-01"
        test_calls = 150
        
        response = requests.patch(
            f"{BASE_URL}/api/ghl/calls-made",
            json={"month": test_month, "calls_made": test_calls}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("month") == test_month, f"Expected month={test_month}, got {data.get('month')}"
        assert data.get("calls_made") == test_calls, f"Expected calls_made={test_calls}, got {data.get('calls_made')}"
        
        # call_percentage should be calculated
        if data.get("leads", 0) > 0:
            expected_pct = round((test_calls / data["leads"]) * 100, 1)
            assert data.get("call_percentage") == expected_pct, f"Expected call_percentage={expected_pct}"
        
        print(f"Updated calls_made for {test_month}: {data.get('calls_made')}, call_percentage: {data.get('call_percentage')}")
        
    def test_update_calls_made_requires_month(self):
        """PATCH /api/ghl/calls-made without month returns 400"""
        response = requests.patch(
            f"{BASE_URL}/api/ghl/calls-made",
            json={"calls_made": 100}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        
    def test_update_calls_made_creates_kpi_if_not_exists(self):
        """PATCH /api/ghl/calls-made for a new month creates KPI record"""
        test_month = "2030-12"  # Future month unlikely to exist
        test_calls = 50
        
        response = requests.patch(
            f"{BASE_URL}/api/ghl/calls-made",
            json={"month": test_month, "calls_made": test_calls}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("month") == test_month
        assert data.get("calls_made") == test_calls
        print(f"Created new KPI for {test_month} with calls_made={test_calls}")
        
    def test_verify_calls_made_persists_via_kpi_endpoint(self):
        """After PATCH calls-made, verify it persists via GET /api/monthly-kpis/{month}"""
        test_month = "2026-01"
        test_calls = 200
        
        # Update calls_made
        patch_response = requests.patch(
            f"{BASE_URL}/api/ghl/calls-made",
            json={"month": test_month, "calls_made": test_calls}
        )
        assert patch_response.status_code == 200
        
        # Verify via KPI endpoint (correct path is /api/monthly-kpis/{month})
        get_response = requests.get(f"{BASE_URL}/api/monthly-kpis/{test_month}")
        assert get_response.status_code == 200, f"Expected 200, got {get_response.status_code}"
        
        kpi_data = get_response.json()
        assert kpi_data.get("calls_made") == test_calls, f"Expected calls_made={test_calls} in KPI, got {kpi_data.get('calls_made')}"
        print(f"Verified calls_made={test_calls} persisted in KPI for {test_month}")


class TestGHLLastSync:
    """Test that last-sync reflects date filter usage"""
    
    def test_last_sync_shows_date_filters_used(self):
        """After sync with dates, last-sync should show those dates"""
        # First do a sync with specific dates
        sync_response = requests.post(
            f"{BASE_URL}/api/ghl/sync",
            params={"start_date": "2025-06-01", "end_date": "2025-12-31"}
        )
        assert sync_response.status_code == 200
        
        # Check last-sync
        last_sync_response = requests.get(f"{BASE_URL}/api/ghl/last-sync")
        assert last_sync_response.status_code == 200
        
        data = last_sync_response.json()
        assert data.get("start_date") == "2025-06-01", f"Expected start_date=2025-06-01, got {data.get('start_date')}"
        assert data.get("end_date") == "2025-12-31", f"Expected end_date=2025-12-31, got {data.get('end_date')}"
        print(f"Last sync shows date filters: {data.get('start_date')} to {data.get('end_date')}")
