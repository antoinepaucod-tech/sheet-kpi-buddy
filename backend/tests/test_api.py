import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Monthly KPIs
class TestMonthlyKPIs:
    def test_get_monthly_kpis_returns_12_months(self):
        r = requests.get(f"{BASE_URL}/api/monthly-kpis")
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 12, f"Expected 12 months, got {len(data)}"

    def test_kpis_have_computed_metrics(self):
        r = requests.get(f"{BASE_URL}/api/monthly-kpis")
        assert r.status_code == 200
        data = r.json()
        for item in data:
            assert 'churn_rate' in item
            assert 'cac' in item
            assert 'roas' in item
            assert 'profit_margin' in item

    def test_get_specific_month(self):
        r = requests.get(f"{BASE_URL}/api/monthly-kpis/2024-12")
        assert r.status_code == 200
        data = r.json()
        assert data['month'] == '2024-12'
        assert 'churn_rate' in data
        assert 'cac' in data
        assert 'roas' in data

    def test_get_nonexistent_month(self):
        r = requests.get(f"{BASE_URL}/api/monthly-kpis/2099-01")
        assert r.status_code == 404


# Transactions
class TestTransactions:
    def test_get_transactions(self):
        r = requests.get(f"{BASE_URL}/api/transactions")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) > 0

    def test_get_transactions_filter_by_month(self):
        r = requests.get(f"{BASE_URL}/api/transactions?month=2024-12")
        assert r.status_code == 200
        data = r.json()
        assert all('2024-12' in tx['date'] for tx in data)

    def test_create_transaction(self):
        payload = {
            "date": "2024-12-30",
            "description": "TEST_transaction_create",
            "amount": 500.0,
            "type": "expense",
            "category": "AUTRE"
        }
        r = requests.post(f"{BASE_URL}/api/transactions", json=payload)
        assert r.status_code == 200
        data = r.json()
        assert data['description'] == payload['description']
        assert data['amount'] == payload['amount']
        assert 'id' in data
        # Cleanup
        requests.delete(f"{BASE_URL}/api/transactions/{data['id']}")

    def test_delete_transaction_creates_exclusion(self):
        # Create a transaction first
        payload = {
            "date": "2024-12-29",
            "description": "TEST_to_delete",
            "amount": 100.0,
            "type": "expense",
            "category": "AUTRE"
        }
        r = requests.post(f"{BASE_URL}/api/transactions", json=payload)
        assert r.status_code == 200
        tx_id = r.json()['id']

        # Delete it
        del_r = requests.delete(f"{BASE_URL}/api/transactions/{tx_id}")
        assert del_r.status_code == 200

        # Verify exclusion was created
        excl_r = requests.get(f"{BASE_URL}/api/excluded")
        assert excl_r.status_code == 200
        excluded = excl_r.json()
        assert any(e['original_transaction_id'] == tx_id for e in excluded)

        # Cleanup: remove exclusion
        excl_item = next((e for e in excluded if e['original_transaction_id'] == tx_id), None)
        if excl_item:
            requests.delete(f"{BASE_URL}/api/excluded/{excl_item['id']}")

    def test_delete_nonexistent_transaction(self):
        r = requests.delete(f"{BASE_URL}/api/transactions/nonexistent-id")
        assert r.status_code == 404


# Categories
class TestCategories:
    def test_get_categories(self):
        r = requests.get(f"{BASE_URL}/api/categories")
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 8


# Excluded
class TestExcluded:
    def test_get_excluded(self):
        r = requests.get(f"{BASE_URL}/api/excluded")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# Init
class TestInit:
    def test_init_check(self):
        r = requests.get(f"{BASE_URL}/api/init")
        assert r.status_code == 200
        data = r.json()
        assert 'has_data' in data
        assert data['has_data'] is True
