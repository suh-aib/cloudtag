import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models.cloud import CloudProvider
from app.models.resource import Resource, TaggingScope
from app.schemas.resource import NormalizedResource
from app.services.resource_inventory import ResourceInventoryService

# Test Database Setup
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture()
def db_session():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)

def test_azure_resource_normalization_and_insert(db_session):
    resource_id = "/subscriptions/123/resourceGroups/rg-test/providers/Microsoft.Compute/virtualMachines/vm-1"
    nr = NormalizedResource(
        resource_id=resource_id,
        resource_name="vm-1",
        resource_type="Microsoft.Compute/virtualMachines",
        resource_group="rg-test",
        account_name="sub-123",
        region_name="eastus",
        cloud_tags={"Environment": "Prod"},
        raw_source={"raw_col": "val"}
    )
    
    stats = ResourceInventoryService.upsert_resources(
        db=db_session,
        provider=CloudProvider.AZURE,
        upload_job_id=None,
        source_metadata={"test": "true"},
        resources=[nr]
    )
    
    assert stats["stats_new"] == 1
    
    res = db_session.query(Resource).filter_by(resource_name="vm-1").first()
    assert res is not None
    assert res.resource_id == resource_id
    assert res.location == "eastus"
    assert res.tagging_scope == TaggingScope.REQUIRED
    assert res.cloud_tags == {"Environment": "Prod"}
    assert res.provider == CloudProvider.AZURE

def test_aws_resource_normalization_and_insert(db_session):
    resource_id = "arn:aws:ec2:us-east-1:123456789012:instance/i-1234567890abcdef0"
    nr = NormalizedResource(
        resource_id=resource_id,
        resource_name="i-123",
        resource_type="EC2",
        account_name="aws-acc-1",
        region_name="us-east-1",
        cloud_tags={"Owner": "TeamA"}
    )
    
    stats = ResourceInventoryService.upsert_resources(
        db=db_session,
        provider=CloudProvider.AWS,
        upload_job_id=None,
        source_metadata={},
        resources=[nr]
    )
    
    assert stats["stats_new"] == 1
    res = db_session.query(Resource).first()
    assert res.provider == CloudProvider.AWS
    assert res.cloud_tags == {"Owner": "TeamA"}

def test_duplicate_upsert_preserves_state(db_session):
    resource_id = "some-long-id"
    nr1 = NormalizedResource(
        resource_id=resource_id,
        resource_name="res-1",
        cloud_tags={"Tag1": "V1"}
    )
    
    ResourceInventoryService.upsert_resources(db_session, CloudProvider.AZURE, None, {}, [nr1])
    
    res = db_session.query(Resource).first()
    res.tagging_scope = TaggingScope.EXCLUDED # Modify workflow state
    db_session.commit()
    
    # Upsert again with new tags
    nr2 = NormalizedResource(
        resource_id=resource_id,
        resource_name="res-1-updated",
        cloud_tags={"Tag2": "V2"} # Tag1 should be preserved via dict merge
    )
    stats = ResourceInventoryService.upsert_resources(db_session, CloudProvider.AZURE, None, {}, [nr2])
    
    assert stats["stats_updated"] == 1
    assert stats["stats_new"] == 0
    
    updated_res = db_session.query(Resource).first()
    assert updated_res.tagging_scope == TaggingScope.EXCLUDED # Should be preserved
    assert updated_res.resource_name == "res-1-updated"
    assert updated_res.cloud_tags == {"Tag1": "V1", "Tag2": "V2"}

def test_invalid_records_handling(db_session):
    nr = NormalizedResource(
        resource_id="", # Invalid, empty
        resource_name="bad-res"
    )
    stats = ResourceInventoryService.upsert_resources(db_session, CloudProvider.AWS, None, {}, [nr])
    assert stats["rows_invalid"] == 1
    assert stats["stats_new"] == 0
    
def test_long_resource_ids(db_session):
    long_id = "arn:" + ("a" * 1500) # Exceeds MySQL index limits if not hashed
    nr = NormalizedResource(
        resource_id=long_id,
        resource_name="long-res"
    )
    
    stats = ResourceInventoryService.upsert_resources(db_session, CloudProvider.AWS, None, {}, [nr])
    assert stats["stats_new"] == 1
    
    res = db_session.query(Resource).first()
    assert res.resource_id == long_id
    assert len(res.resource_id_hash) == 64
