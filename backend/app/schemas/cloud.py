from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from app.models.cloud import CloudProvider, CloudAccountStatus

class CloudRegionBase(BaseModel):
    name: str
    display_name: Optional[str] = None
    enabled: bool = True

class CloudRegionCreate(CloudRegionBase):
    pass

class CloudRegionSchema(CloudRegionBase):
    id: int
    cloud_account_id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class CloudAccountBase(BaseModel):
    name: str
    account_identifier: str
    cloud: CloudProvider
    status: CloudAccountStatus = CloudAccountStatus.ACTIVE

class CloudAccountCreate(CloudAccountBase):
    pass

class CloudAccountUpdate(BaseModel):
    name: Optional[str] = None
    account_identifier: Optional[str] = None
    status: Optional[CloudAccountStatus] = None

class CloudAccountSchema(CloudAccountBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    regions: List[CloudRegionSchema] = []

    class Config:
        from_attributes = True

class RegionSyncRequest(BaseModel):
    regions: List[str]  # List of region codes to enable. Any not in list will be disabled.

class ConnectionTestResponse(BaseModel):
    success: bool
    message: str
