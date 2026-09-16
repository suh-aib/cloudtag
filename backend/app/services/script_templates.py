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

original_hash = manifest.pop("manifest_hash", None)
canonical_str = json.dumps(manifest, sort_keys=True, separators=(",", ":"))
computed_hash = hashlib.sha256(canonical_str.encode("utf-8")).hexdigest()

print("Verifying manifest integrity with server...")
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

manifest["manifest_hash"] = original_hash

print("Authenticating via AWS CLI...")
try:
    current_account = subprocess.check_output(["aws", "sts", "get-caller-identity", "--query", "Account", "--output", "text"], text=True).strip()
    if not current_account: raise Exception()
    print(f"Active AWS Account: {current_account}")
except:
    print("ERROR: Failed to get AWS identity. Please log in.")
    sys.exit(1)

results = []

for res in manifest.get("resources", []):
    resource_id = res.get("resource_id")
    expected_account = res.get("account_id")
    expected_region = res.get("region")
    
    if str(expected_account) != str(current_account):
        print(f"[{resource_id}] SKIP - CONTEXT_MISMATCH")
        for chg in res.get("changes", []):
            if chg.get("change_id"):
                results.append({"change_id": chg["change_id"], "result": "FAILED", "reason_code": "CONTEXT_MISMATCH"})
        continue
        
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
                if chg.get("change_id"):
                    results.append({"change_id": chg["change_id"], "result": "SKIPPED", "reason_code": "RESOURCE_NOT_FOUND"})
            continue
            
        current_tags_array = resource_tag_list[0].get("Tags", [])
        current_tags = { t["Key"]: t["Value"] for t in current_tags_array }
        
    except Exception as e:
        print(f"[{resource_id}] FAILED - READ_FAILED")
        for chg in res.get("changes", []):
            if chg.get("change_id"):
                results.append({"change_id": chg["change_id"], "result": "FAILED", "reason_code": "READ_FAILED"})
        continue

    safe = True
    for chg in res.get("changes", []):
        tag_key = chg["key"]
        expected_prev = chg["before"]
        
        currently_exists = tag_key in current_tags
        current_val = current_tags.get(tag_key)
        
        # Check before state
        if expected_prev is None:
            if currently_exists:
                print(f"[{resource_id}] SKIP - CURRENT_VALUE_CHANGED ({tag_key} expected NOT SET but was {current_val})")
                safe = False
                break
        else:
            if not currently_exists:
                print(f"[{resource_id}] SKIP - CURRENT_VALUE_CHANGED ({tag_key} expected {expected_prev} but was NOT SET)")
                safe = False
                break
            if current_val != expected_prev:
                print(f"[{resource_id}] SKIP - CURRENT_VALUE_CHANGED ({tag_key} expected {expected_prev} but was {current_val})")
                safe = False
                break
                
    if not safe:
        for c in res.get("changes", []):
            if c.get("change_id"):
                results.append({"change_id": c["change_id"], "result": "SKIPPED", "reason_code": "CURRENT_VALUE_CHANGED"})
        continue
        
    tags_to_add_change = []
    keys_to_remove = []
    
    for chg in res.get("changes", []):
        action = chg.get("action")
        if action in ["ADD", "CHANGE"]:
            tags_to_add_change.append(f"{chg[\\"key\\"]}={chg[\\"after\\"]}")
        elif action == "REMOVE":
            keys_to_remove.append(chg["key"])
        # PRESERVE -> NO OPERATION

    try:
        if tags_to_add_change:
            subprocess.check_call([
                "aws", "resourcegroupstaggingapi", "tag-resources", 
                "--resource-arn-list", resource_id, 
                "--region", str(expected_region),
                "--tags", ",".join(tags_to_add_change)
            ])
            
        if keys_to_remove:
            subprocess.check_call([
                "aws", "resourcegroupstaggingapi", "untag-resources", 
                "--resource-arn-list", resource_id, 
                "--region", str(expected_region),
                "--tag-keys", ",".join(keys_to_remove)
            ])
        
        print(f"[{resource_id}] SUCCESS")
        for chg in res.get("changes", []):
            if chg.get("change_id"):
                results.append({
                    "change_id": chg["change_id"],
                    "result": "SUCCESS",
                    "reason_code": "SUCCESS",
                    "actual_value_before": chg["before"],
                    "actual_value_after": chg["after"]
                })
    except Exception as e:
        print(f"[{resource_id}] FAILED - WRITE_FAILED")
        for chg in res.get("changes", []):
            if chg.get("change_id"):
                results.append({"change_id": chg["change_id"], "result": "FAILED", "reason_code": "WRITE_FAILED"})

