"""
Iteration 6 Tests: PDF Report and Revenue Exclusions
Features tested:
1. Deletion of revenue transaction → added to exclusions with type 'revenue'
2. ExcludedRecurringExpense model has 'type' and 'sub_type' fields
3. Endpoint /api/report/pdf/{month} generates a valid PDF
4. PDF content type and filename validation
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestPDFReport:
    """Tests for PDF report generation endpoint"""

    def test_pdf_endpoint_returns_200(self):
        """GET /api/report/pdf/{month} returns 200 for existing month"""
        response = requests.get(f"{BASE_URL}/api/report/pdf/2024-12")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: PDF endpoint returns 200")

    def test_pdf_endpoint_content_type(self):
        """PDF endpoint returns correct content-type"""
        response = requests.get(f"{BASE_URL}/api/report/pdf/2024-12")
        content_type = response.headers.get('Content-Type', '')
        assert 'application/pdf' in content_type, f"Expected PDF content type, got {content_type}"
        print(f"PASS: Content-Type is {content_type}")

    def test_pdf_endpoint_content_disposition(self):
        """PDF endpoint returns Content-Disposition header with filename"""
        response = requests.get(f"{BASE_URL}/api/report/pdf/2024-12")
        disposition = response.headers.get('Content-Disposition', '')
        assert 'attachment' in disposition, f"Expected attachment disposition, got {disposition}"
        assert 'filename=' in disposition, f"Expected filename in disposition, got {disposition}"
        print(f"PASS: Content-Disposition: {disposition}")

    def test_pdf_endpoint_returns_valid_pdf(self):
        """PDF response starts with PDF magic bytes"""
        response = requests.get(f"{BASE_URL}/api/report/pdf/2024-12")
        # PDF files start with %PDF
        content = response.content[:10]
        assert content.startswith(b'%PDF'), f"Expected PDF magic bytes, got {content[:20]}"
        print("PASS: PDF starts with %PDF magic bytes")

    def test_pdf_endpoint_nonexistent_month_returns_404(self):
        """PDF endpoint returns 404 for non-existent month"""
        response = requests.get(f"{BASE_URL}/api/report/pdf/1990-01")
        assert response.status_code == 404, f"Expected 404 for non-existent month, got {response.status_code}"
        print("PASS: Non-existent month returns 404")

    def test_pdf_endpoint_size_reasonable(self):
        """PDF should have reasonable size (> 1KB)"""
        response = requests.get(f"{BASE_URL}/api/report/pdf/2024-12")
        size = len(response.content)
        assert size > 1000, f"PDF too small: {size} bytes"
        assert size < 100000, f"PDF unexpectedly large: {size} bytes"
        print(f"PASS: PDF size is {size} bytes")

    def test_pdf_endpoint_different_months(self):
        """PDF endpoint works for different available months"""
        months_to_test = ["2024-01", "2024-06", "2023-12"]
        for month in months_to_test:
            response = requests.get(f"{BASE_URL}/api/report/pdf/{month}")
            if response.status_code == 200:
                assert response.content.startswith(b'%PDF')
                print(f"PASS: PDF generated for {month}")
            else:
                # Month may not exist - that's fine
                assert response.status_code == 404
                print(f"INFO: Month {month} not found (404)")


class TestRevenueExclusions:
    """Tests for revenue transaction exclusion feature"""

    def test_delete_revenue_transaction_creates_exclusion_with_type(self):
        """Deleting a revenue transaction adds it to exclusions with type='revenue'"""
        # First, create a test revenue transaction
        unique_desc = f"TEST_REVENUE_{uuid.uuid4().hex[:8]}"
        create_response = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": "2024-12-25",
            "description": unique_desc,
            "amount": 1500,
            "type": "revenue",
            "category": "COTISATIONS",
            "sub_type": "members"
        })
        assert create_response.status_code == 200, f"Failed to create transaction: {create_response.text}"
        tx = create_response.json()
        tx_id = tx["id"]
        print(f"PASS: Created test revenue transaction: {tx_id}")

        # Delete the transaction
        delete_response = requests.delete(f"{BASE_URL}/api/transactions/{tx_id}")
        assert delete_response.status_code == 200, f"Failed to delete: {delete_response.text}"
        print("PASS: Transaction deleted successfully")

        # Check exclusions for the transaction
        excluded_response = requests.get(f"{BASE_URL}/api/excluded")
        assert excluded_response.status_code == 200
        excluded = excluded_response.json()
        
        # Find our excluded transaction
        our_exclusion = next((e for e in excluded if e["description"] == unique_desc), None)
        assert our_exclusion is not None, f"Excluded transaction not found: {unique_desc}"
        
        # Verify type and sub_type are preserved
        assert our_exclusion["type"] == "revenue", f"Expected type='revenue', got {our_exclusion.get('type')}"
        assert our_exclusion["sub_type"] == "members", f"Expected sub_type='members', got {our_exclusion.get('sub_type')}"
        assert our_exclusion["category"] == "COTISATIONS"
        assert our_exclusion["amount"] == 1500
        print(f"PASS: Exclusion has type='revenue', sub_type='members'")
        
        # Cleanup - remove from exclusions
        requests.delete(f"{BASE_URL}/api/excluded/{our_exclusion['id']}")

    def test_delete_expense_transaction_creates_exclusion_with_type(self):
        """Deleting an expense transaction adds it to exclusions with type='expense'"""
        # Create a test expense transaction
        unique_desc = f"TEST_EXPENSE_{uuid.uuid4().hex[:8]}"
        create_response = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": "2024-12-26",
            "description": unique_desc,
            "amount": 500,
            "type": "expense",
            "category": "AUTRE",
            "sub_type": None
        })
        assert create_response.status_code == 200, f"Failed to create transaction: {create_response.text}"
        tx = create_response.json()
        tx_id = tx["id"]
        print(f"PASS: Created test expense transaction: {tx_id}")

        # Delete the transaction
        delete_response = requests.delete(f"{BASE_URL}/api/transactions/{tx_id}")
        assert delete_response.status_code == 200, f"Failed to delete: {delete_response.text}"
        print("PASS: Transaction deleted successfully")

        # Check exclusions
        excluded_response = requests.get(f"{BASE_URL}/api/excluded")
        excluded = excluded_response.json()
        
        our_exclusion = next((e for e in excluded if e["description"] == unique_desc), None)
        assert our_exclusion is not None, f"Excluded transaction not found: {unique_desc}"
        
        assert our_exclusion["type"] == "expense", f"Expected type='expense', got {our_exclusion.get('type')}"
        assert our_exclusion["category"] == "AUTRE"
        print(f"PASS: Exclusion has type='expense'")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/excluded/{our_exclusion['id']}")

    def test_delete_coaching_revenue_preserves_subtype(self):
        """Deleting a coaching revenue transaction preserves sub_type='coaching'"""
        unique_desc = f"TEST_COACHING_{uuid.uuid4().hex[:8]}"
        create_response = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": "2024-12-27",
            "description": unique_desc,
            "amount": 2000,
            "type": "revenue",
            "category": "COACHING",
            "sub_type": "coaching"
        })
        assert create_response.status_code == 200
        tx_id = create_response.json()["id"]
        print(f"PASS: Created coaching revenue transaction: {tx_id}")

        # Delete
        delete_response = requests.delete(f"{BASE_URL}/api/transactions/{tx_id}")
        assert delete_response.status_code == 200
        print("PASS: Transaction deleted")

        # Verify exclusion
        excluded_response = requests.get(f"{BASE_URL}/api/excluded")
        excluded = excluded_response.json()
        our_exclusion = next((e for e in excluded if e["description"] == unique_desc), None)
        
        assert our_exclusion is not None
        assert our_exclusion["type"] == "revenue"
        assert our_exclusion["sub_type"] == "coaching", f"Expected sub_type='coaching', got {our_exclusion.get('sub_type')}"
        print(f"PASS: Exclusion preserves sub_type='coaching'")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/excluded/{our_exclusion['id']}")


class TestExcludedEndpoint:
    """Tests for the excluded transactions endpoint"""

    def test_get_excluded_returns_list(self):
        """GET /api/excluded returns a list"""
        response = requests.get(f"{BASE_URL}/api/excluded")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: /api/excluded returns list with {len(data)} items")

    def test_excluded_items_have_type_field(self):
        """Excluded items should have 'type' field"""
        # First create and delete a transaction to ensure we have an exclusion
        unique_desc = f"TEST_TYPE_CHECK_{uuid.uuid4().hex[:8]}"
        create_resp = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": "2024-12-28",
            "description": unique_desc,
            "amount": 100,
            "type": "revenue",
            "category": "COTISATIONS",
            "sub_type": "members"
        })
        tx_id = create_resp.json()["id"]
        requests.delete(f"{BASE_URL}/api/transactions/{tx_id}")

        # Verify excluded has type field
        excluded_response = requests.get(f"{BASE_URL}/api/excluded")
        excluded = excluded_response.json()
        
        if len(excluded) > 0:
            our_exclusion = next((e for e in excluded if e["description"] == unique_desc), None)
            if our_exclusion:
                assert "type" in our_exclusion, f"Excluded item missing 'type' field: {our_exclusion}"
                assert our_exclusion["type"] in ["expense", "revenue"], f"Invalid type value: {our_exclusion['type']}"
                print(f"PASS: Excluded item has 'type' field: {our_exclusion['type']}")
                
                # Cleanup
                requests.delete(f"{BASE_URL}/api/excluded/{our_exclusion['id']}")

    def test_remove_from_exclusions(self):
        """DELETE /api/excluded/{id} removes an exclusion"""
        # Create and delete a transaction to create an exclusion
        unique_desc = f"TEST_REMOVE_{uuid.uuid4().hex[:8]}"
        create_resp = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": "2024-12-29",
            "description": unique_desc,
            "amount": 200,
            "type": "expense",
            "category": "AUTRE"
        })
        tx_id = create_resp.json()["id"]
        requests.delete(f"{BASE_URL}/api/transactions/{tx_id}")

        # Find the exclusion
        excluded_response = requests.get(f"{BASE_URL}/api/excluded")
        excluded = excluded_response.json()
        our_exclusion = next((e for e in excluded if e["description"] == unique_desc), None)
        
        if our_exclusion:
            # Remove from exclusions
            remove_response = requests.delete(f"{BASE_URL}/api/excluded/{our_exclusion['id']}")
            assert remove_response.status_code == 200, f"Failed to remove exclusion: {remove_response.text}"
            print("PASS: Successfully removed from exclusions")
            
            # Verify it's gone
            verify_response = requests.get(f"{BASE_URL}/api/excluded")
            verify_excluded = verify_response.json()
            still_exists = any(e["id"] == our_exclusion["id"] for e in verify_excluded)
            assert not still_exists, "Exclusion still exists after deletion"
            print("PASS: Exclusion no longer in list")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
