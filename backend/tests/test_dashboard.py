import pytest
from fastapi.testclient import TestClient
from app.models.resource import Resource, TaggingScope
from app.models.tagging import TaggingBatch, TaggingChange, BatchStatus, ChangeStatus
from app.models.cloud import CloudProvider, CloudAccount
from app.models.user import User, UserRole
from app.database import SessionLocal
from app.main import app
import uuid

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os

SQLALCHEMY_DATABASE_URL = "sqlite:///./dashboard_test.db"
if os.path.exists("./dashboard_test.db"):
    os.remove("./dashboard_test.db")

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
from app.database import Base
Base.metadata.create_all(bind=engine)

@pytest.fixture
def db_session():
    db = TestingSessionLocal()
    yield db
    db.close()

@pytest.fixture
def override_db(db_session):
    from app.database import get_db
    def _override():
        return db_session
    app.dependency_overrides[get_db] = _override
    yield
    app.dependency_overrides.pop(get_db, None)

@pytest.fixture
def client(override_user, override_db):
    return TestClient(app)

@pytest.fixture
def test_user(db_session):
    user = db_session.query(User).filter(User.role == UserRole.USER).first()
    if not user:
        from app.models.user import UserStatus
        user = User(email="test@user.com", display_name="Test User", role=UserRole.USER, status=UserStatus.ACTIVE)
        db_session.add(user)
        db_session.commit()
    return user

@pytest.fixture
def override_user(test_user):
    from app.api.deps import get_current_user
    def _override():
        return test_user
    app.dependency_overrides[get_current_user] = _override
    yield
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def dashboard_setup(db_session, test_user):
    # Clean DB before each test
    db_session.query(TaggingChange).delete()
    db_session.query(TaggingBatch).delete()
    db_session.query(Resource).delete()
    db_session.query(CloudAccount).delete()
    db_session.commit()
    
    from app.models.cloud import CloudAccountStatus
    # Create accounts
    rnd = str(uuid.uuid4())[:8]
    acc_azure = CloudAccount(name="Test Azure", account_identifier=f"az-{rnd}", cloud=CloudProvider.AZURE, status=CloudAccountStatus.ACTIVE)
    acc_aws = CloudAccount(name="Test AWS", account_identifier=f"aws-{rnd}", cloud=CloudProvider.AWS, status=CloudAccountStatus.ACTIVE)
    db_session.add(acc_azure)
    db_session.add(acc_aws)
    db_session.commit()
    
    # Create resources (10 Azure Required, 5 Azure Excluded, 5 AWS Required)
    resources = []
    for i in range(10):
        r = Resource(
            cloud_account_id=acc_azure.id,
            provider=CloudProvider.AZURE,
            resource_name=f"az-req-{rnd}-{i}",
            resource_id=f"id-az-req-{rnd}-{i}",
            resource_id_hash=f"hash-az-req-{rnd}-{i}",
            resource_type="type1",
            tagging_scope=TaggingScope.REQUIRED,
            cloud_tags={"env": "prod"} # Existing tags
        )
        resources.append(r)
        
    for i in range(5):
        r = Resource(
            cloud_account_id=acc_azure.id,
            provider=CloudProvider.AZURE,
            resource_name=f"az-exc-{rnd}-{i}",
            resource_id=f"id-az-exc-{rnd}-{i}",
            resource_id_hash=f"hash-az-exc-{rnd}-{i}",
            resource_type="type1",
            tagging_scope=TaggingScope.EXCLUDED
        )
        resources.append(r)

    for i in range(5):
        r = Resource(
            cloud_account_id=acc_aws.id,
            provider=CloudProvider.AWS,
            resource_name=f"aws-req-{rnd}-{i}",
            resource_id=f"id-aws-req-{rnd}-{i}",
            resource_id_hash=f"hash-aws-req-{rnd}-{i}",
            resource_type="type2",
            tagging_scope=TaggingScope.REQUIRED
        )
        resources.append(r)
        
    db_session.add_all(resources)
    db_session.commit()
    return acc_azure, acc_aws, rnd

def test_dashboard_empty_progress(client, dashboard_setup):
    res = client.get("/api/inventory/dashboard/stats")
    assert res.status_code == 200
    data = res.json()
    assert data["total_resources"] == 20
    assert data["tagging_required"] == 15
    assert data["pending_approval_resources"] == 0
    assert data["validated_resources"] == 0
    assert data["tagging_completion_percent"] == 0
    
