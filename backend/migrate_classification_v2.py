import sys
import os
import logging
from sqlalchemy.orm import Session
from sqlalchemy import update

sys.path.append(os.path.abspath('.'))
from app.database import engine
from app.models.resource import Resource, Billability, TaggingScope

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

classification_map = {
    # AWS
    "ec2/elastic-ip": ("BILLABLE", "REQUIRED"),
    "ec2/image": ("NON_BILLABLE", "EXCLUDED"),
    "ec2/snapshot": ("CONDITIONAL", "SUPPORTING"),
    "ec2/vpc-endpoint": ("BILLABLE", "SUPPORTING"),
    "ec2/vpc-peering-connection": ("CONDITIONAL", "SUPPORTING"),
    "ec2/vpn-connection": ("BILLABLE", "SUPPORTING"),
    "ec2/vpn-gateway": ("NON_BILLABLE", "SUPPORTING"),
    "logs/log-group": ("CONDITIONAL", "SUPPORTING"),
    "route53/hostedzone": ("CONDITIONAL", "SUPPORTING"),
    "secretsmanager/secret": ("BILLABLE", "REQUIRED"),
    "cloudfront/distribution": ("CONDITIONAL", "REQUIRED"),
    "directconnect/dxcon": ("BILLABLE", "REQUIRED"),
    "ec2/client-vpn-endpoint": ("BILLABLE", "REQUIRED"),
    "elasticloadbalancing/loadbalancer": ("BILLABLE", "REQUIRED"),
    "elasticloadbalancing/listener": ("NON_BILLABLE", "SUPPORTING"),
    "elasticloadbalancing/targetgroup": ("NON_BILLABLE", "SUPPORTING"),
    "elasticache/cluster": ("BILLABLE", "REQUIRED"),
    "elasticache/replicationgroup": ("BILLABLE", "REQUIRED"),
    "elasticache/snapshot": ("CONDITIONAL", "SUPPORTING"),
    "events/event-bus": ("CONDITIONAL", "SUPPORTING"),
    "backup/recovery-point": ("CONDITIONAL", "SUPPORTING"),
    "eks/cluster": ("BILLABLE", "REQUIRED"),
    "eks/nodegroup": ("NON_BILLABLE", "SUPPORTING"),
    "eks/pod": ("NON_BILLABLE", "SUPPORTING"),

    # AZURE
    "microsoft.apimanagement/service": ("BILLABLE", "REQUIRED"),
    "microsoft.app/containerapps": ("BILLABLE", "REQUIRED"),
    "microsoft.app/managedenvironments": ("CONDITIONAL", "SUPPORTING"),
    "microsoft.automation/automationaccounts": ("CONDITIONAL", "SUPPORTING"),
    "microsoft.automation/automationaccounts/runbooks": ("NON_BILLABLE", "SUPPORTING"),
    "microsoft.batch/batchaccounts": ("BILLABLE", "REQUIRED"),
    "microsoft.cache/redisenterprise": ("BILLABLE", "REQUIRED"),
    "microsoft.cognitiveservices/accounts": ("BILLABLE", "REQUIRED"),
    "microsoft.cognitiveservices/accounts/projects": ("NON_BILLABLE", "SUPPORTING"),
    "microsoft.compute/restorepointcollections": ("CONDITIONAL", "SUPPORTING"),
    "microsoft.compute/snapshots": ("CONDITIONAL", "SUPPORTING"),
    "microsoft.containerregistry/registries": ("BILLABLE", "REQUIRED"),
    "microsoft.datafactory/factories": ("CONDITIONAL", "REQUIRED"),
    "microsoft.dataprotection/backupvaults": ("CONDITIONAL", "REQUIRED"),
    "microsoft.documentdb/databaseaccounts": ("BILLABLE", "REQUIRED"),
    "microsoft.insights/components": ("CONDITIONAL", "SUPPORTING"),
    "microsoft.insights/scheduledqueryrules": ("CONDITIONAL", "SUPPORTING"),
    "microsoft.logic/workflows": ("CONDITIONAL", "REQUIRED"),
    "microsoft.network/networkwatchers": ("CONDITIONAL", "SUPPORTING"),
    "microsoft.network/privateendpoints": ("BILLABLE", "SUPPORTING"),
    "microsoft.network/privatednszones": ("CONDITIONAL", "SUPPORTING"),
    "microsoft.operationalinsights/workspaces": ("CONDITIONAL", "SUPPORTING"),
    "microsoft.recoveryservices/vaults": ("CONDITIONAL", "REQUIRED"),
    "microsoft.relay/namespaces": ("BILLABLE", "REQUIRED"),
    "microsoft.search/searchservices": ("BILLABLE", "REQUIRED"),
    "microsoft.web/certificates": ("BILLABLE", "SUPPORTING"),
    "microsoft.web/serverfarms": ("BILLABLE", "REQUIRED"),
    "microsoft.web/sites": ("CONDITIONAL", "REQUIRED"),
    "microsoft.web/staticsites": ("CONDITIONAL", "REQUIRED"),
}

def migrate_classifications():
    logger.info("Starting Phase 2.5B Migration of classifications")
    total_updated = 0
    
    with Session(engine) as session:
        try:
            for rt, (billability, scope) in classification_map.items():
                logger.info(f"Updating '{rt}' to Billability: {billability}, Scope: {scope}")
                stmt = (
                    update(Resource)
                    .where(Resource.resource_type == rt)
                    .values(
                        billability=Billability[billability],
                        tagging_scope=TaggingScope[scope]
                    )
                )
                result = session.execute(stmt)
                logger.info(f"Updated {result.rowcount} rows for '{rt}'.")
                total_updated += result.rowcount
            
            session.commit()
            logger.info(f"Migration successful! Total rows updated: {total_updated}")
        except Exception as e:
            session.rollback()
            logger.error(f"Migration failed: {e}")
            raise

if __name__ == "__main__":
    migrate_classifications()
