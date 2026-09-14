from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
import math

from app.database import get_db
from app.models.user import User, UserRole, UserStatus
from app.models.audit import AuditLog
from app.schemas.user import UserSchema
from app.schemas.admin_users import PaginatedUserResponse, UserUpdateRoleRequest, UserUpdateStatusRequest
from app.api.deps import get_admin_user

router = APIRouter()

@router.get("", response_model=PaginatedUserResponse)
def get_users(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    search: str = Query(None),
    role: UserRole = Query(None),
    status: UserStatus = Query(None),
    current_admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    query = db.query(User)
    
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                User.email.ilike(search_term),
                User.display_name.ilike(search_term)
            )
        )
        
    if role:
        query = query.filter(User.role == role)
        
    if status:
        query = query.filter(User.status == status)
        
    total = query.count()
    pages = math.ceil(total / size) if total > 0 else 1
    
    users = query.order_by(User.id.desc()).offset((page - 1) * size).limit(size).all()
    
    return PaginatedUserResponse(
        items=users,
        total=total,
        page=page,
        size=size,
        pages=pages
    )

@router.get("/{user_id}", response_model=UserSchema)
def get_user(
    user_id: int,
    current_admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.patch("/{user_id}/role", response_model=UserSchema)
def update_user_role(
    user_id: int,
    request: UserUpdateRoleRequest,
    current_admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    if current_admin.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot modify your own role")
        
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    old_role = user.role
    if old_role != request.role:
        user.role = request.role
        
        # Log audit
        audit_log = AuditLog(
            user_id=current_admin.id,
            action="UPDATE_USER_ROLE",
            entity_type="USER",
            entity_id=str(user.id),
            details={"old_value": old_role, "new_value": request.role}
        )
        db.add(audit_log)
        db.commit()
        db.refresh(user)
        
    return user

@router.patch("/{user_id}/status", response_model=UserSchema)
def update_user_status(
    user_id: int,
    request: UserUpdateStatusRequest,
    current_admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    if current_admin.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot modify your own status")
        
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    old_status = user.status
    if old_status != request.status:
        user.status = request.status
        
        # Log audit
        audit_log = AuditLog(
            user_id=current_admin.id,
            action="UPDATE_USER_STATUS",
            entity_type="USER",
            entity_id=str(user.id),
            details={"old_value": old_status, "new_value": request.status}
        )
        db.add(audit_log)
        db.commit()
        db.refresh(user)
        
    return user
