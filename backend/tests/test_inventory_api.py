from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import pytest

from app.main import app as fastapi_app
from app.database import Base, get_db
from app.models.user import User
from app.api.deps import get_current_user
from app.models.resource import Resource, TaggingScope
from app.models.cloud import CloudAccount, CloudProvider
import app.models # Load all models so Base.metadata is populated

import os

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
if os.path.exists("./test.db"):
    os.remove("./test.db")

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

def override_get_current_user():
    return User(id=1, email="testadmin@example.com")

fastapi_app.dependency_overrides[get_db] = override_get_db
fastapi_app.dependency_overrides[get_current_user] = override_get_current_user

client = TestClient(fastapi_app)

@pytest.fixture(autouse=True)
def test_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    # Insert mock data
    acc1 = CloudAccount(name="Sub1", account_identifier="sub-1", cloud=CloudProvider.AZURE)
    acc2 = CloudAccount(name="Sub2", account_identifier="sub-2", cloud=CloudProvider.AZURE)
    acc3 = CloudAccount(name="AwsAcc1", account_identifier="aws-1", cloud=CloudProvider.AWS)
    
    db.add_all([acc1, acc2, acc3])
    db.commit()
    
    res1 = Resource(provider=CloudProvider.AZURE, cloud_account_id=acc1.id, resource_name="r1", resource_type="t1", resource_id="id1", resource_id_hash="h1", tagging_scope=TaggingScope.REQUIRED, resource_group="rg1")
    res2 = Resource(provider=CloudProvider.AZURE, cloud_account_id=acc1.id, resource_name="r2", resource_type="t1", resource_id="id2", resource_id_hash="h2", tagging_scope=TaggingScope.SUPPORTING, resource_group="rg1")
    res3 = Resource(provider=CloudProvider.AZURE, cloud_account_id=acc2.id, resource_name="r3", resource_type="t2", resource_id="id3", resource_id_hash="h3", tagging_scope=TaggingScope.REQUIRED, resource_group="rg2")
    res4 = Resource(provider=CloudProvider.AWS, cloud_account_id=acc3.id, resource_name="r4", resource_type="t3", resource_id="id4", resource_id_hash="h4", tagging_scope=TaggingScope.REQUIRED, location="us-east-1")
    
    db.add_all([res1, res2, res3, res4])
    db.commit()
    
    yield db
    
    db.close()
    Base.metadata.drop_all(bind=engine)

def test_dashboard_stats(test_db):
    response = client.get("/api/inventory/dashboard/stats")
    assert response.status_code == 200
    data = response.json()
    
    assert data["azure_resources"] == 3
    assert data["aws_resources"] == 1
    assert data["mandatory_tags"] == 3 # 3 resources have TaggingScope.REQUIRED
    assert data["tagged_resources"] == 0.0

def test_inventory_accounts_azure(test_db):
    response = client.get("/api/inventory/azure/accounts")
    assert response.status_code == 200
    data = response.json()
    
    assert len(data) == 2
    
    # Order isn't guaranteed by API, so we map them
    accs = {item["account_identifier"]: item for item in data}
    
    assert "sub-1" in accs
    assert accs["sub-1"]["resource_count"] == 2
    assert accs["sub-1"]["group_count"] == 1 # rg1
    
    assert "sub-2" in accs
    assert accs["sub-2"]["resource_count"] == 1
    assert accs["sub-2"]["group_count"] == 1 # rg2
    
    assert "aws-1" not in accs

def test_inventory_accounts_aws(test_db):
    response = client.get("/api/inventory/aws/accounts")
    assert response.status_code == 200
    data = response.json()
    
    assert len(data) == 1
    assert data[0]["account_identifier"] == "aws-1"
    assert data[0]["resource_count"] == 1
    assert data[0]["group_count"] == 1 # us-east-1

def test_empty_inventory(test_db):
    # clear all resources
    test_db.query(Resource).delete()
    test_db.commit()
    
    response = client.get("/api/inventory/azure/accounts")
    assert response.status_code == 200
    assert response.json() == []
    
    dash_response = client.get("/api/inventory/dashboard/stats")
    assert dash_response.status_code == 200
    data = dash_response.json()
    assert data["azure_resources"] == 0
    assert data["azure_resources"] == 0
    assert data["aws_resources"] == 0

def test_azure_resource_groups(test_db):
    response = client.get("/api/inventory/azure/accounts/sub-1/resource-groups")
    assert response.status_code == 200
    data = response.json()
    
    assert len(data) == 1
    assert data[0]["name"] == "rg1"
    assert data[0]["resource_count"] == 2
    assert data[0]["types_count"] == 1

def test_azure_resource_groups_invalid_account(test_db):
    response = client.get("/api/inventory/azure/accounts/invalid-sub/resource-groups")
    assert response.status_code == 404

def test_azure_resource_types(test_db):
    response = client.get("/api/inventory/azure/accounts/sub-1/resource-groups/rg1/types")
    assert response.status_code == 200
    data = response.json()
    
    assert len(data) == 1
    assert data[0]["resource_type"] == "t1"
    assert data[0]["resource_count"] == 2

def test_azure_resources(test_db):
    response = client.get("/api/inventory/azure/accounts/sub-1/resource-groups/rg1/resources")
    assert response.status_code == 200
    data = response.json()
    
    assert len(data) == 2
    resource_ids = [r["resource_id"] for r in data]
    assert "id1" in resource_ids
    assert "id2" in resource_ids

def test_azure_resources_with_type_filter(test_db):
    response = client.get("/api/inventory/azure/accounts/sub-1/resource-groups/rg1/resources?type=t1")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2

    response_empty = client.get("/api/inventory/azure/accounts/sub-1/resource-groups/rg1/resources?type=t99")
    assert response_empty.status_code == 200
    assert len(response_empty.json()) == 0
