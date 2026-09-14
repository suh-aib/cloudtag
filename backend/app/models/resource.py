import hashlib
from sqlalchemy import Column, Integer, String, DateTime, Enum, ForeignKey, JSON, func, Text, event
from sqlalchemy.orm import relationship
from app.database import Base
import enum
from app.models.cloud import CloudProvider

class TaggingScope(str, enum.Enum):
    REQUIRED = "REQUIRED"
    SUPPORTING = "SUPPORTING"
    EXCLUDED = "EXCLUDED"

class Billability(str, enum.Enum):
    BILLABLE = "BILLABLE"
    NON_BILLABLE = "NON_BILLABLE"
    CONDITIONAL = "CONDITIONAL"
    UNKNOWN = "UNKNOWN"

class Resource(Base):
    __tablename__ = "resources"

    id = Column(Integer, primary_key=True, index=True)
    cloud_account_id = Column(Integer, ForeignKey("cloud_accounts.id"), nullable=True)
    region_id = Column(Integer, ForeignKey("cloud_regions.id"), nullable=True)
    provider = Column(Enum(CloudProvider), nullable=True)
    upload_job_id = Column(Integer, ForeignKey("csv_upload_jobs.id"), nullable=True)
    source_metadata = Column(JSON, nullable=True)
    resource_group = Column(String(255), nullable=True)
    resource_name = Column(String(255), nullable=False, index=True)
    resource_id = Column(Text, nullable=False)
    resource_id_hash = Column(String(64), unique=True, nullable=False, index=True)
    resource_type = Column(String(255), nullable=False)
    location = Column(String(255), nullable=True)
    billability = Column(Enum(Billability), default=Billability.UNKNOWN, nullable=False)
    tagging_scope = Column(Enum(TaggingScope), default=TaggingScope.REQUIRED, nullable=False)
    cloud_tags = Column(JSON, nullable=True) # Existing cloud tags
    discovered_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    account = relationship("CloudAccount", back_populates="resources")
    region = relationship("CloudRegion", back_populates="resources")
    tag_states = relationship("ResourceTagState", back_populates="resource")

class TagStateStatus(str, enum.Enum):
    NOT_REVIEWED = "NOT_REVIEWED"
    IN_PROGRESS = "IN_PROGRESS"
    SAVED = "SAVED"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    ASSIGNED = "ASSIGNED"
    SCRIPT_GENERATED = "SCRIPT_GENERATED"
    APPLIED = "APPLIED"
    VALIDATED = "VALIDATED"
    FAILED = "FAILED"
    REJECTED = "REJECTED"

class ResourceTagState(Base):
    __tablename__ = "resource_tag_states"

    id = Column(Integer, primary_key=True, index=True)
    resource_id = Column(Integer, ForeignKey("resources.id"), nullable=False)
    tag_key = Column(String(255), nullable=False)
    previous_value = Column(String(255), nullable=True)
    existing_value = Column(String(255), nullable=True)
    proposed_value = Column(String(255), nullable=True)
    approved_value = Column(String(255), nullable=True)
    final_value = Column(String(255), nullable=True)
    status = Column(Enum(TagStateStatus), default=TagStateStatus.NOT_REVIEWED, nullable=False)
    dont_change = Column(Integer, default=0) # boolean via integer
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    resource = relationship("Resource", back_populates="tag_states")

@event.listens_for(Resource, 'before_insert')
@event.listens_for(Resource, 'before_update')
def generate_resource_id_hash(mapper, connection, target):
    if target.resource_id:
        target.resource_id_hash = hashlib.sha256(target.resource_id.encode('utf-8')).hexdigest()
