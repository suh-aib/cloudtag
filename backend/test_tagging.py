import asyncio
from httpx import AsyncClient
from app.main import app
from app.database import SessionLocal
from app.models.resource import Resource
from app.models.user import User

async def run_test():
    db = SessionLocal()
    admin_user = db.query(User).first()
    
    # Get 3 resources
    resources = db.query(Resource).filter(Resource.provider == "AZURE").limit(3).all()
    resource_ids = [r.id for r in resources]
    
    db.close()
    
    from fastapi.testclient import TestClient
    from app.api.deps import get_current_user
    
    def override_get_current_user():
        db = SessionLocal()
        user = db.query(User).first()
        db.close()
        return user
        
    app.dependency_overrides[get_current_user] = override_get_current_user
    
    client = TestClient(app)
    
    print("Testing GET /api/tagging/definitions")
    resp = client.get("/api/tagging/definitions")
    print("Definitions:", resp.json())
    
    print(f"\nTesting POST /api/tagging/bulk with {len(resource_ids)} resources")
    payload = {
        "provider": "AZURE",
        "scope": "Test Scope",
        "resource_ids": resource_ids,
        "tags": {
            "ENVIRONMENT": "PROD",
            "PROJECT": "XYZ"
        }
    }
    
    resp = client.post("/api/tagging/bulk", json=payload)
    print("Bulk Tag Response:", resp.json())
    
    print("\nVerifying DB records:")
    db = SessionLocal()
    from app.models.tagging import TaggingBatch, TaggingChange, Approval
    
    batch = db.query(TaggingBatch).order_by(TaggingBatch.id.desc()).first()
    print(f"Batch created: {batch.batch_id} - {batch.status.value}")
    
    changes = db.query(TaggingChange).filter(TaggingChange.batch_id == batch.id).all()
    print(f"Changes created: {len(changes)}")
    for c in changes:
        print(f"  Resource: {c.resource_id}, Tag: {c.tag_key}, {c.previous_value} -> {c.proposed_value}")
        
    approval = db.query(Approval).filter(Approval.batch_id == batch.id).first()
    print(f"Approval created: {approval.id} - {approval.status.value}")
    
    db.close()

if __name__ == "__main__":
    asyncio.run(run_test())