print("Execution complete. Ready to ingest results.")
'
"""

def get_aws_revert_script() -> str:
    return """#!/bin/bash
# CloudTag V1 - AWS Revert Script
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
original_hash = manifest.pop("manifest_hash", None)
canonical_str = json.dumps(manifest, sort_keys=True, separators=(",", ":"))
computed_hash = hashlib.sha256(canonical_str.encode("utf-8")).hexdigest()

print("Verifying manifest integrity with server...")
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

manifest["manifest_hash"] = original_hash

print("Authenticating via AWS CLI...")
try:
    current_account = subprocess.check_output(["aws", "sts", "get-caller-identity", "--query", "Account", "--output", "text"], text=True).strip()
    if not current_account: raise Exception()
    print(f"Active AWS Account: {current_account}")
except:
    print("ERROR: Failed to get AWS identity. Please log in.")
    sys.exit(1)

results = []

for res in manifest.get("resources", []):
    resource_id = res.get("resource_id")
    expected_account = res.get("account_id")
    expected_region = res.get("region")
    
    if str(expected_account) != str(current_account):
        print(f"[{resource_id}] SKIP - CONTEXT_MISMATCH")
        for chg in res.get("changes", []):
            if chg.get("change_id"):
                results.append({"change_id": chg["change_id"], "result": "FAILED", "reason_code": "CONTEXT_MISMATCH"})
        continue
        
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
                if chg.get("change_id"):
                    results.append({"change_id": chg["change_id"], "result": "SKIPPED", "reason_code": "RESOURCE_NOT_FOUND"})
            continue
            
        current_tags_array = resource_tag_list[0].get("Tags", [])
        current_tags = { t["Key"]: t["Value"] for t in current_tags_array }
        
    except Exception as e:
        print(f"[{resource_id}] FAILED - READ_FAILED")
        for chg in res.get("changes", []):
            if chg.get("change_id"):
                results.append({"change_id": chg["change_id"], "result": "FAILED", "reason_code": "READ_FAILED"})
        continue

    safe = True
    for chg in res.get("changes", []):
        tag_key = chg["key"]
        expected_after = chg["after"] # The value that was supposed to be APPLIED
        
        currently_exists = tag_key in current_tags
        current_val = current_tags.get(tag_key)
        
        # Check after state
        if expected_after is None:
            if currently_exists:
                print(f"[{resource_id}] SKIP - CURRENT_VALUE_CHANGED ({tag_key} expected NOT SET but was {current_val})")
                safe = False
                break
        else:
            if not currently_exists:
                print(f"[{resource_id}] SKIP - CURRENT_VALUE_CHANGED ({tag_key} expected {expected_after} but was NOT SET)")
                safe = False
                break
            if current_val != expected_after:
                print(f"[{resource_id}] SKIP - CURRENT_VALUE_CHANGED ({tag_key} expected {expected_after} but was {current_val})")
                safe = False
                break
                
    if not safe:
        for c in res.get("changes", []):
            if c.get("change_id"):
                results.append({"change_id": c["change_id"], "result": "SKIPPED", "reason_code": "CURRENT_VALUE_CHANGED"})
        continue
        
    tags_to_add_change = []
    keys_to_remove = []
    
    # REVERT logic
    for chg in res.get("changes", []):
        action = chg.get("action")
        if action == "ADD":
            keys_to_remove.append(chg["key"])
        elif action == "CHANGE":
            tags_to_add_change.append(f"{chg[\\"key\\"]}={chg[\\"before\\"]}")
        elif action == "REMOVE":
            tags_to_add_change.append(f"{chg[\\"key\\"]}={chg[\\"before\\"]}")
        # PRESERVE -> NO OPERATION

    try:
        if tags_to_add_change:
            subprocess.check_call([
                "aws", "resourcegroupstaggingapi", "tag-resources", 
                "--resource-arn-list", resource_id, 
                "--region", str(expected_region),
                "--tags", ",".join(tags_to_add_change)
            ])
            
        if keys_to_remove:
            subprocess.check_call([
                "aws", "resourcegroupstaggingapi", "untag-resources", 
                "--resource-arn-list", resource_id, 
                "--region", str(expected_region),
                "--tag-keys", ",".join(keys_to_remove)
            ])
        
        print(f"[{resource_id}] SUCCESS REVERT")
        for chg in res.get("changes", []):
            if chg.get("change_id"):
                results.append({
                    "change_id": chg["change_id"],
                    "result": "SUCCESS",
                    "reason_code": "SUCCESS",
                    "actual_value_before": chg["after"],
                    "actual_value_after": chg["before"]
                })
    except Exception as e:
        print(f"[{resource_id}] FAILED - WRITE_FAILED")
        for chg in res.get("changes", []):
            if chg.get("change_id"):
                results.append({"change_id": chg["change_id"], "result": "FAILED", "reason_code": "WRITE_FAILED"})

