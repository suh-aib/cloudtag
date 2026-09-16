from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from datetime import datetime
from app.models.cloud import CloudProvider
from app.models.assignment import TaskAssignmentStatus

class CreateAssignmentPayload(BaseModel):
    provider: CloudProvider
    assigned_user_id: int
    scope_type: str
    subscription_id: Optional[str] = None
    account_id: Optional[str] = None
    region_id: Optional[str] = None
    resource_group: Optional[str] = None
    resource_type: Optional[str] = None
    resource_ids: Optional[List[str]] = None

    model_config = ConfigDict(from_attributes=True)

class TaskAssignmentResponse(BaseModel):
    id: int
    task_number: str
    provider: CloudProvider
    scope_type: str
    assigned_user_id: int
    assigned_user_name: Optional[str] = None
    assigned_by_user_id: int
    status: TaskAssignmentStatus
    created_at: datetime
    
    # Progress fields added for UI convenience, even if 0 initially
    resource_count: int = 0
    completed_resources: int = 0
    
    subscription_id: Optional[str] = None
    account_id: Optional[str] = None
    region_id: Optional[str] = None
    resource_group: Optional[str] = None
    resource_type: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class TaskAssignmentResourceResponse(BaseModel):
    id: int
    assignment_id: int
    resource_id: int
    canonical_resource_id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class UserTagProgressResponse(BaseModel):
    user_id: int
    user_name: str
    user_email: str
    task_count: int
    total_resources: int
    completed_resources: int
    pending_resources: int
    progress_percentage: int

    model_config = ConfigDict(from_attributes=True)
