"""
Iteration 54 Tests - Recurring Transactions & Sales Funnel Fixes
Tests 2 fixes:
1) Entonnoir de Vente: close > 0, cash_collected > 0 (from new member sign-ups)
2) Transactions Recurrentes: 73 active billing members with names and amounts (16024 CHF)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestRecurringTransactions:
    """Test recurring transactions loaded from payment_schedules + customer_members"""
    
    def test_recurring_revenue_count_is_73(self):
        """recurring_revenue should contain 73 elements"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis/2026-03/details")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        recurring_revenue = data.get("recurring_revenue", [])
        assert len(recurring_revenue) == 73, f"Expected 73 recurring items, got {len(recurring_revenue)}"
    
    def test_recurring_revenue_has_member_names(self):
        """Each recurring item should have member_name field (not 'J1')"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis/2026-03/details")
        assert response.status_code == 200
        
        data = response.json()
        recurring_revenue = data.get("recurring_revenue", [])
        
        # Check that member names are populated (not empty or generic like 'J1')
        items_with_names = [r for r in recurring_revenue if r.get("member_name") and r.get("member_name") not in ["", "J1", None]]
        assert len(items_with_names) >= 70, f"Expected at least 70 items with proper member names, got {len(items_with_names)}"
        
        # Check first 5 have valid member names
        for i, r in enumerate(recurring_revenue[:5]):
            name = r.get("member_name", "")
            assert name and len(name) > 2, f"Item {i}: Expected valid member_name, got '{name}'"
    
    def test_recurring_revenue_has_amounts(self):
        """Each recurring item should have amount field > 0"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis/2026-03/details")
        assert response.status_code == 200
        
        data = response.json()
        recurring_revenue = data.get("recurring_revenue", [])
        
        # All items should have positive amounts
        items_with_amounts = [r for r in recurring_revenue if r.get("amount", 0) > 0]
        assert len(items_with_amounts) == 73, f"Expected all 73 items with positive amounts, got {len(items_with_amounts)}"
    
    def test_recurring_revenue_total_is_16024(self):
        """Total recurring revenue should be 16024 CHF"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis/2026-03/details")
        assert response.status_code == 200
        
        data = response.json()
        recurring_revenue = data.get("recurring_revenue", [])
        
        total = sum(r.get("amount", 0) for r in recurring_revenue)
        assert total == 16024, f"Expected total recurring revenue 16024, got {total}"


class TestRecalculateRecurring:
    """Test POST /api/monthly-kpis/2026-03/recalculate updates recurring KPIs"""
    
    def test_recalculate_active_recurrences_73(self):
        """active_recurrences should be 73 after recalculate"""
        response = requests.post(f"{BASE_URL}/api/monthly-kpis/2026-03/recalculate")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("active_recurrences") == 73, f"Expected active_recurrences=73, got {data.get('active_recurrences')}"
    
    def test_recalculate_recurring_revenue_16024(self):
        """recurring_revenue should be 16024 after recalculate"""
        response = requests.post(f"{BASE_URL}/api/monthly-kpis/2026-03/recalculate")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("recurring_revenue") == 16024, f"Expected recurring_revenue=16024, got {data.get('recurring_revenue')}"


class TestSalesFunnelClose:
    """Test sales funnel shows new member conversions"""
    
    def test_recalculate_close_greater_than_zero(self):
        """close should be > 0 (from new member sign-ups)"""
        response = requests.post(f"{BASE_URL}/api/monthly-kpis/2026-03/recalculate")
        assert response.status_code == 200
        
        data = response.json()
        close_value = data.get("close", 0)
        assert close_value > 0, f"Expected close > 0, got {close_value}"
    
    def test_recalculate_cash_collected_greater_than_zero(self):
        """cash_collected should be > 0 (from first transactions of new members)"""
        response = requests.post(f"{BASE_URL}/api/monthly-kpis/2026-03/recalculate")
        assert response.status_code == 200
        
        data = response.json()
        cash = data.get("cash_collected", 0)
        assert cash > 0, f"Expected cash_collected > 0, got {cash}"
    
    def test_get_kpi_close_value(self):
        """GET /api/monthly-kpis/2026-03 should show close > 0"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis/2026-03")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("close", 0) > 0, f"Expected close > 0, got {data.get('close', 0)}"
        assert data.get("cash_collected", 0) > 0, f"Expected cash_collected > 0, got {data.get('cash_collected', 0)}"


class TestKPIDetails:
    """Test GET /api/monthly-kpis/2026-03/details returns correct structure"""
    
    def test_details_endpoint_returns_200(self):
        """Details endpoint should return 200"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis/2026-03/details")
        assert response.status_code == 200
    
    def test_details_has_kpi_field(self):
        """Details should include kpi field with all funnel metrics"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis/2026-03/details")
        assert response.status_code == 200
        
        data = response.json()
        kpi = data.get("kpi", {})
        
        # Verify funnel fields exist
        assert "close" in kpi, "kpi should have 'close' field"
        assert "cash_collected" in kpi, "kpi should have 'cash_collected' field"
        assert "active_recurrences" in kpi, "kpi should have 'active_recurrences' field"
        assert "recurring_revenue" in kpi, "kpi should have 'recurring_revenue' field"
    
    def test_details_recurring_revenue_has_membership_field(self):
        """Recurring items should have membership field for display"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis/2026-03/details")
        assert response.status_code == 200
        
        data = response.json()
        recurring = data.get("recurring_revenue", [])
        
        # At least 50% should have membership field
        items_with_membership = [r for r in recurring if r.get("membership")]
        assert len(items_with_membership) >= 35, f"Expected at least 35 items with membership, got {len(items_with_membership)}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
