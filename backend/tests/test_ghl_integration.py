"""
GHL (GoHighLevel) Integration Tests - Iteration 28
Tests for GHL funnel sync endpoints
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestGHLLastSync:
    """Test GET /api/ghl/last-sync endpoint"""
    
    def test_last_sync_returns_status(self):
        """Should return no_sync status or sync record"""
        response = requests.get(f"{BASE_URL}/api/ghl/last-sync")
        assert response.status_code == 200
        data = response.json()
        # Should have either "status": "no_sync" or "status": "success"
        assert "status" in data
        if data["status"] == "no_sync":
            assert "message" in data
            print(f"PASS: No sync yet - {data['message']}")
        elif data["status"] == "success":
            assert "funnel" in data
            assert "synced_at" in data
            print(f"PASS: Last sync found at {data['synced_at']}")


class TestGHLSync:
    """Test POST /api/ghl/sync endpoint - expected to fail with 502 due to invalid API key"""
    
    def test_sync_returns_502_with_invalid_key(self):
        """Sync should return 502 with error message when GHL API key is invalid"""
        response = requests.post(f"{BASE_URL}/api/ghl/sync")
        # Expected: 502 because GHL API key is invalid
        assert response.status_code == 502, f"Expected 502, got {response.status_code}"
        data = response.json()
        assert "detail" in data
        # Should contain info about the API error
        assert "GHL API error" in data["detail"] or "401" in data["detail"]
        print(f"PASS: Sync returns 502 with error - {data['detail'][:100]}...")


class TestGHLConfirmSale:
    """Test POST /api/ghl/confirm-sale endpoint"""
    
    def test_confirm_sale_creates_record(self):
        """Should create a sale record with all fields"""
        unique_id = str(uuid.uuid4())[:8]
        payload = {
            "opportunity_id": f"test-opp-{unique_id}",
            "opportunity_name": "Test Customer",
            "subscription_type": "6 Week Challenge",
            "cash_collected": 599,
            "month": "2024-12"
        }
        response = requests.post(f"{BASE_URL}/api/ghl/confirm-sale", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data["opportunity_id"] == payload["opportunity_id"]
        assert data["opportunity_name"] == payload["opportunity_name"]
        assert data["subscription_type"] == payload["subscription_type"]
        assert data["cash_collected"] == payload["cash_collected"]
        assert data["month"] == payload["month"]
        assert "confirmed_at" in data
        print(f"PASS: Sale confirmed - {data['opportunity_name']} ({data['cash_collected']} CHF)")
    
    def test_confirm_sale_requires_opportunity_id(self):
        """Should return 400 if opportunity_id is missing"""
        payload = {
            "opportunity_name": "Test Customer",
            "subscription_type": "Mensuel"
        }
        response = requests.post(f"{BASE_URL}/api/ghl/confirm-sale", json=payload)
        assert response.status_code == 400
        data = response.json()
        assert "opportunity_id required" in data["detail"]
        print("PASS: Missing opportunity_id returns 400")
    
    def test_confirm_sale_defaults(self):
        """Should use default values for optional fields"""
        unique_id = str(uuid.uuid4())[:8]
        payload = {
            "opportunity_id": f"test-default-{unique_id}"
        }
        response = requests.post(f"{BASE_URL}/api/ghl/confirm-sale", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data["subscription_type"] == "6 Week Challenge"  # default
        assert data["cash_collected"] == 599  # default
        # month should default to current month
        assert "month" in data
        print(f"PASS: Defaults applied - {data['subscription_type']}, {data['cash_collected']} CHF")


class TestGHLSales:
    """Test GET /api/ghl/sales/{month} endpoint"""
    
    def test_get_sales_for_month(self):
        """Should return list of sales for given month"""
        response = requests.get(f"{BASE_URL}/api/ghl/sales/2024-12")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Found {len(data)} sales for 2024-12")
        
        # Verify structure if sales exist
        if len(data) > 0:
            sale = data[0]
            assert "opportunity_id" in sale
            assert "opportunity_name" in sale
            assert "subscription_type" in sale
            assert "cash_collected" in sale
            assert "month" in sale
            assert "confirmed_at" in sale
            print(f"  - First sale: {sale['opportunity_name']} ({sale['cash_collected']} CHF)")
    
    def test_get_sales_empty_month(self):
        """Should return empty list for month with no sales"""
        response = requests.get(f"{BASE_URL}/api/ghl/sales/2020-01")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0
        print("PASS: Empty month returns empty list")


class TestGHLSyncHistory:
    """Test GET /api/ghl/sync-history endpoint"""
    
    def test_sync_history_returns_list(self):
        """Should return list of sync attempts"""
        response = requests.get(f"{BASE_URL}/api/ghl/sync-history")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Found {len(data)} sync history records")
        
        # Verify structure if history exists
        if len(data) > 0:
            record = data[0]
            assert "status" in record
            assert "synced_at" in record
            # If error, should have error field
            if record["status"] == "error":
                assert "error" in record
                print(f"  - Latest: {record['status']} - {record['error'][:50]}...")
            else:
                print(f"  - Latest: {record['status']}")


class TestGHLDataPersistence:
    """Test data persistence - Create sale and verify it appears in GET"""
    
    def test_sale_persists_and_retrieved(self):
        """Create a sale and verify it can be retrieved"""
        unique_id = str(uuid.uuid4())[:8]
        payload = {
            "opportunity_id": f"persist-test-{unique_id}",
            "opportunity_name": f"Persistence Test {unique_id}",
            "subscription_type": "Annuel",
            "cash_collected": 1200,
            "month": "2024-11"
        }
        
        # Create sale
        create_response = requests.post(f"{BASE_URL}/api/ghl/confirm-sale", json=payload)
        assert create_response.status_code == 200
        
        # Retrieve sales for that month
        get_response = requests.get(f"{BASE_URL}/api/ghl/sales/2024-11")
        assert get_response.status_code == 200
        
        sales = get_response.json()
        # Find our created sale
        found = False
        for sale in sales:
            if sale["opportunity_id"] == payload["opportunity_id"]:
                found = True
                assert sale["opportunity_name"] == payload["opportunity_name"]
                assert sale["subscription_type"] == payload["subscription_type"]
                assert sale["cash_collected"] == payload["cash_collected"]
                break
        
        assert found, f"Created sale not found in GET response"
        print(f"PASS: Sale persisted and retrieved - {payload['opportunity_name']}")
