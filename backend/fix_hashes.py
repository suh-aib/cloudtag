from app.database import SessionLocal
from app.models.tagging import ScriptJob, TaggingChange, ScriptJobChange
from app.models.resource import Resource
from app.models.cloud import CloudAccount
from app.services.script_generator import ScriptGeneratorService

db = SessionLocal()
jobs = db.query(ScriptJob).all()
updated = 0
for job in jobs:
    changes_query = db.query(TaggingChange, Resource, CloudAccount)\
            .join(Resource, TaggingChange.resource_id == Resource.id)\
            .join(CloudAccount, Resource.cloud_account_id == CloudAccount.id)\
            .join(ScriptJobChange, TaggingChange.id == ScriptJobChange.change_id)\
            .filter(ScriptJobChange.job_id == job.id)\
            .order_by(Resource.id, TaggingChange.id)\
            .all()
    
    # Rebuild manifest using current format
    manifest = ScriptGeneratorService._build_manifest(job.job_id, job.cloud, changes_query)
    computed_hash = manifest["manifest_hash"]
    
    if job.manifest_hash != computed_hash:
        print(f"Updating job {job.job_id} hash from {job.manifest_hash} to {computed_hash}")
        job.manifest_hash = computed_hash
        updated += 1

if updated > 0:
    db.commit()
    print(f"Updated {updated} jobs.")
else:
    print("No jobs needed updating.")