def test_dashboard_provider_filtering(client, dashboard_setup):
    res = client.get("/api/inventory/dashboard/stats?provider=AZURE")
    data = res.json()
    assert data["total_resources"] == 15
    assert data["tagging_required"] == 10
    
    res_aws = client.get("/api/inventory/dashboard/stats?provider=AWS")
    data_aws = res_aws.json()
    assert data_aws["total_resources"] == 5
    assert data_aws["tagging_required"] == 5

def test_dashboard_with_proposals(client, db_session, test_user, dashboard_setup):
    # 1 batch with 2 Azure resources -> PENDING_APPROVAL
    # Should mean pending_approval_resources = 2
    rnd = dashboard_setup[2]
    r1 = db_session.query(Resource).filter_by(resource_name=f"az-req-{rnd}-0").first()
    r2 = db_session.query(Resource).filter_by(resource_name=f"az-req-{rnd}-1").first()
    
    batch = TaggingBatch(batch_id=str(uuid.uuid4()), created_by=test_user.id, cloud=CloudProvider.AZURE, status=BatchStatus.PENDING_APPROVAL)
    db_session.add(batch)
    db_session.commit()
    
    c1 = TaggingChange(batch_id=batch.id, resource_id=r1.id, tag_key="tag1", proposed_value="v1")
    c2 = TaggingChange(batch_id=batch.id, resource_id=r1.id, tag_key="tag2", proposed_value="v2") # Multiple tags same resource
    c3 = TaggingChange(batch_id=batch.id, resource_id=r2.id, tag_key="tag1", proposed_value="v1")
    db_session.add_all([c1, c2, c3])
    db_session.commit()
    
    res = client.get("/api/inventory/dashboard/stats")
    data = res.json()
    assert data["pending_approval_resources"] == 2
    assert data["tagging_completion_percent"] == 0
    
def test_dashboard_latest_batch_counts(client, db_session, test_user, dashboard_setup):
    rnd = dashboard_setup[2]
    r1 = db_session.query(Resource).filter_by(resource_name=f"az-req-{rnd}-0").first()
    
    b1 = TaggingBatch(batch_id=str(uuid.uuid4()), created_by=test_user.id, cloud=CloudProvider.AZURE, status=BatchStatus.PENDING_APPROVAL)
    db_session.add(b1)
    db_session.commit()
    
    c1 = TaggingChange(batch_id=b1.id, resource_id=r1.id, tag_key="tag1", proposed_value="v1")
    db_session.add(c1)
    db_session.commit()
    
    # First state
    res = client.get("/api/inventory/dashboard/stats")
    assert res.json()["pending_approval_resources"] == 1
    
    # Create newer batch for same resource that is APPROVED
    b2 = TaggingBatch(batch_id=str(uuid.uuid4()), created_by=test_user.id, cloud=CloudProvider.AZURE, status=BatchStatus.APPROVED)
    db_session.add(b2)
    db_session.commit()
    
    c2 = TaggingChange(batch_id=b2.id, resource_id=r1.id, tag_key="tag1", proposed_value="v2")
    db_session.add(c2)
    db_session.commit()
    
    # Second state - Should now be 0 pending, 1 approved
    res = client.get("/api/inventory/dashboard/stats")
    assert res.json()["pending_approval_resources"] == 0
    assert res.json()["approved_resources"] == 1

def test_dashboard_completion_percent(client, db_session, test_user, dashboard_setup):
    # Total required Azure=10, AWS=5 -> Total=15
    # Let's set 3 resources to VALIDATED
    resources = db_session.query(Resource).limit(3).all()
    
    b = TaggingBatch(batch_id=str(uuid.uuid4()), created_by=test_user.id, cloud=CloudProvider.AZURE, status=BatchStatus.VALIDATED)
    db_session.add(b)
    db_session.commit()
    
    for r in resources:
        db_session.add(TaggingChange(batch_id=b.id, resource_id=r.id, tag_key="k", proposed_value="v"))
    db_session.commit()
    
    res = client.get("/api/inventory/dashboard/stats")
    data = res.json()
    assert data["validated_resources"] == 3
    # 3 / 15 = 20%
    assert data["tagging_completion_percent"] == 20
