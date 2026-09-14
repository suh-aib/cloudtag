import re

with open("app/api/inventory.py", "r") as f:
    content = f.read()

# Add imports if missing
if "from sqlalchemy import or_" not in content:
    content = content.replace("from sqlalchemy import func", "from sqlalchemy import func, or_")

if "from app.models.resource import Resource, TaggingScope" in content:
    content = content.replace("from app.models.resource import Resource, TaggingScope", "from app.models.resource import Resource, TaggingScope, Billability")

# Add filter utility
filter_util = """
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
"""

if "def apply_inventory_filters" not in content:
    content = content.replace("router = APIRouter()", "router = APIRouter()\n" + filter_util)

# Now, we need to update every endpoint to accept these parameters and apply them.
import ast
print("Successfully generated script.")
with open("app/api/inventory.py", "w") as f:
    f.write(content)
