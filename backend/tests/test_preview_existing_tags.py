import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.models.user import UserRole
from app.database import engine
from sqlalchemy.orm import Session
from app.models.resource import Resource, TaggingScope, Billability
from app.models.cloud import CloudProvider
from app.models.master_data import TagDefinition, TagProvider

client = TestClient(app)

def override_get_current_user():
    from app.models.user import User
    return User(id=999, email="admin@test.com", role=UserRole.ADMIN)

@pytest.fixture(autouse=True)
def setup_data():
    from app.api.deps import get_current_user
    app.dependency_overrides[get_current_user] = override_get_current_user
    with Session(engine) as session:
        # Create a mock resource with no ENVIRONMENT but other tags
        res1 = Resource(
            provider=CloudProvider.AWS,
            resource_id="arn:aws:ec2:us-east-1:123:instance/i-001",
            resource_name="instance-1",
            resource_type="ec2/instance",
            cloud_tags={"APPNAME": "ABC", "ROLE": "WEB"},
            tagging_scope=TaggingScope.REQUIRED,
            billability=Billability.BILLABLE
        )
        
        # Create a mock resource with ENVIRONMENT=DEV
        res2 = Resource(
            provider=CloudProvider.AWS,
            resource_id="arn:aws:ec2:us-east-1:123:instance/i-002",
            resource_name="instance-2",
            resource_type="ec2/instance",
            cloud_tags={"APPNAME": "ABC", "ROLE": "WEB", "ENVIRONMENT": "DEV"},
            tagging_scope=TaggingScope.REQUIRED,
            billability=Billability.BILLABLE
        )
        
        # Create a mock resource that already has ENVIRONMENT=PROD (should be skipped)
        res3 = Resource(
            provider=CloudProvider.AWS,
            resource_id="arn:aws:ec2:us-east-1:123:instance/i-003",
            resource_name="instance-3",
            resource_type="ec2/instance",
            cloud_tags={"ENVIRONMENT": "PROD"},
            tagging_scope=TaggingScope.REQUIRED,
            billability=Billability.BILLABLE
        )
        
        session.add_all([res1, res2, res3])
        session.commit()
        session.refresh(res1)
        session.refresh(res2)
        session.refresh(res3)
        
        yield (res1.id, res2.id, res3.id)
        
        # cleanup
        session.delete(res1)
        session.delete(res2)
        session.delete(res3)
        session.commit()
        app.dependency_overrides.pop(get_current_user, None)

def test_preview_bulk_tagging_existing_tags(setup_data):
    res1_id, res2_id, res3_id = setup_data
    
    payload = {
        "provider": "AWS",
        "scope_type": "RESOURCE_SELECTION",
        "resource_ids": [res1_id, res2_id, res3_id],
        "tags": {
            "ENVIRONMENT": "PROD"
        }
    }
    
    response = client.post("/api/tagging/preview", json=payload)
    assert response.status_code == 200
    data = response.json()
    
    assert data["resource_count"] == 3
    changes = data["changes"]
    
    # 3 resources * 1 tag changed in the preview list
    assert len(changes) == 3
    
    change_res1 = next(c for c in changes if c["resource_id"] == res1_id)
    assert change_res1["current_value"] == "NOT_SET"
    assert change_res1["proposed_value"] == "PROD"
    assert change_res1["will_change"] == True
    assert change_res1["existing_tags"] == {"APPNAME": "ABC", "ROLE": "WEB"}
    
    change_res2 = next(c for c in changes if c["resource_id"] == res2_id)
    assert change_res2["current_value"] == "DEV"
    assert change_res2["proposed_value"] == "PROD"
    assert change_res2["will_change"] == True
    assert change_res2["existing_tags"] == {"APPNAME": "ABC", "ROLE": "WEB", "ENVIRONMENT": "DEV"}
    
    change_res3 = next(c for c in changes if c["resource_id"] == res3_id)
    assert change_res3["current_value"] == "PROD"
    assert change_res3["proposed_value"] == "PROD"
    assert change_res3["will_change"] == False
    assert change_res3["existing_tags"] == {"ENVIRONMENT": "PROD"}
