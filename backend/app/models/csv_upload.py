from sqlalchemy import Column, Integer, String, DateTime, Enum, JSON, func
import enum
from app.database import Base
from app.models.cloud import CloudProvider

class CSVUploadStatus(str, enum.Enum):
    UPLOADED = "UPLOADED"
    PARSING = "PARSING"
    MAPPING = "MAPPING"
    VALIDATING = "VALIDATING"
    READY_FOR_IMPORT = "READY_FOR_IMPORT"
    IMPORTING = "IMPORTING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"

class CSVUploadJob(Base):
    __tablename__ = "csv_upload_jobs"

    id = Column(Integer, primary_key=True, index=True)
    provider = Column(Enum(CloudProvider), nullable=False)
    original_filename = Column(String(512), nullable=False)
    internal_filepath = Column(String(1024), nullable=False)
    status = Column(Enum(CSVUploadStatus), default=CSVUploadStatus.UPLOADED, nullable=False)
    
    mapping_config = Column(JSON, nullable=True)
    
    rows_total = Column(Integer, default=0)
    rows_valid = Column(Integer, default=0)
    rows_invalid = Column(Integer, default=0)
    stats_new = Column(Integer, default=0)
    stats_updated = Column(Integer, default=0)
    stats_unchanged = Column(Integer, default=0)
    
    error_summary = Column(String(2048), nullable=True)
    
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
