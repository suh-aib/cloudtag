from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import List, Optional
from fastapi import Query

from app.database import get_db
from app.models.user import User
from app.models.cloud import CloudProvider, CloudAccount
from app.models.resource import Resource, TaggingScope, Billability
from app.api.deps import get_current_user
from app.schemas.inventory import (
    DashboardStatsSchema, InventoryAccountSchema,
    ResourceGroupCountSchema, ResourceTypeCountSchema, ResourceDetailSchema
)

router = APIRouter()

def apply_inventory_filters(query, search=None, billable_only=False, billability=None, tagging_scope=None, resource_type=None, location=None):
    if billable_only:
        query = query.filter(Resource.billability == Billability.BILLABLE)
    elif billability:
        query = query.filter(Resource.billability == billability)
        
    if tagging_scope:
        query = query.filter(Resource.tagging_scope == tagging_scope)
        
    if resource_type:
        query = query.filter(Resource.resource_type == resource_type)
        
    if location:
        query = query.filter(Resource.location == location)
        
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Resource.resource_name.ilike(search_term),
                Resource.resource_id.ilike(search_term),
                Resource.resource_type.ilike(search_term),
                Resource.location.ilike(search_term),
                Resource.resource_group.ilike(search_term),
            )
        )
    return query

def apply_account_search(query, search=None):
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                CloudAccount.name.ilike(search_term),
                CloudAccount.account_identifier.ilike(search_term)
            )
        )
    return query


def get_provider_enum(provider_str: str) -> CloudProvider:
    provider_str = provider_str.upper()
    if provider_str == "AZURE":
        return CloudProvider.AZURE
    elif provider_str == "AWS":
        return CloudProvider.AWS
    else:
        raise HTTPException(status_code=400, detail="Invalid provider.")

