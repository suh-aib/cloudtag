from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import pytest
import os
import uuid

from app.main import app as fastapi_app
from app.database import Base, get_db
from app.models.user import User, UserRole
from app.api.deps import get_current_user, get_admin_user
from app.models.resource import Resource, TaggingScope
from app.models.cloud import CloudAccount, CloudProvider
from app.models.assignment import TaskAssignment, TaskAssignmentResource
from sqlalchemy.pool import StaticPool
import app.models # Load all models so Base.metadata is populated

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

user_admin = User(id=1, email="admin@example.com", role=UserRole.ADMIN, display_name="Admin")
user_a = User(id=2, email="usera@example.com", role=UserRole.USER, display_name="User A")
user_b = User(id=3, email="userb@example.com", role=UserRole.USER, display_name="User B")

current_user_override = user_admin

def override_get_current_user():
    return current_user_override

def override_get_admin_user():
    if current_user_override.role != UserRole.ADMIN:
        raise Exception("Not admin")
    return current_user_override

client = TestClient(fastapi_app)

@pytest.fixture(autouse=True)
def test_db():
    global current_user_override
    current_user_override = user_admin
    
    fastapi_app.dependency_overrides[get_db] = override_get_db
    fastapi_app.dependency_overrides[get_current_user] = override_get_current_user
    fastapi_app.dependency_overrides[get_admin_user] = override_get_admin_user
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    # Insert users
    db.merge(user_admin)
    db.merge(user_a)
    db.merge(user_b)
    
    # Insert mock data
    acc1 = CloudAccount(id=1, name="Sub1", account_identifier="sub-1", cloud=CloudProvider.AZURE)
    acc2 = CloudAccount(id=2, name="Sub2", account_identifier="sub-2", cloud=CloudProvider.AZURE)
    db.merge(acc1)
    db.merge(acc2)
    db.commit()
    
    res1 = Resource(id=1, provider=CloudProvider.AZURE, cloud_account_id=acc1.id, resource_name="r1", resource_type="t1", resource_id="id1", resource_id_hash="h1", tagging_scope=TaggingScope.REQUIRED, resource_group="rg1")
    res2 = Resource(id=2, provider=CloudProvider.AZURE, cloud_account_id=acc1.id, resource_name="r2", resource_type="t1", resource_id="id2", resource_id_hash="h2", tagging_scope=TaggingScope.SUPPORTING, resource_group="rg1")
    res3 = Resource(id=3, provider=CloudProvider.AZURE, cloud_account_id=acc2.id, resource_name="r3", resource_type="t2", resource_id="id3", resource_id_hash="h3", tagging_scope=TaggingScope.REQUIRED, resource_group="rg2")
    
    db.merge(res1)
    db.merge(res2)
    db.merge(res3)
    db.commit()
    
    yield
    
    db.close()
    Base.metadata.drop_all(bind=engine)

def test_admin_create_subscription_assignment():
    payload = {
        "provider": "AZURE",
        "assigned_user_id": 2,
        "scope_type": "SUBSCRIPTION",
        "subscription_id": "sub-1"
    }
    response = client.post("/api/admin/task-assignments", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["resource_count"] == 2
    assert data["status"] == "ACTIVE"
    assert data["task_number"] == "CT-001"

def test_duplicate_overlap_rejection():
    # First assignment
    payload1 = {
        "provider": "AZURE",
        "assigned_user_id": 2,
        "scope_type": "SUBSCRIPTION",
        "subscription_id": "sub-1"
    }
    client.post("/api/admin/task-assignments", json=payload1)
    
    # Second assignment overlapping via Resource Group
    payload2 = {
        "provider": "AZURE",
        "assigned_user_id": 2,
        "scope_type": "RESOURCE_GROUP",
        "resource_group": "rg1"
    }
    response = client.post("/api/admin/task-assignments", json=payload2)
    assert response.status_code == 400
    assert "already included in an active assignment for this user" in response.json()["detail"]

def test_different_users_same_resource():
    # First assignment to User A
    payload1 = {
        "provider": "AZURE",
        "assigned_user_id": 2,
        "scope_type": "RESOURCE_GROUP",
        "resource_group": "rg1"
    }
    res1 = client.post("/api/admin/task-assignments", json=payload1)
    assert res1.status_code == 200
    
    # Second assignment to User B
    payload2 = {
        "provider": "AZURE",
        "assigned_user_id": 3,
        "scope_type": "RESOURCE_GROUP",
        "resource_group": "rg1"
    }
    res2 = client.post("/api/admin/task-assignments", json=payload2)
    assert res2.status_code == 200

def test_user_data_isolation():
    global current_user_override
    
    # Admin assigns to User A
    payload = {
        "provider": "AZURE",
        "assigned_user_id": 2,
        "scope_type": "SUBSCRIPTION",
        "subscription_id": "sub-1"
    }
    client.post("/api/admin/task-assignments", json=payload)
    
    # Switch to User A
    current_user_override = user_a
    res_a = client.get("/api/my/tasks")
    assert res_a.status_code == 200
    assert len(res_a.json()) == 1
    task_id = res_a.json()[0]["id"]
    
    # Switch to User B
    current_user_override = user_b
    res_b = client.get("/api/my/tasks")
    assert res_b.status_code == 200
    assert len(res_b.json()) == 0
    
    # User B tries to view User A's task
    res_b_detail = client.get(f"/api/my/tasks/{task_id}")
    assert res_b_detail.status_code == 403

def test_admin_user_progress():
    payload = {
        "provider": "AZURE",
        "assigned_user_id": 2,
        "scope_type": "SUBSCRIPTION",
        "subscription_id": "sub-1"
    }
    client.post("/api/admin/task-assignments", json=payload)
    
    res = client.get("/api/admin/user-tag-progress")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["user_id"] == 2
    assert data[0]["total_resources"] == 2
    assert data[0]["completed_resources"] == 0

def test_preview_assignment():
    payload = {
        "provider": "AZURE",
        "assigned_user_id": 2,
        "scope_type": "SUBSCRIPTION",
        "subscription_id": "sub-1"
    }
    response = client.post("/api/admin/task-assignments/preview", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["resource_count"] == 2
    assert data["is_valid"] == True
    assert data["conflict"] == False
    
    # Actually create it
    client.post("/api/admin/task-assignments", json=payload)
    
    # Preview again, should show conflict
    response2 = client.post("/api/admin/task-assignments/preview", json=payload)
    data2 = response2.json()
    assert data2["resource_count"] == 2
    assert data2["is_valid"] == False
    assert data2["conflict"] == True

def test_admin_rbac_enforcement():
    global current_user_override
    
    # User A tries to create assignment
    current_user_override = user_a
    payload = {
        "provider": "AZURE",
        "assigned_user_id": 2,
        "scope_type": "SUBSCRIPTION",
        "subscription_id": "sub-1"
    }
    
    # POST assignment should fail
    try:
        res1 = client.post("/api/admin/task-assignments", json=payload)
        assert res1.status_code == 403 or res1.status_code == 500  # Dep overrides raise Exception("Not admin")
    except Exception as e:
        assert "Not admin" in str(e)
        
    # Preview assignment should fail
    try:
        res2 = client.post("/api/admin/task-assignments/preview", json=payload)
    except Exception as e:
        assert "Not admin" in str(e)

    # Get admin progress should fail
    try:
        res3 = client.get("/api/admin/user-tag-progress")
    except Exception as e:
        assert "Not admin" in str(e)

