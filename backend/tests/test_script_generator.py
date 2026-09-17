import pytest
import os
import tempfile
import subprocess
from app.services.script_generator import ScriptGeneratorService
from app.models.cloud import CloudProvider
from app.services.script_templates import get_aws_apply_script, get_aws_revert_script, get_azure_apply_script, get_azure_revert_script
import json

class MockResource:
    def __init__(self, res_id, arn, cloud_tags, resource_type="ec2/instance"):
        self.id = res_id
        self.resource_id = arn
        self.resource_name = arn.split('/')[-1]
        self.resource_group = "rg1"
        self.location = "us-east-1"
        self.cloud_tags = cloud_tags
        self.resource_type = resource_type

class MockAccount:
    def __init__(self, acc_id, region_id="us-east-1"):
        self.account_identifier = acc_id
        self.name = acc_id
        self.cloud_account_id = acc_id
        self.region_id = region_id
        self.provider = "AWS"

class MockChange:
    def __init__(self, id, key, prev, prop, app=None):
        self.id = id
        self.tag_key = key
        self.previous_value = prev
        self.proposed_value = prop
        self.approved_value = app if app is not None else prop


def run_bash_n(script_content: str):
    with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix=".sh") as f:
        f.write(script_content)
        temp_path = f.name
    try:
        subprocess.check_output(["bash", "-n", temp_path], stderr=subprocess.STDOUT)
    except subprocess.CalledProcessError as e:
        os.remove(temp_path)
        pytest.fail(f"Bash syntax validation failed:\\n{e.output.decode('utf-8')}")
    os.remove(temp_path)


def test_bash_syntax():
    res1 = MockResource(1, "arn:aws:ec2:us-east-1:123:instance/i-123", {})
    acc1 = MockAccount("123")
    c1 = MockChange(1, "TAG1", "NOT_SET", "V1")
    manifest = ScriptGeneratorService._build_manifest("JOB-SYNTAX", CloudProvider.AWS, [(c1, res1, acc1)])
    script = get_aws_apply_script(manifest)
    run_bash_n(script)


def test_A_normal_add():
    res1 = MockResource(1, "arn:aws:ec2:us-east-1:123:instance/i-123", {})
    acc1 = MockAccount("123")
    # Current: NOT_SET, Approved: NA -> Expected: Action ADD
    c1 = MockChange(1, "ENV", "NOT_SET", "NA")
    manifest = ScriptGeneratorService._build_manifest("JOB-A", CloudProvider.AWS, [(c1, res1, acc1)])
    
    # 1. Verify Action is ADD
    changes = manifest["resources"][0]["changes"]
    assert len(changes) == 1
    assert changes[0]["action"] == "ADD"
    
    script = get_aws_apply_script(manifest)
    assert "ADD_COUNT=$((ADD_COUNT + 1))" in script
    assert "aws ec2 create-tags" in script


def test_B_current_value_changed():
    res1 = MockResource(1, "arn:aws:ec2:us-east-1:123:instance/i-123", {})
    acc1 = MockAccount("123")
    # Current: UAT, Approved: NA
    c1 = MockChange(1, "ENV", "UAT", "NA")
    manifest = ScriptGeneratorService._build_manifest("JOB-B", CloudProvider.AWS, [(c1, res1, acc1)])
    
    script = get_aws_apply_script(manifest)
    assert "SKIPPED_CURRENT_VALUE_CHANGED=$((SKIPPED_CURRENT_VALUE_CHANGED + 1))" in script
    # It must return immediately
    assert "echo 'SKIPPED_CURRENT_VALUE_CHANGED (ENV expected UAT but was '$CURRENT_VAL')'" in script


