import sys
import os

# Ensure the app can be imported
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy import text
from app.database import SessionLocal, engine
from app.models.resource import Resource, TaggingScope, Billability
from app.models.cloud import CloudProvider

# Define mappings based on provided constraints and DB discovery
classification_rules = {
    # Azure Mappings
    CloudProvider.AZURE: {
        "microsoft.compute/virtualmachines": (Billability.BILLABLE, TaggingScope.REQUIRED),
        "microsoft.storage/storageaccounts": (Billability.BILLABLE, TaggingScope.REQUIRED),
        "microsoft.sql/servers/databases": (Billability.BILLABLE, TaggingScope.REQUIRED),
        "microsoft.sql/servers": (Billability.BILLABLE, TaggingScope.REQUIRED),
        "microsoft.sqlvirtualmachine/sqlvirtualmachines": (Billability.BILLABLE, TaggingScope.REQUIRED),
        "microsoft.compute/disks": (Billability.BILLABLE, TaggingScope.REQUIRED),
        
        "microsoft.network/virtualnetworks": (Billability.NON_BILLABLE, TaggingScope.SUPPORTING),
        "microsoft.network/networksecuritygroups": (Billability.NON_BILLABLE, TaggingScope.SUPPORTING),
        "microsoft.network/routetables": (Billability.NON_BILLABLE, TaggingScope.SUPPORTING),
        "microsoft.network/privatednszones": (Billability.NON_BILLABLE, TaggingScope.SUPPORTING),
        "microsoft.network/privatednszones/virtualnetworklinks": (Billability.NON_BILLABLE, TaggingScope.SUPPORTING),
        "microsoft.network/networkinterfaces": (Billability.NON_BILLABLE, TaggingScope.SUPPORTING),
        "microsoft.network/bastionhosts": (Billability.BILLABLE, TaggingScope.REQUIRED),
        "microsoft.network/loadbalancers": (Billability.BILLABLE, TaggingScope.REQUIRED),
        
        "microsoft.web/sites": (Billability.CONDITIONAL, TaggingScope.REQUIRED),
        "microsoft.web/serverfarms": (Billability.CONDITIONAL, TaggingScope.REQUIRED),
        "microsoft.network/publicipaddresses": (Billability.CONDITIONAL, TaggingScope.REQUIRED),
        "microsoft.keyvault/vaults": (Billability.CONDITIONAL, TaggingScope.REQUIRED),
        "microsoft.operationalinsights/workspaces": (Billability.CONDITIONAL, TaggingScope.SUPPORTING),
        "microsoft.insights/components": (Billability.CONDITIONAL, TaggingScope.SUPPORTING),
        "microsoft.insights/actiongroups": (Billability.NON_BILLABLE, TaggingScope.EXCLUDED),
        "microsoft.alertsmanagement/smartdetectoralertrules": (Billability.NON_BILLABLE, TaggingScope.EXCLUDED),
    },
    
    # AWS Mappings
    CloudProvider.AWS: {
        "ec2/instance": (Billability.BILLABLE, TaggingScope.REQUIRED),
        "ec2/volume": (Billability.BILLABLE, TaggingScope.REQUIRED),
        "s3/bucket": (Billability.BILLABLE, TaggingScope.REQUIRED),
        "rds/db": (Billability.BILLABLE, TaggingScope.REQUIRED),
        "rds/snapshot": (Billability.CONDITIONAL, TaggingScope.SUPPORTING),
        "ec2/snapshot": (Billability.CONDITIONAL, TaggingScope.SUPPORTING),
        "backup/recovery-point": (Billability.CONDITIONAL, TaggingScope.SUPPORTING),
        "backup/backup-vault": (Billability.NON_BILLABLE, TaggingScope.SUPPORTING),
        
        "ec2/vpc": (Billability.NON_BILLABLE, TaggingScope.SUPPORTING),
        "ec2/subnet": (Billability.NON_BILLABLE, TaggingScope.SUPPORTING),
        "ec2/security-group": (Billability.NON_BILLABLE, TaggingScope.SUPPORTING),
        "ec2/route-table": (Billability.NON_BILLABLE, TaggingScope.SUPPORTING),
        "ec2/internet-gateway": (Billability.NON_BILLABLE, TaggingScope.SUPPORTING),
        "ec2/network-interface": (Billability.NON_BILLABLE, TaggingScope.SUPPORTING),
        "ec2/elastic-ip": (Billability.CONDITIONAL, TaggingScope.SUPPORTING),
        "ec2/natgateway": (Billability.BILLABLE, TaggingScope.REQUIRED),
        
        "iam/policy": (Billability.NON_BILLABLE, TaggingScope.EXCLUDED),
        "iam/instance-profile": (Billability.NON_BILLABLE, TaggingScope.EXCLUDED),
        "cloudformation/stack": (Billability.NON_BILLABLE, TaggingScope.EXCLUDED),
        "cloudformation/stackset": (Billability.NON_BILLABLE, TaggingScope.EXCLUDED),
        "cloudwatch/alarm": (Billability.NON_BILLABLE, TaggingScope.EXCLUDED),
        "events/rule": (Billability.NON_BILLABLE, TaggingScope.EXCLUDED),
        
        "lambda/function": (Billability.CONDITIONAL, TaggingScope.REQUIRED),
        "sqs/queue": (Billability.CONDITIONAL, TaggingScope.REQUIRED),
        "elasticloadbalancing/loadbalancer": (Billability.BILLABLE, TaggingScope.REQUIRED),
        "eks/cluster": (Billability.BILLABLE, TaggingScope.REQUIRED),
        "eks/pod": (Billability.NON_BILLABLE, TaggingScope.SUPPORTING),
    }
}

