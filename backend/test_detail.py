from app.database import SessionLocal
from app.models.tagging import ScriptJob, TaggingChange, ScriptJobChange
from app.models.resource import Resource
from app.models.cloud import CloudAccount
from app.services.script_generator import ScriptGeneratorService

db = SessionLocal()
job_id = "JOB-AZURE-25DAB3B0"
job = db.query(ScriptJob).filter(ScriptJob.job_id == job_id).first()
if job:
    changes_query = db.query(TaggingChange, Resource, CloudAccount)\
            .join(Resource, TaggingChange.resource_id == Resource.id)\
            .join(CloudAccount, Resource.cloud_account_id == CloudAccount.id)\
            .join(ScriptJobChange, TaggingChange.id == ScriptJobChange.change_id)\
            .filter(ScriptJobChange.job_id == job.id)\
            .order_by(Resource.id, TaggingChange.id)\
            .all()
    manifest = ScriptGeneratorService._build_manifest(job_id, job.cloud, changes_query)
    print("Stored hash:", job.manifest_hash)
    print("Computed hash:", manifest["manifest_hash"])
    if manifest["manifest_hash"] != job.manifest_hash:
        print("MISMATCH DETECTED")
