import re

with open("app/api/inventory.py", "r") as f:
    content = f.read()

# For get_provider_accounts
def patch_get_provider_accounts(content):
    sig = """def get_provider_accounts(
    provider: str = Path(...),
    search: Optional[str] = Query(None),
    billable_only: bool = Query(False),
    billability: Optional[str] = Query(None),
    tagging_scope: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):"""
    # Find start and replace
    old_sig = """def get_provider_accounts(
    provider: str = Path(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):"""
    content = content.replace(old_sig, sig)
    
    old_query = """    results = db.query(
        CloudAccount.id.label("account_id"),
        CloudAccount.name.label("account_name"),
        CloudAccount.account_identifier.label("account_identifier"),
        func.count(Resource.id).label("resource_count"),
        func.count(func.distinct(group_expr)).label("group_count")
    ).join(
        Resource, Resource.cloud_account_id == CloudAccount.id
    ).filter(
        Resource.provider == provider_enum
    )"""
    new_query = """    base_query = db.query(
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
    
    results = base_query"""
    content = content.replace(old_query, new_query)
    return content

content = patch_get_provider_accounts(content)

def patch_get_azure_resource_groups(content):
    old_sig = """def get_azure_resource_groups(
    account_identifier: str = Path(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):"""
    new_sig = """def get_azure_resource_groups(
    account_identifier: str = Path(...),
    search: Optional[str] = Query(None),
    billable_only: bool = Query(False),
    billability: Optional[str] = Query(None),
    tagging_scope: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):"""
    content = content.replace(old_sig, new_sig)
    
    old_query = """    results = db.query(
        Resource.resource_group,
        func.count(Resource.id).label("resource_count"),
        func.count(func.distinct(Resource.resource_type)).label("types_count"),
        func.group_concat(func.distinct(Resource.location)).label("locations")
    ).filter(
        Resource.cloud_account_id == account.id,
        Resource.provider == CloudProvider.AZURE,
        Resource.resource_group != None
    )"""
    new_query = """    base_query = db.query(
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
    results = base_query"""
    content = content.replace(old_query, new_query)
    return content

content = patch_get_azure_resource_groups(content)

def patch_get_azure_resource_types(content):
    old_sig = """def get_azure_resource_types(
    account_identifier: str = Path(...),
    resource_group: str = Path(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):"""
    new_sig = """def get_azure_resource_types(
    account_identifier: str = Path(...),
    resource_group: str = Path(...),
    search: Optional[str] = Query(None),
    billable_only: bool = Query(False),
    billability: Optional[str] = Query(None),
    tagging_scope: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):"""
    content = content.replace(old_sig, new_sig)
    
    old_query = """    results = db.query(
        Resource.resource_type,
        func.count(Resource.id).label("resource_count")
    ).filter(
        Resource.cloud_account_id == account.id,
        Resource.provider == CloudProvider.AZURE,
        Resource.resource_group == resource_group
    )"""
    new_query = """    base_query = db.query(
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
    results = base_query"""
    content = content.replace(old_query, new_query)
    
    old_loop = """        types.append(ResourceTypeCountSchema(
            resource_type=r.resource_type,
            display_name=display,
            resource_count=r.resource_count
        ))"""
    new_loop = """        types.append(ResourceTypeCountSchema(
            resource_type=r.resource_type,
            display_name=display,
            resource_count=r.resource_count,
            billability=r.billability,
            tagging_scope=r.tagging_scope
        ))"""
    content = content.replace(old_loop, new_loop)
    return content

content = patch_get_azure_resource_types(content)


def patch_get_azure_resources(content):
    old_sig = """def get_azure_resources(
    account_identifier: str = Path(...),
    resource_group: str = Path(...),
    type: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):"""
    new_sig = """def get_azure_resources(
    account_identifier: str = Path(...),
    resource_group: str = Path(...),
    type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    billable_only: bool = Query(False),
    billability: Optional[str] = Query(None),
    tagging_scope: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):"""
    content = content.replace(old_sig, new_sig)
    
    old_query = """    query = db.query(Resource).filter(
        Resource.cloud_account_id == account.id,
        Resource.provider == CloudProvider.AZURE,
        Resource.resource_group == resource_group
    )
    
    if type:
        query = query.filter(Resource.resource_type == type)"""
    new_query = """    query = db.query(Resource).filter(
        Resource.cloud_account_id == account.id,
        Resource.provider == CloudProvider.AZURE,
        Resource.resource_group == resource_group
    )
    
    query = apply_inventory_filters(query, search=search, billable_only=billable_only, billability=billability, tagging_scope=tagging_scope, resource_type=type)"""
    content = content.replace(old_query, new_query)
    
    old_schema = """        results.append(ResourceDetailSchema(
            id=r.id,
            resource_name=r.resource_name,
            resource_type=r.resource_type,
            resource_group=r.resource_group,
            location=r.location,
            resource_id=r.resource_id,
            cloud_tags=r.cloud_tags,
            tagging_scope=r.tagging_scope,
            status=status
        ))"""
    new_schema = """        results.append(ResourceDetailSchema(
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
        ))"""
    content = content.replace(old_schema, new_schema)
    return content

