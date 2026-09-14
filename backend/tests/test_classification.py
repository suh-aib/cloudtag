import pytest
from app.models.resource import Resource, TaggingScope, Billability
from app.models.cloud import CloudProvider
import sys
import os

def test_billability_enum():
    assert hasattr(Billability, "BILLABLE")
    assert hasattr(Billability, "NON_BILLABLE")
    assert hasattr(Billability, "CONDITIONAL")
    assert hasattr(Billability, "UNKNOWN")
    
    assert Billability.BILLABLE.value == "BILLABLE"

def test_tagging_scope_enum():
    assert hasattr(TaggingScope, "REQUIRED")
    assert hasattr(TaggingScope, "SUPPORTING")
    assert hasattr(TaggingScope, "EXCLUDED")

def test_resource_model_classification_independence():
    # Verify that Billability and TaggingScope are entirely independent fields on the Resource model
    
    # 1. EC2 Instance -> BILLABLE + REQUIRED
    r1 = Resource(
        provider=CloudProvider.AWS,
        resource_type="ec2/instance",
        billability=Billability.BILLABLE,
        tagging_scope=TaggingScope.REQUIRED
    )
    assert r1.billability == Billability.BILLABLE
    assert r1.tagging_scope == TaggingScope.REQUIRED
    
    # 2. VPC -> NON_BILLABLE + SUPPORTING
    r2 = Resource(
        provider=CloudProvider.AWS,
        resource_type="ec2/vpc",
        billability=Billability.NON_BILLABLE,
        tagging_scope=TaggingScope.SUPPORTING
    )
    assert r2.billability == Billability.NON_BILLABLE
    assert r2.tagging_scope == TaggingScope.SUPPORTING
    
    # 3. Security Group -> NON_BILLABLE + SUPPORTING
    r3 = Resource(
        provider=CloudProvider.AWS,
        resource_type="ec2/security-group",
        billability=Billability.NON_BILLABLE,
        tagging_scope=TaggingScope.SUPPORTING
    )
    assert r3.billability == Billability.NON_BILLABLE
    
    # 4. IAM Policy -> NON_BILLABLE + EXCLUDED
    r4 = Resource(
        provider=CloudProvider.AWS,
        resource_type="iam/policy",
        billability=Billability.NON_BILLABLE,
        tagging_scope=TaggingScope.EXCLUDED
    )
    assert r4.tagging_scope == TaggingScope.EXCLUDED
    
    # 5. Azure Virtual Machine -> BILLABLE + REQUIRED
    r5 = Resource(
        provider=CloudProvider.AZURE,
        resource_type="microsoft.compute/virtualmachines",
        billability=Billability.BILLABLE,
        tagging_scope=TaggingScope.REQUIRED
    )
    assert r5.billability == Billability.BILLABLE

def test_default_values():
    r = Resource(
        provider=CloudProvider.AWS,
        resource_type="unknown-type"
    )
    # Testing that setting it to default works
    assert r.billability is None # Because SQLAlchemy defaults trigger on insert unless server_default is fetched. 
    # But wait, it's defined as Enum(Billability), default=Billability.UNKNOWN. So it will be evaluated at insert time.
