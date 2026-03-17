"""
Test suite for iteration 51 features:
1. Dashboard KPIs (REVENUS TOTAUX / BÉNÉFICE NET) for March 2026
2. Transaction clickable member links (client_name in details)
3. Renewal cycle selector in members edit form
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


class TestKPIRecalculation:
    """Test KPI auto-recalculate from transactions"""

    def test_march_2026_kpi_values(self, api_client):
        """GET /api/monthly-kpis/2026-03 should return correct total_revenue=4762 and net_profit=2592"""
        response = api_client.get(f"{BASE_URL}/api/monthly-kpis/2026-03")
        assert response.status_code == 200
        
        data = response.json()
        assert "total_revenue" in data
        assert "net_profit" in data
        
        # Expected values based on recalculated transactions
        assert data["total_revenue"] == 4762.0, f"Expected 4762.0, got {data['total_revenue']}"
        assert data["net_profit"] == 2592.0, f"Expected 2592.0, got {data['net_profit']}"
        
    def test_recalculate_endpoint(self, api_client):
        """POST /api/monthly-kpis/2026-03/recalculate should recalculate and return correct data"""
        response = api_client.post(f"{BASE_URL}/api/monthly-kpis/2026-03/recalculate")
        assert response.status_code == 200
        
        data = response.json()
        assert data["total_revenue"] == 4762.0
        assert data["net_profit"] == 2592.0
        assert data["cash_collected"] == 4762.0  # Should also be set

    def test_kpi_details_has_transaction_breakdown(self, api_client):
        """GET /api/monthly-kpis/2026-03/details should return transaction breakdown"""
        response = api_client.get(f"{BASE_URL}/api/monthly-kpis/2026-03/details")
        assert response.status_code == 200
        
        data = response.json()
        assert "revenue_breakdown" in data
        assert "expense_breakdown" in data
        assert "total_revenue_from_transactions" in data
        
        # Verify sum matches
        assert data["total_revenue_from_transactions"] == 4762.0


class TestTransactionClientNames:
    """Test that transactions include client_name for member navigation"""
    
    def test_details_has_client_name_in_transactions(self, api_client):
        """Transaction breakdown should include client_name field"""
        response = api_client.get(f"{BASE_URL}/api/monthly-kpis/2026-03/details")
        assert response.status_code == 200
        
        data = response.json()
        
        # Check revenue breakdown has transactions with client_name
        revenue_breakdown = data.get("revenue_breakdown", [])
        assert len(revenue_breakdown) > 0, "Should have revenue categories"
        
        has_client_names = False
        for category in revenue_breakdown:
            for tx in category.get("transactions", []):
                if tx.get("client_name"):
                    has_client_names = True
                    break
        
        assert has_client_names, "At least one transaction should have client_name"
    
    def test_lucas_sanchez_in_transactions(self, api_client):
        """Lucas Sanchez should appear in transaction client_name"""
        response = api_client.get(f"{BASE_URL}/api/monthly-kpis/2026-03/details")
        assert response.status_code == 200
        
        data = response.json()
        
        # Find Lucas Sanchez in revenue transactions
        found = False
        for category in data.get("revenue_breakdown", []):
            for tx in category.get("transactions", []):
                if "Lucas Sanchez" in (tx.get("client_name") or ""):
                    found = True
                    print(f"Found Lucas Sanchez in category '{category['category']}': {tx}")
                    break
        
        assert found, "Lucas Sanchez should appear in transaction client_names"


class TestMemberRenewalCycle:
    """Test member renewal_cycle is a frontend-only UI helper (not persisted to backend)"""
    
    def test_members_api_returns_data(self, api_client):
        """GET /api/members should return members list"""
        response = api_client.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0, "Should have at least one member"
    
    def test_member_update_with_subscription_end_date(self, api_client):
        """Members can be updated with new subscription_end_date (renewal_cycle is UI-only)"""
        # Get a member first
        response = api_client.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        
        members = response.json()
        assert len(members) > 0
        
        # Find a member with a membership field
        member = next((m for m in members if m.get("membership")), members[0])
        member_id = member["id"]
        
        # Update with new subscription_end_date (simulating renewal cycle change)
        update_payload = {
            "name": member["name"],
            "email": member.get("email", ""),
            "membership": member.get("membership", "Test"),
            "subscription_end_date": "2027-03-15"  # New expiration date
        }
        
        response = api_client.put(f"{BASE_URL}/api/members/{member_id}", json=update_payload)
        assert response.status_code == 200
        
        # Verify the update
        updated = response.json()
        assert updated["subscription_end_date"] == "2027-03-15"
        print(f"Updated member subscription_end_date to: {updated.get('subscription_end_date')}")


class TestMemberSearch:
    """Test that members can be found for navigation from transactions"""
    
    def test_lucas_sanchez_exists(self, api_client):
        """Lucas Sanchez should exist as a member"""
        response = api_client.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        
        members = response.json()
        lucas = [m for m in members if "Lucas Sanchez" in m.get("name", "")]
        
        assert len(lucas) > 0, "Lucas Sanchez should exist as a member"
        print(f"Found member: {lucas[0]['name']} (ID: {lucas[0]['id'][:8]}...)")


class TestAllMonthlyKPIs:
    """Test that all KPIs endpoint works"""
    
    def test_get_all_kpis(self, api_client):
        """GET /api/monthly-kpis should return list with March 2026"""
        response = api_client.get(f"{BASE_URL}/api/monthly-kpis")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        # Find March 2026
        march = next((k for k in data if k["month"] == "2026-03"), None)
        assert march is not None, "March 2026 KPI should exist"
        
        # Verify values
        assert march["total_revenue"] == 4762.0
        assert march["net_profit"] == 2592.0
