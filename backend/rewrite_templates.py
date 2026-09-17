import json

def generate_script_templates_code():
    code = """import json
from app.models.cloud import CloudProvider

def get_aws_apply_script(manifest: dict) -> str:
    job_id = manifest.get("job_id", "UNKNOWN")
    lines = [
        "#!/usr/bin/env bash",
        f"# CloudTag V1 - AWS Apply Script",
        f"# Job: {job_id}",
        "",
        "set -u",
        "set -o pipefail",
        "",
        "echo 'Authenticating via AWS CLI...'",
        "CURRENT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo '')",
        "if [ -z \\"$CURRENT_ACCOUNT\\" ]; then",
        "    echo 'ERROR: Failed to get AWS identity. Please log in.'",
        "    exit 1",
        "fi",
        "echo \\"Active AWS Account: $CURRENT_ACCOUNT\\"",
        ""
    ]
    
    if manifest.get("resources"):
        expected_account = manifest["resources"][0].get("account_id")
        lines.extend([
            f"EXPECTED_ACCOUNT='{expected_account}'",
            "if [ \\"$EXPECTED_ACCOUNT\\" != \\"$CURRENT_ACCOUNT\\" ]; then",
            "    echo 'TARGET_ACCOUNT_MISMATCH'",
            "    exit 1",
            "fi",
            ""
        ])
        
    lines.extend([
        "TOTAL=0",
        "SUCCESS_COUNT=0",
        "SKIPPED_CURRENT_VALUE_CHANGED=0",
        "FAILED_PRECHECK=0",
        "FAILED_WRITE=0",
        "FAILED_POST_VERIFY=0",
        "PRESERVED_NO_OP=0",
        "ADD_COUNT=0",
        "CHANGE_COUNT=0",
        "REMOVE_COUNT=0",
        "PRESERVE_COUNT=0",
        ""
    ])
    
    for idx, res in enumerate(manifest.get("resources", [])):
        rid = res.get("resource_id")
        expected_region = res.get("region")
        res_type = res.get("resource_type")
        
        func_name = f"process_resource_{idx}"
        lines.append(f"{func_name}() {{")
        lines.append(f"    echo '--------------------------------------------------'")
        lines.append(f"    echo 'Processing Resource: {rid}'")
        lines.append(f"    echo 'Region: {expected_region}'")
        lines.append(f"    TOTAL=$((TOTAL + 1))")
        
        lines.append(f"    TAG_OUT=''")
        lines.append(f"    if [ \\"{res_type}\\" = \\"ec2/instance\\" ]; then")
        lines.append(f"        INSTANCE_ID=$(echo '{rid}' | awk -F'/' '{{print $2}}')")
        lines.append(f"        aws ec2 describe-instances --instance-ids \\"$INSTANCE_ID\\" --region '{expected_region}' >/dev/null 2>&1")
        lines.append(f"        if [ $? -ne 0 ]; then")
        lines.append(f"            echo 'FAILED_PRECHECK: Resource does not exist or read failed'")
        lines.append(f"            FAILED_PRECHECK=$((FAILED_PRECHECK + 1))")
        lines.append(f"            return")
        lines.append(f"        fi")
        lines.append(f"        TAG_OUT=$(aws ec2 describe-tags --filters \\"Name=resource-id,Values=$INSTANCE_ID\\" --region '{expected_region}' --output json 2>/dev/null)")
        lines.append(f"        if [ $? -ne 0 ]; then")
        lines.append(f"            echo 'FAILED_PRECHECK: AWS CLI returned exit code non-zero for tags'")
        lines.append(f"            FAILED_PRECHECK=$((FAILED_PRECHECK + 1))")
        lines.append(f"            return")
        lines.append(f"        fi")
        lines.append(f"    elif [ \\"{res_type}\\" = \\"events/rule\\" ]; then")
        lines.append(f"        RULE_NAME=$(echo '{rid}' | awk -F'rule/' '{{print $2}}')")
        lines.append(f"        aws events describe-rule --name \\"$RULE_NAME\\" --region '{expected_region}' >/dev/null 2>&1")
        lines.append(f"        if [ $? -ne 0 ]; then")
        lines.append(f"            echo 'FAILED_PRECHECK: Resource does not exist or read failed'")
        lines.append(f"            FAILED_PRECHECK=$((FAILED_PRECHECK + 1))")
        lines.append(f"            return")
        lines.append(f"        fi")
        lines.append(f"        TAG_OUT=$(aws events list-tags-for-resource --resource-arn '{rid}' --region '{expected_region}' --output json 2>/dev/null)")
        lines.append(f"        if [ $? -ne 0 ]; then")
        lines.append(f"            echo 'FAILED_PRECHECK: AWS CLI returned exit code non-zero for tags'")
        lines.append(f"            FAILED_PRECHECK=$((FAILED_PRECHECK + 1))")
        lines.append(f"            return")
        lines.append(f"        fi")
        lines.append(f"    else")
        lines.append(f"        echo 'FAILED_PRECHECK: UNSUPPORTED_STATE_READ'")
        lines.append(f"        FAILED_PRECHECK=$((FAILED_PRECHECK + 1))")
        lines.append(f"        return")
        lines.append(f"    fi")
        
        lines.append(f"    IS_SAFE=1")
        
        for chg in res.get("changes", []):
            k = chg.get("key")
            b = chg.get("before")
            
            lines.append(f"    CURRENT_VAL=$(python3 -c \\"")
            lines.append(f"import sys, json")
            lines.append(f"try:")
            lines.append(f"    data = json.loads(sys.stdin.read())")
            lines.append(f"    tags = data.get('Tags', [])")
            lines.append(f"    tag = next((t['Value'] for t in tags if t['Key'] == '{k}'), None)")
            lines.append(f"    if tag is None: print('NOT_SET')")
            lines.append(f"    else: print(tag)")
            lines.append(f"except:")
            lines.append(f"    print('JSON_ERROR')")
            lines.append(f"\\" <<< \\"$TAG_OUT\\")")
            
            lines.append(f"    if [ \\"$CURRENT_VAL\\" = 'JSON_ERROR' ]; then")
            lines.append(f"        echo 'FAILED_PRECHECK: Malformed JSON'")
            lines.append(f"        FAILED_PRECHECK=$((FAILED_PRECHECK + 1))")
            lines.append(f"        return")
            lines.append(f"    fi")
            
            if b == "NOT_SET" or b is None:
                lines.append(f"    if [ \\"$CURRENT_VAL\\" != 'NOT_SET' ]; then")
                lines.append(f"        echo 'SKIPPED_CURRENT_VALUE_CHANGED ({k} expected NOT_SET but was '$CURRENT_VAL')'")
                lines.append(f"        IS_SAFE=0")
                lines.append(f"    fi")
            else:
                lines.append(f"    if [ \\"$CURRENT_VAL\\" = 'NOT_SET' ]; then")
                lines.append(f"        echo 'SKIPPED_CURRENT_VALUE_CHANGED ({k} expected {b} but was NOT_SET)'")
                lines.append(f"        IS_SAFE=0")
                lines.append(f"    elif [ \\"$CURRENT_VAL\\" != '{b}' ]; then")
                lines.append(f"        echo 'SKIPPED_CURRENT_VALUE_CHANGED ({k} expected {b} but was '$CURRENT_VAL')'")
                lines.append(f"        IS_SAFE=0")
                lines.append(f"    fi")
                
        lines.append(f"    if [ \\"$IS_SAFE\\" -eq 0 ]; then")
        lines.append(f"        SKIPPED_CURRENT_VALUE_CHANGED=$((SKIPPED_CURRENT_VALUE_CHANGED + 1))")
        lines.append(f"        return")
        lines.append(f"    fi")
        
        tags_to_add = []
        keys_to_remove = []
        for chg in res.get("changes", []):
            action = chg.get("action")
            k = chg.get("key")
            a = chg.get("after")
            
            lines.append(f"    {action}_COUNT=$(({action}_COUNT + 1))")
            if action in ["ADD", "CHANGE"]:
                tags_to_add.append(f"Key={k},Value={a}")
            elif action == "REMOVE":
                keys_to_remove.append(f"{k}")
            elif action == "PRESERVE":
                lines.append(f"    PRESERVED_NO_OP=$((PRESERVED_NO_OP + 1))")
                lines.append(f"    echo 'PRESERVED_NO_OP | {k} | {a}'")
                
        lines.append(f"    WRITE_FAILED=0")
        
        if tags_to_add:
            joined_tags = " ".join(tags_to_add)
            lines.append(f"    if [ \\"{res_type}\\" = \\"ec2/instance\\" ]; then")
            lines.append(f"        aws ec2 create-tags --resources \\"$INSTANCE_ID\\" --tags {joined_tags} --region '{expected_region}' >/dev/null 2>&1")
            lines.append(f"        if [ $? -ne 0 ]; then WRITE_FAILED=1; fi")
            lines.append(f"    elif [ \\"{res_type}\\" = \\"events/rule\\" ]; then")
            lines.append(f"        aws events tag-resource --resource-arn '{rid}' --tags {joined_tags} --region '{expected_region}' >/dev/null 2>&1")
            lines.append(f"        if [ $? -ne 0 ]; then WRITE_FAILED=1; fi")
            lines.append(f"    fi")
            
        if keys_to_remove:
            lines.append(f"    if [ \\"{res_type}\\" = \\"ec2/instance\\" ]; then")
            joined_keys_ec2 = " ".join([f"Key={k}" for k in keys_to_remove])
            lines.append(f"        aws ec2 delete-tags --resources \\"$INSTANCE_ID\\" --tags {joined_keys_ec2} --region '{expected_region}' >/dev/null 2>&1")
            lines.append(f"        if [ $? -ne 0 ]; then WRITE_FAILED=1; fi")
            lines.append(f"    elif [ \\"{res_type}\\" = \\"events/rule\\" ]; then")
            joined_keys_events = " ".join([f"\\"{k}\\"" for k in keys_to_remove])
            lines.append(f"        aws events untag-resource --resource-arn '{rid}' --tag-keys {joined_keys_events} --region '{expected_region}' >/dev/null 2>&1")
            lines.append(f"        if [ $? -ne 0 ]; then WRITE_FAILED=1; fi")
            lines.append(f"    fi")
            
        lines.append(f"    if [ \\"$WRITE_FAILED\\" -eq 1 ]; then")
        lines.append(f"        echo 'FAILED_WRITE: API call failed'")
        lines.append(f"        FAILED_WRITE=$((FAILED_WRITE + 1))")
        lines.append(f"        return")
        lines.append(f"    fi")
        
        # Determine if any tag actually requires checking after. 
        # If there are only PRESERVE or REMOVE, we should still check.
        # However, if there are NO mutations (only PRESERVE), it's safe to check.
        
        lines.append(f"    TAG_OUT_POST=''")
        lines.append(f"    if [ \\"{res_type}\\" = \\"ec2/instance\\" ]; then")
        lines.append(f"        TAG_OUT_POST=$(aws ec2 describe-tags --filters \\"Name=resource-id,Values=$INSTANCE_ID\\" --region '{expected_region}' --output json 2>/dev/null)")
        lines.append(f"        if [ $? -ne 0 ]; then")
        lines.append(f"            echo 'FAILED_POST_VERIFY: Read API failed'")
        lines.append(f"            FAILED_POST_VERIFY=$((FAILED_POST_VERIFY + 1))")
        lines.append(f"            return")
        lines.append(f"        fi")
        lines.append(f"    elif [ \\"{res_type}\\" = \\"events/rule\\" ]; then")
        lines.append(f"        TAG_OUT_POST=$(aws events list-tags-for-resource --resource-arn '{rid}' --region '{expected_region}' --output json 2>/dev/null)")
        lines.append(f"        if [ $? -ne 0 ]; then")
        lines.append(f"            echo 'FAILED_POST_VERIFY: Read API failed'")
        lines.append(f"            FAILED_POST_VERIFY=$((FAILED_POST_VERIFY + 1))")
        lines.append(f"            return")
        lines.append(f"        fi")
        lines.append(f"    fi")
        
        lines.append(f"    VERIFY_SAFE=1")
        for chg in res.get("changes", []):
            k = chg.get("key")
            a = chg.get("after")
            
            lines.append(f"    POST_VAL=$(python3 -c \\"")
            lines.append(f"import sys, json")
            lines.append(f"try:")
            lines.append(f"    data = json.loads(sys.stdin.read())")
            lines.append(f"    tags = data.get('Tags', [])")
            lines.append(f"    tag = next((t['Value'] for t in tags if t['Key'] == '{k}'), None)")
            lines.append(f"    if tag is None: print('NOT_SET')")
            lines.append(f"    else: print(tag)")
            lines.append(f"except:")
            lines.append(f"    print('JSON_ERROR')")
            lines.append(f"\\" <<< \\"$TAG_OUT_POST\\")")
            
            lines.append(f"    if [ \\"$POST_VAL\\" = 'JSON_ERROR' ]; then")
            lines.append(f"        echo 'FAILED_POST_VERIFY: Malformed JSON'")
            lines.append(f"        FAILED_POST_VERIFY=$((FAILED_POST_VERIFY + 1))")
            lines.append(f"        return")
            lines.append(f"    fi")
            
            if a == "NOT_SET" or a is None:
                lines.append(f"    if [ \\"$POST_VAL\\" != 'NOT_SET' ]; then")
                lines.append(f"        echo 'FAILED_POST_VERIFY ({k} expected NOT_SET but was '$POST_VAL')'")
                lines.append(f"        VERIFY_SAFE=0")
                lines.append(f"    fi")
            else:
                lines.append(f"    if [ \\"$POST_VAL\\" = 'NOT_SET' ]; then")
                lines.append(f"        echo 'FAILED_POST_VERIFY ({k} expected {a} but was NOT_SET)'")
                lines.append(f"        VERIFY_SAFE=0")
                lines.append(f"    elif [ \\"$POST_VAL\\" != '{a}' ]; then")
                lines.append(f"        echo 'FAILED_POST_VERIFY ({k} expected {a} but was '$POST_VAL')'")
                lines.append(f"        VERIFY_SAFE=0")
                lines.append(f"    fi")
                
        lines.append(f"    if [ \\"$VERIFY_SAFE\\" -eq 1 ]; then")
        lines.append(f"        echo 'SUCCESS'")
        lines.append(f"        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))")
        lines.append(f"    else")
        lines.append(f"        FAILED_POST_VERIFY=$((FAILED_POST_VERIFY + 1))")
        lines.append(f"    fi")
        lines.append(f"    echo ''")
        lines.append(f"}}")
        lines.append(f"{func_name}")
        lines.append("")
        
    lines.append("echo '=================================================='")
    lines.append("echo 'EXECUTION SUMMARY'")
    lines.append("echo '=================================================='")
    lines.append("echo \\"Total resources                 : $TOTAL\\"")
    lines.append("echo \\"SUCCESS                         : $SUCCESS_COUNT\\"")
    lines.append("echo \\"PRESERVED_NO_OP                 : $PRESERVED_NO_OP\\"")
    lines.append("echo \\"SKIPPED_CURRENT_VALUE_CHANGED   : $SKIPPED_CURRENT_VALUE_CHANGED\\"")
    lines.append("echo \\"FAILED_PRECHECK                 : $FAILED_PRECHECK\\"")
    lines.append("echo \\"FAILED_WRITE                    : $FAILED_WRITE\\"")
    lines.append("echo \\"FAILED_POST_VERIFY              : $FAILED_POST_VERIFY\\"")
    lines.append("echo ''")
    lines.append("echo 'ACTION SUMMARY'")
    lines.append("echo '--------------------------------------------------'")
    lines.append("echo \\"ADD       : $ADD_COUNT\\"")
    lines.append("echo \\"CHANGE    : $CHANGE_COUNT\\"")
    lines.append("echo \\"REMOVE    : $REMOVE_COUNT\\"")
    lines.append("echo \\"PRESERVE  : $PRESERVE_COUNT\\"")
    lines.append("echo '=================================================='")
    lines.append("if [ \\"$FAILED_PRECHECK\\" -gt 0 ] || [ \\"$FAILED_WRITE\\" -gt 0 ] || [ \\"$FAILED_POST_VERIFY\\" -gt 0 ]; then")
    lines.append("    exit 1")
    lines.append("fi")
    lines.append("exit 0")
    
    return "\\n".join(lines) + "\\n"

def get_aws_revert_script(manifest: dict) -> str:
    inverted_manifest = json.loads(json.dumps(manifest))
    for res in inverted_manifest.get("resources", []):
        for chg in res.get("changes", []):
            orig_before = chg.get("before")
            orig_after = chg.get("after")
            orig_action = chg.get("action")
            
            if orig_action == "ADD":
                chg["before"] = orig_after
                chg["after"] = "NOT_SET"
                chg["action"] = "REMOVE"
            elif orig_action == "CHANGE":
                chg["before"] = orig_after
                chg["after"] = orig_before
                chg["action"] = "CHANGE"
            elif orig_action == "REMOVE":
                chg["before"] = "NOT_SET"
                chg["after"] = orig_before
                chg["action"] = "ADD"
            elif orig_action == "PRESERVE":
                pass
                
    script = get_aws_apply_script(inverted_manifest)
    return script.replace("AWS Apply Script", "AWS Revert Script")


def get_azure_apply_script(manifest: dict) -> str:
    job_id = manifest.get("job_id", "UNKNOWN")
    lines = [
        "<#",
        "CloudTag V1 - Azure Apply Script",
        f"Job: {job_id}",
        "#>",
        "$ErrorActionPreference = \\"Continue\\"",
        "",
        "Write-Host 'Checking Azure Context...'",
        "$context = Get-AzContext -ErrorAction SilentlyContinue",
        "if (-Not $context) {",
        "    Write-Error 'Not logged in to Azure. Please run Connect-AzAccount.'",
        "    exit 1",
        "}",
        "$CurrentSub = $context.Subscription.Id",
        "Write-Host \\"Active Subscription: $CurrentSub\\"",
        ""
    ]
    
    if manifest.get("resources"):
        expected_sub = manifest["resources"][0].get("account_id")
        lines.extend([
            f"$EXPECTED_SUB = '{expected_sub}'",
            "if ($EXPECTED_SUB -ne $CurrentSub) {",
            "    Write-Host 'TARGET_SUBSCRIPTION_MISMATCH'",
            "    exit 1",
            "}",
            ""
        ])
        
    lines.extend([
        "$global:TOTAL = 0",
        "$global:SUCCESS_COUNT = 0",
        "$global:SKIPPED_CURRENT_VALUE_CHANGED = 0",
        "$global:FAILED_PRECHECK = 0",
        "$global:FAILED_WRITE = 0",
        "$global:FAILED_POST_VERIFY = 0",
        "$global:PRESERVED_NO_OP = 0",
        "$global:ADD_COUNT = 0",
        "$global:CHANGE_COUNT = 0",
        "$global:REMOVE_COUNT = 0",
        "$global:PRESERVE_COUNT = 0",
        ""
    ])
    
    for res in manifest.get("resources", []):
        rid = res.get("resource_id")
        
        lines.append(f"& {{")
        lines.append(f"    Write-Host '--------------------------------------------------'")
        lines.append(f"    Write-Host 'Processing Resource: {rid}'")
        lines.append(f"    $global:TOTAL++")
        
        lines.append(f"    $Resource = $null")
        lines.append(f"    try {{")
        lines.append(f"        $Resource = Get-AzResource -ResourceId '{rid}' -ErrorAction Stop")
        lines.append(f"    }} catch {{")
        lines.append(f"        Write-Host 'FAILED_PRECHECK: Resource does not exist or cannot be read'")
        lines.append(f"        $global:FAILED_PRECHECK++")
        lines.append(f"        return")
        lines.append(f"    }}")
        
        lines.append(f"    if ($null -eq $Resource) {{")
        lines.append(f"        Write-Host 'FAILED_PRECHECK: Resource does not exist'")
        lines.append(f"        $global:FAILED_PRECHECK++")
        lines.append(f"        return")
        lines.append(f"    }}")
        
        lines.append(f"    $CurrentTags = $Resource.Tags")
        lines.append(f"    if ($null -eq $CurrentTags) {{ $CurrentTags = @{{}} }}")
        lines.append(f"    $IsSafe = $true")
        
        for chg in res.get("changes", []):
            k = chg.get("key")
            b = chg.get("before")
            
            lines.append(f"    $CurrentlyExists = $CurrentTags.ContainsKey('{k}')")
            lines.append(f"    $CurrentVal = if ($CurrentlyExists) {{ $CurrentTags['{k}'] }} else {{ $null }}")
            
            if b == "NOT_SET" or b is None:
                lines.append(f"    if ($CurrentlyExists) {{")
                lines.append(f"        Write-Host 'SKIPPED_CURRENT_VALUE_CHANGED ({k} expected NOT_SET but was '$CurrentVal')'")
                lines.append(f"        $IsSafe = $false")
                lines.append(f"    }}")
            else:
                lines.append(f"    if (-not $CurrentlyExists) {{")
                lines.append(f"        Write-Host 'SKIPPED_CURRENT_VALUE_CHANGED ({k} expected {b} but was NOT_SET)'")
                lines.append(f"        $IsSafe = $false")
                lines.append(f"    }} elseif ($CurrentVal -cne '{b}') {{")
                lines.append(f"        Write-Host 'SKIPPED_CURRENT_VALUE_CHANGED ({k} expected {b} but was '$CurrentVal')'")
                lines.append(f"        $IsSafe = $false")
                lines.append(f"    }}")
                
        lines.append(f"    if (-not $IsSafe) {{")
        lines.append(f"        $global:SKIPPED_CURRENT_VALUE_CHANGED++")
        lines.append(f"        return")
        lines.append(f"    }}")
        
        lines.append(f"    $TagsToApply = @{{}}")
        lines.append(f"    $KeysToRemove = @()")
        
        for chg in res.get("changes", []):
            action = chg.get("action")
            k = chg.get("key")
            a = chg.get("after")
            
            lines.append(f"    $global:{action}_COUNT++")
            if action in ["ADD", "CHANGE"]:
                lines.append(f"    $TagsToApply['{k}'] = '{a}'")
            elif action == "REMOVE":
                lines.append(f"    $KeysToRemove += '{k}'")
            elif action == "PRESERVE":
                lines.append(f"    $global:PRESERVED_NO_OP++")
                lines.append(f"    Write-Host 'PRESERVED_NO_OP | {k} | {a}'")
                
        lines.append(f"    $WriteFailed = $false")
        lines.append(f"    try {{")
        lines.append(f"        if ($TagsToApply.Count -gt 0) {{")
        lines.append(f"            Update-AzTag -ResourceId '{rid}' -Tag $TagsToApply -Operation Merge -ErrorAction Stop | Out-Null")
        lines.append(f"        }}")
        lines.append(f"        if ($KeysToRemove.Count -gt 0) {{")
        lines.append(f"            $TagsToDelete = @{{}}")
        lines.append(f"            foreach ($k in $KeysToRemove) {{ $TagsToDelete[$k] = '' }}")
        lines.append(f"            Update-AzTag -ResourceId '{rid}' -Tag $TagsToDelete -Operation Delete -ErrorAction Stop | Out-Null")
        lines.append(f"        }}")
        lines.append(f"    }} catch {{")
        lines.append(f"        $WriteFailed = $true")
        lines.append(f"    }}")
        
        lines.append(f"    if ($WriteFailed) {{")
        lines.append(f"        Write-Host 'FAILED_WRITE'")
        lines.append(f"        $global:FAILED_WRITE++")
        lines.append(f"        return")
        lines.append(f"    }}")
        
        lines.append(f"    $ResourcePost = $null")
        lines.append(f"    try {{")
        lines.append(f"        $ResourcePost = Get-AzResource -ResourceId '{rid}' -ErrorAction Stop")
        lines.append(f"    }} catch {{")
        lines.append(f"        Write-Host 'FAILED_POST_VERIFY: Read API failed'")
        lines.append(f"        $global:FAILED_POST_VERIFY++")
        lines.append(f"        return")
        lines.append(f"    }}")
        
        lines.append(f"    $CurrentTagsPost = if ($null -ne $ResourcePost -and $null -ne $ResourcePost.Tags) {{ $ResourcePost.Tags }} else {{ @{{}} }}")
        lines.append(f"    $VerifySafe = $true")
        
        for chg in res.get("changes", []):
            k = chg.get("key")
            a = chg.get("after")
            
            lines.append(f"    $CurrentlyExists = $CurrentTagsPost.ContainsKey('{k}')")
            lines.append(f"    $PostVal = if ($CurrentlyExists) {{ $CurrentTagsPost['{k}'] }} else {{ $null }}")
            
            if a == "NOT_SET" or a is None:
                lines.append(f"    if ($CurrentlyExists) {{")
                lines.append(f"        Write-Host 'FAILED_POST_VERIFY ({k} expected NOT_SET but was '$PostVal')'")
                lines.append(f"        $VerifySafe = $false")
                lines.append(f"    }}")
            else:
                lines.append(f"    if (-not $CurrentlyExists) {{")
                lines.append(f"        Write-Host 'FAILED_POST_VERIFY ({k} expected {a} but was NOT_SET)'")
                lines.append(f"        $VerifySafe = $false")
                lines.append(f"    }} elseif ($PostVal -cne '{a}') {{")
                lines.append(f"        Write-Host 'FAILED_POST_VERIFY ({k} expected {a} but was '$PostVal')'")
                lines.append(f"        $VerifySafe = $false")
                lines.append(f"    }}")
                
        lines.append(f"    if ($VerifySafe) {{")
        lines.append(f"        Write-Host 'SUCCESS'")
        lines.append(f"        $global:SUCCESS_COUNT++")
        lines.append(f"    }} else {{")
        lines.append(f"        $global:FAILED_POST_VERIFY++")
        lines.append(f"    }}")
        lines.append(f"    Write-Host ''")
        lines.append(f"}}")
        
    lines.append("Write-Host '=================================================='")
    lines.append("Write-Host 'EXECUTION SUMMARY'")
    lines.append("Write-Host '=================================================='")
    lines.append("Write-Host \\"Total resources                 : $global:TOTAL\\"")
    lines.append("Write-Host \\"SUCCESS                         : $global:SUCCESS_COUNT\\"")
    lines.append("Write-Host \\"PRESERVED_NO_OP                 : $global:PRESERVED_NO_OP\\"")
    lines.append("Write-Host \\"SKIPPED_CURRENT_VALUE_CHANGED   : $global:SKIPPED_CURRENT_VALUE_CHANGED\\"")
    lines.append("Write-Host \\"FAILED_PRECHECK                 : $global:FAILED_PRECHECK\\"")
    lines.append("Write-Host \\"FAILED_WRITE                    : $global:FAILED_WRITE\\"")
    lines.append("Write-Host \\"FAILED_POST_VERIFY              : $global:FAILED_POST_VERIFY\\"")
    lines.append("Write-Host ''")
    lines.append("Write-Host 'ACTION SUMMARY'")
    lines.append("Write-Host '--------------------------------------------------'")
    lines.append("Write-Host \\"ADD       : $global:ADD_COUNT\\"")
    lines.append("Write-Host \\"CHANGE    : $global:CHANGE_COUNT\\"")
    lines.append("Write-Host \\"REMOVE    : $global:REMOVE_COUNT\\"")
    lines.append("Write-Host \\"PRESERVE  : $global:PRESERVE_COUNT\\"")
    lines.append("Write-Host '=================================================='")
    lines.append("if ($global:FAILED_PRECHECK -gt 0 -or $global:FAILED_WRITE -gt 0 -or $global:FAILED_POST_VERIFY -gt 0) {")
    lines.append("    exit 1")
    lines.append("}")
    lines.append("exit 0")
    
    return "\\n".join(lines) + "\\n"

def get_azure_revert_script(manifest: dict) -> str:
    inverted_manifest = json.loads(json.dumps(manifest))
    for res in inverted_manifest.get("resources", []):
        for chg in res.get("changes", []):
            orig_before = chg.get("before")
            orig_after = chg.get("after")
            orig_action = chg.get("action")
            
            if orig_action == "ADD":
                chg["before"] = orig_after
                chg["after"] = "NOT_SET"
                chg["action"] = "REMOVE"
            elif orig_action == "CHANGE":
                chg["before"] = orig_after
                chg["after"] = orig_before
                chg["action"] = "CHANGE"
            elif orig_action == "REMOVE":
                chg["before"] = "NOT_SET"
                chg["after"] = orig_before
                chg["action"] = "ADD"
            elif orig_action == "PRESERVE":
                pass
                
    script = get_azure_apply_script(inverted_manifest)
    return script.replace("Azure Apply Script", "Azure Revert Script")
"""
    with open('app/services/script_templates.py', 'w') as f:
        f.write(code)

generate_script_templates_code()
