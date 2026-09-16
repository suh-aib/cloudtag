from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import datetime
from app.models.cloud import CloudProvider
from app.models.master_data import TagProvider
from enum import Enum

class ScopeType(str, Enum):
    SUBSCRIPTION = "SUBSCRIPTION"
    RESOURCE_GROUP = "RESOURCE_GROUP"
    RESOURCE_TYPE = "RESOURCE_TYPE"
    RESOURCE_SELECTION = "RESOURCE_SELECTION"
    AWS_ACCOUNT = "AWS_ACCOUNT"

class TagValueSchema(BaseModel):
    id: int
    value: str
    display_name: Optional[str] = None
    enabled: bool

    class Config:
        from_attributes = True

class TagDefinitionSchema(BaseModel):
    id: int
    provider: TagProvider
    name: str
    description: Optional[str] = None
    mandatory: bool
    enabled: bool
    values: List[TagValueSchema]

    class Config:
        from_attributes = True

class BulkTagRequestSchema(BaseModel):
    provider: CloudProvider
    scope_type: ScopeType
    account_id: Optional[str] = None
    resource_group: Optional[str] = None
    resource_type: Optional[str] = None
    resource_ids: Optional[List[int]] = None
    tags: Dict[str, str]
    task_id: Optional[int] = None
    status: Optional[str] = "PENDING_APPROVAL"

class BatchResponseSchema(BaseModel):
    id: int
    batch_id: str
    cloud: CloudProvider
    scope: Optional[str] = None
    status: str
    created_at: datetime
    resource_count: Optional[int] = 0
    created_by_name: Optional[str] = None
    
    class Config:
        from_attributes = True

class BulkTagResponseSchema(BaseModel):
    batch_id: str
    status: str

class PreviewResourceChange(BaseModel):
    resource_id: int
    resource_name: str
    tag_key: str
    current_value: str
    proposed_value: str
    will_change: bool
    existing_tags: Optional[Dict[str, str]] = None

class PreviewResponseSchema(BaseModel):
    resource_count: int
    changes: List[PreviewResourceChange]

class ChangeDetailSchema(BaseModel):
    id: int
    resource_id: int
    account_name: str
    account_id_str: str
    resource_group: Optional[str] = None
    resource_type: str
    resource_name: str
    tag_key: str
    previous_value: Optional[str] = None
    proposed_value: Optional[str] = None
    status: str

class BatchApprovalDetailSchema(BaseModel):
    id: int
    batch_id: str
    cloud: CloudProvider
    scope: Optional[str] = None
    status: str
    created_at: datetime
    submitted_by: str
    changes: List[ChangeDetailSchema]

class ApprovalDecisionRequest(BaseModel):
    scope_type: str # BATCH, ACCOUNT, RESOURCE_GROUP, REGION, RESOURCE_TYPE, RESOURCE
    scope_value: str
    action: str # APPROVE, REJECT
    account_id: Optional[str] = None
    resource_group: Optional[str] = None
    region: Optional[str] = None
    resource_type: Optional[str] = None
