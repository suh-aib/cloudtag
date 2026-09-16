from app.database import SessionLocal
from app.services.script_generator import ScriptGeneratorService
from app.models.cloud import CloudProvider
db = SessionLocal()
try:
    job, manifest, token = ScriptGeneratorService.generate_apply_job(db, 1, [21])
    print(f"SUCCESS: {job.job_id}")
except Exception as e:
    import traceback
    traceback.print_exc()
