"""
Integration tests for the batch-verify player endpoint.
Uses mocked Century Games API responses.
"""
import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient


# Mock player data matching Century Games API response format
MOCK_PLAYER_DATA = {
    "33066334": {
        "fid": "33066334",
        "nickname": "TestPlayer1",
        "avatar_image": "https://cdn.centurygame.com/avatar1.png",
        "kid": 172,
        "stove_lv": 30,
    },
    "44077445": {
        "fid": "44077445",
        "nickname": "TestPlayer2",
        "avatar_image": "https://cdn.centurygame.com/avatar2.png",
        "kid": 200,
        "stove_lv": 25,
    },
    "55088556": {
        "fid": "55088556",
        "nickname": "TestPlayer3",
        "avatar_image": None,
        "kid": 150,
        "stove_lv": 15,
    },
}


async def mock_fetch_player(player_id: str):
    """Mock that returns fake player data or raises HTTPException for unknown IDs."""
    from fastapi import HTTPException

    if player_id in MOCK_PLAYER_DATA:
        return MOCK_PLAYER_DATA[player_id]
    raise HTTPException(status_code=404, detail={"code": "PLAYER_NOT_FOUND"})


async def mock_fetch_rate_limited(player_id: str):
    """Mock that simulates rate limiting on the 3rd call."""
    from fastapi import HTTPException

    mock_fetch_rate_limited._call_count = getattr(mock_fetch_rate_limited, "_call_count", 0) + 1
    if mock_fetch_rate_limited._call_count >= 3:
        raise HTTPException(status_code=429, detail={"code": "RATE_LIMITED"})
    if player_id in MOCK_PLAYER_DATA:
        return MOCK_PLAYER_DATA[player_id]
    raise HTTPException(status_code=404, detail={"code": "PLAYER_NOT_FOUND"})


class TestBatchVerify:
    """Test the POST /api/v1/player-link/batch-verify endpoint."""

    @patch("api.routers.player_link.fetch_player_from_century_games", side_effect=mock_fetch_player)
    @patch("asyncio.sleep", new_callable=AsyncMock)
    def test_batch_verify_success(self, mock_sleep, mock_fetch, client):
        """Test successful batch verification of multiple player IDs."""
        response = client.post(
            "/api/v1/player-link/batch-verify",
            json={"player_ids": ["33066334", "44077445"]},
        )
        assert response.status_code == 200
        data = response.json()
        assert "33066334" in data["results"]
        assert "44077445" in data["results"]
        assert data["results"]["33066334"]["username"] == "TestPlayer1"
        assert data["results"]["33066334"]["town_center_level"] == 30
        assert data["results"]["33066334"]["kingdom"] == 172
        assert data["results"]["44077445"]["username"] == "TestPlayer2"
        assert len(data["errors"]) == 0

    @patch("api.routers.player_link.fetch_player_from_century_games", side_effect=mock_fetch_player)
    @patch("asyncio.sleep", new_callable=AsyncMock)
    def test_batch_verify_with_unknown_player(self, mock_sleep, mock_fetch, client):
        """Test batch verify gracefully handles unknown player IDs."""
        response = client.post(
            "/api/v1/player-link/batch-verify",
            json={"player_ids": ["33066334", "99999999"]},
        )
        assert response.status_code == 200
        data = response.json()
        assert "33066334" in data["results"]
        assert "99999999" not in data["results"]
        assert len(data["errors"]) == 1
        assert "99999999" in data["errors"][0]

    @patch("api.routers.player_link.fetch_player_from_century_games", side_effect=mock_fetch_player)
    @patch("asyncio.sleep", new_callable=AsyncMock)
    def test_batch_verify_deduplicates(self, mock_sleep, mock_fetch, client):
        """Test that duplicate player IDs are deduplicated."""
        response = client.post(
            "/api/v1/player-link/batch-verify",
            json={"player_ids": ["33066334", "33066334", "33066334"]},
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["results"]) == 1
        assert mock_fetch.call_count == 1

    @patch("api.routers.player_link.fetch_player_from_century_games", side_effect=mock_fetch_player)
    @patch("asyncio.sleep", new_callable=AsyncMock)
    def test_batch_verify_validates_ids(self, mock_sleep, mock_fetch, client):
        """Test that invalid player IDs are filtered out."""
        response = client.post(
            "/api/v1/player-link/batch-verify",
            json={"player_ids": ["33066334", "abc", "12", ""]},
        )
        assert response.status_code == 200
        data = response.json()
        # Only 33066334 is valid (abc=not digits, 12=too short, empty=filtered)
        assert len(data["results"]) == 1
        assert mock_fetch.call_count == 1

    def test_batch_verify_empty_list(self, client):
        """Test that empty player_ids list returns validation error."""
        response = client.post(
            "/api/v1/player-link/batch-verify",
            json={"player_ids": []},
        )
        assert response.status_code == 422  # Pydantic validation error

    @patch("api.routers.player_link.fetch_player_from_century_games", side_effect=mock_fetch_rate_limited)
    @patch("asyncio.sleep", new_callable=AsyncMock)
    def test_batch_verify_stops_on_rate_limit(self, mock_sleep, mock_fetch, client):
        """Test that batch verify stops processing when rate limited."""
        mock_fetch_rate_limited._call_count = 0
        response = client.post(
            "/api/v1/player-link/batch-verify",
            json={"player_ids": ["33066334", "44077445", "55088556"]},
        )
        assert response.status_code == 200
        data = response.json()
        # First 2 succeed, 3rd gets rate limited
        assert len(data["results"]) == 2
        assert any("rate limited" in e for e in data["errors"])

    @patch("api.routers.player_link.fetch_player_from_century_games", side_effect=mock_fetch_player)
    @patch("asyncio.sleep", new_callable=AsyncMock)
    def test_batch_verify_response_structure(self, mock_sleep, mock_fetch, client):
        """Test that response matches expected BatchVerifyResponse schema."""
        response = client.post(
            "/api/v1/player-link/batch-verify",
            json={"player_ids": ["33066334"]},
        )
        assert response.status_code == 200
        data = response.json()
        player = data["results"]["33066334"]
        assert "player_id" in player
        assert "username" in player
        assert "avatar_url" in player
        assert "kingdom" in player
        assert "town_center_level" in player
        assert "verified" in player
        assert player["verified"] is True
