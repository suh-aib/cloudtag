from app.database import SessionLocal
from app.models.tagging import ScriptJob
db = SessionLocal()
job = db.query(ScriptJob).filter(ScriptJob.job_id == "JOB-AZURE-25DAB3B0").first()
print(f"Stored hash: {job.manifest_hash}")
