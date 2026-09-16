import logging
from app.database import engine
from app.models.assignment import TaskAssignment, TaskAssignmentResource

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def migrate():
    logger.info("Creating Task Assignment tables...")
    try:
        # checkfirst=True prevents dropping or recreating if they exist
        TaskAssignment.__table__.create(engine, checkfirst=True)
        TaskAssignmentResource.__table__.create(engine, checkfirst=True)
        logger.info("Task Assignment tables created successfully.")
    except Exception as e:
        logger.error(f"Error creating tables: {e}")
        raise

if __name__ == "__main__":
    migrate()
