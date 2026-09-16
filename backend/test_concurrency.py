import threading
import time
from app.database import SessionLocal
from app.models.cloud import CloudProvider
from app.services.script_generator import ScriptGeneratorService

def generate_worker(thread_id, admin_id):
    db = SessionLocal()
    try:
        job, manifest, token = ScriptGeneratorService.generate_apply_job(db, admin_id, CloudProvider.AWS, "AUDIT-123")
        print(f"Thread {thread_id} generated job {job.job_id}")
    except Exception as e:
        print(f"Thread {thread_id} failed: {e}")
    finally:
        db.close()

def run_concurrency_test():
    # Assume the same setup as audit.py is already run, but let's just make a dummy approved change
    db = SessionLocal()
    try:
        from app.models.tagging import TaggingChange, ChangeStatus, TaggingBatch, BatchStatus, ScriptJob, ScriptJobChange
        # Reset any SCRIPT_GENERATED to APPROVED
        db.query(TaggingChange).filter(TaggingChange.status==ChangeStatus.SCRIPT_GENERATED).update({"status": ChangeStatus.APPROVED})
        db.commit()
    finally:
        db.close()

    t1 = threading.Thread(target=generate_worker, args=(1, 3))
    t2 = threading.Thread(target=generate_worker, args=(2, 3))

    t1.start()
    t2.start()

    t1.join()
    t2.join()

if __name__ == "__main__":
    run_concurrency_test()
