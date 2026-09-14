from fastapi.testclient import TestClient
import pytest
from app.main import app as fastapi_app
from app.models.user import User
from app.models.tagging import TaggingBatch, BatchStatus
from app.api.auth import get_current_user
from app.api.deps import get_admin_user
from datetime import datetime

client = TestClient(fastapi_app)

def mock_admin_user():
    return User(id=1, email="admin@test.com", display_name="Admin User", role="ADMIN")

def mock_normal_user():
    return User(id=2, email="user@test.com", display_name="Test User", role="USER")

fastapi_app.dependency_overrides[get_current_user] = mock_normal_user
fastapi_app.dependency_overrides[get_admin_user] = mock_admin_user

@pytest.fixture
def test_db(monkeypatch):
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from app.database import Base, get_db

    import os
    db_path = "./approvals_test.db"
    if os.path.exists(db_path):
        os.remove(db_path)
    engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    
    import app.models.resource
    import app.models.cloud
    import app.models.tagging
    import app.models.user
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    db = TestingSessionLocal()
    
    # Insert users
    admin = User(id=1, email="admin@test.com", display_name="Admin User", role="ADMIN", password_hash="pw")
    user = User(id=2, email="user@test.com", display_name="Test User", role="USER", password_hash="pw")
    db.add_all([admin, user])
    
    # Insert batches
    b1 = TaggingBatch(batch_id="B-1", cloud="AZURE", status=BatchStatus.PENDING_APPROVAL, created_by=2)
    b2 = TaggingBatch(batch_id="B-2", cloud="AWS", status=BatchStatus.APPROVED, created_by=2)
    b3 = TaggingBatch(batch_id="B-3", cloud="AZURE", status=BatchStatus.PARTIALLY_APPROVED, created_by=2)
    
    db.add_all([b1, b2, b3])
    db.commit()

    def override_get_db():
        try:
            yield db
        finally:
            db.close()
            
    fastapi_app.dependency_overrides[get_db] = override_get_db
    yield db
    Base.metadata.drop_all(bind=engine)
    fastapi_app.dependency_overrides.pop(get_db, None)

def test_get_approval_queue_admin(test_db):
    response = client.get("/api/approvals/queue")
    assert response.status_code == 200
    data = response.json()
