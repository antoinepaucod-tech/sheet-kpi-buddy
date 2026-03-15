"""
Test Settings Types API endpoints for dynamic membership and member types
- Tests GET, POST, PUT, DELETE for membership-types and member-types
- Verifies iteration 34 requirements: dynamic subscription types
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://sports-kpi-hub.preview.emergentagent.com').rstrip('/')


class TestMembershipTypesAPI:
    """Tests for /api/settings/membership-types endpoints"""
    
    def test_get_membership_types_returns_list(self):
        """GET /api/settings/membership-types should return a list"""
        response = requests.get(f"{BASE_URL}/api/settings/membership-types")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ GET membership-types returned {len(data)} items")
    
    def test_get_active_membership_types(self):
        """GET /api/settings/membership-types?active_only=true should return active types"""
        response = requests.get(f"{BASE_URL}/api/settings/membership-types?active_only=true")
        assert response.status_code == 200
        
        data = response.json()
        # Verify all returned items are active
        for item in data:
            assert item.get('is_active') == True, f"Item {item.get('name')} should be active"
        print(f"✓ GET active_only=true returned {len(data)} active membership types")
    
    def test_membership_types_have_required_fields(self):
        """Each membership type should have required fields"""
        response = requests.get(f"{BASE_URL}/api/settings/membership-types?active_only=true")
        assert response.status_code == 200
        
        data = response.json()
        required_fields = ['id', 'name', 'is_active']
        
        for item in data:
            for field in required_fields:
                assert field in item, f"Field '{field}' missing in {item.get('name', 'unknown')}"
        print(f"✓ All membership types have required fields")
    
    def test_expected_membership_types_exist(self):
        """Verify expected membership types exist (Mensuel, Semestriel, Annuel, 6 Weeks Challenge, 3 Mois)"""
        response = requests.get(f"{BASE_URL}/api/settings/membership-types?active_only=true")
        assert response.status_code == 200
        
        data = response.json()
        names = [item['name'] for item in data]
        
        expected = ['Mensuel', 'Semestriel', 'Annuel', '6 Weeks Challenge', '3 Mois']
        for expected_name in expected:
            assert expected_name in names, f"Expected '{expected_name}' in membership types, found: {names}"
        
        print(f"✓ All 5 expected membership types found: {names}")
    
    def test_membership_types_have_duration_info(self):
        """Membership types should have duration_months or duration_days"""
        response = requests.get(f"{BASE_URL}/api/settings/membership-types?active_only=true")
        assert response.status_code == 200
        
        data = response.json()
        for item in data:
            has_duration = item.get('duration_months') or item.get('duration_days')
            # Allow duration_months = 0 for days-based memberships
            if item.get('duration_months') == 0:
                has_duration = item.get('duration_days') is not None
            assert has_duration, f"Type '{item.get('name')}' has no duration info"
        
        print("✓ All membership types have duration information")


class TestMemberTypesAPI:
    """Tests for /api/settings/member-types endpoints"""
    
    def test_get_member_types_returns_list(self):
        """GET /api/settings/member-types should return a list"""
        response = requests.get(f"{BASE_URL}/api/settings/member-types")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ GET member-types returned {len(data)} items")
    
    def test_get_active_member_types(self):
        """GET /api/settings/member-types?active_only=true should return active types"""
        response = requests.get(f"{BASE_URL}/api/settings/member-types?active_only=true")
        assert response.status_code == 200
        
        data = response.json()
        for item in data:
            assert item.get('is_active') == True, f"Item {item.get('name')} should be active"
        print(f"✓ GET active_only=true returned {len(data)} active member types")
    
    def test_expected_member_types_exist(self):
        """Verify expected member types exist (Généraux Récurrents, PIF, PT)"""
        response = requests.get(f"{BASE_URL}/api/settings/member-types?active_only=true")
        assert response.status_code == 200
        
        data = response.json()
        names = [item['name'] for item in data]
        codes = [item.get('code', '') for item in data]
        
        # Check for expected codes
        expected_codes = ['general', 'pif', 'pt']
        for expected_code in expected_codes:
            assert expected_code in codes, f"Expected code '{expected_code}' in member types, found: {codes}"
        
        print(f"✓ All 3 expected member types found: {names}")


class TestMembershipTypeCRUD:
    """Test CRUD operations for membership types"""
    
    @pytest.fixture(autouse=True)
    def cleanup(self):
        """Clean up test data after each test"""
        yield
        # Cleanup: delete any test memberships created
        response = requests.get(f"{BASE_URL}/api/settings/membership-types")
        if response.status_code == 200:
            for item in response.json():
                if item.get('name', '').startswith('TEST_'):
                    requests.delete(f"{BASE_URL}/api/settings/membership-types/{item['id']}")
    
    def test_create_membership_type(self):
        """POST /api/settings/membership-types should create a new type"""
        unique_name = f"TEST_Type_{uuid.uuid4().hex[:8]}"
        payload = {
            "name": unique_name,
            "duration_months": 2,
            "price": 200,
            "is_recurring": True,
            "is_active": True,
            "display_order": 99
        }
        
        response = requests.post(f"{BASE_URL}/api/settings/membership-types", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data['name'] == unique_name
        assert data['duration_months'] == 2
        assert data['price'] == 200
        assert 'id' in data
        
        # Verify persistence with GET
        get_response = requests.get(f"{BASE_URL}/api/settings/membership-types/{data['id']}")
        assert get_response.status_code == 200
        assert get_response.json()['name'] == unique_name
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/settings/membership-types/{data['id']}")
        print(f"✓ Created and verified membership type: {unique_name}")
    
    def test_update_membership_type(self):
        """PUT /api/settings/membership-types/:id should update an existing type"""
        # First create a type to update
        unique_name = f"TEST_Update_{uuid.uuid4().hex[:8]}"
        create_payload = {
            "name": unique_name,
            "duration_months": 1,
            "price": 100,
            "is_recurring": True,
            "is_active": True
        }
        create_response = requests.post(f"{BASE_URL}/api/settings/membership-types", json=create_payload)
        assert create_response.status_code == 200
        created_id = create_response.json()['id']
        
        # Update the type
        update_payload = {
            "name": unique_name,
            "duration_months": 3,
            "price": 300,
            "is_recurring": False,
            "is_active": True
        }
        update_response = requests.put(f"{BASE_URL}/api/settings/membership-types/{created_id}", json=update_payload)
        assert update_response.status_code == 200
        
        # Verify update with GET
        get_response = requests.get(f"{BASE_URL}/api/settings/membership-types/{created_id}")
        assert get_response.status_code == 200
        updated_data = get_response.json()
        assert updated_data['duration_months'] == 3
        assert updated_data['price'] == 300
        assert updated_data['is_recurring'] == False
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/settings/membership-types/{created_id}")
        print(f"✓ Updated and verified membership type: {unique_name}")
    
    def test_delete_membership_type(self):
        """DELETE /api/settings/membership-types/:id should delete a type"""
        # Create a type to delete
        unique_name = f"TEST_Delete_{uuid.uuid4().hex[:8]}"
        create_payload = {
            "name": unique_name,
            "duration_months": 1,
            "price": 50,
            "is_recurring": True,
            "is_active": True
        }
        create_response = requests.post(f"{BASE_URL}/api/settings/membership-types", json=create_payload)
        assert create_response.status_code == 200
        created_id = create_response.json()['id']
        
        # Delete the type
        delete_response = requests.delete(f"{BASE_URL}/api/settings/membership-types/{created_id}")
        assert delete_response.status_code == 200
        
        # Verify deletion with GET (should return 404)
        get_response = requests.get(f"{BASE_URL}/api/settings/membership-types/{created_id}")
        assert get_response.status_code == 404
        
        print(f"✓ Deleted and verified removal of membership type: {unique_name}")


class TestMemberTypeCRUD:
    """Test CRUD operations for member types"""
    
    @pytest.fixture(autouse=True)
    def cleanup(self):
        """Clean up test data after each test"""
        yield
        # Cleanup: delete any test member types created
        response = requests.get(f"{BASE_URL}/api/settings/member-types")
        if response.status_code == 200:
            for item in response.json():
                if item.get('code', '').startswith('test_'):
                    requests.delete(f"{BASE_URL}/api/settings/member-types/{item['id']}")
    
    def test_create_member_type(self):
        """POST /api/settings/member-types should create a new type"""
        unique_code = f"test_{uuid.uuid4().hex[:8]}"
        payload = {
            "name": f"TEST Member {unique_code}",
            "code": unique_code,
            "description": "Test member type",
            "is_active": True,
            "display_order": 99
        }
        
        response = requests.post(f"{BASE_URL}/api/settings/member-types", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data['code'] == unique_code
        assert 'id' in data
        
        # Verify persistence with GET
        get_response = requests.get(f"{BASE_URL}/api/settings/member-types/{data['id']}")
        assert get_response.status_code == 200
        assert get_response.json()['code'] == unique_code
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/settings/member-types/{data['id']}")
        print(f"✓ Created and verified member type: {unique_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