content = patch_get_azure_resources(content)


def patch_get_aws_regions(content):
    old_sig = """def get_aws_regions(
    account_identifier: str = Path(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):"""
    new_sig = """def get_aws_regions(
    account_identifier: str = Path(...),
    search: Optional[str] = Query(None),
    billable_only: bool = Query(False),
    billability: Optional[str] = Query(None),
    tagging_scope: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):"""
    content = content.replace(old_sig, new_sig)
    
    old_query = """    results = db.query(
        Resource.location,
        func.count(Resource.id).label("resource_count"),
        func.count(func.distinct(Resource.resource_type)).label("types_count")
    ).filter(
        Resource.cloud_account_id == account.id,
        Resource.provider == CloudProvider.AWS,
        Resource.location != None
    )"""
    new_query = """    base_query = db.query(
        Resource.location,
        func.count(Resource.id).label("resource_count"),
        func.count(func.distinct(Resource.resource_type)).label("types_count")
    ).filter(
        Resource.cloud_account_id == account.id,
        Resource.provider == CloudProvider.AWS,
        Resource.location != None
    )
    
    base_query = apply_inventory_filters(base_query, search=search, billable_only=billable_only, billability=billability, tagging_scope=tagging_scope)
    results = base_query"""
    content = content.replace(old_query, new_query)
    return content

content = patch_get_aws_regions(content)

def patch_get_aws_resource_types(content):
    old_sig = """def get_aws_resource_types(
    account_identifier: str = Path(...),
    region: str = Path(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):"""
    new_sig = """def get_aws_resource_types(
    account_identifier: str = Path(...),
    region: str = Path(...),
    search: Optional[str] = Query(None),
    billable_only: bool = Query(False),
    billability: Optional[str] = Query(None),
    tagging_scope: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):"""
    content = content.replace(old_sig, new_sig)
    
    old_query = """    results = db.query(
        Resource.resource_type,
        func.count(Resource.id).label("resource_count")
    ).filter(
        Resource.cloud_account_id == account.id,
        Resource.provider == CloudProvider.AWS,
        Resource.location == region
    )"""
    new_query = """    base_query = db.query(
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
    results = base_query"""
    content = content.replace(old_query, new_query)
    
    old_loop = """        types.append(ResourceTypeCountSchema(
            resource_type=r.resource_type,
            display_name=display,
            resource_count=r.resource_count
        ))"""
    new_loop = """        types.append(ResourceTypeCountSchema(
            resource_type=r.resource_type,
            display_name=display,
            resource_count=r.resource_count,
            billability=r.billability,
            tagging_scope=r.tagging_scope
        ))"""
    content = content.replace(old_loop, new_loop)
    return content

content = patch_get_aws_resource_types(content)

def patch_get_aws_resources(content):
    old_sig = """def get_aws_resources(
    account_identifier: str = Path(...),
    region: str = Path(...),
    type: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):"""
    new_sig = """def get_aws_resources(
    account_identifier: str = Path(...),
    region: str = Path(...),
    type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    billable_only: bool = Query(False),
    billability: Optional[str] = Query(None),
    tagging_scope: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):"""
    content = content.replace(old_sig, new_sig)
    
    old_query = """    query = db.query(Resource).filter(
        Resource.cloud_account_id == account.id,
        Resource.provider == CloudProvider.AWS,
        Resource.location == region
    )
    
    if type:
        query = query.filter(Resource.resource_type == type)"""
    new_query = """    query = db.query(Resource).filter(
        Resource.cloud_account_id == account.id,
        Resource.provider == CloudProvider.AWS,
        Resource.location == region
    )
    
    query = apply_inventory_filters(query, search=search, billable_only=billable_only, billability=billability, tagging_scope=tagging_scope, resource_type=type)"""
    content = content.replace(old_query, new_query)
    
    old_schema = """        results.append(ResourceDetailSchema(
            id=r.id,
            resource_name=r.resource_name,
            resource_type=r.resource_type,
            resource_group=r.resource_group,
            location=r.location,
            resource_id=r.resource_id,
            cloud_tags=r.cloud_tags,
            tagging_scope=r.tagging_scope,
            status=status
        ))"""
    new_schema = """        results.append(ResourceDetailSchema(
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
        ))"""
    content = content.replace(old_schema, new_schema)
    return content

content = patch_get_aws_resources(content)

with open("app/api/inventory.py", "w") as f:
    f.write(content)

print("Updated inventory.py")
