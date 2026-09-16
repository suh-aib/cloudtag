import pytest
from app.models.cloud import CloudProvider
from app.models.resource import Resource
from app.models.tagging import TaggingChange
from app.models.cloud import CloudAccount
from app.services.script_generator import ScriptGeneratorService
import json

class MockChange:
    def __init__(self, id, tag_key, previous_value, approved_value):
        self.id = id
        self.tag_key = tag_key
        self.previous_value = previous_value
        self.approved_value = approved_value
        self.proposed_value = approved_value

class MockResource:
    def __init__(self, _id, res_id, name="Res", loc="eastus", rg="my-rg", rt="Microsoft.Compute/virtualMachines", cloud_tags=None):
        self.id = _id
        self.resource_id = res_id
        self.name = name
        self.location = loc
        self.resource_group = rg
        self.resource_type = rt
        self.cloud_tags = cloud_tags or {"EXISTING_KEY": "OLD_VAL"}

class MockAccount:
    def __init__(self, account_identifier):
        self.account_identifier = account_identifier
        self.name = "Mock Account Name"

def test_build_manifest_logic():
    res1 = MockResource(1, "/sub1/res1", cloud_tags={"ENVIRONMENT": "UAT", "BACKUP": "YES", "OWNER": "Suhaib"})
    acc1 = MockAccount("sub1")
    
    # CHANGE: UAT -> PROD
    change1 = MockChange(101, "ENVIRONMENT", "UAT", "PROD")
    # ADD: NOT SET -> PROD
    change2 = MockChange(102, "COST_CENTER", None, "PROD")
    # REMOVE: UAT -> NOT SET
    change3 = MockChange(103, "TEST_TAG", "UAT", None)

    changes = [
        (change1, res1, acc1),
        (change2, res1, acc1),
        (change3, res1, acc1),
    ]

    manifest = ScriptGeneratorService._build_manifest("JOB-TEST", CloudProvider.AZURE, changes)
    
    resources = manifest.get("resources")
    assert len(resources) == 1
    
    res_manifest = resources[0]
    changes_manifest = res_manifest.get("changes")
    
    # Should have 5 changes (3 explicit + 2 preserve for BACKUP and OWNER)
    assert len(changes_manifest) == 5
    
    # The list is sorted by tag_key, let's map them for easy assertions
    change_map = { c["key"]: c for c in changes_manifest }
    
    # 1. CHANGE
    assert change_map["ENVIRONMENT"]["action"] == "CHANGE"
    assert change_map["ENVIRONMENT"]["before"] == "UAT"
    assert change_map["ENVIRONMENT"]["after"] == "PROD"
    
    # 2. ADD
    assert change_map["COST_CENTER"]["action"] == "ADD"
    assert change_map["COST_CENTER"]["before"] is None
    assert change_map["COST_CENTER"]["after"] == "PROD"
    
    # 3. REMOVE
    assert change_map["TEST_TAG"]["action"] == "REMOVE"
    assert change_map["TEST_TAG"]["before"] == "UAT"
    assert change_map["TEST_TAG"]["after"] is None
    
    # 4. PRESERVE
    assert change_map["BACKUP"]["action"] == "PRESERVE"
    assert change_map["BACKUP"]["before"] == "YES"
    assert change_map["BACKUP"]["after"] == "YES"
    
    assert change_map["OWNER"]["action"] == "PRESERVE"
    assert change_map["OWNER"]["before"] == "Suhaib"
    assert change_map["OWNER"]["after"] == "Suhaib"

def test_manifest_determinism():
    res1 = MockResource(1, "/sub1/res1", cloud_tags={"A": "1"})
    res2 = MockResource(2, "/sub1/res2", cloud_tags={"B": "2"})
    acc1 = MockAccount("sub1")
    
    change1 = MockChange(101, "TAG1", "v1", "v2")
    change2 = MockChange(102, "TAG2", "x1", "x2")
    
    # Order 1
    changes_order_1 = [
        (change1, res1, acc1),
        (change2, res2, acc1)
    ]
    manifest1 = ScriptGeneratorService._build_manifest("JOB-1", CloudProvider.AZURE, changes_order_1)
    
    # Order 2
    changes_order_2 = [
        (change2, res2, acc1),
        (change1, res1, acc1)
    ]
    manifest2 = ScriptGeneratorService._build_manifest("JOB-1", CloudProvider.AZURE, changes_order_2)
    
    manifest1.pop("generated_at", None)
    manifest2.pop("generated_at", None)
    manifest1.pop("manifest_hash", None)
    manifest2.pop("manifest_hash", None)
    
    m1_str = json.dumps(manifest1, sort_keys=True, separators=(",", ":"))
    m2_str = json.dumps(manifest2, sort_keys=True, separators=(",", ":"))
    
    assert m1_str == m2_str
    
def test_manifest_integrity_check():
    res1 = MockResource(1, "/sub1/res1")
    acc1 = MockAccount("sub1")
    change1 = MockChange(101, "T1", "A", "B")
    
    manifest = ScriptGeneratorService._build_manifest("JOB-1", CloudProvider.AZURE, [(change1, res1, acc1)])
    original_hash = manifest["manifest_hash"]
    
    # Validate the hash locally via the same process used in script templates
    m = manifest.copy()
    m.pop('manifest_hash', None)
    c = json.dumps(m, sort_keys=True, separators=(',', ':'))
    import hashlib
    computed_hash = hashlib.sha256(c.encode('utf-8')).hexdigest()
    
    assert original_hash == computed_hash

