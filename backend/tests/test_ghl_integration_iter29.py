"""
GHL (GoHighLevel) Integration Tests - Iteration 29
Tests for GHL funnel sync endpoints with working PIT token
GHL API is NOW WORKING - sync returns real data (684 opportunities, 33 showed_sold)
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestGHLSync:
    """Test POST /api/ghl/sync endpoint - Now working with valid PIT token"""
    
    def test_sync_returns_success_with_funnel_data(self):
        """Sync should return status 'success' with funnel data and total_opportunities"""
        response = requests.post(f"{BASE_URL}/api/ghl/sync", timeout=60)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify structure
        assert data.get("status") == "success"
        assert "funnel" in data
        assert "total_opportunities" in data
        
        # Verify expected data (684+ opportunities)
        assert data["total_opportunities"] >= 684, f"Expected 684+ opportunities, got {data['total_opportunities']}"
        
        # Verify funnel stages
        funnel = data["funnel"]
        assert "new_leads" in funnel
        assert "confirmed_appointment" in funnel
        assert "showed_sold" in funnel
        assert funnel["showed_sold"] >= 33, f"Expected 33+ showed_sold, got {funnel['showed_sold']}"
        
        print(f"PASS: Sync success - {data['total_opportunities']} opportunities, {funnel['showed_sold']} Ventes")


class TestGHLLastSync:
    """Test GET /api/ghl/last-sync endpoint"""
    
    def test_last_sync_returns_successful_sync_with_data(self):
        """Should return the most recent successful sync with funnel + total_opportunities"""
        response = requests.get(f"{BASE_URL}/api/ghl/last-sync", timeout=30)
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("status") == "success"
        assert "funnel" in data
        assert "total_opportunities" in data
        assert "synced_at" in data
        
        # Verify expected values
        assert data["total_opportunities"] >= 684
        assert data["funnel"]["showed_sold"] >= 33
        
        print(f"PASS: Last sync - {data['total_opportunities']} opps, synced at {data['synced_at']}")


class TestGHLConfirmSale:
    """Test POST /api/ghl/confirm-sale endpoint"""
    
    def test_confirm_sale_with_full_payload(self):
        """Should create a sale record with opportunity_id, opportunity_name, subscription_type, cash_collected, month"""
        unique_id = str(uuid.uuid4())[:8]
        payload = {
            "opportunity_id": f"test-iter29-{unique_id}",
            "opportunity_name": f"Test Customer Iter29 {unique_id}",
            "subscription_type": "6 Week Challenge",
            "cash_collected": 599,
            "month": "2026-03"
        }
        response = requests.post(f"{BASE_URL}/api/ghl/confirm-sale", json=payload, timeout=30)
        assert response.status_code == 200
        
        data = response.json()
        assert data["opportunity_id"] == payload["opportunity_id"]
        assert data["opportunity_name"] == payload["opportunity_name"]
        assert data["subscription_type"] == payload["subscription_type"]
        assert data["cash_collected"] == payload["cash_collected"]
        assert data["month"] == payload["month"]
        assert "confirmed_at" in data
        
        print(f"PASS: Sale confirmed - {data['opportunity_name']} ({data['cash_collected']} CHF)")
    
    def test_confirm_sale_with_different_subscription_types(self):
        """Test confirming sales with different subscription types"""
        subscription_types = [
            ("Mensuel", 120),
            ("3 Mois", 350),
            ("6 Mois", 650),
            ("Annuel", 1200),
        ]
        
        for sub_type, amount in subscription_types:
            unique_id = str(uuid.uuid4())[:8]
            payload = {
                "opportunity_id": f"test-sub-{sub_type.replace(' ', '-')}-{unique_id}",
                "opportunity_name": f"Test {sub_type}",
                "subscription_type": sub_type,
                "cash_collected": amount,
                "month": "2026-03"
            }
            response = requests.post(f"{BASE_URL}/api/ghl/confirm-sale", json=payload, timeout=30)
            assert response.status_code == 200
            data = response.json()
            assert data["subscription_type"] == sub_type
            assert data["cash_collected"] == amount
        
        print(f"PASS: All subscription types work correctly")
    
    def test_confirm_sale_requires_opportunity_id(self):
        """Should return 400 if opportunity_id is missing"""
        payload = {
            "opportunity_name": "Test Customer",
            "subscription_type": "Mensuel"
        }
        response = requests.post(f"{BASE_URL}/api/ghl/confirm-sale", json=payload, timeout=30)
        assert response.status_code == 400
        data = response.json()
        assert "opportunity_id required" in data["detail"]
        print("PASS: Missing opportunity_id returns 400")


class TestGHLSales:
    """Test GET /api/ghl/sales/{month} endpoint"""
    
    def test_get_sales_for_march_2026(self):
        """Should return confirmed sales for 2026-03"""
        response = requests.get(f"{BASE_URL}/api/ghl/sales/2026-03", timeout=30)
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Found {len(data)} sales for 2026-03")
        
        # Verify structure if sales exist
        if len(data) > 0:
            sale = data[0]
            assert "opportunity_id" in sale
            assert "opportunity_name" in sale
            assert "subscription_type" in sale
            assert "cash_collected" in sale
            assert "month" in sale
            assert "confirmed_at" in sale
    
    def test_create_and_retrieve_sale(self):
        """Create a sale and verify it can be retrieved in the sales list"""
        unique_id = str(uuid.uuid4())[:8]
        payload = {
            "opportunity_id": f"retrieve-test-{unique_id}",
            "opportunity_name": f"Retrieve Test {unique_id}",
            "subscription_type": "Annuel",
            "cash_collected": 1200,
            "month": "2026-03"
        }
        
        # Create sale
        create_response = requests.post(f"{BASE_URL}/api/ghl/confirm-sale", json=payload, timeout=30)
        assert create_response.status_code == 200
        
        # Retrieve sales for that month
        get_response = requests.get(f"{BASE_URL}/api/ghl/sales/2026-03", timeout=30)
        assert get_response.status_code == 200
        
        sales = get_response.json()
        # Find our created sale
        found = any(s["opportunity_id"] == payload["opportunity_id"] for s in sales)
        assert found, "Created sale not found in GET response"
        
        print(f"PASS: Sale persisted and retrieved - {payload['opportunity_name']}")


class TestConversionRates:
    """Test that sync data enables conversion rate calculations"""
    
    def test_funnel_data_supports_conversion_calculations(self):
        """Verify funnel data can be used to calculate conversion rates"""
        response = requests.get(f"{BASE_URL}/api/ghl/last-sync", timeout=30)
        assert response.status_code == 200
        
        data = response.json()
        funnel = data.get("funnel", {})
        total_opps = data.get("total_opportunities", 0)
        
        # Calculate rates (same as frontend)
        # Taux RDV = confirmed_appointment / total_opportunities
        confirmed = funnel.get("confirmed_appointment", 0)
        rdv_rate = (confirmed / total_opps * 100) if total_opps > 0 else 0
        
        # Taux Présence (Show Rate)
        showed = funnel.get("showed_sold", 0) + funnel.get("showed_lost", 0)
        no_showed = funnel.get("no_showed", 0)
        total_scheduled = confirmed + no_showed + showed
        presence_rate = (showed / total_scheduled * 100) if total_scheduled > 0 else 0
        
        # Taux Closing
        showed_sold = funnel.get("showed_sold", 0)
        showed_lost = funnel.get("showed_lost", 0)
        total_showed = showed_sold + showed_lost
        closing_rate = (showed_sold / total_showed * 100) if total_showed > 0 else 0
        
        print(f"Conversion Rates:")
        print(f"  - Taux RDV: {rdv_rate:.1f}%")
        print(f"  - Taux Présence: {presence_rate:.1f}%")
        print(f"  - Taux Closing: {closing_rate:.1f}%")
        
        # Basic sanity checks
        assert total_opps >= 684
        assert showed_sold >= 33
        print("PASS: Funnel data supports conversion calculations")
