from app.database import engine, SessionLocal
from sqlalchemy import text
from app.models.tagging import ScriptJob, ExecutionResult, ScriptJobChange
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def migrate():
    # Base.metadata.create_all will create script_job_changes since it doesn't exist
    from app.models.tagging import Base
    Base.metadata.create_all(bind=engine)
    logger.info("Created missing tables.")

    db = SessionLocal()
    try:
        # Check and add columns to script_jobs
        logger.info("Migrating script_jobs...")
        db.execute(text("ALTER TABLE script_jobs DROP FOREIGN KEY script_jobs_ibfk_1;"))
        db.execute(text("ALTER TABLE script_jobs DROP COLUMN batch_id;"))
        db.execute(text("ALTER TABLE script_jobs ADD COLUMN script_version INTEGER DEFAULT 1 NOT NULL;"))
        db.execute(text("ALTER TABLE script_jobs ADD COLUMN manifest_hash VARCHAR(255);"))
        db.execute(text("ALTER TABLE script_jobs ADD COLUMN ingestion_token_hash VARCHAR(255);"))
        
        # Check and add columns to execution_results
        logger.info("Migrating execution_results...")
        db.execute(text("ALTER TABLE execution_results ADD COLUMN change_id INTEGER;"))
        db.execute(text("ALTER TABLE execution_results ADD CONSTRAINT fk_er_change FOREIGN KEY (change_id) REFERENCES tagging_changes(id);"))
        db.execute(text("ALTER TABLE execution_results ADD COLUMN reason_code VARCHAR(255);"))
        db.execute(text("ALTER TABLE execution_results ADD COLUMN expected_value VARCHAR(255);"))
        db.execute(text("ALTER TABLE execution_results ADD COLUMN proposed_value VARCHAR(255);"))
        db.execute(text("ALTER TABLE execution_results ADD COLUMN actual_value_before VARCHAR(255);"))
        db.execute(text("ALTER TABLE execution_results ADD COLUMN actual_value_after VARCHAR(255);"))
        
        db.commit()
        logger.info("Migration successful.")
    except Exception as e:
        db.rollback()
        logger.warning(f"Migration error (might already be applied): {e}")
    finally:
        db.close()

if __name__ == "__main__":
    migrate()