def test_C_D_api_pre_read_failure_and_malformed_json():
    res1 = MockResource(1, "arn:aws:ec2:us-east-1:123:instance/i-123", {})
    acc1 = MockAccount("123")
    c1 = MockChange(1, "ENV", "NOT_SET", "NA")
    manifest = ScriptGeneratorService._build_manifest("JOB-CD", CloudProvider.AWS, [(c1, res1, acc1)])
    
    script = get_aws_apply_script(manifest)
    assert "FAILED_PRECHECK=$((FAILED_PRECHECK + 1))" in script
    # API read failure logic is present
    assert "echo 'FAILED_PRECHECK: AWS CLI returned exit code non-zero for tags'" in script
    # Malformed JSON logic is present
    assert "echo 'FAILED_PRECHECK: Malformed JSON'" in script
    # Ensure it returns
    assert "return" in script


def test_E_missing_resource():
    res1 = MockResource(1, "arn:aws:ec2:us-east-1:123:instance/i-123", {})
    acc1 = MockAccount("123")
    c1 = MockChange(1, "ENV", "NOT_SET", "NA")
    manifest = ScriptGeneratorService._build_manifest("JOB-E", CloudProvider.AWS, [(c1, res1, acc1)])
    
    script = get_aws_apply_script(manifest)
    # Exists check failure logic
    assert "echo 'FAILED_PRECHECK: Resource does not exist or read failed'" in script


def test_F_write_failure():
    res1 = MockResource(1, "arn:aws:ec2:us-east-1:123:instance/i-123", {})
    acc1 = MockAccount("123")
    c1 = MockChange(1, "ENV", "NOT_SET", "NA")
    manifest = ScriptGeneratorService._build_manifest("JOB-F", CloudProvider.AWS, [(c1, res1, acc1)])
    
    script = get_aws_apply_script(manifest)
    # Write failure logic
    assert "if [ $? -ne 0 ]; then WRITE_FAILED=1; fi" in script
    assert "echo 'FAILED_WRITE: API call failed'" in script
    assert "FAILED_WRITE=$((FAILED_WRITE + 1))" in script


def test_G_H_post_verification():
    res1 = MockResource(1, "arn:aws:ec2:us-east-1:123:instance/i-123", {})
    acc1 = MockAccount("123")
    c1 = MockChange(1, "ENV", "NOT_SET", "NA")
    manifest = ScriptGeneratorService._build_manifest("JOB-GH", CloudProvider.AWS, [(c1, res1, acc1)])
    
    script = get_aws_apply_script(manifest)
    assert "FAILED_POST_VERIFY=$((FAILED_POST_VERIFY + 1))" in script
    assert "echo 'FAILED_POST_VERIFY: Read API failed'" in script
    assert "echo 'FAILED_POST_VERIFY: Malformed JSON'" in script
    assert "echo 'FAILED_POST_VERIFY (ENV expected NA but was '$POST_VAL')'" in script


def test_I_account_mismatch():
    res1 = MockResource(1, "arn:aws:ec2:us-east-1:123:instance/i-123", {})
    acc1 = MockAccount("123")
    c1 = MockChange(1, "ENV", "NOT_SET", "NA")
    manifest = ScriptGeneratorService._build_manifest("JOB-I", CloudProvider.AWS, [(c1, res1, acc1)])
    
    script = get_aws_apply_script(manifest)
    # Global account validation before resources
    assert 'if [ "$EXPECTED_ACCOUNT" != "$CURRENT_ACCOUNT" ]; then' in script
    assert "echo 'TARGET_ACCOUNT_MISMATCH'" in script
    assert "exit 1" in script


def test_J_preserve():
    res1 = MockResource(1, "arn:aws:ec2:us-east-1:123:instance/i-123", {})
    acc1 = MockAccount("123")
    # Current value equals approved value
    c1 = MockChange(1, "ENV", "PROD", "PROD")
    manifest = ScriptGeneratorService._build_manifest("JOB-J", CloudProvider.AWS, [(c1, res1, acc1)])
    
    script = get_aws_apply_script(manifest)
    changes = manifest["resources"][0]["changes"]
    assert len(changes) == 1
    assert changes[0]["action"] == "PRESERVE"
    
    assert "PRESERVED_NO_OP=$((PRESERVED_NO_OP + 1))" in script
    assert "PRESERVE_COUNT=$((PRESERVE_COUNT + 1))" in script
    assert "aws ec2 create-tags" not in script
    assert "aws ec2 delete-tags" not in script


