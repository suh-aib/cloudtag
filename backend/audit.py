import os
import sys
import json
import logging
from app.database import SessionLocal, engine
from app.models.tagging import TaggingChange, ChangeStatus, TaggingBatch, BatchStatus, ScriptJob, ScriptJobChange
from app.models.resource import Resource
from app.models.cloud import CloudAccount, CloudProvider
from app.models.user import User, UserRole
from app.services.script_generator import ScriptGeneratorService

def run_audit():
    db = SessionLocal()
    try:
        print("=== 1. DATABASE SETUP ===")
        # create mock user
        admin = db.query(User).filter(User.email=="audit@local").first()
        if not admin:
            admin = User(email="audit@local", display_name="Audit", role=UserRole.ADMIN)
            db.add(admin)
            db.commit()
            db.refresh(admin)

        # create mock account
        acct = db.query(CloudAccount).filter(CloudAccount.account_identifier=="AUDIT-123").first()
        if not acct:
            acct = CloudAccount(cloud=CloudProvider.AWS, account_identifier="AUDIT-123", name="Audit Account")
            db.add(acct)
            db.commit()
            db.refresh(acct)
            
        # create mock resource
        res = db.query(Resource).filter(Resource.resource_id=="arn:audit:1").first()
        if not res:
            res = Resource(cloud_account_id=acct.id, resource_type="ec2/instance", resource_id="arn:audit:1", resource_name="audit-vm", location="us-east-1", cloud_tags={"OLD_TAG": "yes"})
            db.add(res)
            db.commit()
            db.refresh(res)

        # create tagging batch
        batch = TaggingBatch(batch_id="BATCH-AUDIT-1", created_by=admin.id, cloud=CloudProvider.AWS, status=BatchStatus.APPROVED)
        db.add(batch)
        db.commit()
        db.refresh(batch)

        print("=== 3. ELIGIBILITY TEST ===")
        # Create various statuses
        c1 = TaggingChange(batch_id=batch.id, resource_id=res.id, tag_key="ENV", previous_value=None, proposed_value="PROD", approved_value="PROD", status=ChangeStatus.APPROVED)
        c2 = TaggingChange(batch_id=batch.id, resource_id=res.id, tag_key="PEND", proposed_value="x", status=ChangeStatus.PENDING_APPROVAL)
        c3 = TaggingChange(batch_id=batch.id, resource_id=res.id, tag_key="REJ", proposed_value="x", status=ChangeStatus.REJECTED)
        db.add_all([c1, c2, c3])
        db.commit()

        job, manifest, token = ScriptGeneratorService.generate_apply_job(db, admin.id, CloudProvider.AWS, "AUDIT-123")
        
        changes_in_manifest = [c["tag_key"] for r in manifest["resources"] for c in r["changes"]]
        print(f"Tags in manifest: {changes_in_manifest}")
        
        print("=== 4. MANIFEST SAFETY ===")
        print(json.dumps(manifest, indent=2))
        
        # Clean up
        db.query(ScriptJobChange).filter(ScriptJobChange.job_id==job.id).delete()
        db.query(ScriptJob).filter(ScriptJob.id==job.id).delete()
        db.query(TaggingChange).filter(TaggingChange.batch_id==batch.id).delete()
        db.query(TaggingBatch).filter(TaggingBatch.id==batch.id).delete()
        db.commit()
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    run_audit()
