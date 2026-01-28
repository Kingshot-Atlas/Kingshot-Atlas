"""
Tests for submission endpoints and validation.
"""
import pytest


class TestSubmissionValidation:
    """Test submission input validation."""

    def test_create_submission_valid(self, client, sample_kingdom):
        """Test creating a valid submission."""
        response = client.post(
            "/api/submissions",
            json={
                "kingdom_number": sample_kingdom.kingdom_number,
                "kvk_number": 5,
                "opponent_kingdom": 200,
                "prep_result": "W",
                "battle_result": "L",
                "notes": "Test submission"
            },
            headers={"X-User-Id": "test-user-123", "X-User-Name": "TestUser"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["kingdom_number"] == sample_kingdom.kingdom_number
        assert data["status"] == "pending"

    def test_create_submission_invalid_prep_result(self, client, sample_kingdom):
        """Test submission fails with invalid prep_result."""
        response = client.post(
            "/api/submissions",
            json={
                "kingdom_number": sample_kingdom.kingdom_number,
                "kvk_number": 5,
                "opponent_kingdom": 200,
                "prep_result": "X",  # Invalid
                "battle_result": "W"
            },
            headers={"X-User-Id": "test-user-123"}
        )
        assert response.status_code == 422

    def test_create_submission_kingdom_too_large(self, client):
        """Test submission fails with kingdom number out of range."""
        response = client.post(
            "/api/submissions",
            json={
                "kingdom_number": 99999,  # Out of range (max 9999)
                "kvk_number": 5,
                "opponent_kingdom": 200,
                "prep_result": "W",
                "battle_result": "W"
            },
            headers={"X-User-Id": "test-user-123"}
        )
        assert response.status_code == 422

    def test_create_submission_same_opponent(self, client, sample_kingdom):
        """Test submission fails when opponent equals kingdom."""
        response = client.post(
            "/api/submissions",
            json={
                "kingdom_number": sample_kingdom.kingdom_number,
                "kvk_number": 5,
                "opponent_kingdom": sample_kingdom.kingdom_number,  # Same!
                "prep_result": "W",
                "battle_result": "W"
            },
            headers={"X-User-Id": "test-user-123"}
        )
        assert response.status_code == 422

    def test_create_submission_invalid_screenshot_url(self, client, sample_kingdom):
        """Test submission fails with invalid screenshot URL."""
        response = client.post(
            "/api/submissions",
            json={
                "kingdom_number": sample_kingdom.kingdom_number,
                "kvk_number": 5,
                "opponent_kingdom": 200,
                "prep_result": "W",
                "battle_result": "W",
                "screenshot_url": "not-a-valid-url"  # Must start with http(s)://
            },
            headers={"X-User-Id": "test-user-123"}
        )
        assert response.status_code == 422

    def test_create_submission_missing_user_id(self, client, sample_kingdom):
        """Test submission fails without user ID header."""
        response = client.post(
            "/api/submissions",
            json={
                "kingdom_number": sample_kingdom.kingdom_number,
                "kvk_number": 5,
                "opponent_kingdom": 200,
                "prep_result": "W",
                "battle_result": "W"
            }
        )
        assert response.status_code == 422

    def test_create_submission_kingdom_not_found(self, client):
        """Test submission fails for non-existent kingdom."""
        response = client.post(
            "/api/submissions",
            json={
                "kingdom_number": 9998,  # Doesn't exist
                "kvk_number": 5,
                "opponent_kingdom": 200,
                "prep_result": "W",
                "battle_result": "W"
            },
            headers={"X-User-Id": "test-user-123"}
        )
        assert response.status_code == 404

    def test_get_submissions(self, client):
        """Test getting submissions list."""
        response = client.get("/api/submissions")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_get_submissions_filtered(self, client):
        """Test getting submissions with status filter."""
        response = client.get("/api/submissions?status=pending")
        assert response.status_code == 200


class TestSubmissionReview:
    """Test submission review functionality."""

    def test_review_submission_approve(self, client, sample_kingdom):
        """Test approving a submission."""
        # First create a submission
        create_response = client.post(
            "/api/submissions",
            json={
                "kingdom_number": sample_kingdom.kingdom_number,
                "kvk_number": 5,
                "opponent_kingdom": 200,
                "prep_result": "W",
                "battle_result": "W"
            },
            headers={"X-User-Id": "test-user-123"}
        )
        submission_id = create_response.json()["id"]
        
        # Review it
        response = client.post(
            f"/api/submissions/{submission_id}/review",
            json={"status": "approved", "review_notes": "Looks good"},
            headers={"X-User-Id": "moderator-123"}
        )
        assert response.status_code == 200
        assert "approved" in response.json()["message"]

    def test_review_submission_reject(self, client, sample_kingdom):
        """Test rejecting a submission."""
        create_response = client.post(
            "/api/submissions",
            json={
                "kingdom_number": sample_kingdom.kingdom_number,
                "kvk_number": 6,
                "opponent_kingdom": 201,
                "prep_result": "L",
                "battle_result": "L"
            },
            headers={"X-User-Id": "test-user-123"}
        )
        submission_id = create_response.json()["id"]
        
        response = client.post(
            f"/api/submissions/{submission_id}/review",
            json={"status": "rejected", "review_notes": "Invalid data"},
            headers={"X-User-Id": "moderator-123"}
        )
        assert response.status_code == 200
        assert "rejected" in response.json()["message"]

    def test_review_submission_invalid_status(self, client, sample_kingdom):
        """Test review fails with invalid status."""
        create_response = client.post(
            "/api/submissions",
            json={
                "kingdom_number": sample_kingdom.kingdom_number,
                "kvk_number": 7,
                "opponent_kingdom": 202,
                "prep_result": "W",
                "battle_result": "L"
            },
            headers={"X-User-Id": "test-user-123"}
        )
        submission_id = create_response.json()["id"]
        
        response = client.post(
            f"/api/submissions/{submission_id}/review",
            json={"status": "invalid_status"},
            headers={"X-User-Id": "moderator-123"}
        )
        assert response.status_code == 422

    def test_review_nonexistent_submission(self, client):
        """Test reviewing non-existent submission fails."""
        response = client.post(
            "/api/submissions/99999/review",
            json={"status": "approved"},
            headers={"X-User-Id": "moderator-123"}
        )
        assert response.status_code == 404
