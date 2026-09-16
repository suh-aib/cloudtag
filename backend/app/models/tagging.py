from sqlalchemy import Column, Integer, String, DateTime, Enum, ForeignKey, func
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.cloud import CloudProvider
import enum

class BatchStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    PARTIALLY_APPROVED = "PARTIALLY_APPROVED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    ASSIGNED = "ASSIGNED"
    SCRIPT_GENERATED = "SCRIPT_GENERATED"
    APPLIED = "APPLIED"
    VALIDATED = "VALIDATED"
    FAILED = "FAILED"

class TaggingBatch(Base):
    __tablename__ = "tagging_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String(255), unique=True, index=True, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    cloud = Column(Enum(CloudProvider), nullable=False)
    scope = Column(String(255), nullable=True)
    status = Column(Enum(BatchStatus), default=BatchStatus.PENDING_APPROVAL, nullable=False)
    task_assignment_id = Column(Integer, ForeignKey("task_assignments.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    task_assignment = relationship("TaskAssignment")
    changes = relationship("TaggingChange", back_populates="batch")
    approvals = relationship("Approval", back_populates="batch")

class ChangeStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    PARTIALLY_APPROVED = "PARTIALLY_APPROVED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    ASSIGNED = "ASSIGNED"
    SCRIPT_GENERATED = "SCRIPT_GENERATED"
    APPLIED = "APPLIED"
    VALIDATED = "VALIDATED"
    FAILED = "FAILED"

class TaggingChange(Base):
    __tablename__ = "tagging_changes"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("tagging_batches.id"), nullable=False)
    resource_id = Column(Integer, ForeignKey("resources.id"), nullable=False)
    tag_key = Column(String(255), nullable=False)
    previous_value = Column(String(255), nullable=True)
    proposed_value = Column(String(255), nullable=True)
    approved_value = Column(String(255), nullable=True)
    status = Column(Enum(ChangeStatus), default=ChangeStatus.DRAFT, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    batch = relationship("TaggingBatch", back_populates="changes")
    resource = relationship("Resource")

class ApprovalStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    PARTIALLY_APPROVED = "PARTIALLY_APPROVED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    ASSIGNED = "ASSIGNED"
    SCRIPT_GENERATED = "SCRIPT_GENERATED"
    APPLIED = "APPLIED"
    VALIDATED = "VALIDATED"
    FAILED = "FAILED"

class Approval(Base):
    __tablename__ = "approvals"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("tagging_batches.id"), nullable=False)
    submitted_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(Enum(ApprovalStatus), default=ApprovalStatus.PENDING_APPROVAL, nullable=False)
    comments = Column(String(1024), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    reviewed_at = Column(DateTime(timezone=True), nullable=True)

    batch = relationship("TaggingBatch", back_populates="approvals")

class ScriptType(str, enum.Enum):
    APPLY = "APPLY"
    REVERT = "REVERT"

class JobStatus(str, enum.Enum):
    GENERATED = "GENERATED"
    EXECUTING = "EXECUTING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"

class ScriptJob(Base):
    __tablename__ = "script_jobs"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(String(255), unique=True, index=True, nullable=False)
    cloud = Column(Enum(CloudProvider), nullable=False)
    script_type = Column(Enum(ScriptType), nullable=False)
    status = Column(Enum(JobStatus), default=JobStatus.GENERATED, nullable=False)
    
    script_version = Column(Integer, default=1, nullable=False)
    manifest_hash = Column(String(255), nullable=True)
    ingestion_token_hash = Column(String(255), nullable=True)
    
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    changes = relationship("ScriptJobChange", back_populates="job")
    execution_results = relationship("ExecutionResult", back_populates="job")

class ScriptJobChange(Base):
    __tablename__ = "script_job_changes"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("script_jobs.id"), nullable=False)
    change_id = Column(Integer, ForeignKey("tagging_changes.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    job = relationship("ScriptJob", back_populates="changes")
    change = relationship("TaggingChange")

class ExecutionStatus(str, enum.Enum):
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    SKIPPED = "SKIPPED"
    PENDING = "PENDING"

class ExecutionResult(Base):
    __tablename__ = "execution_results"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("script_jobs.id"), nullable=False)
    resource_id = Column(Integer, ForeignKey("resources.id"), nullable=False)
    change_id = Column(Integer, ForeignKey("tagging_changes.id"), nullable=True)
    status = Column(Enum(ExecutionStatus), default=ExecutionStatus.PENDING, nullable=False)
    
    reason_code = Column(String(255), nullable=True)
    message = Column(String(1024), nullable=True)
    
    expected_value = Column(String(255), nullable=True)
    proposed_value = Column(String(255), nullable=True)
    actual_value_before = Column(String(255), nullable=True)
    actual_value_after = Column(String(255), nullable=True)
    
    executed_at = Column(DateTime(timezone=True), nullable=True)
    validated_at = Column(DateTime(timezone=True), nullable=True)

    job = relationship("ScriptJob", back_populates="execution_results")
    resource = relationship("Resource")
    change = relationship("TaggingChange")
