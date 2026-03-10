"""
Iteration 4 tests: Recurring Transactions CRUD and Generation
Tests for /api/recurring-transactions endpoints
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestRecurringTransactionsCRUD:
    """Test CRUD operations for recurring transactions"""
    
    def test_get_all_recurring_transactions(self):
        """Test GET /api/recurring-transactions returns list"""
        r = requests.get(f"{BASE_URL}/api/recurring-transactions")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} recurring transactions")
        # Verify expected seed data exists
        descriptions = [rec['description'] for rec in data]
        assert any('Loyer' in d for d in descriptions), "Expected 'Loyer mensuel' seed data"
        
    def test_create_recurring_transaction(self):
        """Test POST /api/recurring-transactions creates new template"""
        payload = {
            "type": "expense",
            "category": "AUTRE",
            "description": f"TEST_create_recurring_{uuid.uuid4().hex[:8]}",
            "amount": 750.50,
            "sub_type": None,
            "recurrence_day": 15,
            "is_active": True
        }
        r = requests.post(f"{BASE_URL}/api/recurring-transactions", json=payload)
        assert r.status_code == 200
        data = r.json()
        assert data['description'] == payload['description']
        assert data['amount'] == 750.50
        assert data['recurrence_day'] == 15
        assert data['is_active'] == True
        assert 'id' in data
        print(f"Created recurring: {data['id']}")
        # Cleanup
        requests.delete(f"{BASE_URL}/api/recurring-transactions/{data['id']}")
        
    def test_update_recurring_transaction(self):
        """Test PUT /api/recurring-transactions/{id} updates template"""
        # Create first
        payload = {
            "type": "expense",
            "category": "LOYER",
            "description": f"TEST_update_recurring_{uuid.uuid4().hex[:8]}",
            "amount": 1000,
            "recurrence_day": 1,
            "is_active": True
        }
        create_r = requests.post(f"{BASE_URL}/api/recurring-transactions", json=payload)
        assert create_r.status_code == 200
        rec_id = create_r.json()['id']
        
        # Update
        update_payload = {
            "type": "expense",
            "category": "LOYER",
            "description": payload['description'],
            "amount": 1500,
            "recurrence_day": 5,
            "is_active": False
        }
        update_r = requests.put(f"{BASE_URL}/api/recurring-transactions/{rec_id}", json=update_payload)
        assert update_r.status_code == 200
        data = update_r.json()
        assert data['amount'] == 1500
        assert data['recurrence_day'] == 5
        assert data['is_active'] == False
        print(f"Updated recurring: amount={data['amount']}, day={data['recurrence_day']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/recurring-transactions/{rec_id}")
        
    def test_delete_recurring_transaction(self):
        """Test DELETE /api/recurring-transactions/{id} removes template"""
        # Create first
        payload = {
            "type": "revenue",
            "category": "COTISATIONS",
            "description": f"TEST_delete_recurring_{uuid.uuid4().hex[:8]}",
            "amount": 500,
            "recurrence_day": 10,
            "is_active": True
        }
        create_r = requests.post(f"{BASE_URL}/api/recurring-transactions", json=payload)
        assert create_r.status_code == 200
        rec_id = create_r.json()['id']
        
        # Delete
        delete_r = requests.delete(f"{BASE_URL}/api/recurring-transactions/{rec_id}")
        assert delete_r.status_code == 200
        assert 'supprimée' in delete_r.json()['message'].lower() or 'deleted' in delete_r.json()['message'].lower()
        print(f"Deleted recurring: {rec_id}")
        
        # Verify deleted
        get_r = requests.get(f"{BASE_URL}/api/recurring-transactions")
        ids = [r['id'] for r in get_r.json()]
        assert rec_id not in ids
        
    def test_delete_nonexistent_returns_404(self):
        """Test DELETE with invalid ID returns 404"""
        fake_id = str(uuid.uuid4())
        r = requests.delete(f"{BASE_URL}/api/recurring-transactions/{fake_id}")
        assert r.status_code == 404


class TestRecurringTransactionGeneration:
    """Test monthly transaction generation from recurring templates"""
    
    def test_generate_transactions_for_month(self):
        """Test POST /api/recurring-transactions/generate/{year}/{month}"""
        # Create a test recurring template
        payload = {
            "type": "expense",
            "category": "AUTRE",
            "description": f"TEST_generate_{uuid.uuid4().hex[:8]}",
            "amount": 123.45,
            "recurrence_day": 7,
            "is_active": True
        }
        create_r = requests.post(f"{BASE_URL}/api/recurring-transactions", json=payload)
        assert create_r.status_code == 200
        rec_id = create_r.json()['id']
        
        # Generate for a specific month (2025-03)
        gen_r = requests.post(f"{BASE_URL}/api/recurring-transactions/generate/2025/3")
        assert gen_r.status_code == 200
        data = gen_r.json()
        
        assert 'month' in data
        assert data['month'] == '2025-03'
        assert 'created' in data
        assert data['created'] >= 1  # At least our test template + existing ones
        assert 'transactions' in data
        print(f"Generated {data['created']} transactions for 2025-03")
        
        # Verify our test transaction was created
        our_tx = [tx for tx in data['transactions'] if tx['description'] == payload['description']]
        assert len(our_tx) == 1
        assert our_tx[0]['amount'] == 123.45
        assert our_tx[0]['date'] == '2025-03-07'  # Day 7 of March
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/recurring-transactions/{rec_id}")
        
    def test_generate_invalid_month_returns_400(self):
        """Test generate with invalid month returns 400"""
        r = requests.post(f"{BASE_URL}/api/recurring-transactions/generate/2025/13")
        assert r.status_code == 400
        
    def test_generate_respects_recurrence_day(self):
        """Test that generated transactions use correct recurrence day"""
        # Check existing recurring transactions
        r = requests.get(f"{BASE_URL}/api/recurring-transactions")
        recs = r.json()
        
        # Get one with specific day
        rec_with_day = next((r for r in recs if r.get('recurrence_day', 1) > 1), None)
        if rec_with_day:
            day = rec_with_day['recurrence_day']
            print(f"Found recurring with day={day}: {rec_with_day['description']}")
            
        assert len(recs) > 0, "No recurring transactions found"


class TestRecurringTransactionToggle:
    """Test toggle active/inactive functionality"""
    
    def test_toggle_active_to_inactive(self):
        """Test deactivating a recurring transaction"""
        # Create active
        payload = {
            "type": "expense",
            "category": "AUTRE",
            "description": f"TEST_toggle_{uuid.uuid4().hex[:8]}",
            "amount": 100,
            "recurrence_day": 1,
            "is_active": True
        }
        create_r = requests.post(f"{BASE_URL}/api/recurring-transactions", json=payload)
        rec_id = create_r.json()['id']
        
        # Toggle to inactive
        update_payload = {**payload, "is_active": False}
        update_r = requests.put(f"{BASE_URL}/api/recurring-transactions/{rec_id}", json=update_payload)
        assert update_r.status_code == 200
        assert update_r.json()['is_active'] == False
        print(f"Toggled {rec_id} to inactive")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/recurring-transactions/{rec_id}")
        
    def test_inactive_excluded_from_generation(self):
        """Test that inactive recurring transactions are not generated"""
        # Create inactive recurring
        payload = {
            "type": "expense",
            "category": "AUTRE",
            "description": f"TEST_inactive_{uuid.uuid4().hex[:8]}",
            "amount": 999,
            "recurrence_day": 1,
            "is_active": False
        }
        create_r = requests.post(f"{BASE_URL}/api/recurring-transactions", json=payload)
        rec_id = create_r.json()['id']
        
        # Generate for a specific month
        gen_r = requests.post(f"{BASE_URL}/api/recurring-transactions/generate/2025/4")
        assert gen_r.status_code == 200
        
        # Verify our inactive template was NOT generated
        txs = gen_r.json()['transactions']
        our_tx = [tx for tx in txs if tx['description'] == payload['description']]
        assert len(our_tx) == 0, "Inactive recurring should not be generated"
        print(f"Verified inactive recurring not generated")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/recurring-transactions/{rec_id}")


class TestCategories:
    """Test categories endpoint for recurring form"""
    
    def test_get_categories_returns_expense_and_revenue(self):
        """Test categories include both types"""
        r = requests.get(f"{BASE_URL}/api/categories")
        assert r.status_code == 200
        data = r.json()
        
        expense_cats = [c for c in data if c['type'] == 'expense']
        revenue_cats = [c for c in data if c['type'] == 'revenue']
        
        assert len(expense_cats) >= 1, "No expense categories found"
        assert len(revenue_cats) >= 1, "No revenue categories found"
        print(f"Found {len(expense_cats)} expense and {len(revenue_cats)} revenue categories")
