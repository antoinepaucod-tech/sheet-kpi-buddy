"""
Iteration 3 tests: N-1 comparison, monthly notes, CSV bulk import, KPI 2023 data
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestKPIsN1:
    """Test KPIs endpoint returns 24 months (2023 + 2024)"""
    
    def test_get_all_kpis_returns_24_months(self):
        r = requests.get(f"{BASE_URL}/api/monthly-kpis")
        assert r.status_code == 200
        data = r.json()
        months_2024 = [d for d in data if d['month'].startswith('2024')]
        months_2023 = [d for d in data if d['month'].startswith('2023')]
        print(f"Total KPIs: {len(data)}, 2024: {len(months_2024)}, 2023: {len(months_2023)}")
        assert len(months_2023) >= 12, f"Expected 12 months 2023, got {len(months_2023)}"
        assert len(months_2024) >= 12, f"Expected 12 months 2024, got {len(months_2024)}"

    def test_kpi_2023_fields_present(self):
        r = requests.get(f"{BASE_URL}/api/monthly-kpis/2023-06")
        assert r.status_code == 200
        data = r.json()
        assert data['month'] == '2023-06'
        assert data['total_revenue'] > 0
        assert 'note' in data

class TestMonthlyNote:
    """Test PATCH /api/monthly-kpis/{month}/note"""

    def test_patch_note_updates_correctly(self):
        note_text = "Test note iteration 3"
        r = requests.patch(
            f"{BASE_URL}/api/monthly-kpis/2024-12/note",
            json={"note": note_text}
        )
        assert r.status_code == 200
        data = r.json()
        assert data['note'] == note_text
        print(f"Note updated: {data['note']}")

    def test_patch_note_persists(self):
        # verify by GET
        r = requests.get(f"{BASE_URL}/api/monthly-kpis/2024-12")
        assert r.status_code == 200
        data = r.json()
        assert data['note'] is not None
        print(f"Persisted note: {data['note']}")

    def test_patch_note_clear(self):
        # restore original note
        r = requests.patch(
            f"{BASE_URL}/api/monthly-kpis/2024-12/note",
            json={"note": "Excellent mois de décembre - record historique !"}
        )
        assert r.status_code == 200

class TestBulkImport:
    """Test POST /api/transactions/bulk"""

    def test_bulk_import_transactions(self):
        payload = [
            {"date": "2024-01-15", "description": "TEST_bulk_import_1", "amount": 100.0, "type": "revenue", "category": "COTISATIONS", "sub_type": "members"},
            {"date": "2024-01-16", "description": "TEST_bulk_import_2", "amount": 200.0, "type": "expense", "category": "LOYER", "sub_type": None},
        ]
        r = requests.post(f"{BASE_URL}/api/transactions/bulk", json=payload)
        assert r.status_code == 200
        data = r.json()
        assert 'imported' in data
        assert 'skipped' in data
        assert data['imported'] == 2
        print(f"Bulk import result: {data['imported']} imported, {data['skipped']} skipped")

    def test_bulk_import_returns_transaction_list(self):
        payload = [
            {"date": "2024-02-15", "description": "TEST_bulk_single", "amount": 50.0, "type": "revenue", "category": "COACHING", "sub_type": "coaching"},
        ]
        r = requests.post(f"{BASE_URL}/api/transactions/bulk", json=payload)
        assert r.status_code == 200
        data = r.json()
        assert 'transactions' in data
        assert len(data['transactions']) >= 1
        assert data['transactions'][0]['description'] == "TEST_bulk_single"

    def test_bulk_import_empty_list(self):
        r = requests.post(f"{BASE_URL}/api/transactions/bulk", json=[])
        assert r.status_code == 200
        data = r.json()
        assert data['imported'] == 0
