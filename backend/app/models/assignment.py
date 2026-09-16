from sqlalchemy import Column, Integer, String, DateTime, Enum, ForeignKey, func, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.cloud import CloudProvider
import enum

class TaskAssignmentStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"

class TaskAssignment(Base):
    __tablename__ = "task_assignments"

    id = Column(Integer, primary_key=True, index=True)
    task_number = Column(String(255), unique=True, index=True, nullable=False) # Server generated (e.g. CT-001)
    provider = Column(Enum(CloudProvider), nullable=False)
    scope_type = Column(String(255), nullable=False)
    
    assigned_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    assigned_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    subscription_id = Column(String(255), nullable=True)
    account_id = Column(String(255), nullable=True)
    region_id = Column(String(255), nullable=True)
    resource_group = Column(String(255), nullable=True)
    resource_type = Column(String(255), nullable=True)
    
    status = Column(Enum(TaskAssignmentStatus), default=TaskAssignmentStatus.ACTIVE, nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    assigned_user = relationship("User", foreign_keys=[assigned_user_id])
    assigned_by_user = relationship("User", foreign_keys=[assigned_by_user_id])
    resources = relationship("TaskAssignmentResource", back_populates="assignment")

class TaskAssignmentResource(Base):
    __tablename__ = "task_assignment_resources"

    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("task_assignments.id"), nullable=False, index=True)
    resource_id = Column(Integer, ForeignKey("resources.id"), nullable=False)
    resource_id_hash = Column(String(64), nullable=False, index=True) # Cached from resource for fast duplicate checking without constant JOIN
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint('assignment_id', 'resource_id', name='uq_assignment_resource'),
    )

    assignment = relationship("TaskAssignment", back_populates="resources")
    resource = relationship("Resource")
