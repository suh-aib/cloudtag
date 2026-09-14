import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.user import User, UserRole
from app.models.master_data import TagDefinition, TagValue
from app.models.resource import Resource
import uuid

@pytest.fixture
def admin_user():
    db = SessionLocal()
    user = db.query(User).filter(User.role == UserRole.ADMIN).first()
    db.close()
    return user

@pytest.fixture
def override_user(admin_user):
    from app.api.deps import get_current_user
    def _override():
        return admin_user
    app.dependency_overrides[get_current_user] = _override
    yield
    app.dependency_overrides.pop(get_current_user, None)

@pytest.fixture
def client(override_user):
    return TestClient(app)

def test_create_tag_definition(client):
    tag_name = f"TEST_TAG_{uuid.uuid4().hex[:6]}"
    response = client.post("/api/admin/tags", json={
        "provider": "AZURE",
        "name": tag_name,
        "description": "A test tag",
        "mandatory": True,
        "enabled": True
    })
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == tag_name
    assert data["provider"] == "AZURE"

def test_create_tag_values(client):
    tag_name = f"TEST_TAG_{uuid.uuid4().hex[:6]}"
    res = client.post("/api/admin/tags", json={
        "provider": "AZURE",
        "name": tag_name,
        "description": "A test tag",
        "mandatory": True,
        "enabled": True
    })
    test_tag = res.json()
    
    # Add a value
    response = client.post(f"/api/admin/tags/{test_tag['id']}/values", json={
        "value": "VAL1",
        "display_name": "Value 1",
        "enabled": True
    })
    assert response.status_code == 200
    data = response.json()
    assert data["value"] == "VAL1"

def test_bulk_tagging_validation(client):
    tag_name = f"TEST_TAG_{uuid.uuid4().hex[:6]}"
    res = client.post("/api/admin/tags", json={
        "provider": "AZURE",
        "name": tag_name,
        "description": "A test tag",
        "mandatory": True,
        "enabled": True
    })
    test_tag = res.json()
    client.post(f"/api/admin/tags/{test_tag['id']}/values", json={
        "value": "VAL1",
        "display_name": "Value 1",
        "enabled": True
    })
    
    db = SessionLocal()
    resource = db.query(Resource).filter(Resource.provider == "AZURE").first()
    db.close()
    if not resource:
        pytest.skip("No AZURE resource found to test bulk tagging")

    # This should fail because VAL2 is not an allowed value
    response = client.post("/api/tagging/bulk", json={
        "provider": "AZURE",
        "scope_type": "RESOURCE_SELECTION",
        "resource_ids": [resource.id],
        "tags": {
            tag_name: "VAL2"
        }
    })
    assert response.status_code == 400
    assert "Invalid value" in response.json()["detail"]

    # This should succeed
    response = client.post("/api/tagging/bulk", json={
        "provider": "AZURE",
        "scope_type": "RESOURCE_SELECTION",
        "resource_ids": [resource.id],
        "tags": {
            tag_name: "VAL1"
        }
    })
    assert response.status_code == 200

def test_bulk_create_and_soft_delete(client):
    tag_name = f"TEST_TAG_{uuid.uuid4().hex[:6]}"
    res = client.post("/api/admin/tags", json={
        "provider": "AZURE",
        "name": tag_name,
        "description": "Bulk tag test",
        "mandatory": False,
        "enabled": True
    })
    test_tag = res.json()
    tag_id = test_tag["id"]

    # Bulk create values
    bulk_res = client.post(f"/api/admin/tags/{tag_id}/values/bulk", json={
        "values": ["A", "B", "C"]
    })
    assert bulk_res.status_code == 200
    values = bulk_res.json()
    assert len(values) == 3
    assert {v["value"] for v in values} == {"A", "B", "C"}
    
    # Check duplicates are ignored
    bulk_res2 = client.post(f"/api/admin/tags/{tag_id}/values/bulk", json={
        "values": ["B", "C", "D"]
    })
    values2 = bulk_res2.json()
    assert len(values2) == 4
    assert {v["value"] for v in values2} == {"A", "B", "C", "D"}

    # Soft delete 'A'
    val_a = next(v for v in values2 if v["value"] == "A")
    del_res = client.delete(f"/api/admin/tags/values/{val_a['id']}")
    assert del_res.status_code == 200
    
    # Verify it is soft deleted (enabled=False)
    db = SessionLocal()
    val_in_db = db.query(TagValue).filter(TagValue.id == val_a['id']).first()
    assert val_in_db is not None
    assert val_in_db.enabled is False
    db.close()
