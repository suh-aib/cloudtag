from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.models.user import UserRole, UserStatus

class UserSchema(BaseModel):
    id: int
    entra_object_id: Optional[str]
    email: str
    display_name: Optional[str]
    role: UserRole
    status: UserStatus
    created_at: datetime
    updated_at: datetime
    last_login: Optional[datetime]

    class Config:
        from_attributes = True
