"""
Iteration 40 - Testing KPI Details P0 Bug Fixes
Tests:
1. GET /api/monthly-kpis/{month}/details - Returns kpi, revenue_breakdown, expense_breakdown, recurring_revenue, recurring_expense
2. revenue_breakdown contains ABONNEMENTS with correct total and transactions
3. expense_breakdown contains SALAIRES COACHS with correct total
4. recurring_expense contains 'loyer Hybrid' with generated_this_month=false for mars
5. POST /api/recurring-transactions/generate/{year}/{month} triggers KPI recalculation
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestKPIDetailsEndpoint:
    """Tests for the new /api/monthly-kpis/{month}/details endpoint"""

    def test_get_monthly_kpi_details_returns_all_fields(self):
        """GET /api/monthly-kpis/2026-03/details returns kpi, revenue_breakdown, expense_breakdown, recurring_revenue, recurring_expense"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis/2026-03/details")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify all required fields are present
        assert "kpi" in data, "Response should contain 'kpi' field"
        assert "revenue_breakdown" in data, "Response should contain 'revenue_breakdown' field"
        assert "expense_breakdown" in data, "Response should contain 'expense_breakdown' field"
        assert "recurring_revenue" in data, "Response should contain 'recurring_revenue' field"
        assert "recurring_expense" in data, "Response should contain 'recurring_expense' field"
        assert "total_revenue_from_transactions" in data, "Response should contain 'total_revenue_from_transactions'"
        assert "total_expenses_from_transactions" in data, "Response should contain 'total_expenses_from_transactions'"
        assert "transactions_count" in data, "Response should contain 'transactions_count'"
        
        print(f"✅ KPI Details endpoint returns all required fields")

    def test_revenue_breakdown_contains_abonnements(self):
        """revenue_breakdown contains ABONNEMENTS category with correct total and transactions"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis/2026-03/details")
        assert response.status_code == 200
        
        data = response.json()
        revenue_breakdown = data.get("revenue_breakdown", [])
        
        # Find ABONNEMENTS category
        abonnements = next((cat for cat in revenue_breakdown if cat["category"] == "ABONNEMENTS"), None)
        
        assert abonnements is not None, "ABONNEMENTS category should be in revenue_breakdown"
        assert abonnements["total"] == 599, f"ABONNEMENTS total should be 599, got {abonnements['total']}"
        assert abonnements["count"] == 1, f"ABONNEMENTS count should be 1, got {abonnements['count']}"
        assert "transactions" in abonnements, "ABONNEMENTS should contain transactions list"
        assert len(abonnements["transactions"]) == 1, f"Should have 1 transaction, got {len(abonnements['transactions'])}"
        
        tx = abonnements["transactions"][0]
        assert tx["description"] == "Vente 6 Week Challenge - Caroline Maerten", f"Description mismatch: {tx['description']}"
        assert tx["amount"] == 599, f"Amount should be 599, got {tx['amount']}"
        
        print(f"✅ revenue_breakdown contains ABONNEMENTS: {abonnements['total']} CHF ({abonnements['count']} tx)")

    def test_expense_breakdown_contains_salaires_coachs(self):
        """expense_breakdown contains SALAIRES COACHS category with correct total"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis/2026-03/details")
        assert response.status_code == 200
        
        data = response.json()
        expense_breakdown = data.get("expense_breakdown", [])
        
        # Find SALAIRES COACHS category
        salaires = next((cat for cat in expense_breakdown if cat["category"] == "SALAIRES COACHS"), None)
        
        assert salaires is not None, "SALAIRES COACHS category should be in expense_breakdown"
        assert salaires["total"] == 350.0, f"SALAIRES COACHS total should be 350, got {salaires['total']}"
        assert salaires["count"] == 1, f"SALAIRES COACHS count should be 1, got {salaires['count']}"
        
        print(f"✅ expense_breakdown contains SALAIRES COACHS: {salaires['total']} CHF ({salaires['count']} tx)")

    def test_recurring_expense_contains_loyer_hybrid(self):
        """recurring_expense contains 'loyer Hybrid' with generated_this_month=false for mars"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis/2026-03/details")
        assert response.status_code == 200
        
        data = response.json()
        recurring_expense = data.get("recurring_expense", [])
        
        # Find loyer Hybrid
        loyer = next((r for r in recurring_expense if "loyer Hybrid" in r.get("description", "")), None)
        
        assert loyer is not None, "loyer Hybrid should be in recurring_expense"
        assert loyer["amount"] == 7700.0, f"loyer Hybrid amount should be 7700, got {loyer['amount']}"
        assert loyer["category"] == "LOYER", f"loyer Hybrid category should be LOYER, got {loyer['category']}"
        assert loyer["generated_this_month"] == False, f"loyer Hybrid should NOT be generated for mars, got {loyer['generated_this_month']}"
        assert loyer["is_active"] == True, "loyer Hybrid should be active"
        
        print(f"✅ recurring_expense contains 'loyer Hybrid': {loyer['amount']} CHF, generated_this_month={loyer['generated_this_month']}")

    def test_kpi_contains_fast_cash_revenue(self):
        """KPI data should contain fast_cash_revenue field"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis/2026-03/details")
        assert response.status_code == 200
        
        data = response.json()
        kpi = data.get("kpi", {})
        
        assert "fast_cash_revenue" in kpi, "KPI should contain 'fast_cash_revenue' field"
        assert kpi["fast_cash_revenue"] == 1947, f"fast_cash_revenue should be 1947, got {kpi['fast_cash_revenue']}"
        
        print(f"✅ KPI contains fast_cash_revenue: {kpi['fast_cash_revenue']} CHF")

    def test_totals_from_transactions_are_correct(self):
        """total_revenue_from_transactions and total_expenses_from_transactions should be correct"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis/2026-03/details")
        assert response.status_code == 200
        
        data = response.json()
        
        assert data["total_revenue_from_transactions"] == 599, f"Total revenue from tx should be 599, got {data['total_revenue_from_transactions']}"
        assert data["total_expenses_from_transactions"] == 350.0, f"Total expenses from tx should be 350, got {data['total_expenses_from_transactions']}"
        assert data["transactions_count"] == 2, f"Should have 2 transactions, got {data['transactions_count']}"
        
        print(f"✅ Totals correct: Revenue={data['total_revenue_from_transactions']} CHF, Expenses={data['total_expenses_from_transactions']} CHF")


class TestRecurringTransactionGeneration:
    """Tests for recurring transaction generation and KPI auto-recalculation"""

    def test_generate_recurring_for_test_month(self):
        """POST /api/recurring-transactions/generate/{year}/{month} generates transactions and triggers KPI recalc"""
        # Use a test month that won't interfere with existing data (e.g., 2026-04)
        test_year = 2026
        test_month = 4
        
        response = requests.post(f"{BASE_URL}/api/recurring-transactions/generate/{test_year}/{test_month}")
        
        if response.status_code == 404:
            # No active recurring transactions - this is OK for this test
            print(f"⚠️ No active recurring transactions to generate (404)")
            pytest.skip("No active recurring transactions")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "month" in data, "Response should contain 'month'"
        assert data["month"] == "2026-04", f"Month should be 2026-04, got {data['month']}"
        
        print(f"✅ Recurring transactions generated for {data['month']}: {data.get('created', 0)} created")
        
        # Verify KPI was updated for that month
        kpi_response = requests.get(f"{BASE_URL}/api/monthly-kpis/2026-04")
        if kpi_response.status_code == 200:
            kpi = kpi_response.json()
            # After generating loyer 7700 CHF expense, expenses should be updated
            if data.get("created", 0) > 0:
                assert kpi.get("total_expenses", 0) >= 7700, f"KPI expenses should include generated recurring, got {kpi.get('total_expenses')}"
                print(f"✅ KPI auto-recalculated after generation: expenses={kpi.get('total_expenses')} CHF")


class TestKPIDetailsNotFound:
    """Test 404 for non-existent months"""

    def test_kpi_details_nonexistent_month(self):
        """GET /api/monthly-kpis/9999-01/details returns 404"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis/9999-01/details")
        assert response.status_code == 404, f"Expected 404 for non-existent month, got {response.status_code}"
        
        print(f"✅ Returns 404 for non-existent month")


