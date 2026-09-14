import logging
from app.database import SessionLocal
from app.models.master_data import TagDefinition, TagValue

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def seed_tags():
    db = SessionLocal()
    try:
        # Check if tags exist
        if db.query(TagDefinition).count() > 0:
            logger.info("Tag definitions already exist.")
            return

        logger.info("Seeding initial Tag Definitions...")
        
        env_def = TagDefinition(name="ENVIRONMENT", description="Environment lifecycle stage", mandatory=True)
        role_def = TagDefinition(name="ROLE", description="Server or resource role", mandatory=True)
        proj_def = TagDefinition(name="PROJECT", description="Project code", mandatory=True)
        crit_def = TagDefinition(name="CRITICAL", description="Business criticality", mandatory=True)
        
        db.add_all([env_def, role_def, proj_def, crit_def])
        db.flush()

        env_values = [
            TagValue(tag_definition_id=env_def.id, value="DEV", display_name="Development"),
            TagValue(tag_definition_id=env_def.id, value="UAT", display_name="User Acceptance Testing"),
            TagValue(tag_definition_id=env_def.id, value="PROD", display_name="Production"),
            TagValue(tag_definition_id=env_def.id, value="QA", display_name="Quality Assurance"),
        ]
        
        role_values = [
            TagValue(tag_definition_id=role_def.id, value="WEB", display_name="Web Server"),
            TagValue(tag_definition_id=role_def.id, value="APP", display_name="Application Server"),
            TagValue(tag_definition_id=role_def.id, value="DB", display_name="Database Server"),
            TagValue(tag_definition_id=role_def.id, value="CACHE", display_name="Caching Layer"),
        ]

        proj_values = [
            TagValue(tag_definition_id=proj_def.id, value="ABC", display_name="Project ABC"),
            TagValue(tag_definition_id=proj_def.id, value="XYZ", display_name="Project XYZ"),
            TagValue(tag_definition_id=proj_def.id, value="INTERNAL", display_name="Internal Operations"),
        ]

        crit_values = [
            TagValue(tag_definition_id=crit_def.id, value="YES", display_name="Yes - Tier 1"),
            TagValue(tag_definition_id=crit_def.id, value="NO", display_name="No - Tier 2/3"),
        ]

        db.add_all(env_values + role_values + proj_values + crit_values)
        db.commit()
        logger.info("Seeded initial Tag Definitions successfully.")

    except Exception as e:
        logger.error(f"Error seeding tags: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_tags()
