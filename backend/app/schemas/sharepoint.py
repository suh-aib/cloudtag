from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.models.cloud import CloudProvider
from app.models.sharepoint import SharePointConfigStatus, SharePointSyncStatus

class SharePointMappingBase(BaseModel):
    source_header: str
    target_field: Optional[str] = None
    confidence_score: Optional[float] = None
    is_approved: bool = False
    is_ignored: bool = False
    sample_values: Optional[str] = None

class SharePointMappingSchema(SharePointMappingBase):
    id: int
    config_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class SharePointSyncJobBase(BaseModel):
    status: SharePointSyncStatus
    records_processed: int = 0
    error_message: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None

class SharePointSyncJobSchema(SharePointSyncJobBase):
    id: int
    config_id: int

    class Config:
        from_attributes = True

class SharePointConfigBase(BaseModel):
    site_url: Optional[str] = None
    document_library: Optional[str] = None
    workbook: Optional[str] = None
    worksheet: Optional[str] = None
    status: SharePointConfigStatus = SharePointConfigStatus.ACTIVE

class SharePointConfigUpdate(SharePointConfigBase):
    pass

class SharePointConfigSchema(SharePointConfigBase):
    id: int
    provider: CloudProvider
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    # Exposing the latest sync job if available
    latest_sync: Optional[SharePointSyncJobSchema] = None

    class Config:
        from_attributes = True

class SharePointConnectionTestResponse(BaseModel):
    success: bool
    message: str
