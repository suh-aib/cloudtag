from pydantic import BaseModel
from typing import List
from app.models.user import UserRole, UserStatus
from app.schemas.user import UserSchema

class PaginatedUserResponse(BaseModel):
    items: List[UserSchema]
    total: int
    page: int
    size: int
    pages: int

class UserUpdateRoleRequest(BaseModel):
    role: UserRole

class UserUpdateStatusRequest(BaseModel):
    status: UserStatus
