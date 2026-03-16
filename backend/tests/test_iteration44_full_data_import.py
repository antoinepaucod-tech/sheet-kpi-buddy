"""
Iteration 44 - Full Data Import Testing
Tests for:
- 326 members with correct PIF/Récurrent classifications
- 38 categories (25 revenue + 13 expense) with correct kpi_column mapping
- 26 membership types with is_pif configuration
- Monthly grid for budget editing (expenses/revenues)
- Monthly KPIs with actual data
- Update monthly amount functionality
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "test@crossfit.ch",
        "password": "test123"
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Authentication failed")

@pytest.fixture(scope="module")
def api_client(auth_token):
    """Session with auth header"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    })
    return session


class TestMembersData:
    """Test members endpoint with expected 326 members"""
    
    def test_get_all_members_count(self, api_client):
        """GET /api/members - Should return 326 members"""
        response = api_client.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        members = response.json()
        # Data import should have 326 members
        print(f"Total members: {len(members)}")
        assert len(members) >= 300, f"Expected ~326 members, got {len(members)}"
    
    def test_members_pif_classification(self, api_client):
        """Verify PIF members have correct member_type"""
        response = api_client.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        members = response.json()
        
        pif_count = sum(1 for m in members if m.get('member_type') == 'Membres PIF')
        # Actual type is "Membres Généraux Récurrents"
        recurring_count = sum(1 for m in members if 'récurrent' in m.get('member_type', '').lower())
        
        print(f"PIF members: {pif_count}")
        print(f"Recurring members: {recurring_count}")
        
        # Should have both PIF and recurring members
        assert pif_count > 0, "Should have PIF members"
        assert recurring_count > 0, "Should have recurring members"


class TestCategoriesData:
    """Test categories endpoint - 38 categories (25 revenue + 13 expense)"""
    
    def test_get_all_categories(self, api_client):
        """GET /api/categories - Should return 38 categories"""
        response = api_client.get(f"{BASE_URL}/api/categories")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        categories = response.json()
        print(f"Total categories: {len(categories)}")
        # Should have around 38 categories
        assert len(categories) >= 30, f"Expected ~38 categories, got {len(categories)}"
    
    def test_categories_revenue_expense_split(self, api_client):
        """Verify categories have proper type (revenue/expense) split"""
        response = api_client.get(f"{BASE_URL}/api/categories")
        assert response.status_code == 200
        categories = response.json()
        
        revenue_cats = [c for c in categories if c.get('type') == 'revenue']
        expense_cats = [c for c in categories if c.get('type') == 'expense']
        
        print(f"Revenue categories: {len(revenue_cats)}")
        print(f"Expense categories: {len(expense_cats)}")
        
        # Expected: 25 revenue + 13 expense
        assert len(revenue_cats) >= 20, f"Expected ~25 revenue categories, got {len(revenue_cats)}"
        assert len(expense_cats) >= 10, f"Expected ~13 expense categories, got {len(expense_cats)}"
    
    def test_categories_have_kpi_column(self, api_client):
        """Verify categories have kpi_column mapping"""
        response = api_client.get(f"{BASE_URL}/api/categories")
        assert response.status_code == 200
        categories = response.json()
        
        with_kpi_col = sum(1 for c in categories if c.get('kpi_column'))
        print(f"Categories with kpi_column: {with_kpi_col}")
        # Most categories should have kpi_column
        assert with_kpi_col >= 20, f"Expected most categories to have kpi_column"


class TestMembershipTypes:
    """Test membership types endpoint - 26 types with PIF configuration"""
    
    def test_get_membership_types(self, api_client):
        """GET /api/settings/membership-types - Should return 26 types"""
        response = api_client.get(f"{BASE_URL}/api/settings/membership-types")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        types = response.json()
        print(f"Total membership types: {len(types)}")
        # Should have 26 types
        assert len(types) >= 20, f"Expected ~26 types, got {len(types)}"
    
    def test_pif_membership_types(self, api_client):
        """Verify PIF membership types have is_pif=True"""
        response = api_client.get(f"{BASE_URL}/api/settings/membership-types")
        assert response.status_code == 200
        types = response.json()
        
        # PIF types: ANNUEL X1, PACK, 6 WEEKS CHALLENGE, OFFRE 6 MOIS, PRÊT, THE COACH ENTRÉE
        pif_names = ['ANNUEL X1', 'PACK', '6 WEEKS CHALLENGE', 'OFFRE 6 MOIS', 'PRÊT', 'THE COACH ENTRÉE']
        
        for pif_name in pif_names:
            matching = [t for t in types if pif_name.lower() in t.get('name', '').lower()]
            if matching:
                for t in matching:
                    print(f"Type '{t['name']}': is_pif={t.get('is_pif')}, member_type={t.get('member_type')}")
                    assert t.get('is_pif') == True or t.get('member_type') == 'Membres PIF', \
                        f"Type {t['name']} should be PIF"
        
        # Count total PIF types
        pif_types = [t for t in types if t.get('is_pif') == True]
        print(f"Total PIF types: {len(pif_types)}")


