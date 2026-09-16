import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import get_db, Base, engine
from sqlalchemy.orm import sessionmaker
from app.models.master_data import TagDefinition, TagValue
from app.models.cloud import CloudProvider
from app.models.user import UserRole

# Use a clean test database strategy if needed, but since we are running against the real code logic, we can mock the DB or just use a transaction.
# We will just write the tests assuming the test DB fixture provides a clean session.

client = TestClient(app)

def override_get_admin_user():
    from app.models.user import User
    return User(id=999, email="admin@test.com", role=UserRole.ADMIN)

@pytest.fixture(autouse=True)
def run_around_tests():
    from app.api.admin_tags import get_admin_user as admin_tags_get_admin_user
    app.dependency_overrides[admin_tags_get_admin_user] = override_get_admin_user
    yield
    app.dependency_overrides.pop(admin_tags_get_admin_user, None)

def test_1_create_azure_only_tag():
    response = client.post("/api/admin/tags", json={"provider": "AZURE", "name": "TEST_AZURE_ONLY", "enabled": True})
    assert response.status_code == 200
    
    res_az = client.get("/api/admin/tags?provider=AZURE")
    assert any(t["name"] == "TEST_AZURE_ONLY" for t in res_az.json())
    
    res_aws = client.get("/api/admin/tags?provider=AWS")
    assert not any(t["name"] == "TEST_AZURE_ONLY" for t in res_aws.json())

def test_2_create_aws_only_tag():
    response = client.post("/api/admin/tags", json={"provider": "AWS", "name": "TEST_AWS_ONLY", "enabled": True})
    assert response.status_code == 200
    
    res_aws = client.get("/api/admin/tags?provider=AWS")
    assert any(t["name"] == "TEST_AWS_ONLY" for t in res_aws.json())
    
    res_az = client.get("/api/admin/tags?provider=AZURE")
    assert not any(t["name"] == "TEST_AWS_ONLY" for t in res_az.json())

def test_3_create_shared_tag():
    response = client.post("/api/admin/tags", json={"provider": "SHARED", "name": "TEST_SHARED", "enabled": True})
    assert response.status_code == 200
    
    res_az = client.get("/api/admin/tags?provider=AZURE")
    assert any(t["name"] == "TEST_SHARED" for t in res_az.json())
    
    res_aws = client.get("/api/admin/tags?provider=AWS")
    assert any(t["name"] == "TEST_SHARED" for t in res_aws.json())

def test_4_and_5_shared_values():
    # Get the shared tag
    res = client.get("/api/admin/tags?provider=AZURE")
    tag = next(t for t in res.json() if t["name"] == "TEST_SHARED")
    
    # Add value (context doesn't matter for the API, it's just adding to the tag ID)
    v_res = client.post(f"/api/admin/tags/{tag['id']}/values", json={"value": "PROD", "enabled": True})
    assert v_res.status_code == 200
    
    # Verify value appears when fetched via AWS context (which fetches the same tag ID)
    res_aws = client.get("/api/admin/tags?provider=AWS")
    tag_aws = next(t for t in res_aws.json() if t["name"] == "TEST_SHARED")
    assert any(v["value"] == "PROD" for v in tag_aws["values"])

def test_8_edit_azure_only_to_shared():
    # Get Azure only tag
    res = client.get("/api/admin/tags?provider=AZURE")
    tag = next(t for t in res.json() if t["name"] == "TEST_AZURE_ONLY")
    
    # Update to SHARED
    update_res = client.put(f"/api/admin/tags/{tag['id']}", json={"provider": "SHARED"})
    assert update_res.status_code == 200
    
    # Verify it now appears in AWS
    res_aws = client.get("/api/admin/tags?provider=AWS")
    assert any(t["name"] == "TEST_AZURE_ONLY" for t in res_aws.json())

def test_9_edit_shared_to_azure_only():
    # Get shared tag
    res = client.get("/api/admin/tags?provider=AZURE")
    tag = next(t for t in res.json() if t["name"] == "TEST_SHARED")
    
    # Update to AZURE
    update_res = client.put(f"/api/admin/tags/{tag['id']}", json={"provider": "AZURE"})
    assert update_res.status_code == 200
    
    # Verify it no longer appears in AWS
    res_aws = client.get("/api/admin/tags?provider=AWS")
    assert not any(t["name"] == "TEST_SHARED" for t in res_aws.json())

# Cleanup logic
def test_99_cleanup():
    res = client.get("/api/admin/tags")
    for t in res.json():
        if t["name"].startswith("TEST_"):
            client.delete(f"/api/admin/tags/{t['id']}")