print("Execution complete. Ready to ingest results.")
'
"""

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

$ManifestJson = Get-Content $ManifestPath -Raw
$Manifest = $ManifestJson | ConvertFrom-Json

$JobId = $Manifest.job_id
$OriginalHash = $Manifest.manifest_hash

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
            if ($c.change_id) { $Results += @{ change_id = $c.change_id; result = "FAILED"; reason_code = "CONTEXT_MISMATCH" } }
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
            if ($c.change_id) { $Results += @{ change_id = $c.change_id; result = "SKIPPED"; reason_code = "RESOURCE_NOT_FOUND" } }
        }
        continue
    }
    
    $IsSafe = $true
    foreach ($c in $res.changes) {
        $Key = $c.key
        $ExpectedPrev = $c.before
        
        $CurrentlyExists = $CurrentTags.ContainsKey($Key)
        $CurrentVal = if ($CurrentlyExists) { $CurrentTags[$Key] } else { $null }
        
        if ($null -eq $ExpectedPrev) {
            if ($CurrentlyExists) {
                Write-Host "[$ResourceId] SKIP - CURRENT_VALUE_CHANGED ($Key expected NOT SET but was $CurrentVal)"
                $IsSafe = $false; break
            }
        } else {
            if (-not $CurrentlyExists) {
                Write-Host "[$ResourceId] SKIP - CURRENT_VALUE_CHANGED ($Key expected $ExpectedPrev but was NOT SET)"
                $IsSafe = $false; break
            }
            if ($CurrentVal -ne $ExpectedPrev) {
                Write-Host "[$ResourceId] SKIP - CURRENT_VALUE_CHANGED ($Key expected $ExpectedPrev but was $CurrentVal)"
                $IsSafe = $false; break
            }
        }
    }
    
    if (-Not $IsSafe) {
        foreach ($c in $res.changes) {
            if ($c.change_id) { $Results += @{ change_id = $c.change_id; result = "SKIPPED"; reason_code = "CURRENT_VALUE_CHANGED" } }
        }
        continue
    }
    
    $TagsToApply = @{}
    $KeysToRemove = @()
    foreach ($c in $res.changes) {
        if ($c.action -in @("ADD", "CHANGE")) {
            $TagsToApply[$c.key] = $c.after
        } elseif ($c.action -eq "REMOVE") {
            $KeysToRemove += $c.key
        }
        # PRESERVE -> NO OPERATION
    }
    
    try {
        if ($TagsToApply.Count -gt 0) {
            Update-AzTag -ResourceId $ResourceId -Tag $TagsToApply -Operation Merge -ErrorAction Stop | Out-Null
        }
        
        if ($KeysToRemove.Count -gt 0) {
            $TagsToDelete = @{}
            foreach ($k in $KeysToRemove) { $TagsToDelete[$k] = "" }
            Update-AzTag -ResourceId $ResourceId -Tag $TagsToDelete -Operation Delete -ErrorAction Stop | Out-Null
        }
        
        Write-Host "[$ResourceId] SUCCESS"
        
        foreach ($c in $res.changes) {
            if ($c.change_id) {
                $Results += @{ 
                    change_id = $c.change_id; 
                    result = "SUCCESS"; 
                    reason_code = "SUCCESS";
                    actual_value_before = $c.before;
                    actual_value_after = $c.after
                }
            }
        }
    } catch {
        Write-Host "[$ResourceId] FAILED - WRITE_FAILED"
        foreach ($c in $res.changes) {
            if ($c.change_id) { $Results += @{ change_id = $c.change_id; result = "FAILED"; reason_code = "WRITE_FAILED" } }
        }
    }
}

Write-Host "Execution complete. Results ready for ingestion."
"""