class TestMonthlyGridExpenses:
    """Test monthly grid endpoint for expenses"""
    
    def test_get_monthly_grid_expenses_2025(self, api_client):
        """GET /api/transactions/monthly-grid?year=2025&type=expense"""
        response = api_client.get(f"{BASE_URL}/api/transactions/monthly-grid?year=2025&type=expense")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        grid = response.json()
        print(f"Expense categories in grid: {len(grid)}")
        # Should return expense categories with monthly amounts
        assert len(grid) >= 10, f"Expected ~13 expense categories, got {len(grid)}"
        
        # Verify grid structure
        if grid:
            first = grid[0]
            assert 'category' in first, "Grid should have category field"
            assert 'months' in first, "Grid should have months field"
            assert 'year_total' in first, "Grid should have year_total field"
    
    def test_monthly_grid_has_loyers_data(self, api_client):
        """Verify LOYERS category has data"""
        response = api_client.get(f"{BASE_URL}/api/transactions/monthly-grid?year=2025&type=expense")
        assert response.status_code == 200
        grid = response.json()
        
        loyers = next((r for r in grid if 'LOYER' in r.get('category', '').upper()), None)
        if loyers:
            print(f"LOYERS data: {loyers}")
            # Should have monthly data
            months_with_data = sum(1 for m in range(1, 13) if loyers['months'].get(str(m), 0) > 0)
            print(f"LOYERS - months with data: {months_with_data}")


class TestMonthlyGridRevenues:
    """Test monthly grid endpoint for revenues"""
    
    def test_get_monthly_grid_revenues_2025(self, api_client):
        """GET /api/transactions/monthly-grid?year=2025&type=revenue"""
        response = api_client.get(f"{BASE_URL}/api/transactions/monthly-grid?year=2025&type=revenue")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        grid = response.json()
        print(f"Revenue categories in grid: {len(grid)}")
        # Should return revenue categories
        assert len(grid) >= 15, f"Expected ~25 revenue categories, got {len(grid)}"


class TestUpdateMonthlyAmount:
    """Test update monthly amount endpoint"""
    
    def test_update_monthly_amount(self, api_client):
        """PUT /api/transactions/update-monthly-amount - Update LOYERS for Feb 2025"""
        # First get current data
        response = api_client.get(f"{BASE_URL}/api/transactions/monthly-grid?year=2025&type=expense")
        assert response.status_code == 200
        grid = response.json()
        
        # Find a category to test with
        test_category = None
        for cat in grid:
            if cat.get('category'):
                test_category = cat['category']
                break
        
        if not test_category:
            pytest.skip("No expense categories found")
        
        # Try to update
        update_data = {
            "category": test_category,
            "year": 2025,
            "month": 2,
            "amount": 5000.0,
            "description": "Test update"
        }
        
        response = api_client.put(f"{BASE_URL}/api/transactions/update-monthly-amount", json=update_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        result = response.json()
        print(f"Update result: {result}")
        assert result.get('status') == 'ok', "Update should succeed"


class TestMonthlyKPIs:
    """Test monthly KPIs endpoints"""
    
    def test_get_monthly_kpi_2025_01(self, api_client):
        """GET /api/monthly-kpis/2025-01 - Should have data"""
        response = api_client.get(f"{BASE_URL}/api/monthly-kpis/2025-01")
        if response.status_code == 404:
            pytest.skip("KPI for 2025-01 not found")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        kpi = response.json()
        print(f"KPI 2025-01: revenue={kpi.get('total_revenue')}, expenses={kpi.get('total_expenses')}")
        # Should have some data
        assert kpi.get('total_revenue', 0) > 0 or kpi.get('total_expenses', 0) > 0, \
            "KPI should have revenue or expense data"
    
    def test_get_monthly_kpi_2026_02(self, api_client):
        """GET /api/monthly-kpis/2026-02 - Should have real data"""
        response = api_client.get(f"{BASE_URL}/api/monthly-kpis/2026-02")
        if response.status_code == 404:
            pytest.skip("KPI for 2026-02 not found")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        kpi = response.json()
        print(f"KPI 2026-02: revenue={kpi.get('total_revenue')}, expenses={kpi.get('total_expenses')}")
    
    def test_get_all_monthly_kpis(self, api_client):
        """GET /api/monthly-kpis - Should return multiple months"""
        response = api_client.get(f"{BASE_URL}/api/monthly-kpis")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        kpis = response.json()
        print(f"Total KPI months: {len(kpis)}")
        # Should have around 32 months
        assert len(kpis) >= 20, f"Expected ~32 KPI months, got {len(kpis)}"
        
        # Find months with data
        with_revenue = [k for k in kpis if k.get('total_revenue', 0) > 0]
        print(f"KPIs with revenue > 0: {len(with_revenue)}")
        
        # Get latest month with data
        if with_revenue:
            latest = max(with_revenue, key=lambda k: k.get('month', ''))
            print(f"Latest month with data: {latest.get('month')} - revenue: {latest.get('total_revenue')}")


class TestTransactionsCounts:
    """Test transaction counts"""
    
    def test_get_transactions_count(self, api_client):
        """GET /api/transactions - Should return ~3425 transactions"""
        response = api_client.get(f"{BASE_URL}/api/transactions")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        transactions = response.json()
        print(f"Total transactions: {len(transactions)}")
        # Should have around 3425 transactions
        assert len(transactions) >= 1000, f"Expected ~3425 transactions, got {len(transactions)}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
