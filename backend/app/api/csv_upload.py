from fastapi import APIRouter, Depends, HTTPException, Path, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func
import os
import uuid
import csv
from typing import List

from app.database import get_db
from app.models.user import User
from app.models.cloud import CloudProvider, CloudAccount, CloudRegion
from app.models.resource import Resource
from app.models.csv_upload import CSVUploadJob, CSVUploadStatus
from app.models.audit import AuditLog
from app.api.deps import get_admin_user
from app.schemas.csv_upload import (
    CSVUploadJobSchema,
    CSVMappingDetectionResponse,
    CSVMappedHeader,
    CSVMappingConfirmRequest
)
from app.services.mapping_engine import guess_mapping
from app.schemas.resource import NormalizedResource
from app.services.resource_inventory import ResourceInventoryService

router = APIRouter()

TEMP_DIR = "/tmp/cloudtag_uploads"

def get_provider_enum(provider_str: str) -> CloudProvider:
    provider_str = provider_str.upper()
    if provider_str == "AZURE":
        return CloudProvider.AZURE
    elif provider_str == "AWS":
        return CloudProvider.AWS
    else:
        raise HTTPException(status_code=400, detail="Invalid provider.")

@router.post("/{provider}/upload", response_model=CSVUploadJobSchema)
async def upload_csv(
    provider: str = Path(...),
    file: UploadFile = File(...),
    current_admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    provider_enum = get_provider_enum(provider)
    
    if not file.filename.lower().endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are permitted.")
        
    os.makedirs(TEMP_DIR, exist_ok=True)
    file_id = str(uuid.uuid4())
    filepath = os.path.join(TEMP_DIR, f"{file_id}_{file.filename}")
    
    try:
        content = await file.read()
        with open(filepath, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
        
    # Count rows
    total_rows = 0
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            headers = next(reader, None) # Skip header
            if not headers:
                raise ValueError("Empty CSV file")
            for _ in reader:
                total_rows += 1
    except Exception as e:
        os.remove(filepath)
        raise HTTPException(status_code=400, detail=f"Invalid CSV format: {str(e)}")
        
    job = CSVUploadJob(
        provider=provider_enum,
        original_filename=file.filename,
        internal_filepath=filepath,
        status=CSVUploadStatus.UPLOADED,
        rows_total=total_rows
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    
    # Audit log
    audit_log = AuditLog(
        user_id=current_admin.id,
        action="UPLOAD_CSV",
        entity_type="CSV_JOB",
        entity_id=str(job.id),
        details={"filename": file.filename, "provider": provider_enum.value}
    )
    db.add(audit_log)
    db.commit()
    
    return job

@router.get("/{provider}/jobs/{job_id}", response_model=CSVUploadJobSchema)
def get_job(
    job_id: int,
    provider: str = Path(...),
    current_admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    job = db.query(CSVUploadJob).filter(CSVUploadJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    return job

@router.get("/{provider}/jobs/{job_id}/headers", response_model=CSVMappingDetectionResponse)
def detect_headers(
    job_id: int,
    provider: str = Path(...),
    current_admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    job = db.query(CSVUploadJob).filter(CSVUploadJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
        
    try:
        with open(job.internal_filepath, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            headers = next(reader, None)
            
            samples = []
            for _ in range(3):
                row = next(reader, None)
                if row:
                    samples.append(row)
                    
        if not headers:
            raise HTTPException(status_code=400, detail="Failed to read headers.")
            
        mapped_headers = []
        for col_idx, header in enumerate(headers):
            col_samples = []
            for row in samples:
                if col_idx < len(row):
                    col_samples.append(str(row[col_idx]))
                    
            target_field, confidence, target_tag_key = guess_mapping(header, col_samples)
            
            mapped_headers.append(CSVMappedHeader(
                source_header=header,
                target_field=target_field,
                target_tag_key=target_tag_key,
                confidence_score=confidence,
                sample_values=col_samples,
                is_ignored=False
            ))
            
        return CSVMappingDetectionResponse(
            headers=mapped_headers,
            total_rows_detected=job.rows_total
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process CSV: {str(e)}")

@router.post("/{provider}/jobs/{job_id}/validate", response_model=CSVUploadJobSchema)
def validate_import(
    job_id: int,
    request: CSVMappingConfirmRequest,
    provider: str = Path(...),
    current_admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    job = db.query(CSVUploadJob).filter(CSVUploadJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
        
    job.status = CSVUploadStatus.VALIDATING
    job.mapping_config = [m.model_dump() for m in request.mappings]
    db.commit()
    
    # Run validation
    rows_valid = 0
    rows_invalid = 0
    stats_new = 0
    stats_updated = 0
    stats_unchanged = 0
    
    target_map = {}
    try:
        with open(job.internal_filepath, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            headers = next(reader, None)
            if not headers:
                raise ValueError("No headers")
                
            for idx, h in enumerate(headers):
                for m in request.mappings:
                    if m.source_header == h and not m.is_ignored and m.target_field:
                        target_map[idx] = m
                        break
                        
            # We must have mapped resource_id
            if not any(m.target_field == "resource_id" for m in target_map.values()):
                job.status = CSVUploadStatus.FAILED
                job.error_message = "Critical: 'resource_id' must be mapped to validate import."
                db.commit()
                return job
                
            # Pre-fetch existing resources for fast lookup
            existing_resources = {r.resource_id: r for r in db.query(Resource).filter(Resource.provider == job.provider).all()}
            
            for row in reader:
                # Extract fields
                parsed = {}
                for idx, val in enumerate(row):
                    if idx in target_map:
                        m = target_map[idx]
                        if m.target_field not in ["cloud_tag", "serialized_tags"]:
                            parsed[m.target_field] = val
                        
                res_id = parsed.get("resource_id")
                if not res_id:
                    rows_invalid += 1
                    continue
                    
                rows_valid += 1
                
                # Check duplication
                if res_id in existing_resources:
                    # In a real app we'd deeply compare fields. Here we just mark updated.
                    stats_updated += 1
                else:
                    stats_new += 1
                    
        job.rows_valid = rows_valid
        job.rows_invalid = rows_invalid
        job.stats_new = stats_new
        job.stats_updated = stats_updated
        job.stats_unchanged = stats_unchanged
        job.status = CSVUploadStatus.READY_FOR_IMPORT
        
    except Exception as e:
        job.status = CSVUploadStatus.FAILED
        job.error_message = str(e)
        
    db.commit()
    db.refresh(job)
    return job

import json

@router.post("/{provider}/jobs/{job_id}/import", response_model=CSVUploadJobSchema)
def execute_import(
    job_id: int,
    provider: str = Path(...),
    current_admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    job = db.query(CSVUploadJob).filter(CSVUploadJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
        
    if job.status != CSVUploadStatus.READY_FOR_IMPORT:
        raise HTTPException(status_code=400, detail="Job is not in READY_FOR_IMPORT status.")
        
    job.status = CSVUploadStatus.IMPORTING
    db.commit()
    
    try:
        # Load map
        target_map = {}
        with open(job.internal_filepath, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            headers = next(reader, None)
            for idx, h in enumerate(headers):
                for m in job.mapping_config:
                    if m.get("source_header") == h and not m.get("is_ignored") and m.get("target_field"):
                        target_map[idx] = m
            
            normalized_resources = []
            for row_idx, row in enumerate(reader):
                parsed = {}
                cloud_tags = {}
                raw_source = {}
                
                for idx, val in enumerate(row):
                    header_name = headers[idx] if idx < len(headers) else f"col_{idx}"
                    
                    if idx in target_map:
                        m = target_map[idx]
                        field = m["target_field"]
                        if field == "cloud_tag":
                            raw_key = m.get("target_tag_key") or header_name
                            cloud_tags[raw_key.strip()] = val
                        elif field == "serialized_tags":
                            try:
                                parsed_tags = json.loads(val)
                                if isinstance(parsed_tags, dict):
                                    cloud_tags.update({str(k).strip(): str(v) for k,v in parsed_tags.items()})
                                else:
                                    # Fallback to raw if it's not a dict
                                    raw_source[header_name] = val
                            except:
                                # Fallback to raw if JSON is invalid
                                raw_source[header_name] = val
                        else:
                            parsed[field] = val
                    else:
                        # Unmapped or ignored goes to raw_source, NOT cloud_tags!
                        raw_source[header_name] = val
                        
                res_id = parsed.get("resource_id")
                if not res_id:
                    continue
                    
                nr = NormalizedResource(
                    resource_id=parsed.get("resource_id", ""),
                    resource_name=parsed.get("resource_name"),
                    resource_type=parsed.get("resource_type"),
                    resource_group=parsed.get("resource_group"),
                    account_id=parsed.get("account_id"),
                    account_name=parsed.get("account_name"),
                    region_name=parsed.get("region"),
                    cloud_tags=cloud_tags,
                    raw_source=raw_source
                )
                normalized_resources.append(nr)
                
            source_metadata = {
                "filename": job.original_filename
            }
            
            ResourceInventoryService.upsert_resources(
                db=db,
                provider=job.provider,
                upload_job_id=job.id,
                source_metadata=source_metadata,
                resources=normalized_resources
            )
            
        job.status = CSVUploadStatus.COMPLETED
        job.completed_at = func.now()
        
    except Exception as e:
        db.rollback()
        job.status = CSVUploadStatus.FAILED
        job.error_message = f"Import failed: {str(e)}"
        
    db.commit()
    db.refresh(job)
    return job
