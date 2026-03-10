"""
Authentication API tests
- Tests JWT login/register/me endpoints
- Tests protected routes
- Tests token validation
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuthEndpoints:
    """Auth endpoint tests: register, login, me, update-club-name"""
    
    def test_login_success(self):
        """Test login with existing credentials (test@crossfit.ch/test123)"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@crossfit.ch",
            "password": "test123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "access_token" in data, "Missing access_token in response"
        assert "token_type" in data, "Missing token_type in response"
        assert data["token_type"] == "bearer"
        assert "user" in data, "Missing user in response"
        
        # Verify user data
        user = data["user"]
        assert user["email"] == "test@crossfit.ch"
        assert user["club_name"] == "CrossFit Lausanne"
        assert "id" in user
        
        # Store token for other tests
        TestAuthEndpoints.auth_token = data["access_token"]
        TestAuthEndpoints.user_id = user["id"]
    
    def test_login_invalid_credentials(self):
        """Test login with wrong password"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@crossfit.ch",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        assert "incorrect" in data["detail"].lower() or "mot de passe" in data["detail"].lower()
    
    def test_login_nonexistent_user(self):
        """Test login with non-existent email"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "nonexistent@example.com",
            "password": "somepassword"
        })
        assert response.status_code == 401
    
    def test_register_new_user_and_verify(self):
        """Test registering a new user and verify data persistence"""
        unique_email = f"TEST_user_{uuid.uuid4().hex[:8]}@example.com"
        club_name = "TEST Club Fitness"
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "testpass123",
            "club_name": club_name
        })
        assert response.status_code == 200, f"Register failed: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "access_token" in data
        assert "user" in data
        
        user = data["user"]
        assert user["email"] == unique_email.lower()  # Email should be lowercase
        assert user["club_name"] == club_name
        assert "id" in user
        
        # GET /auth/me to verify user was persisted
        headers = {"Authorization": f"Bearer {data['access_token']}"}
        me_response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert me_response.status_code == 200
        
        me_data = me_response.json()
        assert me_data["email"] == unique_email.lower()
        assert me_data["club_name"] == club_name
        
        # Store for cleanup
        TestAuthEndpoints.test_user_email = unique_email
    
    def test_register_duplicate_email(self):
        """Test registering with existing email fails"""
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": "test@crossfit.ch",  # Already exists
            "password": "testpass123",
            "club_name": "Another Club"
        })
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        assert "email" in data["detail"].lower() or "utilisé" in data["detail"].lower()
    
    def test_get_me_with_valid_token(self):
        """Test /auth/me with valid token"""
        # First login to get token
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@crossfit.ch",
            "password": "test123"
        })
        token = login_response.json()["access_token"]
        
        # Call /auth/me
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "test@crossfit.ch"
        assert data["club_name"] == "CrossFit Lausanne"
        assert "id" in data
    
    def test_get_me_without_token(self):
        """Test /auth/me without token returns 401"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        assert "token" in data["detail"].lower() or "manquant" in data["detail"].lower()
    
    def test_get_me_with_invalid_token(self):
        """Test /auth/me with invalid token returns 401"""
        headers = {"Authorization": "Bearer invalidtoken123"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
    
    def test_update_club_name(self):
        """Test updating club name"""
        # Login first
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@crossfit.ch",
            "password": "test123"
        })
        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Update club name
        new_name = "CrossFit Lausanne Updated"
        response = requests.put(f"{BASE_URL}/api/auth/club-name", 
            json={"club_name": new_name},
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["club_name"] == new_name
        
        # Verify via /auth/me
        me_response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert me_response.json()["club_name"] == new_name
        
        # Reset back to original
        requests.put(f"{BASE_URL}/api/auth/club-name", 
            json={"club_name": "CrossFit Lausanne"},
            headers=headers
        )
    
    def test_update_club_name_without_auth(self):
        """Test updating club name without auth fails"""
        response = requests.put(f"{BASE_URL}/api/auth/club-name", 
            json={"club_name": "New Name"}
        )
        assert response.status_code == 401


class TestProtectedRoutes:
    """Test that other API routes work with/without auth"""
    
    def test_unprotected_routes_work_without_auth(self):
        """Some routes like /monthly-kpis should work without auth (based on current impl)"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis")
        # Currently these routes don't require auth based on server.py
        assert response.status_code == 200
    
    def test_settings_route_works(self):
        """Test /settings endpoint"""
        response = requests.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 200


class TestTokenValidation:
    """Test JWT token validation edge cases"""
    
    def test_malformed_authorization_header(self):
        """Test with malformed auth header"""
        # Missing Bearer prefix
        headers = {"Authorization": "sometoken"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 401
    
    def test_empty_bearer_token(self):
        """Test with empty bearer token"""
        headers = {"Authorization": "Bearer "}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 401


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
