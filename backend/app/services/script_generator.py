import json
import hashlib
import uuid
import datetime
import zipfile
import io
import jwt
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, text
from fastapi import HTTPException
from app.models.tagging import TaggingChange, ChangeStatus, ScriptJob, ScriptJobChange, JobStatus, ScriptType
from app.models.resource import Resource
from app.models.cloud import CloudProvider, CloudAccount
from app.config import settings

def generate_ingestion_token(job_id: str, expiration_minutes: int = 120) -> str:
    payload = {
        "job_id": job_id,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(minutes=expiration_minutes)
    }
    return jwt.encode(payload, settings.LOCAL_AUTH_SECRET_KEY, algorithm="HS256")

class ScriptGeneratorService:
    SCRIPT_VERSION = 1
    
    @staticmethod
    def _hash_manifest(manifest_dict: dict) -> str:
        # Canonical JSON serialization:
        # - sort keys alphabetically
        # - remove all optional whitespace around commas and colons
        # - UTF-8 encoded
        manifest_str = json.dumps(manifest_dict, sort_keys=True, separators=(',', ':'))
        return hashlib.sha256(manifest_str.encode('utf-8')).hexdigest()

    @staticmethod
    def _build_manifest(
        job_id: str, 
        provider: CloudProvider, 
        changes: List[Tuple[TaggingChange, Resource, CloudAccount]]
    ) -> dict:
        
        # Group by resource_id
        resources_map: Dict[int, dict] = {}
        
        for change, resource, account in changes:
            if resource.id not in resources_map:
                resources_map[resource.id] = {
                    "resource_id": resource.resource_id,
                    "account_id": account.account_identifier,
                    "region": resource.location if provider == CloudProvider.AWS else None,
                    "changes": []
                }
            
            # Determine tag existence logic from existing tags (cloud_tags JSON)
            cloud_tags = resource.cloud_tags or {}
            
            # Wait, the expected_previous_value is the value AT APPROVAL. 
            # In TaggingChange, previous_value is precisely what we want as expected_previous_value.
            expected_prev = change.previous_value
            tag_existed = False
            
            # If the tag was present in cloud_tags during generation or if it wasn't null initially
            # Actually, previous_value being None in CloudTag implies it didn't exist, 
            # while an empty string implies it existed but was empty.
            if expected_prev is not None:
                tag_existed = True
                
            resources_map[resource.id]["changes"].append({
                "change_id": change.id,
                "tag_key": change.tag_key,
                "tag_existed_before": tag_existed,
                "expected_previous_value": expected_prev,
                "proposed_value": change.approved_value or change.proposed_value
            })

        resources_list = list(resources_map.values())

        manifest = {
            "job_id": job_id,
            "provider": provider.value,
            "generated_at": datetime.datetime.utcnow().isoformat() + "Z",
            "script_version": ScriptGeneratorService.SCRIPT_VERSION,
            "resources": resources_list
        }
        
        # Append hash to the manifest root
        manifest["manifest_hash"] = ScriptGeneratorService._hash_manifest(manifest)
        return manifest

    @staticmethod
    def generate_apply_job(
        db: Session, 
        user_id: int, 
        provider: CloudProvider, 
        account_id_filter: str = None
    ) -> ScriptJob:
        
        # We need to query eligible APPROVED changes atomically.
        # Eligibility: status == APPROVED and provider matches and not already in an active ScriptJob.
        # Since we use MySQL/Postgres in typical prod, FOR UPDATE SKIP LOCKED is best, 
        # but SQLAlchemy doesn't support SKIP LOCKED universally on all dialects in basic form.
        # We'll use a direct lock or standard with_for_update.
        
        query = db.query(TaggingChange, Resource, CloudAccount)\
            .join(Resource, TaggingChange.resource_id == Resource.id)\
            .join(CloudAccount, Resource.cloud_account_id == CloudAccount.id)\
            .outerjoin(ScriptJobChange, TaggingChange.id == ScriptJobChange.change_id)\
            .filter(
                TaggingChange.status == ChangeStatus.APPROVED,
                CloudAccount.cloud == provider,
                ScriptJobChange.id == None # Not associated with any job yet (or we could filter by active jobs)
            )
            
        if account_id_filter:
            query = query.filter(CloudAccount.account_identifier == account_id_filter)
            
        # Lock rows
        eligible_rows = query.with_for_update(skip_locked=True).all()
        
        if not eligible_rows:
            raise HTTPException(status_code=400, detail="No eligible approved changes found for generation.")
            
        # Create Job ID
        job_id_str = f"JOB-{provider.value}-{uuid.uuid4().hex[:8].upper()}"
        
        # Build Manifest
        manifest = ScriptGeneratorService._build_manifest(job_id_str, provider, eligible_rows)
        manifest_hash = manifest["manifest_hash"]
        
        # Ingestion Token
        token = generate_ingestion_token(job_id_str)
        token_hash = hashlib.sha256(token.encode('utf-8')).hexdigest()
        
        # Create ScriptJob
        new_job = ScriptJob(
            job_id=job_id_str,
            cloud=provider,
            script_type=ScriptType.APPLY,
            status=JobStatus.GENERATED,
            script_version=ScriptGeneratorService.SCRIPT_VERSION,
            manifest_hash=manifest_hash,
            ingestion_token_hash=token_hash,
            created_by=user_id
        )
        db.add(new_job)
        db.flush() # Get new_job.id
        
        # Create ScriptJobChange associations and update TaggingChange status
        for change, _, _ in eligible_rows:
            assoc = ScriptJobChange(job_id=new_job.id, change_id=change.id)
            db.add(assoc)
            change.status = ChangeStatus.SCRIPT_GENERATED
            
        db.commit()
        db.refresh(new_job)
        
        return new_job, manifest, token

    @staticmethod
    def generate_script_package(manifest: dict, token: str) -> io.BytesIO:
        """
        Creates a ZIP in-memory containing the manifest.json and the apply scripts.
        """
        zip_buffer = io.BytesIO()
        
        provider = manifest.get("provider")
        
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            # Add manifest
            zf.writestr("manifest.json", json.dumps(manifest, indent=2))
            
            # Add README with token instruction
            readme_content = (
                f"# CloudTag Script Job: {manifest['job_id']}\n\n"
                "## Execution Instructions\n"
                "This script expects you to be authenticated in your terminal.\n\n"
                f"**Ingestion Token**: `{token}`\n\n"
                "Do NOT share this token. It will expire in 2 hours.\n"
                "Pass this token when prompted or as an environment variable `CLOUDTAG_TOKEN`."
            )
            zf.writestr("README.md", readme_content)
            
            # Add Scripts
            if provider == "AWS":
                import os
                # We will write the AWS templates here
                zf.writestr("apply.sh", ScriptGeneratorService.get_aws_apply_script())
            elif provider == "AZURE":
                zf.writestr("apply.ps1", ScriptGeneratorService.get_azure_apply_script())
                
        zip_buffer.seek(0)
        return zip_buffer

    @staticmethod
    def get_aws_apply_script() -> str:
        return """#!/bin/bash
# CloudTag V1 - AWS Apply Script
set -e

MANIFEST_FILE="manifest.json"
if [ ! -f "$MANIFEST_FILE" ]; then
    echo "ERROR: manifest.json not found."
    exit 1
fi

if [ -z "$CLOUDTAG_TOKEN" ]; then
    read -p "Enter Ingestion Token: " CLOUDTAG_TOKEN
fi

# We use Python locally for robust canonical JSON hashing and API verification.
python3 -c '
import json, sys, os, urllib.request, hashlib, subprocess

token = os.environ.get("CLOUDTAG_TOKEN", "")

try:
    with open("manifest.json") as f:
        manifest = json.load(f)
except Exception as e:
    print(f"ERROR: Failed to load manifest: {e}")
    sys.exit(1)

job_id = manifest.get("job_id")

# Calculate Canonical Hash (remove manifest_hash before hashing)
original_hash = manifest.pop("manifest_hash", None)
canonical_str = json.dumps(manifest, sort_keys=True, separators=(",", ":"))
computed_hash = hashlib.sha256(canonical_str.encode("utf-8")).hexdigest()

print("Verifying manifest integrity with server...")
# Pre-flight verify API call
api_base = os.environ.get("API_BASE_URL", "http://localhost:8000")
try:
    req = urllib.request.Request(f"{api_base}/api/admin/scripts/{job_id}/verify")
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", "application/json")
    data = json.dumps({"manifest_hash": computed_hash}).encode("utf-8")
    resp = urllib.request.urlopen(req, data=data)
    if resp.status != 200:
        raise Exception("Invalid response")
    print("Integrity verification SUCCESS.")
except Exception as e:
    print(f"ERROR: Manifest verification failed: {e}")
    sys.exit(1)

# Verification passed, re-add hash for downstream processing if needed
manifest["manifest_hash"] = original_hash

print("Authenticating via AWS CLI...")
try:
    current_account = subprocess.check_output(["aws", "sts", "get-caller-identity", "--query", "Account", "--output", "text"], text=True).strip()
    if not current_account: raise Exception()
    print(f"Active AWS Account: {current_account}")
except:
    print("ERROR: Failed to get AWS identity. Please log in.")
    sys.exit(1)

manifest_hash = manifest.get("manifest_hash")
script_version = manifest.get("script_version")

results = []

def report_results():
    payload = {
        "manifest_hash": manifest_hash,
        "script_version": script_version,
        "results": results
    }
    # Ingestion will happen here via curl/urllib...
    pass

for res in manifest.get("resources", []):
    resource_id = res.get("resource_id")
    expected_account = res.get("account_id")
    expected_region = res.get("region")
    
    # 1. Context validation
    if str(expected_account) != str(current_account):
        print(f"[{resource_id}] SKIP - CONTEXT_MISMATCH")
        for chg in res.get("changes", []):
            results.append({
                "change_id": chg["change_id"],
                "result": "FAILED",
                "reason_code": "CONTEXT_MISMATCH"
            })
        continue
        
    # 2. Read current tags
    try:
        tag_out = subprocess.check_output(
            ["aws", "resourcegroupstaggingapi", "get-resources", "--resource-arn-list", resource_id, "--region", str(expected_region), "--output", "json"], 
            text=True
        )
        tag_data = json.loads(tag_out)
        
        resource_tag_list = tag_data.get("ResourceTagMappingList", [])
        if not resource_tag_list:
            print(f"[{resource_id}] SKIP - RESOURCE_NOT_FOUND")
            for chg in res.get("changes", []):
                results.append({"change_id": chg["change_id"], "result": "SKIPPED", "reason_code": "RESOURCE_NOT_FOUND"})
            continue
            
        current_tags_array = resource_tag_list[0].get("Tags", [])
        current_tags = { t["Key"]: t["Value"] for t in current_tags_array }
        
    except Exception as e:
        print(f"[{resource_id}] FAILED - READ_FAILED")
        for chg in res.get("changes", []):
            results.append({"change_id": chg["change_id"], "result": "FAILED", "reason_code": "READ_FAILED"})
        continue

    # 3. Validate Preconditions
    safe = True
    for chg in res.get("changes", []):
        tag_key = chg["tag_key"]
        expected_prev = chg["expected_previous_value"]
        tag_existed = chg["tag_existed_before"]
        
        current_val = current_tags.get(tag_key)
        currently_exists = tag_key in current_tags
        
        if currently_exists and not tag_existed:
            print(f"[{resource_id}] SKIP - TAG_CREATED_EXTERNALLY ({tag_key})")
            safe = False
            for c in res.get("changes", []):
                results.append({"change_id": c["change_id"], "result": "SKIPPED", "reason_code": "TAG_CREATED_EXTERNALLY"})
            break
            
        if not currently_exists and tag_existed:
            print(f"[{resource_id}] SKIP - TAG_DELETED_EXTERNALLY ({tag_key})")
            safe = False
            for c in res.get("changes", []):
                results.append({"change_id": c["change_id"], "result": "SKIPPED", "reason_code": "TAG_DELETED_EXTERNALLY"})
            break
            
        if tag_existed and (current_val != expected_prev):
            if current_val == chg["proposed_value"]:
                print(f"[{resource_id}] SKIP - ALREADY_MATCHES_PROPOSED ({tag_key})")
                safe = False
                for c in res.get("changes", []):
                    results.append({"change_id": c["change_id"], "result": "SKIPPED", "reason_code": "ALREADY_MATCHES_PROPOSED"})
                break
            else:
                print(f"[{resource_id}] SKIP - CURRENT_VALUE_CHANGED ({tag_key})")
                safe = False
                for c in res.get("changes", []):
                    results.append({"change_id": c["change_id"], "result": "SKIPPED", "reason_code": "CURRENT_VALUE_CHANGED"})
                break
                
    if not safe:
        continue
        
    # 4. Write Phase
    tags_to_apply = []
    for chg in res.get("changes", []):
        tags_to_apply.append(f"{chg[\\"tag_key\\"]}={chg[\\"proposed_value\\"]}")
        
    try:
        subprocess.check_call([
            "aws", "resourcegroupstaggingapi", "tag-resources", 
            "--resource-arn-list", resource_id, 
            "--region", str(expected_region),
            "--tags", ",".join(tags_to_apply)
        ])
        
        print(f"[{resource_id}] SUCCESS")
        for chg in res.get("changes", []):
            results.append({
                "change_id": chg["change_id"],
                "result": "SUCCESS",
                "reason_code": "SUCCESS",
                "actual_value_before": chg["expected_previous_value"],
                "actual_value_after": chg["proposed_value"]
            })
    except Exception as e:
        print(f"[{resource_id}] FAILED - WRITE_FAILED")
        for chg in res.get("changes", []):
            results.append({"change_id": chg["change_id"], "result": "FAILED", "reason_code": "WRITE_FAILED"})

print("Execution complete. Ready to ingest results.")
'
"""

    @staticmethod
    def get_azure_apply_script() -> str:
        return """<#
CloudTag V1 - Azure Apply Script
#>
$ErrorActionPreference = "Stop"

$ManifestPath = "manifest.json"
if (-Not (Test-Path $ManifestPath)) {
    Write-Error "ERROR: manifest.json not found."
    exit 1
}

$Token = $env:CLOUDTAG_TOKEN
if (-Not $Token) {
    $Token = Read-Host "Enter Ingestion Token"
}

# Load manifest and calculate canonical hash
$ManifestJson = Get-Content $ManifestPath -Raw
$Manifest = $ManifestJson | ConvertFrom-Json

$JobId = $Manifest.job_id
$OriginalHash = $Manifest.manifest_hash

# Remove manifest_hash for canonical generation (must match server exactly)
# PowerShell ConvertTo-Json uses different spacing than Python's sort_keys/separators.
# Since PS JSON serialization might slightly differ, we MUST ensure exact byte match.
# An alternative is we parse and re-serialize using a Python-compatible standard:
# We'll use a small python snippet if available, or build canonical JSON manually.
# For maximum safety in this CloudTag PS snippet, we call a quick inline python command 
# because PowerShell's ConvertTo-Json can be unpredictable across versions.
$PythonHashCmd = @"
import json, hashlib
with open('manifest.json') as f: m = json.load(f)
m.pop('manifest_hash', None)
c = json.dumps(m, sort_keys=True, separators=(',', ':'))
print(hashlib.sha256(c.encode('utf-8')).hexdigest())
"@
try {
    $ComputedHash = (python3 -c $PythonHashCmd).Trim()
} catch {
    Write-Error "ERROR: Failed to compute canonical hash locally."
    exit 1
}

Write-Host "Verifying manifest integrity with server..."
$ApiBase = if ($env:API_BASE_URL) { $env:API_BASE_URL } else { "http://localhost:8000" }
$VerifyUrl = "$ApiBase/api/admin/scripts/$JobId/verify"
$VerifyBody = @{ manifest_hash = $ComputedHash } | ConvertTo-Json -Compress

try {
    $Resp = Invoke-RestMethod -Uri $VerifyUrl -Method Post -Headers @{
        "Authorization" = "Bearer $Token"
        "Content-Type"  = "application/json"
    } -Body $VerifyBody
    Write-Host "Integrity verification SUCCESS."
} catch {
    Write-Error "ERROR: Manifest verification failed. Tampering detected or server unreachable."
    exit 1
}

Write-Host "Checking Azure Context..."
$context = Get-AzContext
if (-Not $context) {
    Write-Error "Not logged in to Azure. Please run Connect-AzAccount."
    exit 1
}

$CurrentSub = $context.Subscription.Id
Write-Host "Active Subscription: $CurrentSub"

$Results = @()

foreach ($res in $Manifest.resources) {
    $ResourceId = $res.resource_id
    $ExpectedSub = $res.account_id
    
    if ($ExpectedSub -ne $CurrentSub) {
        Write-Host "[$ResourceId] SKIP - CONTEXT_MISMATCH"
        foreach ($c in $res.changes) {
            $Results += @{ change_id = $c.change_id; result = "FAILED"; reason_code = "CONTEXT_MISMATCH" }
        }
        continue
    }
    
    try {
        $Resource = Get-AzResource -ResourceId $ResourceId -ErrorAction Stop
        $CurrentTags = $Resource.Tags
        if ($null -eq $CurrentTags) {
            $CurrentTags = @{}
        }
    } catch {
        Write-Host "[$ResourceId] SKIP - RESOURCE_NOT_FOUND or READ_FAILED"
        foreach ($c in $res.changes) {
            $Results += @{ change_id = $c.change_id; result = "SKIPPED"; reason_code = "RESOURCE_NOT_FOUND" }
        }
        continue
    }
    
    $IsSafe = $true
    foreach ($c in $res.changes) {
        $Key = $c.tag_key
        $ExpectedPrev = $c.expected_previous_value
        $TagExisted = $c.tag_existed_before
        
        $CurrentlyExists = $CurrentTags.ContainsKey($Key)
        $CurrentVal = if ($CurrentlyExists) { $CurrentTags[$Key] } else { $null }
        
        if ($CurrentlyExists -and -not $TagExisted) {
            Write-Host "[$ResourceId] SKIP - TAG_CREATED_EXTERNALLY ($Key)"
            $IsSafe = $false; break
        }
        if (-not $CurrentlyExists -and $TagExisted) {
            Write-Host "[$ResourceId] SKIP - TAG_DELETED_EXTERNALLY ($Key)"
            $IsSafe = $false; break
        }
        if ($TagExisted -and ($CurrentVal -ne $ExpectedPrev)) {
            if ($CurrentVal -eq $c.proposed_value) {
                Write-Host "[$ResourceId] SKIP - ALREADY_MATCHES_PROPOSED ($Key)"
                $IsSafe = $false; break
            } else {
                Write-Host "[$ResourceId] SKIP - CURRENT_VALUE_CHANGED ($Key)"
                $IsSafe = $false; break
            }
        }
    }
    
    if (-Not $IsSafe) {
        # Loop above could be smarter about which failure we hit, but we'll assign a generic skip if not set
        # In a full implementation, we'd assign the exact reason. 
        # For brevity in V1:
        foreach ($c in $res.changes) {
            $Results += @{ change_id = $c.change_id; result = "SKIPPED"; reason_code = "PRECONDITION_FAILED" }
        }
        continue
    }
    
    $TagsToApply = @{}
    foreach ($c in $res.changes) {
        $TagsToApply[$c.tag_key] = $c.proposed_value
    }
    
    try {
        Update-AzTag -ResourceId $ResourceId -Tag $TagsToApply -Operation Merge -ErrorAction Stop | Out-Null
        Write-Host "[$ResourceId] SUCCESS"
        
        foreach ($c in $res.changes) {
            $Results += @{ 
                change_id = $c.change_id; 
                result = "SUCCESS"; 
                reason_code = "SUCCESS";
                actual_value_before = $c.expected_previous_value;
                actual_value_after = $c.proposed_value
            }
        }
    } catch {
        Write-Host "[$ResourceId] FAILED - WRITE_FAILED"
        foreach ($c in $res.changes) {
            $Results += @{ change_id = $c.change_id; result = "FAILED"; reason_code = "WRITE_FAILED" }
        }
    }
}

Write-Host "Execution complete. Results ready for ingestion."
"""
