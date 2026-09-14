from app.database import SessionLocal
from app.models.tagging import TaggingBatch, TaggingChange
from app.models.user import User
from app.models.resource import Resource
import pprint
from sqlalchemy import func

db = SessionLocal()

print("=== TaggingBatches Statuses ===")
batches_status = db.query(TaggingBatch.status, func.count(TaggingBatch.id)).group_by(TaggingBatch.status).all()
pprint.pprint(batches_status)

print("\n=== TaggingBatches by Creator ===")
batches_creator = db.query(TaggingBatch.created_by, TaggingBatch.status, func.count(TaggingBatch.id)).group_by(TaggingBatch.created_by, TaggingBatch.status).all()
pprint.pprint(batches_creator)

print("\n=== Users ===")
users = db.query(User.id, User.display_name, User.role).all()
pprint.pprint(users)

print("\n=== Tagging Changes Statuses ===")
changes_status = db.query(TaggingChange.status, func.count(TaggingChange.id)).group_by(TaggingChange.status).all()
pprint.pprint(changes_status)

print("\n=== Missing Batch IDs in Changes? ===")
missing_batches = db.query(func.count(TaggingChange.id)).filter(~TaggingChange.batch_id.in_(db.query(TaggingBatch.id))).scalar()
print(f"Changes with missing batch: {missing_batches}")

db.close()
