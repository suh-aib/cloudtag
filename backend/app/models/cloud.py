from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum, ForeignKey, func
from sqlalchemy.orm import relationship
from app.database import Base
import enum

class CloudProvider(str, enum.Enum):
    AZURE = "AZURE"
    AWS = "AWS"

class CloudAccountStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    DISABLED = "DISABLED"

class CloudAccount(Base):
    __tablename__ = "cloud_accounts"

    id = Column(Integer, primary_key=True, index=True)
    cloud = Column(Enum(CloudProvider), nullable=False)
    name = Column(String(255), nullable=False)
    account_identifier = Column(String(255), nullable=False, unique=True, index=True)
    status = Column(Enum(CloudAccountStatus), default=CloudAccountStatus.ACTIVE, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    regions = relationship("CloudRegion", back_populates="account")
    resources = relationship("Resource", back_populates="account")

class CloudRegion(Base):
    __tablename__ = "cloud_regions"

    id = Column(Integer, primary_key=True, index=True)
    cloud_account_id = Column(Integer, ForeignKey("cloud_accounts.id"), nullable=False)
    name = Column(String(255), nullable=False)
    display_name = Column(String(255), nullable=True)
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    account = relationship("CloudAccount", back_populates="regions")
    resources = relationship("Resource", back_populates="region")