@router.get("/dashboard/stats", response_model=DashboardStatsSchema)
def get_dashboard_stats(
    provider: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.models.tagging import TaggingBatch, TaggingChange, BatchStatus
    from sqlalchemy import distinct
    
    base_query = db.query(Resource)
    if provider:
        p = CloudProvider.AZURE if provider.upper() == 'AZURE' else CloudProvider.AWS
        base_query = base_query.filter(Resource.provider == p)
        
    total_resources = base_query.count()
    tagging_required = base_query.filter(Resource.tagging_scope == TaggingScope.REQUIRED).count()
    
    latest_batch_subq = db.query(
        TaggingChange.resource_id,
        func.max(TaggingBatch.id).label("latest_batch_id")
    ).join(
        TaggingBatch, TaggingChange.batch_id == TaggingBatch.id
    ).group_by(
        TaggingChange.resource_id
    ).subquery()
    
    status_counts_query = db.query(
        TaggingBatch.status,
        func.count(distinct(latest_batch_subq.c.resource_id))
    ).join(
        latest_batch_subq, TaggingBatch.id == latest_batch_subq.c.latest_batch_id
    )
    
    if provider:
        p = CloudProvider.AZURE if provider.upper() == 'AZURE' else CloudProvider.AWS
        status_counts_query = status_counts_query.join(
            Resource, Resource.id == latest_batch_subq.c.resource_id
        ).filter(
            Resource.provider == p
        )
        
    status_counts = status_counts_query.group_by(TaggingBatch.status).all()
    
    status_map = {status: count for status, count in status_counts}
    
    pending_approval_resources = status_map.get(BatchStatus.PENDING_APPROVAL, 0)
    approved_resources = status_map.get(BatchStatus.APPROVED, 0)
    assigned_resources = status_map.get(BatchStatus.ASSIGNED, 0)
    validated_resources = status_map.get(BatchStatus.VALIDATED, 0)
    

    if tagging_required > 0:
        tagging_completion_percent = int((validated_resources / tagging_required) * 100)
    else:
        tagging_completion_percent = 0

    return DashboardStatsSchema(
        total_resources=total_resources,
        tagging_required=tagging_required,
        validated_resources=validated_resources,
        pending_approval_resources=pending_approval_resources,
        approved_resources=approved_resources,
        assigned_resources=assigned_resources,
        tagging_completion_percent=tagging_completion_percent
    )

@router.get("/{provider}/accounts", response_model=List[InventoryAccountSchema])
def get_provider_accounts(
    provider: str = Path(...),
    search: Optional[str] = Query(None),
    billable_only: bool = Query(False),
    billability: Optional[str] = Query(None),
    tagging_scope: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    provider_enum = get_provider_enum(provider)
    
    if provider_enum == CloudProvider.AZURE:
        group_expr = Resource.resource_group
    else:
        group_expr = Resource.location
        
    base_query = db.query(
        CloudAccount.id.label("account_id"),
        CloudAccount.name.label("account_name"),
        CloudAccount.account_identifier.label("account_identifier"),
        func.count(Resource.id).label("resource_count"),
        func.count(func.distinct(group_expr)).label("group_count")
    ).join(
        Resource, Resource.cloud_account_id == CloudAccount.id
    ).filter(
        Resource.provider == provider_enum
    )
    
    # Apply Resource filters to ensure counts are accurate
    base_query = apply_inventory_filters(base_query, search=None, billable_only=billable_only, billability=billability, tagging_scope=tagging_scope)
    # Apply Account search
    base_query = apply_account_search(base_query, search=search)
    
    results = base_query.group_by(
        CloudAccount.id, CloudAccount.name, CloudAccount.account_identifier
    ).all()
    
    # Map to schema
    accounts = []
    for r in results:
        accounts.append(InventoryAccountSchema(
            account_id=r.account_id,
            account_name=r.account_name or "Unknown",
            account_identifier=r.account_identifier or "Unknown",
            resource_count=r.resource_count,
            group_count=r.group_count
        ))
        
    return accounts

@router.get("/azure/accounts/{account_identifier}/resource-groups", response_model=List[ResourceGroupCountSchema])
def get_azure_resource_groups(
    account_identifier: str = Path(...),
    search: Optional[str] = Query(None),
    billable_only: bool = Query(False),
    billability: Optional[str] = Query(None),
    tagging_scope: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Find account id first to ensure it exists
    account = db.query(CloudAccount).filter(
        CloudAccount.account_identifier == account_identifier,
        CloudAccount.cloud == CloudProvider.AZURE
    ).first()
    
    if not account:
        raise HTTPException(status_code=404, detail="Azure account not found.")

    base_query = db.query(
        Resource.resource_group,
        func.count(Resource.id).label("resource_count"),
        func.count(func.distinct(Resource.resource_type)).label("types_count"),
        func.group_concat(func.distinct(Resource.location)).label("locations")
    ).filter(
        Resource.cloud_account_id == account.id,
        Resource.provider == CloudProvider.AZURE,
        Resource.resource_group != None
    )
    
    base_query = apply_inventory_filters(base_query, search=search, billable_only=billable_only, billability=billability, tagging_scope=tagging_scope)
    results = base_query.group_by(
        Resource.resource_group
    ).all()

    groups = []
    for r in results:
        locs = r.locations.split(',') if r.locations else []
        locs = list(set([loc for loc in locs if loc])) # clean up
        groups.append(ResourceGroupCountSchema(
            name=r.resource_group,
            locations=locs,
            resource_count=r.resource_count,
            types_count=r.types_count
        ))
        
    return groups

@router.get("/azure/accounts/{account_identifier}/resource-groups/{resource_group}/types", response_model=List[ResourceTypeCountSchema])
def get_azure_resource_types(
    account_identifier: str = Path(...),
    resource_group: str = Path(...),
    search: Optional[str] = Query(None),
    billable_only: bool = Query(False),
    billability: Optional[str] = Query(None),
    tagging_scope: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    account = db.query(CloudAccount).filter(
        CloudAccount.account_identifier == account_identifier,
        CloudAccount.cloud == CloudProvider.AZURE
    ).first()
    
    if not account:
        raise HTTPException(status_code=404, detail="Azure account not found.")

    base_query = db.query(
        Resource.resource_type,
        func.count(Resource.id).label("resource_count"),
        func.max(Resource.billability).label("billability"),
        func.max(Resource.tagging_scope).label("tagging_scope")
    ).filter(
        Resource.cloud_account_id == account.id,
        Resource.provider == CloudProvider.AZURE,
        Resource.resource_group == resource_group
    )
    
    base_query = apply_inventory_filters(base_query, search=search, billable_only=billable_only, billability=billability, tagging_scope=tagging_scope)
    results = base_query.group_by(
        Resource.resource_type
    ).all()

    types = []
    for r in results:
        # Simple heuristic for display name: take last segment
        display = r.resource_type.split('/')[-1] if '/' in r.resource_type else r.resource_type
        
        types.append(ResourceTypeCountSchema(
            resource_type=r.resource_type,
            display_name=display,
            resource_count=r.resource_count,
            billability=r.billability,
            tagging_scope=r.tagging_scope
        ))
        
    return types

from typing import Optional
from fastapi import Query

@router.get("/azure/accounts/{account_identifier}/resource-groups/{resource_group}/resources", response_model=List[ResourceDetailSchema])
def get_azure_resources(
    account_identifier: str = Path(...),
    resource_group: str = Path(...),
    type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    billable_only: bool = Query(False),
    billability: Optional[str] = Query(None),
    tagging_scope: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    account = db.query(CloudAccount).filter(
        CloudAccount.account_identifier == account_identifier,
        CloudAccount.cloud == CloudProvider.AZURE
    ).first()
    
    if not account:
        raise HTTPException(status_code=404, detail="Azure account not found.")

    query = db.query(Resource).filter(
        Resource.cloud_account_id == account.id,
        Resource.provider == CloudProvider.AZURE,
        Resource.resource_group == resource_group
    )
    
    query = apply_inventory_filters(query, search=search, billable_only=billable_only, billability=billability, tagging_scope=tagging_scope, resource_type=type)
        
    resources = query.all()
    
    results = []
    for r in resources:
        # Determine status (simplified, if no tag states assume NOT_REVIEWED)
        status = "NOT_REVIEWED"
        if r.tag_states:
            # Check if any states are IN_PROGRESS or something else
            statuses = [ts.status for ts in r.tag_states]
            if any(s != "NOT_REVIEWED" for s in statuses):
                # Just take the first non-NOT_REVIEWED for now
                for s in statuses:
                    if s != "NOT_REVIEWED":
                        status = s
                        break

        results.append(ResourceDetailSchema(
            id=r.id,
            resource_name=r.resource_name,
            resource_type=r.resource_type,
            resource_group=r.resource_group,
            location=r.location,
            resource_id=r.resource_id,
            cloud_tags=r.cloud_tags,
            billability=r.billability,
            tagging_scope=r.tagging_scope,
            status=status
        ))
        
    return results

@router.get("/aws/accounts/{account_identifier}/regions", response_model=List[ResourceGroupCountSchema])
def get_aws_regions(
    account_identifier: str = Path(...),
    search: Optional[str] = Query(None),
    billable_only: bool = Query(False),
    billability: Optional[str] = Query(None),
    tagging_scope: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    account = db.query(CloudAccount).filter(
        CloudAccount.account_identifier == account_identifier,
        CloudAccount.cloud == CloudProvider.AWS
    ).first()
    
    if not account:
        raise HTTPException(status_code=404, detail="AWS account not found.")

    base_query = db.query(
        Resource.location,
        func.count(Resource.id).label("resource_count"),
        func.count(func.distinct(Resource.resource_type)).label("types_count")
    ).filter(
        Resource.cloud_account_id == account.id,
        Resource.provider == CloudProvider.AWS,
        Resource.location != None
    )
    
    base_query = apply_inventory_filters(base_query, search=search, billable_only=billable_only, billability=billability, tagging_scope=tagging_scope)
    results = base_query.group_by(
        Resource.location
    ).all()

    groups = []
    for r in results:
        groups.append(ResourceGroupCountSchema(
            name=r.location,
            locations=[r.location],
            resource_count=r.resource_count,
            types_count=r.types_count
        ))
        
    return groups

@router.get("/aws/accounts/{account_identifier}/regions/{region}/types", response_model=List[ResourceTypeCountSchema])
def get_aws_resource_types(
    account_identifier: str = Path(...),
    region: str = Path(...),
    search: Optional[str] = Query(None),
    billable_only: bool = Query(False),
    billability: Optional[str] = Query(None),
    tagging_scope: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    account = db.query(CloudAccount).filter(
        CloudAccount.account_identifier == account_identifier,
        CloudAccount.cloud == CloudProvider.AWS
    ).first()
    
    if not account:
        raise HTTPException(status_code=404, detail="AWS account not found.")

    base_query = db.query(
        Resource.resource_type,
        func.count(Resource.id).label("resource_count"),
        func.max(Resource.billability).label("billability"),
        func.max(Resource.tagging_scope).label("tagging_scope")
    ).filter(
        Resource.cloud_account_id == account.id,
        Resource.provider == CloudProvider.AWS,
        Resource.location == region
    )
    
    base_query = apply_inventory_filters(base_query, search=search, billable_only=billable_only, billability=billability, tagging_scope=tagging_scope)
    results = base_query.group_by(
        Resource.resource_type
    ).all()

    types = []
    for r in results:
        display = r.resource_type.split('/')[-1] if '/' in r.resource_type else r.resource_type
        types.append(ResourceTypeCountSchema(
            resource_type=r.resource_type,
            display_name=display,
            resource_count=r.resource_count,
            billability=r.billability,
            tagging_scope=r.tagging_scope
        ))
        
    return types

@router.get("/aws/accounts/{account_identifier}/regions/{region}/resources", response_model=List[ResourceDetailSchema])
def get_aws_resources(
    account_identifier: str = Path(...),
    region: str = Path(...),
    type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    billable_only: bool = Query(False),
    billability: Optional[str] = Query(None),
    tagging_scope: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    account = db.query(CloudAccount).filter(
        CloudAccount.account_identifier == account_identifier,
        CloudAccount.cloud == CloudProvider.AWS
    ).first()
    
    if not account:
        raise HTTPException(status_code=404, detail="AWS account not found.")

    query = db.query(Resource).filter(
        Resource.cloud_account_id == account.id,
        Resource.provider == CloudProvider.AWS,
        Resource.location == region
    )
    
    query = apply_inventory_filters(query, search=search, billable_only=billable_only, billability=billability, tagging_scope=tagging_scope, resource_type=type)
        
    resources = query.all()
    
    results = []
    for r in resources:
        status = "NOT_REVIEWED"
        if r.tag_states:
            statuses = [ts.status for ts in r.tag_states]
            if any(s != "NOT_REVIEWED" for s in statuses):
                for s in statuses:
                    if s != "NOT_REVIEWED":
                        status = s
                        break

        results.append(ResourceDetailSchema(
            id=r.id,
            resource_name=r.resource_name,
            resource_type=r.resource_type,
            resource_group=r.resource_group,
            location=r.location,
            resource_id=r.resource_id,
            cloud_tags=r.cloud_tags,
            billability=r.billability,
            tagging_scope=r.tagging_scope,
            status=status
        ))
        
    return results