def migrate():
    with engine.connect() as conn:
        print("Checking if billability column exists...")
        res = conn.execute(text("SHOW COLUMNS FROM resources LIKE 'billability'")).fetchone()
        
        if not res:
            print("Adding billability column...")
            conn.execute(text("ALTER TABLE resources ADD COLUMN billability VARCHAR(255) DEFAULT 'UNKNOWN' NOT NULL"))
            conn.commit()
            print("Column added.")
        else:
            print("Column already exists.")
            
    # Now use ORM to process the backfill
    db = SessionLocal()
    try:
        resources = db.query(Resource).all()
        print(f"Loaded {len(resources)} resources.")
        
        billability_counts = {
            Billability.BILLABLE: 0,
            Billability.NON_BILLABLE: 0,
            Billability.CONDITIONAL: 0,
            Billability.UNKNOWN: 0
        }
        
        scope_counts = {
            TaggingScope.REQUIRED: 0,
            TaggingScope.SUPPORTING: 0,
            TaggingScope.EXCLUDED: 0
        }
        
        provider_counts = {}
        unknown_types = set()
        
        for r in resources:
            p = r.provider
            t = r.resource_type.lower() if r.resource_type else ""
            
            # Identify mapping
            mapping = classification_rules.get(p, {}).get(t)
            
            if mapping:
                b_val, s_val = mapping
            else:
                b_val = Billability.UNKNOWN
                s_val = TaggingScope.SUPPORTING # Safe default
                unknown_types.add(f"{p.name if p else 'None'} - {t}")
                
            r.billability = b_val
            r.tagging_scope = s_val
            
            # Tally counts
            billability_counts[b_val] += 1
            scope_counts[s_val] += 1
            
            key = f"{p.name if p else 'None'} - {b_val.name} - {s_val.name}"
            provider_counts[key] = provider_counts.get(key, 0) + 1
            
        print("Committing changes...")
        db.commit()
        print("Done!")
        
        # Summary output
        print("\n--- CLASSIFICATION SUMMARY ---")
        print(f"Total resources: {len(resources)}")
        print("\nBillability:")
        for k, v in billability_counts.items():
            print(f"{k.name}: {v}")
            
        print("\nTagging Scope:")
        for k, v in scope_counts.items():
            print(f"{k.name}: {v}")
            
        print("\nProvider/Billability/Scope Breakdown:")
        for k, v in sorted(provider_counts.items()):
            print(f"{k}: {v}")
            
        print("\nUnknown Types left as UNKNOWN/SUPPORTING:")
        for u in sorted(unknown_types):
            print(u)
            
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    migrate()