def get_azure_revert_script() -> str:
    return """<#
CloudTag V1 - Azure Revert Script
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

$ManifestJson = Get-Content $ManifestPath -Raw
$Manifest = $ManifestJson | ConvertFrom-Json

$JobId = $Manifest.job_id
$OriginalHash = $Manifest.manifest_hash

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
            if ($c.change_id) { $Results += @{ change_id = $c.change_id; result = "FAILED"; reason_code = "CONTEXT_MISMATCH" } }
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
            if ($c.change_id) { $Results += @{ change_id = $c.change_id; result = "SKIPPED"; reason_code = "RESOURCE_NOT_FOUND" } }
        }
        continue
    }
    
    $IsSafe = $true
    foreach ($c in $res.changes) {
        $Key = $c.key
        $ExpectedAfter = $c.after
        
        $CurrentlyExists = $CurrentTags.ContainsKey($Key)
        $CurrentVal = if ($CurrentlyExists) { $CurrentTags[$Key] } else { $null }
        
        if ($null -eq $ExpectedAfter) {
            if ($CurrentlyExists) {
                Write-Host "[$ResourceId] SKIP - CURRENT_VALUE_CHANGED ($Key expected NOT SET but was $CurrentVal)"
                $IsSafe = $false; break
            }
        } else {
            if (-not $CurrentlyExists) {
                Write-Host "[$ResourceId] SKIP - CURRENT_VALUE_CHANGED ($Key expected $ExpectedAfter but was NOT SET)"
                $IsSafe = $false; break
            }
            if ($CurrentVal -ne $ExpectedAfter) {
                Write-Host "[$ResourceId] SKIP - CURRENT_VALUE_CHANGED ($Key expected $ExpectedAfter but was $CurrentVal)"
                $IsSafe = $false; break
            }
        }
    }
    
    if (-Not $IsSafe) {
        foreach ($c in $res.changes) {
            if ($c.change_id) { $Results += @{ change_id = $c.change_id; result = "SKIPPED"; reason_code = "CURRENT_VALUE_CHANGED" } }
        }
        continue
    }
    
    $TagsToApply = @{}
    $KeysToRemove = @()
    foreach ($c in $res.changes) {
        if ($c.action -eq "ADD") {
            $KeysToRemove += $c.key
        } elseif ($c.action -in @("CHANGE", "REMOVE")) {
            $TagsToApply[$c.key] = $c.before
        }
        # PRESERVE -> NO OPERATION
    }
    
    try {
        if ($TagsToApply.Count -gt 0) {
            Update-AzTag -ResourceId $ResourceId -Tag $TagsToApply -Operation Merge -ErrorAction Stop | Out-Null
        }
        
        if ($KeysToRemove.Count -gt 0) {
            $TagsToDelete = @{}
            foreach ($k in $KeysToRemove) { $TagsToDelete[$k] = "" }
            Update-AzTag -ResourceId $ResourceId -Tag $TagsToDelete -Operation Delete -ErrorAction Stop | Out-Null
        }
        
        Write-Host "[$ResourceId] SUCCESS REVERT"
        
        foreach ($c in $res.changes) {
            if ($c.change_id) {
                $Results += @{ 
                    change_id = $c.change_id; 
                    result = "SUCCESS"; 
                    reason_code = "SUCCESS";
                    actual_value_before = $c.after;
                    actual_value_after = $c.before
                }
            }
        }
    } catch {
        Write-Host "[$ResourceId] FAILED - WRITE_FAILED"
        foreach ($c in $res.changes) {
            if ($c.change_id) { $Results += @{ change_id = $c.change_id; result = "FAILED"; reason_code = "WRITE_FAILED" } }
        }
    }
}

Write-Host "Execution complete. Results ready for ingestion."
"""
