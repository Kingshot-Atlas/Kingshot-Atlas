"""
Tests for kingdom endpoints.
"""
import pytest


class TestKingdomEndpoints:
    """Test kingdom-related API endpoints."""

    def test_health_check(self, client):
        """Test health endpoint returns healthy status."""
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "healthy"}

    def test_root_endpoint(self, client):
        """Test root endpoint returns API message."""
        response = client.get("/")
        assert response.status_code == 200
        assert "message" in response.json()

    def test_get_kingdoms_empty(self, client):
        """Test getting kingdoms when database is empty."""
        response = client.get("/api/v1/kingdoms")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert data["total"] == 0

    def test_get_kingdoms_with_data(self, client, sample_kingdom):
        """Test getting kingdoms with data in database."""
        response = client.get("/api/v1/kingdoms")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1
        
    def test_get_kingdom_by_number(self, client, sample_kingdom):
        """Test getting a specific kingdom by number."""
        response = client.get(f"/api/v1/kingdoms/{sample_kingdom.kingdom_number}")
        assert response.status_code == 200
        data = response.json()
        assert data["kingdom_number"] == sample_kingdom.kingdom_number
        assert data["overall_score"] == sample_kingdom.overall_score

    def test_get_kingdom_not_found(self, client):
        """Test getting a non-existent kingdom returns 404."""
        response = client.get("/api/v1/kingdoms/99999")
        assert response.status_code == 404

    def test_get_kingdoms_with_search(self, client, sample_kingdom):
        """Test kingdom search functionality."""
        response = client.get(f"/api/v1/kingdoms?search={sample_kingdom.kingdom_number}")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1

    def test_get_kingdoms_pagination(self, client, sample_kingdom):
        """Test pagination parameters."""
        response = client.get("/api/v1/kingdoms?page=1&page_size=10")
        assert response.status_code == 200
        data = response.json()
        assert "page" in data
        assert "page_size" in data
        assert "total_pages" in data

    def test_get_kingdoms_sorting(self, client, sample_kingdom):
        """Test sorting parameters."""
        response = client.get("/api/v1/kingdoms?sort=overall_score&order=desc")
        assert response.status_code == 200

    def test_security_headers_present(self, client):
        """Test that security headers are present in responses."""
        response = client.get("/health")
        assert "x-content-type-options" in response.headers
        assert "x-frame-options" in response.headers
        assert "content-security-policy" in response.headers
        assert "referrer-policy" in response.headers


class TestLeaderboardEndpoints:
    """Test leaderboard-related API endpoints."""

    def test_get_leaderboard_empty(self, client):
        """Test leaderboard when database is empty."""
        response = client.get("/api/v1/leaderboard")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_get_leaderboard_with_data(self, client, sample_kingdom):
        """Test leaderboard returns kingdoms sorted by score."""
        response = client.get("/api/v1/leaderboard")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1

    def test_get_leaderboard_limit(self, client, sample_kingdom):
        """Test leaderboard respects limit parameter."""
        response = client.get("/api/v1/leaderboard?limit=5")
        assert response.status_code == 200
        data = response.json()
        assert len(data) <= 5


class TestCompareEndpoints:
    """Test comparison API endpoints."""

    def test_compare_kingdoms(self, client, sample_kingdom, db_session):
        """Test comparing multiple kingdoms."""
        from models import Kingdom
        from datetime import datetime, timezone
        
        # Create another kingdom
        kingdom2 = Kingdom(
            kingdom_number=101,
            total_kvks=8,
            prep_wins=5,
            prep_losses=3,
            prep_win_rate=0.625,
            prep_streak=1,
            battle_wins=6,
            battle_losses=2,
            battle_win_rate=0.75,
            battle_streak=2,
            dominations=4,
            defeats=1,
            most_recent_status="Unannounced",
            overall_score=82.0,
            last_updated=datetime.now(timezone.utc)
        )
        db_session.add(kingdom2)
        db_session.commit()
        
        response = client.get(f"/api/v1/compare?kingdoms={sample_kingdom.kingdom_number},{kingdom2.kingdom_number}")
        assert response.status_code == 200
        data = response.json()
        assert "kingdoms" in data
        assert len(data["kingdoms"]) == 2

    def test_compare_kingdom_not_found(self, client):
        """Test comparing with non-existent kingdom returns 404."""
        response = client.get("/api/v1/compare?kingdoms=99998,99999")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()
