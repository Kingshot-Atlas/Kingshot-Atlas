"""
Pytest configuration and fixtures for Kingshot Atlas API tests.
"""
import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Set test environment before importing app modules
os.environ["SECRET_KEY"] = "test-secret-key-for-testing-only"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from database import Base, get_db
from main import app


# Create test database engine
TEST_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    """Override database dependency for tests."""
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="function")
def db_session():
    """Create a fresh database session for each test."""
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    """Create a test client with database override."""
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.create_all(bind=engine)
    
    with TestClient(app) as test_client:
        yield test_client
    
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def sample_kingdom(db_session):
    """Create a sample kingdom for testing."""
    from models import Kingdom
    from datetime import datetime
    
    kingdom = Kingdom(
        kingdom_number=100,
        total_kvks=10,
        prep_wins=6,
        prep_losses=4,
        prep_win_rate=0.6,
        prep_streak=2,
        battle_wins=7,
        battle_losses=3,
        battle_win_rate=0.7,
        battle_streak=3,
        dominations=5,
        defeats=2,
        most_recent_status="Unannounced",
        overall_score=85.5,
        last_updated=datetime.utcnow()
    )
    db_session.add(kingdom)
    db_session.commit()
    db_session.refresh(kingdom)
    return kingdom


@pytest.fixture
def sample_user(db_session):
    """Create a sample user for testing."""
    from models import User
    from api.routers.auth import hash_password
    
    user = User(
        username="testuser",
        email="test@example.com",
        hashed_password=hash_password("TestPass123"),
        role="user",
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def auth_headers(client, sample_user):
    """Get authentication headers for a test user."""
    response = client.post(
        "/api/auth/token",
        data={"username": "testuser", "password": "TestPass123"}
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
