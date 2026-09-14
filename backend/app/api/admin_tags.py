from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.user import User, UserRole
from app.api.deps import get_current_user
from app.models.cloud import CloudProvider
from app.models.master_data import TagDefinition, TagValue, TagProvider
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

def get_admin_user(current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return current_user

# Schemas for Admin
class TagDefinitionCreate(BaseModel):
    provider: TagProvider
    name: str
    description: Optional[str] = None
    mandatory: bool = False
    enabled: bool = True

class TagDefinitionUpdate(BaseModel):
    provider: Optional[TagProvider] = None
    description: Optional[str] = None
    mandatory: Optional[bool] = None
    enabled: Optional[bool] = None

class TagValueCreate(BaseModel):
    value: str
    display_name: Optional[str] = None
    enabled: bool = True

class TagValueUpdate(BaseModel):
    value: Optional[str] = None
    display_name: Optional[str] = None
    enabled: Optional[bool] = None

class BulkTagValueCreate(BaseModel):
    values: List[str]

from app.schemas.tagging import TagDefinitionSchema, TagValueSchema

@router.get("", response_model=List[TagDefinitionSchema])
def get_tag_definitions(
    provider: Optional[TagProvider] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    query = db.query(TagDefinition)
    if provider:
        from sqlalchemy import or_
        query = query.filter(
            or_(
                TagDefinition.provider == provider,
                TagDefinition.provider == TagProvider.SHARED
            )
        )
    return query.all()

@router.post("", response_model=TagDefinitionSchema)
def create_tag_definition(
    tag_in: TagDefinitionCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    existing = db.query(TagDefinition).filter(
        TagDefinition.provider == tag_in.provider,
        TagDefinition.name == tag_in.name
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Tag definition already exists for this provider")
    
    new_tag = TagDefinition(
        provider=tag_in.provider,
        name=tag_in.name,
        description=tag_in.description,
        mandatory=tag_in.mandatory,
        enabled=tag_in.enabled
    )
    db.add(new_tag)
    db.commit()
    db.refresh(new_tag)
    return new_tag

@router.put("/{tag_id}", response_model=TagDefinitionSchema)
def update_tag_definition(
    tag_id: int,
    tag_in: TagDefinitionUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    tag = db.query(TagDefinition).filter(TagDefinition.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag definition not found")
        
    update_data = tag_in.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(tag, key, value)
        
    db.commit()
    db.refresh(tag)
    return tag

@router.delete("/{tag_id}")
def delete_tag_definition(
    tag_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    tag = db.query(TagDefinition).filter(TagDefinition.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag definition not found")
        
    # Delete associated values first
    db.query(TagValue).filter(TagValue.tag_definition_id == tag_id).delete()
    db.delete(tag)
    db.commit()
    return {"message": "Tag definition deleted successfully"}

@router.post("/{tag_id}/values", response_model=TagValueSchema)
def create_tag_value(
    tag_id: int,
    val_in: TagValueCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    tag = db.query(TagDefinition).filter(TagDefinition.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag definition not found")
        
    # Check if value exists
    existing = db.query(TagValue).filter(
        TagValue.tag_definition_id == tag_id,
        TagValue.value == val_in.value
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Tag value already exists")
        
    new_val = TagValue(
        tag_definition_id=tag_id,
        value=val_in.value,
        display_name=val_in.display_name,
        enabled=val_in.enabled
    )
    db.add(new_val)
    db.commit()
    db.refresh(new_val)
    return new_val

@router.post("/{tag_id}/values/bulk", response_model=List[TagValueSchema])
def create_tag_values_bulk(
    tag_id: int,
    bulk_in: BulkTagValueCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    tag = db.query(TagDefinition).filter(TagDefinition.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag definition not found")

    existing_values = {v.value for v in db.query(TagValue).filter(TagValue.tag_definition_id == tag_id).all()}
    
    new_values = []
    for val_str in bulk_in.values:
        clean_val = val_str.strip()
        if not clean_val or clean_val in existing_values:
            continue
            
        new_val = TagValue(
            tag_definition_id=tag_id,
            value=clean_val,
            enabled=True
        )
        db.add(new_val)
        new_values.append(new_val)
        existing_values.add(clean_val)
        
    db.commit()
    for v in new_values:
        db.refresh(v)
        
    # Return all values for this tag so the UI can update
    return db.query(TagValue).filter(TagValue.tag_definition_id == tag_id).all()

@router.put("/values/{value_id}", response_model=TagValueSchema)
def update_tag_value(
    value_id: int,
    val_in: TagValueUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    val = db.query(TagValue).filter(TagValue.id == value_id).first()
    if not val:
        raise HTTPException(status_code=404, detail="Tag value not found")
        
    update_data = val_in.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(val, key, value)
        
    db.commit()
    db.refresh(val)
    return val

@router.delete("/values/{value_id}")
def delete_tag_value(
    value_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    val = db.query(TagValue).filter(TagValue.id == value_id).first()
    if not val:
        raise HTTPException(status_code=404, detail="Tag value not found")
        
    val.enabled = False
    db.commit()
    return {"message": "Tag value soft deleted successfully"}
