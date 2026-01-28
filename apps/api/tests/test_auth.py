"""
Tests for authentication endpoints.
"""
import pytest


class TestAuthEndpoints:
    """Test authentication-related API endpoints."""

    def test_register_user(self, client):
        """Test user registration with valid data."""
        response = client.post(
            "/api/auth/register",
            json={
                "username": "newuser",
                "email": "newuser@example.com",
                "password": "SecurePass123"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "newuser"
        assert data["email"] == "newuser@example.com"
        assert "hashed_password" not in data

    def test_register_duplicate_email(self, client, sample_user):
        """Test registration fails with duplicate email."""
        response = client.post(
            "/api/auth/register",
            json={
                "username": "anotheruser",
                "email": "test@example.com",  # Same as sample_user
                "password": "SecurePass123"
            }
        )
        assert response.status_code == 400
        assert "already registered" in response.json()["detail"]

    def test_register_duplicate_username(self, client, sample_user):
        """Test registration fails with duplicate username."""
        response = client.post(
            "/api/auth/register",
            json={
                "username": "testuser",  # Same as sample_user
                "email": "another@example.com",
                "password": "SecurePass123"
            }
        )
        assert response.status_code == 400
        assert "already taken" in response.json()["detail"]

    def test_register_weak_password(self, client):
        """Test registration fails with weak password."""
        response = client.post(
            "/api/auth/register",
            json={
                "username": "weakpassuser",
                "email": "weak@example.com",
                "password": "short"  # Too short, no digits
            }
        )
        assert response.status_code == 422  # Validation error

    def test_register_invalid_email(self, client):
        """Test registration fails with invalid email."""
        response = client.post(
            "/api/auth/register",
            json={
                "username": "invalidemail",
                "email": "not-an-email",
                "password": "SecurePass123"
            }
        )
        assert response.status_code == 422

    def test_login_success(self, client, sample_user):
        """Test successful login returns token."""
        response = client.post(
            "/api/auth/token",
            data={"username": "testuser", "password": "TestPass123"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_login_wrong_password(self, client, sample_user):
        """Test login fails with wrong password."""
        response = client.post(
            "/api/auth/token",
            data={"username": "testuser", "password": "wrongpassword"}
        )
        assert response.status_code == 401

    def test_login_wrong_username(self, client):
        """Test login fails with non-existent user."""
        response = client.post(
            "/api/auth/token",
            data={"username": "nonexistent", "password": "anypassword"}
        )
        assert response.status_code == 401

    def test_get_current_user(self, client, auth_headers):
        """Test getting current user info with valid token."""
        response = client.get("/api/auth/me", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "testuser"

    def test_get_current_user_no_token(self, client):
        """Test getting current user fails without token."""
        response = client.get("/api/auth/me")
        assert response.status_code == 401

    def test_get_current_user_invalid_token(self, client):
        """Test getting current user fails with invalid token."""
        response = client.get(
            "/api/auth/me",
            headers={"Authorization": "Bearer invalid-token"}
        )
        assert response.status_code == 401

    def test_logout(self, client, auth_headers):
        """Test logout endpoint."""
        response = client.post("/api/auth/logout", headers=auth_headers)
        assert response.status_code == 200
        assert "logged out" in response.json()["message"].lower()

    def test_admin_endpoint_forbidden(self, client, auth_headers):
        """Test admin endpoint forbidden for regular user."""
        response = client.get("/api/auth/admin-only", headers=auth_headers)
        assert response.status_code == 403

    def test_moderator_endpoint_forbidden(self, client, auth_headers):
        """Test moderator endpoint forbidden for regular user."""
        response = client.get("/api/auth/moderator-only", headers=auth_headers)
        assert response.status_code == 403
