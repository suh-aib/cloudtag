from app.database import SessionLocal
from app.models.master_data import TagDefinition, TagValue
import sys

def main():
    db = SessionLocal()
    
    # Identify test tags
    test_tags = db.query(TagDefinition).filter(TagDefinition.name.like("TEST_TAG_%")).all()
    
    if not test_tags:
        print("No TEST_TAG_* definitions found in the database. Clean!")
        db.close()
        return

    print(f"Found {len(test_tags)} test tag definitions:")
    for t in test_tags:
        print(f" - {t.name} (ID: {t.id})")
        
        # Delete associated tag values first
        deleted_vals = db.query(TagValue).filter(TagValue.tag_definition_id == t.id).delete()
        print(f"   Deleted {deleted_vals} associated TagValue records.")
        
        # Delete the tag definition
        db.delete(t)
        
    # Commit changes
    db.commit()
    print("Cleanup completed successfully.")
    db.close()

if __name__ == "__main__":
    main()
