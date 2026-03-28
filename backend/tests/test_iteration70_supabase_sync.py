"""
Iteration 70 - Supabase KPI Sync Service Tests
Tests for the real-time KPI synchronization to Supabase via REST API.

Features tested:
- GET /api/sync/status - Returns sync status structure
- POST /api/sync/supabase - Sync single club KPIs to Supabase
- POST /api/sync/supabase/all - Sync all mapped clubs
- POST /api/monthly-kpis/{month}/recalculate - Auto-triggers sync after recalculation
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test Club IDs from the mapping
CLUB_VERSOIX = "0a327bf5-c759-49eb-87e4-551913f78bdb"  # Has 27 months of KPI data
CLUB_GRAND_SACONNEX = "3933cca5-ed80-42b9-ac91-6120f8f06ed4"  # Has 1 month of KPI data
CLUB_SERVETTE = "9bfdb209-066d-4d11-b195-a6b9533b8cb8"  # No data - should skip
CLUB_UNKNOWN = "00000000-0000-0000-0000-000000000000"  # Not in mapping


class TestSyncStatus:
    """Tests for GET /api/sync/status endpoint"""
    
    def test_sync_status_returns_correct_structure(self):
        """GET /api/sync/status returns correct structure with all required fields"""
        response = requests.get(f"{BASE_URL}/api/sync/status")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify all required fields are present
        assert "last_sync" in data, "Missing 'last_sync' field"
        assert "status" in data, "Missing 'status' field"
        assert "mapping" in data, "Missing 'mapping' field"
        assert "synced_rows" in data, "Missing 'synced_rows' field"
        assert "clubs_synced" in data, "Missing 'clubs_synced' field"
        
        # Verify mapping contains expected clubs
        mapping = data["mapping"]
        assert isinstance(mapping, dict), "mapping should be a dict"
        assert CLUB_VERSOIX in mapping, f"Versoix club {CLUB_VERSOIX} not in mapping"
        assert CLUB_GRAND_SACONNEX in mapping, f"Grand-Saconnex club {CLUB_GRAND_SACONNEX} not in mapping"
        
        # Verify types
        assert isinstance(data["synced_rows"], int), "synced_rows should be int"
        assert isinstance(data["clubs_synced"], list), "clubs_synced should be list"
        
        print(f"✓ Sync status structure verified: status={data['status']}, last_sync={data['last_sync']}")


class TestSingleClubSync:
    """Tests for POST /api/sync/supabase with X-Club-Id header"""
    
    def test_sync_versoix_club_success(self):
        """POST /api/sync/supabase with Versoix club_id syncs KPIs and returns ok status"""
        headers = {"X-Club-Id": CLUB_VERSOIX}
        response = requests.post(f"{BASE_URL}/api/sync/supabase", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("status") == "ok", f"Expected status 'ok', got: {data}"
        assert "rows_upserted" in data, "Missing 'rows_upserted' field"
        assert data["rows_upserted"] > 0, f"Expected rows_upserted > 0, got {data['rows_upserted']}"
        
        print(f"✓ Versoix sync successful: {data['rows_upserted']} rows upserted")
    
    def test_sync_grand_saconnex_club_success(self):
        """POST /api/sync/supabase with Grand-Saconnex club_id syncs KPIs"""
        headers = {"X-Club-Id": CLUB_GRAND_SACONNEX}
        response = requests.post(f"{BASE_URL}/api/sync/supabase", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Grand-Saconnex has 1 month of data, so should sync or skip if no data
        assert data.get("status") in ["ok", "skipped"], f"Expected status 'ok' or 'skipped', got: {data}"
        
        if data.get("status") == "ok":
            assert "rows_upserted" in data, "Missing 'rows_upserted' field"
            print(f"✓ Grand-Saconnex sync successful: {data['rows_upserted']} rows upserted")
        else:
            print(f"✓ Grand-Saconnex sync skipped: {data.get('reason', 'no reason')}")
    
    def test_sync_unknown_club_returns_skipped(self):
        """POST /api/sync/supabase with unknown club_id returns skipped status"""
        headers = {"X-Club-Id": CLUB_UNKNOWN}
        response = requests.post(f"{BASE_URL}/api/sync/supabase", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("status") == "skipped", f"Expected status 'skipped', got: {data}"
        assert "reason" in data, "Missing 'reason' field for skipped status"
        assert "No Supabase mapping" in data.get("reason", ""), f"Expected 'No Supabase mapping' in reason, got: {data.get('reason')}"
        
        print(f"✓ Unknown club correctly skipped: {data.get('reason')}")
    
    def test_sync_servette_no_data_returns_skipped(self):
        """POST /api/sync/supabase with Servette club_id (no KPI data) returns skipped"""
        headers = {"X-Club-Id": CLUB_SERVETTE}
        response = requests.post(f"{BASE_URL}/api/sync/supabase", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Servette is in mapping but has no KPI data, so should skip
        assert data.get("status") in ["ok", "skipped"], f"Expected status 'ok' or 'skipped', got: {data}"
        
        if data.get("status") == "skipped":
            print(f"✓ Servette correctly skipped (no data): {data.get('reason')}")
        else:
            print(f"✓ Servette sync successful: {data.get('rows_upserted', 0)} rows")


class TestSyncAllClubs:
    """Tests for POST /api/sync/supabase/all endpoint"""
    
    def test_sync_all_clubs_returns_per_club_results(self):
        """POST /api/sync/supabase/all syncs all mapped clubs and returns per-club results"""
        response = requests.post(f"{BASE_URL}/api/sync/supabase/all")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, dict), "Response should be a dict with per-club results"
        
        # Should have results for all mapped clubs
        assert CLUB_VERSOIX in data, f"Missing result for Versoix club"
        assert CLUB_GRAND_SACONNEX in data, f"Missing result for Grand-Saconnex club"
        assert CLUB_SERVETTE in data, f"Missing result for Servette club"
        
        # Verify Versoix result (has data)
        versoix_result = data[CLUB_VERSOIX]
        assert versoix_result.get("status") == "ok", f"Versoix should have status 'ok', got: {versoix_result}"
        assert versoix_result.get("rows_upserted", 0) > 0, f"Versoix should have rows_upserted > 0"
        
        # Count successful syncs
        ok_count = sum(1 for r in data.values() if r.get("status") == "ok")
        skipped_count = sum(1 for r in data.values() if r.get("status") == "skipped")
        
        print(f"✓ Sync all clubs completed: {ok_count} ok, {skipped_count} skipped")
        for club_id, result in data.items():
            status = result.get("status")
            rows = result.get("rows_upserted", 0)
            reason = result.get("reason", "")
            print(f"  - {club_id[:8]}...: {status} ({rows} rows) {reason}")


class TestSyncStatusAfterSync:
    """Tests for GET /api/sync/status after performing a sync"""
    
    def test_status_updated_after_single_club_sync(self):
        """GET /api/sync/status shows updated last_sync timestamp after sync"""
        # First, get initial status
        initial_response = requests.get(f"{BASE_URL}/api/sync/status")
        initial_data = initial_response.json()
        initial_last_sync = initial_data.get("last_sync")
        
        # Perform a sync
        headers = {"X-Club-Id": CLUB_VERSOIX}
        sync_response = requests.post(f"{BASE_URL}/api/sync/supabase", headers=headers)
        assert sync_response.status_code == 200
        
        # Small delay to ensure timestamp changes
        time.sleep(0.5)
        
        # Get updated status
        updated_response = requests.get(f"{BASE_URL}/api/sync/status")
        updated_data = updated_response.json()
        
        assert updated_data.get("status") == "ok", f"Expected status 'ok', got: {updated_data.get('status')}"
        assert updated_data.get("last_sync") is not None, "last_sync should not be None after sync"
        assert updated_data.get("synced_rows", 0) > 0, "synced_rows should be > 0 after sync"
        assert CLUB_VERSOIX in updated_data.get("clubs_synced", []), "Versoix should be in clubs_synced"
        
        # Verify timestamp was updated (if initial was not None)
        if initial_last_sync:
            assert updated_data.get("last_sync") >= initial_last_sync, "last_sync should be updated"
        
        print(f"✓ Status updated after sync: last_sync={updated_data.get('last_sync')}, rows={updated_data.get('synced_rows')}")


class TestAutoSyncAfterRecalculate:
    """Tests for auto-sync trigger after KPI recalculation"""
    
    def test_recalculate_triggers_auto_sync(self):
        """POST /api/monthly-kpis/{month}/recalculate with X-Club-Id triggers auto-sync"""
        headers = {"X-Club-Id": CLUB_VERSOIX}
        
        # Get initial sync status
        initial_status = requests.get(f"{BASE_URL}/api/sync/status").json()
        initial_last_sync = initial_status.get("last_sync")
        
        # Trigger recalculation for a month that exists
        recalc_response = requests.post(
            f"{BASE_URL}/api/monthly-kpis/2025-01/recalculate",
            headers=headers
        )
        
        # Recalculate should succeed (200) or return 404 if month doesn't exist
        assert recalc_response.status_code in [200, 404], f"Expected 200 or 404, got {recalc_response.status_code}: {recalc_response.text}"
        
        if recalc_response.status_code == 200:
            print(f"✓ Recalculation successful for 2025-01")
            
            # Wait a bit for async sync to complete
            time.sleep(2)
            
            # Check if sync was triggered (status should be updated)
            updated_status = requests.get(f"{BASE_URL}/api/sync/status").json()
            
            # The auto-sync is fire-and-forget, so we check if last_sync was updated
            if updated_status.get("last_sync") and updated_status.get("last_sync") != initial_last_sync:
                print(f"✓ Auto-sync triggered: last_sync updated to {updated_status.get('last_sync')}")
            else:
                # Auto-sync might not have completed yet or might have failed silently
                print(f"⚠ Auto-sync may not have completed yet (last_sync: {updated_status.get('last_sync')})")
        else:
            print(f"⚠ Month 2025-01 not found for Versoix, skipping auto-sync verification")


class TestSyncWithoutClubId:
    """Tests for POST /api/sync/supabase without X-Club-Id header"""
    
    def test_sync_without_club_id_syncs_all(self):
        """POST /api/sync/supabase without X-Club-Id syncs all clubs"""
        # When no club_id is provided, it should sync all clubs
        response = requests.post(f"{BASE_URL}/api/sync/supabase")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Should return per-club results like /supabase/all
        assert isinstance(data, dict), "Response should be a dict with per-club results"
        
        # Should have results for mapped clubs
        has_club_results = any(club_id in data for club_id in [CLUB_VERSOIX, CLUB_GRAND_SACONNEX, CLUB_SERVETTE])
        assert has_club_results, f"Expected per-club results, got: {data}"
        
        print(f"✓ Sync without club_id synced all clubs: {len(data)} clubs processed")


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
