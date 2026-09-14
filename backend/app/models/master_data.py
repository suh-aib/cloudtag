from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, func, Enum, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.cloud import CloudProvider
import enum

class TagProvider(str, enum.Enum):
    AZURE = "AZURE"
    AWS = "AWS"
    SHARED = "SHARED"

class TagDefinition(Base):
    __tablename__ = "tag_definitions"

    id = Column(Integer, primary_key=True, index=True)
    provider = Column(Enum(TagProvider), nullable=False)
    name = Column(String(255), index=True, nullable=False)
    description = Column(String(1024), nullable=True)
    enabled = Column(Boolean, default=True)
    mandatory = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint('provider', 'name', name='uq_provider_tag_name'),
    )

    values = relationship("TagValue", back_populates="definition")

class TagValue(Base):
    __tablename__ = "tag_values"

    id = Column(Integer, primary_key=True, index=True)
    tag_definition_id = Column(Integer, ForeignKey("tag_definitions.id"), nullable=False)
    value = Column(String(255), nullable=False)
    display_name = Column(String(255), nullable=True)
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    definition = relationship("TagDefinition", back_populates="values")

class Application(Base):
    __tablename__ = "applications"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    code = Column(String(255), nullable=False, unique=True)
    description = Column(String(1024), nullable=True)
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    code = Column(String(255), nullable=False, unique=True)
    description = Column(String(1024), nullable=True)
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
