from pydantic import BaseModel, Field
from typing import Optional, Dict, Any

class NormalizedResource(BaseModel):
    """
    A unified resource model used internally to standardize resource data
    ingested from various sources (CSV, SharePoint, API discovery).
    """
    resource_id: str
    resource_name: Optional[str] = None
    resource_type: Optional[str] = None
    resource_group: Optional[str] = None
    account_id: Optional[str] = None
    account_name: Optional[str] = None
    region_name: Optional[str] = None
    
    # Unmapped source fields that should be preserved as tags
    cloud_tags: Dict[str, Any] = Field(default_factory=dict)
    
    # Original raw data representing this resource (e.g., CSV row)
    raw_source: Dict[str, Any] = Field(default_factory=dict)
