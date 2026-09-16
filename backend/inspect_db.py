from app.database import SessionLocal
from app.models.tagging import TaggingBatch, TaggingChange, ScriptJob, ScriptJobChange
from app.models.cloud import CloudAccount
from sqlalchemy.orm import joinedload

db = SessionLocal()
batches = db.query(TaggingBatch).all()
for b in batches:
    print(f"Batch {b.id}, cloud={b.cloud.value}, scope={b.scope}, status={b.status.value}")
    
changes = db.query(TaggingChange).all()
statuses = {}
for c in changes:
    statuses[c.status.value] = statuses.get(c.status.value, 0) + 1
print(f"Change Statuses: {statuses}")

jobs = db.query(ScriptJob).all()
for j in jobs:
    print(f"Job {j.id} ({j.job_id}), status={j.status.value}, created_at={j.created_at}")

