from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime

from app.database import get_db
from app.models.user import User, UserStatus
from app.schemas.user import UserSchema
from app.api.deps import get_current_user

router = APIRouter()

@router.get("/me", response_model=UserSchema)
def read_users_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Returns the current authenticated user's profile.
    Updates the last_login timestamp automatically.
    """
    # Update last login timestamp
    current_user.last_login = datetime.utcnow()
    db.commit()
    db.refresh(current_user)
    return current_user

from pydantic import BaseModel
from fastapi import HTTPException
from app.utils.security import verify_password
import jwt
from app.config import settings

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

@router.post("/login", response_model=TokenResponse)
def login_local(req: LoginRequest, db: Session = Depends(get_db)):
    if settings.AUTH_MODE != "local":
        raise HTTPException(status_code=400, detail="Local login is disabled. Use Microsoft Entra ID.")
        
    user = db.query(User).filter(User.email == req.username).first()
    if not user or not user.password_hash:
        raise HTTPException(status_code=401, detail="Invalid credentials.")
        
    if not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials.")
        
    if user.status != UserStatus.ACTIVE:
        raise HTTPException(status_code=403, detail="User account is disabled.")

    # Create local JWT
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "name": user.display_name or user.email,
        "role": user.role,
        "exp": datetime.utcnow().timestamp() + 86400 * 7 # 7 days
    }
    
    token = jwt.encode(payload, settings.LOCAL_AUTH_SECRET_KEY, algorithm="HS256")
    return {"access_token": token}
