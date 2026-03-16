"""
Test iteration 42 - Dashboard TRANSFORM corrections
Tests for:
1. Sales Funnel percentages recalculated correctly
2. Profit margin clamping for chart display
3. API response structure for monthly KPIs
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestSalesFunnelPercentages:
    """Test sales funnel percentage calculations"""
    
    def test_march_2026_funnel_percentages(self):
        """
        March 2026: leads=84, calls=42, scheduled=6, show=2, close=1
        Expected: call=50.0%, sched=14.3%, show=33.3%, close=50.0%
        """
        response = requests.get(f"{BASE_URL}/api/monthly-kpis/2026-03")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify raw counts
        assert data['leads'] == 84, f"Expected leads=84, got {data['leads']}"
        assert data['calls_made'] == 42, f"Expected calls=42, got {data['calls_made']}"
        assert data['scheduled'] == 6, f"Expected scheduled=6, got {data['scheduled']}"
        assert data['show'] == 2, f"Expected show=2, got {data['show']}"
        assert data['close'] == 1, f"Expected close=1, got {data['close']}"
        
        # Verify percentages calculated correctly
        # call_percentage = calls_made / leads * 100 = 42/84*100 = 50.0%
        assert data['call_percentage'] == 50.0, f"Expected call_percentage=50.0, got {data['call_percentage']}"
        
        # sched_percentage = scheduled / calls_made * 100 = 6/42*100 = 14.3%
        assert data['sched_percentage'] == 14.3, f"Expected sched_percentage=14.3, got {data['sched_percentage']}"
        
        # show_percentage = show / scheduled * 100 = 2/6*100 = 33.3%
        assert data['show_percentage'] == 33.3, f"Expected show_percentage=33.3, got {data['show_percentage']}"
        
        # close_percentage = close / show * 100 = 1/2*100 = 50.0%
        assert data['close_percentage'] == 50.0, f"Expected close_percentage=50.0, got {data['close_percentage']}"
        
        print("✅ March 2026 funnel percentages correct")
    
    def test_jan_2026_funnel_high_calls(self):
        """
        January 2026: leads=84, calls=200
        call_percentage = 200/84*100 = 238.1% (when calls > leads)
        This is correct behavior - percentage can exceed 100%
        """
        response = requests.get(f"{BASE_URL}/api/monthly-kpis/2026-01")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify raw counts
        assert data['leads'] == 84, f"Expected leads=84, got {data['leads']}"
        assert data['calls_made'] == 200, f"Expected calls=200, got {data['calls_made']}"
        
        # Verify percentage > 100% is allowed (calls > leads scenario)
        assert data['call_percentage'] == 238.1, f"Expected call_percentage=238.1, got {data['call_percentage']}"
        
        print("✅ January 2026 funnel percentage (>100%) correct")


class TestProfitMarginValues:
    """Test profit margin extreme values are stored correctly"""
    
    def test_march_2026_extreme_profit_margin(self):
        """
        March 2026 has extreme profit margin: -1243.91%
        API should return raw value (chart will clamp it)
        """
        response = requests.get(f"{BASE_URL}/api/monthly-kpis/2026-03")
        assert response.status_code == 200
        
        data = response.json()
        
        # Profit margin is calculated as: net_profit / total_revenue * 100
        # net_profit = -7451, total_revenue = 599
        # profit_margin = -7451/599*100 = -1243.91%
        assert abs(data['profit_margin'] - (-1243.91)) < 0.1, f"Expected profit_margin≈-1243.91, got {data['profit_margin']}"
        
        print("✅ March 2026 extreme profit margin stored correctly")
    
    def test_profit_margin_calculation(self):
        """Verify profit margin is calculated as net_profit/total_revenue*100"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis/2026-03")
        assert response.status_code == 200
        
        data = response.json()
        
        net_profit = data['net_profit']
        total_revenue = data['total_revenue']
        profit_margin = data['profit_margin']
        
        # Only verify if revenue > 0
        if total_revenue > 0:
            expected_margin = round((net_profit / total_revenue) * 100, 2)
            assert abs(profit_margin - expected_margin) < 0.1, f"Profit margin calculation incorrect"
        
        print("✅ Profit margin calculation verified")


class TestAPIResponseStructure:
    """Test API returns all required fields"""
    
    def test_monthly_kpi_has_funnel_fields(self):
        """Verify API returns all funnel-related fields"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis/2026-03")
        assert response.status_code == 200
        
        data = response.json()
        
        required_fields = [
            'leads', 'calls_made', 'call_percentage',
            'scheduled', 'sched_percentage',
            'show', 'show_percentage',
            'close', 'close_percentage',
            'cash_collected', 'avg_per_sale'
        ]
        
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        
        print("✅ All funnel fields present in API response")
    
    def test_monthly_kpi_has_member_fields(self):
        """Verify API returns member evolution fields"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis/2026-03")
        assert response.status_code == 200
        
        data = response.json()
        
        required_fields = [
            'total_members', 'new_members', 'lost_members',
            'total_active_members', 'churn_rate'
        ]
        
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        
        print("✅ All member fields present in API response")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
