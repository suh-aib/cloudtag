from app.database import engine, SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    print("Pre-cleanup Resources count:", db.execute(text("SELECT COUNT(*) FROM resources")).scalar())
    
    # Check if there are tag states
    print("Pre-cleanup Tag States count:", db.execute(text("SELECT COUNT(*) FROM resource_tag_states")).scalar())
    
    # 1. Delete dependent resource_tag_states for resources
    db.execute(text("DELETE FROM resource_tag_states WHERE resource_id IN (SELECT id FROM resources WHERE provider = 'AZURE')"))
    
    # 2. Delete azure resources
    db.execute(text("DELETE FROM resources WHERE provider = 'AZURE'"))
    
    # 3. Optional: we can delete the csv_upload_jobs for AZURE but maybe it's fine to keep them or delete them. User says "where safe".
    # We will delete them.
    db.execute(text("DELETE FROM csv_upload_jobs WHERE provider = 'AZURE'"))
    
    db.commit()
    print("Cleanup successful.")
    
    print("Post-cleanup Resources count:", db.execute(text("SELECT COUNT(*) FROM resources")).scalar())
except Exception as e:
    db.rollback()
    print("Error:", e)
finally:
    db.close()
