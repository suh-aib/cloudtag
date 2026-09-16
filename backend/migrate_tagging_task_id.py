import logging
from sqlalchemy import text
from app.database import engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def migrate():
    logger.info("Migrating tagging_batches table...")
    with engine.connect() as conn:
        try:
            # Check if column exists
            result = conn.execute(text("SHOW COLUMNS FROM tagging_batches LIKE 'task_assignment_id'")).fetchone()
            if not result:
                conn.execute(text("ALTER TABLE tagging_batches ADD COLUMN task_assignment_id INT NULL"))
                conn.execute(text("ALTER TABLE tagging_batches ADD CONSTRAINT fk_tagging_batch_task FOREIGN KEY (task_assignment_id) REFERENCES task_assignments(id)"))
                logger.info("Added task_assignment_id to tagging_batches.")
            else:
                logger.info("Column task_assignment_id already exists in tagging_batches.")
                
            conn.commit()
            logger.info("Migration completed successfully.")
        except Exception as e:
            logger.error(f"Error migrating table: {e}")
            conn.rollback()
            raise

if __name__ == "__main__":
    migrate()