def test_historic_job_aws_f46fbc3c():
    # Equivalent to JOB-AWS-F46FBC3C
    # 2 resources, APPNAME Not set -> NA
    res1 = MockResource(1, "arn:aws:events:us-east-1:123:rule/rule-1", {}, resource_type="events/rule")
    res2 = MockResource(2, "arn:aws:events:us-east-1:123:rule/rule-2", {}, resource_type="events/rule")
    acc1 = MockAccount("123")
    
    c1 = MockChange(1, "APPNAME", "NOT_SET", "NA")
    c2 = MockChange(2, "APPNAME", "NOT_SET", "NA")
    
    manifest = ScriptGeneratorService._build_manifest("JOB-AWS-F46FBC3C", CloudProvider.AWS, [(c1, res1, acc1), (c2, res2, acc1)])
    
    # Assert classification
    chg1 = manifest["resources"][0]["changes"][0]
    chg2 = manifest["resources"][1]["changes"][0]
    
    assert chg1["action"] == "ADD"
    assert chg1["before"] == "NOT_SET"
    assert chg1["after"] == "NA"
    assert chg2["action"] == "ADD"
    
    script = get_aws_apply_script(manifest)
    
    # Assert EventBridge API is used correctly
    assert "aws events describe-rule" in script
    assert "aws events list-tags-for-resource" in script
    assert "aws events tag-resource" in script
    
    run_bash_n(script)


def test_azure_script_logic():
    res1 = MockResource(1, "/subscriptions/sub1/rg/vm1", {})
    acc1 = MockAccount("sub1")
    c1 = MockChange(1, "TAG1", "NOT_SET", "V1")
    c2 = MockChange(2, "TAG2", "V1", "NOT_SET")
    c3 = MockChange(3, "TAG3", "SAME", "SAME")
    
    manifest = ScriptGeneratorService._build_manifest("JOB-AZURE", CloudProvider.AZURE, [(c1, res1, acc1), (c2, res1, acc1), (c3, res1, acc1)])
    script = get_azure_apply_script(manifest)
    
    # 1. Global sub check
    assert "TARGET_SUBSCRIPTION_MISMATCH" in script
    assert "$EXPECTED_SUB = 'sub1'" in script
    
    # 2. Resource scoped script block
    assert "& {" in script
    
    # 3. Explicit error stop and return
    assert "-ErrorAction Stop" in script
    assert "return" in script
    
    # 4. PRESERVE yields NO writes
    assert "$global:PRESERVED_NO_OP++" in script


def test_unsupported_aws_type():
    res1 = MockResource(1, "arn:aws:s3:::mybucket", {}, resource_type="s3/bucket")
    acc1 = MockAccount("123")
    c1 = MockChange(1, "TAG1", "NOT_SET", "V1")
    manifest = ScriptGeneratorService._build_manifest("JOB-UNSUPPORTED", CloudProvider.AWS, [(c1, res1, acc1)])
    script = get_aws_apply_script(manifest)
    
    assert "UNSUPPORTED_STATE_READ" in script
    assert "return" in script


def test_empty_string_distinct_from_not_set():
    res1 = MockResource(1, "res1", {})
    acc1 = MockAccount("sub1")
    
    c1 = MockChange(1, "EMPTY_TAG", "NOT_SET", "")
    c2 = MockChange(2, "TO_EMPTY", "VAL", "")
    
    manifest = ScriptGeneratorService._build_manifest("JOB-EMPTY", CloudProvider.AZURE, [(c1, res1, acc1), (c2, res1, acc1)])
    chgs = {c["key"]: c for c in manifest["resources"][0]["changes"]}
    
    assert chgs["EMPTY_TAG"]["action"] == "ADD"
    assert chgs["EMPTY_TAG"]["after"] == ""
    assert chgs["TO_EMPTY"]["action"] == "CHANGE"
    assert chgs["TO_EMPTY"]["after"] == ""
