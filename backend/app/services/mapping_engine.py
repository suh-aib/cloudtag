import re
from typing import List, Tuple

class MappingDetectionResult:
    def __init__(self, source_header: str, target_field: str = None, confidence: float = 0.0, sample_values: List[str] = None):
        self.source_header = source_header
        self.target_field = target_field
        self.confidence = confidence
        self.sample_values = sample_values or []

# Mock data representing what the SharePoint adapter would return if connected
MOCK_AZURE_SOURCE = {
    "headers": ["SubscriptionName", "ResourceGroup", "ResourceName", "ResourceType", "Location", "ResourceId", "OwnerEmail"],
    "data": [
        ["Prod-Sub-01", "rg-network-prod", "vnet-eastus", "Microsoft.Network/virtualNetworks", "eastus", "/subscriptions/123/resourceGroups/rg-network-prod/...", "admin@malabar.com"],
        ["Dev-Sub-02", "rg-app-dev", "vm-web-01", "Microsoft.Compute/virtualMachines", "westus", "/subscriptions/456/...", "dev@malabar.com"]
    ]
}

MOCK_AWS_SOURCE = {
    "headers": ["Account", "VPC ID", "Resource ID", "Service", "Region", "Environment"],
    "data": [
        ["123456789012", "vpc-0123abcd", "i-0987654321", "EC2", "us-east-1", "Production"],
        ["123456789012", "vpc-0123abcd", "db-0abcd12345", "RDS", "us-east-1", "Development"]
    ]
}

# The canonical fields in CloudTag's internal model that we want to map against
CANONICAL_FIELDS = {
    "account_name": ["subscriptionname", "subscription name", "account name", "account"],
    "account_id": ["subscriptionid", "subscription id", "account id", "aws account"],
    "resource_group": ["resourcegroup", "rg", "vpc id"],
    "resource_name": ["resourcename", "name"],
    "resource_type": ["resourcetype", "type", "service"],
    "region": ["location", "region"],
    "resource_id": ["resourceid", "id", "arn"],
    "owner": ["owneremail", "owner", "contact"],
    "environment": ["environment", "env"]
}

# Common tag columns
COMMON_TAG_COLUMNS = [
    "appname", "environment", "critical", "project", "role",
    "business_unit", "cost_center", "owner", "application", "service", "department"
]

def normalize_string(s: str) -> str:
    """Removes spaces, underscores, and lowers case for fuzzy matching."""
    return re.sub(r'[^a-zA-Z0-9]', '', s).lower()

def guess_mapping(header: str, sample_values: List[str]) -> Tuple[str, float, str]:
    """Returns (target_field, confidence_score, target_tag_key)"""
    norm_header = normalize_string(header)
    
    # 0. Check for serialized tags (e.g. AllTags)
    if norm_header in ["alltags", "tags", "cloudtags"]:
        return "serialized_tags", 90.0, None

    # 1. Alias Matching
    for target, aliases in CANONICAL_FIELDS.items():
        if norm_header in [normalize_string(a) for a in aliases]:
            return target, 90.0, None
            
    # 1.5 Common Tag Detection
    if norm_header in [normalize_string(t) for t in COMMON_TAG_COLUMNS] or header.upper() == header:
        # High confidence for recognized tag names, lower for just ALL CAPS names
        confidence = 85.0 if norm_header in [normalize_string(t) for t in COMMON_TAG_COLUMNS] else 60.0
        return "cloud_tag", confidence, header
            
    # 2. Data Pattern Detection (Regex heuristics on sample data)
    # E.g., if it looks like an Azure Resource ID or AWS ARN
    id_pattern = re.compile(r'(/subscriptions/|arn:aws:)')
    if any(id_pattern.match(str(val)) for val in sample_values):
        return "resource_id", 80.0, None
        
    # E.g., if it looks like an email
    email_pattern = re.compile(r'^[^@]+@[^@]+\.[^@]+$')
    if any(email_pattern.match(str(val)) for val in sample_values):
        return "owner", 75.0, None

    return None, 0.0, None

def detect_mappings(provider: str) -> List[MappingDetectionResult]:
    """Simulates downloading the SharePoint data and running the detection engine."""
    source = MOCK_AZURE_SOURCE if provider.upper() == "AZURE" else MOCK_AWS_SOURCE
    
    headers = source["headers"]
    data = source["data"]
    
    results = []
    for col_idx, header in enumerate(headers):
        # Extract up to 3 sample values for this column
        samples = []
        for row in data[:3]:
            if col_idx < len(row):
                samples.append(str(row[col_idx]))
                
        target_field, confidence, target_tag_key = guess_mapping(header, samples)
        
        results.append(MappingDetectionResult(
            source_header=header,
            target_field=target_field,
            confidence=confidence,
            sample_values=samples
        ))
        
        # Adding target_tag_key manually to result
        results[-1].target_tag_key = target_tag_key
        
    return results
