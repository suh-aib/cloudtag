from pydantic import BaseModel
from typing import List, Optional, Any
from datetime import datetime
from app.models.cloud import CloudProvider
from app.models.csv_upload import CSVUploadStatus

class CSVUploadJobBase(BaseModel):
    provider: CloudProvider
    original_filename: str

class CSVUploadJobSchema(CSVUploadJobBase):
    id: int
    status: CSVUploadStatus
    rows_total: int
    rows_valid: int
    rows_invalid: int
    stats_new: int
    stats_updated: int
    stats_unchanged: int
    error_summary: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    mapping_config: Optional[Any] = None
    
    class Config:
        from_attributes = True

class CSVMappedHeader(BaseModel):
    source_header: str
    target_field: Optional[str] = None
    target_tag_key: Optional[str] = None
    confidence_score: Optional[float] = None
    sample_values: List[str] = []
    is_ignored: bool = False

class CSVMappingDetectionResponse(BaseModel):
    headers: List[CSVMappedHeader]
    total_rows_detected: int

class CSVMappingConfirmRequest(BaseModel):
    mappings: List[CSVMappedHeader]
