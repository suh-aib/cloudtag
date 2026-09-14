from pydantic import BaseModel
from typing import List, Optional

class DashboardStatsSchema(BaseModel):
    total_resources: int
    tagging_required: int
    validated_resources: int
    pending_approval_resources: int
    approved_resources: int
    assigned_resources: int
    tagging_completion_percent: int

class InventoryAccountSchema(BaseModel):
    account_id: Optional[int] = None
    account_name: str
    account_identifier: str
    resource_count: int
    group_count: int # For Azure (Resource Groups) or AWS (Regions)

class ResourceGroupCountSchema(BaseModel):
    name: str
    locations: List[str]
    resource_count: int
    types_count: int

class ResourceTypeCountSchema(BaseModel):
    resource_type: str
    display_name: str
    resource_count: int

class ResourceDetailSchema(BaseModel):
    id: int
    resource_name: str
    resource_type: str
    resource_group: Optional[str] = None
    location: Optional[str] = None
    resource_id: str
    cloud_tags: Optional[dict] = None
    tagging_scope: str
    status: str # Derived from ResourceTagState or fallback to NOT_REVIEWED

    class Config:
        from_attributes = True