class TestCategoryBreakdownStructure:
    """Test the structure of category breakdowns"""

    def test_breakdown_entry_structure(self):
        """Each breakdown entry should have category, kpi_column, total, count, transactions"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis/2026-03/details")
        assert response.status_code == 200
        
        data = response.json()
        
        for breakdown_type in ["revenue_breakdown", "expense_breakdown"]:
            breakdown = data.get(breakdown_type, [])
            for entry in breakdown:
                assert "category" in entry, f"{breakdown_type} entry should have 'category'"
                assert "kpi_column" in entry, f"{breakdown_type} entry should have 'kpi_column'"
                assert "total" in entry, f"{breakdown_type} entry should have 'total'"
                assert "count" in entry, f"{breakdown_type} entry should have 'count'"
                assert "transactions" in entry, f"{breakdown_type} entry should have 'transactions'"
                
                # Verify transactions structure
                for tx in entry["transactions"]:
                    assert "date" in tx, "Transaction should have 'date'"
                    assert "description" in tx, "Transaction should have 'description'"
                    assert "amount" in tx, "Transaction should have 'amount'"
        
        print(f"✅ All breakdown entries have correct structure")


class TestRecurringTransactionStatusFlag:
    """Test the generated_this_month flag for recurring transactions"""

    def test_recurring_generated_flag(self):
        """Recurring transactions should have generated_this_month flag based on actual transactions"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis/2026-03/details")
        assert response.status_code == 200
        
        data = response.json()
        
        # Get all recurring
        all_recurring = data.get("recurring_revenue", []) + data.get("recurring_expense", [])
        
        for rec in all_recurring:
            assert "generated_this_month" in rec, f"Recurring '{rec.get('description')}' should have 'generated_this_month' flag"
            assert isinstance(rec["generated_this_month"], bool), "generated_this_month should be a boolean"
        
        print(f"✅ All recurring transactions have generated_this_month flag")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
