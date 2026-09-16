from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Dict, Any
import json
import hashlib
from app.database import get_db
from app.models.user import User
from app.api.deps import get_admin_user
from app.models.cloud import CloudProvider, CloudAccount
from app.models.resource import Resource
from app.models.tagging import ScriptJob, JobStatus, ChangeStatus, ExecutionResult, ExecutionStatus, TaggingChange, ScriptJobChange
from app.services.script_generator import ScriptGeneratorService
from pydantic import BaseModel
import datetime

router = APIRouter()

class GenerateRequest(BaseModel):
    batch_ids: List[int]

class IngestResultItem(BaseModel):
    change_id: int
    result: str
    reason_code: str
    actual_value_before: str = None
    actual_value_after: str = None

class IngestRequest(BaseModel):
    manifest_hash: str
    script_version: int
    results: List[IngestResultItem]

class VerifyRequest(BaseModel):
    manifest_hash: str

@router.post("/generate")
def generate_script(
    request: GenerateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    try:
        new_job, manifest, token = ScriptGeneratorService.generate_apply_job(
            db=db,
            user_id=admin.id,
            batch_ids=request.batch_ids
        )
        return {
            "job_id": new_job.job_id,
            "status": new_job.status.value,
            "manifest_hash": new_job.manifest_hash,
            "token": token
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{job_id}/download")
def download_script(
    job_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    job = db.query(ScriptJob).filter(ScriptJob.job_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    # Reconstruct manifest for download (we don't persist the full JSON blob to save space, we regenerate it identically)
    # Actually, if we regenerate it identically, we must ensure it matches the hash exactly!
    changes_query = db.query(TaggingChange, Resource, CloudAccount)\
            .join(Resource, TaggingChange.resource_id == Resource.id)\
            .join(CloudAccount, Resource.cloud_account_id == CloudAccount.id)\
            .join(ScriptJobChange, TaggingChange.id == ScriptJobChange.change_id)\
            .filter(ScriptJobChange.job_id == job.id)\
            .order_by(Resource.id, TaggingChange.id)\
            .all()
            
    manifest = ScriptGeneratorService._build_manifest(job_id, job.cloud, changes_query)
    
    # We must ensure the hash matches (i.e. immutable)
    if manifest["manifest_hash"] != job.manifest_hash:
        raise HTTPException(status_code=500, detail="Manifest hash mismatch. Underlying data may have been corrupted.")
        
    # In a real system we'd look up the exact token, but for this V1 download, we generate a fresh one or just use a dummy since it's just for download UI instructions. Actually, if we generate a fresh one, we need to update the db.
    # Let's just generate a fresh one and update the hash so it's valid for 2 hours from download.
    from app.services.script_generator import generate_ingestion_token
    token = generate_ingestion_token(job_id)
    token_hash = hashlib.sha256(token.encode('utf-8')).hexdigest()
    job.ingestion_token_hash = token_hash
    db.commit()
    
    zip_buffer = ScriptGeneratorService.generate_script_package(manifest, token)
    
    return StreamingResponse(
        zip_buffer, 
        media_type="application/zip", 
        headers={"Content-Disposition": f"attachment; filename=CloudTag-{job_id}.zip"}
    )

@router.get("/{job_id}")
def get_script_job_detail(
    job_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    job = db.query(ScriptJob).filter(ScriptJob.job_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    changes_query = db.query(TaggingChange, Resource, CloudAccount)\
            .join(Resource, TaggingChange.resource_id == Resource.id)\
            .join(CloudAccount, Resource.cloud_account_id == CloudAccount.id)\
            .join(ScriptJobChange, TaggingChange.id == ScriptJobChange.change_id)\
            .filter(ScriptJobChange.job_id == job.id)\
            .order_by(Resource.id, TaggingChange.id)\
            .all()
            
    manifest = ScriptGeneratorService._build_manifest(job_id, job.cloud, changes_query)
    
    if manifest["manifest_hash"] != job.manifest_hash:
        raise HTTPException(status_code=500, detail="Manifest hash mismatch. Underlying data may have been corrupted.")
        
    return {
        "job_id": job.job_id,
        "cloud": job.cloud.value,
        "script_type": job.script_type.value,
        "status": job.status.value,
        "created_at": job.created_at,
        "manifest": manifest
    }

@router.get("/{job_id}/preview")
def get_script_job_preview(
    job_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    job = db.query(ScriptJob).filter(ScriptJob.job_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    from app.services import script_templates
    
    if job.cloud.value == "AWS":
        apply_script = script_templates.get_aws_apply_script()
        revert_script = script_templates.get_aws_revert_script()
    else:
        apply_script = script_templates.get_azure_apply_script()
        revert_script = script_templates.get_azure_revert_script()
        
    return {
        "apply_script": apply_script,
        "revert_script": revert_script
    }

@router.get("")
def list_script_jobs(
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    jobs = db.query(ScriptJob).order_by(ScriptJob.created_at.desc()).all()
    res = []
    for j in jobs:
        res.append({
            "id": j.id,
            "job_id": j.job_id,
            "cloud": j.cloud.value,
            "script_type": j.script_type.value,
            "status": j.status.value,
            "created_at": j.created_at,
            "created_by": j.created_by
        })
    return res

def _verify_job_token(req: Request, job_id: str, db: Session) -> ScriptJob:
    auth_header = req.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token format.")
        
    token = auth_header.split(" ")[1]
    
    from app.config import settings
    import jwt
    try:
        payload = jwt.decode(token, settings.LOCAL_AUTH_SECRET_KEY, algorithms=["HS256"])
        if payload.get("job_id") != job_id:
            raise HTTPException(status_code=403, detail="Token mismatch for job_id")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    job = db.query(ScriptJob).filter(ScriptJob.job_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    token_hash = hashlib.sha256(token.encode('utf-8')).hexdigest()
    if job.ingestion_token_hash != token_hash:
        raise HTTPException(status_code=403, detail="Token revoked or superseded.")
        
    return job

@router.post("/{job_id}/verify")
def verify_script_manifest(
    job_id: str,
    request: VerifyRequest,
    req: Request,
    db: Session = Depends(get_db)
):
    job = _verify_job_token(req, job_id, db)
    
    if job.status not in (JobStatus.GENERATED, JobStatus.EXECUTING):
        raise HTTPException(status_code=400, detail="Job is no longer active.")
        
    if request.manifest_hash != job.manifest_hash:
        raise HTTPException(status_code=400, detail="Manifest integrity verification failed.")
        
    # Valid
    if job.status == JobStatus.GENERATED:
        job.status = JobStatus.EXECUTING
        db.commit()
        
    return {"status": "ok"}

@router.post("/{job_id}/ingest")
def ingest_script_result(
    job_id: str,
    request: IngestRequest,
    req: Request,
    db: Session = Depends(get_db)
):
    job = _verify_job_token(req, job_id, db)

    if request.manifest_hash != job.manifest_hash:
        raise HTTPException(status_code=400, detail="Manifest hash mismatch.")
        
    if request.script_version != job.script_version:
        raise HTTPException(status_code=400, detail="Script version mismatch.")

    # Load legitimate changes for this job
    valid_changes = db.query(TaggingChange, Resource)\
        .join(ScriptJobChange, TaggingChange.id == ScriptJobChange.change_id)\
        .join(Resource, TaggingChange.resource_id == Resource.id)\
        .filter(ScriptJobChange.job_id == job.id)\
        .all()
        
    valid_change_map = { chg.id: (chg, res) for chg, res in valid_changes }

    processed_count = 0
    success_count = 0
    fail_count = 0
    skip_count = 0

    for result_item in request.results:
        if result_item.change_id not in valid_change_map:
            # Client trying to report on a change not in this job
            continue
            
        change, resource = valid_change_map[result_item.change_id]
        
        exec_status = ExecutionStatus.FAILED
        if result_item.result == "SUCCESS":
            exec_status = ExecutionStatus.SUCCESS
        elif result_item.result == "SKIPPED":
            exec_status = ExecutionStatus.SKIPPED
            
        # Hard Security Boundary: The client cannot overwrite the approved intent.
        if exec_status == ExecutionStatus.SUCCESS:
            if result_item.actual_value_after != change.proposed_value:
                # TAMPER DETECTED: The client claims SUCCESS but wrote something else
                exec_status = ExecutionStatus.FAILED
                result_item.reason_code = "TAMPER_DETECTED"
            
        # Create execution result record
        er = ExecutionResult(
            job_id=job.id,
            resource_id=resource.id,
            change_id=change.id,
            status=exec_status,
            reason_code=result_item.reason_code,
            expected_value=change.previous_value,
            proposed_value=change.proposed_value,
            actual_value_before=result_item.actual_value_before,
            actual_value_after=result_item.actual_value_after,
            executed_at=datetime.datetime.utcnow()
        )
        db.add(er)
        
        # Safe state transition
        if exec_status == ExecutionStatus.SUCCESS and change.status in (ChangeStatus.APPROVED, ChangeStatus.SCRIPT_GENERATED):
            change.status = ChangeStatus.APPLIED
            success_count += 1
        elif exec_status == ExecutionStatus.SKIPPED:
            # Revert to APPROVED so it's eligible for future generations
            change.status = ChangeStatus.APPROVED
            skip_count += 1
        else:
            # Revert to APPROVED for FAILED as well
            change.status = ChangeStatus.APPROVED
            fail_count += 1
            
        processed_count += 1

    job.status = JobStatus.COMPLETED
    db.commit()

    return {
        "status": "success",
        "processed": processed_count,
        "success": success_count,
        "skipped": skip_count,
        "failed": fail_count
    }

