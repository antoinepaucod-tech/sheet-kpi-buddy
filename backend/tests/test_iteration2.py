"""Backend tests for iteration 2: settings, categories, recalculate endpoints"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSettings:
    """Tests for /api/settings GET and PUT"""

    def test_get_settings(self):
        res = requests.get(f"{BASE_URL}/api/settings")
        assert res.status_code == 200
        data = res.json()
        assert "club_name" in data
        assert "targets" in data
        targets = data["targets"]
        for key in ["churn_rate", "cac", "roas", "new_members", "profit_margin", "revenue_growth"]:
            assert key in targets, f"Missing target key: {key}"

    def test_put_settings(self):
        payload = {
            "club_name": "TEST_Club",
            "targets": {
                "churn_rate": 2.5,
                "cac": 120.0,
                "roas": 15.0,
                "new_members": 25,
                "profit_margin": 28.0,
                "revenue_growth": 4.0,
            }
        }
        res = requests.put(f"{BASE_URL}/api/settings", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["club_name"] == "TEST_Club"
        assert data["targets"]["churn_rate"] == 2.5

    def test_settings_persisted_after_put(self):
        # Restore default
        payload = {"club_name": "Mon Club", "targets": {"churn_rate": 3.0, "cac": 150.0, "roas": 20.0, "new_members": 30, "profit_margin": 30.0, "revenue_growth": 5.0}}
        requests.put(f"{BASE_URL}/api/settings", json=payload)
        res = requests.get(f"{BASE_URL}/api/settings")
        assert res.status_code == 200
        assert res.json()["club_name"] == "Mon Club"


class TestCategories:
    """Tests for categories CRUD"""
    created_id = None

    def test_get_categories(self):
        res = requests.get(f"{BASE_URL}/api/categories")
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    def test_create_category(self):
        payload = {"name": "TEST_ASSURANCE", "type": "expense", "kpi_column": "other_expenses", "color": "#3B82F6"}
        res = requests.post(f"{BASE_URL}/api/categories", json=payload)
        assert res.status_code in [200, 201]
        data = res.json()
        assert data["name"] == "TEST_ASSURANCE"
        assert "id" in data
        TestCategories.created_id = data["id"]

    def test_delete_category(self):
        if not TestCategories.created_id:
            pytest.skip("No category created to delete")
        res = requests.delete(f"{BASE_URL}/api/categories/{TestCategories.created_id}")
        assert res.status_code in [200, 204]

    def test_delete_nonexistent_category(self):
        res = requests.delete(f"{BASE_URL}/api/categories/nonexistent_id_12345")
        assert res.status_code == 404


class TestRecalculate:
    """Tests for recalculate endpoints"""

    def test_recalculate_all(self):
        res = requests.post(f"{BASE_URL}/api/monthly-kpis/recalculate-all")
        assert res.status_code == 200
        data = res.json()
        assert "recalculated" in data

    def test_recalculate_specific_month(self):
        res = requests.post(f"{BASE_URL}/api/monthly-kpis/2025-01/recalculate")
        assert res.status_code in [200, 201, 404]
