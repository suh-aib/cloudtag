from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, ForeignKey, Enum, func
from sqlalchemy.orm import relationship
import enum
from app.database import Base
from app.models.cloud import CloudProvider

class SharePointSyncStatus(str, enum.Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    
class SharePointConfigStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    DISABLED = "DISABLED"

class SharePointConfig(Base):
    __tablename__ = "sharepoint_configs"
    
    id = Column(Integer, primary_key=True, index=True)
    provider = Column(Enum(CloudProvider), unique=True, nullable=False, index=True)
    site_url = Column(String(512), nullable=True)
    document_library = Column(String(255), nullable=True)
    workbook = Column(String(255), nullable=True)
    worksheet = Column(String(255), nullable=True)
    status = Column(Enum(SharePointConfigStatus), default=SharePointConfigStatus.ACTIVE, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    sync_jobs = relationship("SharePointSyncJob", back_populates="config", cascade="all, delete-orphan")
    mappings = relationship("SharePointMapping", back_populates="config", cascade="all, delete-orphan")


class SharePointSyncJob(Base):
    __tablename__ = "sharepoint_sync_jobs"
    
    id = Column(Integer, primary_key=True, index=True)
    config_id = Column(Integer, ForeignKey("sharepoint_configs.id"), nullable=False)
    status = Column(Enum(SharePointSyncStatus), default=SharePointSyncStatus.PENDING, nullable=False)
    records_processed = Column(Integer, default=0)
    error_message = Column(String(1024), nullable=True)
    start_time = Column(DateTime(timezone=True), server_default=func.now())
    end_time = Column(DateTime(timezone=True), nullable=True)
    
    config = relationship("SharePointConfig", back_populates="sync_jobs")


class SharePointMapping(Base):
    __tablename__ = "sharepoint_mappings"
    
    id = Column(Integer, primary_key=True, index=True)
    config_id = Column(Integer, ForeignKey("sharepoint_configs.id"), nullable=False)
    source_header = Column(String(255), nullable=False)
    target_field = Column(String(255), nullable=True)
    confidence_score = Column(Float, nullable=True)
    is_approved = Column(Boolean, default=False)
    is_ignored = Column(Boolean, default=False)
    sample_values = Column(String(2048), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    config = relationship("SharePointConfig", back_populates="mappings")
