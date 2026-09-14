from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import jwt
from jwt import PyJWKClient
import logging

from app.database import get_db
from app.config import settings
from app.models.user import User, UserRole, UserStatus

logger = logging.getLogger(__name__)

security = HTTPBearer()

# Standard Microsoft Entra ID v2.0 JWKS endpoint
JWKS_URL = f"https://login.microsoftonline.com/{settings.ENTRA_TENANT_ID}/discovery/v2.0/keys"
jwks_client = PyJWKClient(JWKS_URL)

def verify_token(token: str) -> dict:
    if settings.AUTH_MODE == "local":
        try:
            data = jwt.decode(
                token,
                settings.LOCAL_AUTH_SECRET_KEY,
                algorithms=["HS256"]
            )
            return data
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token has expired.")
        except Exception as e:
            logger.error(f"Local token validation error: {e}")
            raise HTTPException(status_code=401, detail="Invalid authentication credentials.")

    # Entra logic
    if not settings.ENTRA_CLIENT_ID or not settings.ENTRA_TENANT_ID:
        raise HTTPException(status_code=500, detail="Entra ID configuration is missing.")

    try:
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        data = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=settings.ENTRA_CLIENT_ID,
            issuer=f"https://login.microsoftonline.com/{settings.ENTRA_TENANT_ID}/v2.0"
        )
        return data
    except jwt.exceptions.PyJWKClientError as e:
        logger.error(f"JWK Client Error: {e}")
        raise HTTPException(status_code=401, detail="Unable to fetch signing keys.")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired.")
    except jwt.InvalidAudienceError:
        raise HTTPException(status_code=401, detail="Invalid token audience.")
    except jwt.InvalidIssuerError:
        raise HTTPException(status_code=401, detail="Invalid token issuer.")
    except Exception as e:
        logger.error(f"Token validation error: {e}")
        raise HTTPException(status_code=401, detail="Invalid authentication credentials.")

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    token_data = verify_token(credentials.credentials)
    
    if settings.AUTH_MODE == "local":
        user_id = token_data.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Token missing subject claim.")
        user = db.query(User).filter(User.id == int(user_id)).first()
        if not user:
            raise HTTPException(status_code=401, detail="User not found.")
        if user.status != UserStatus.ACTIVE:
            raise HTTPException(status_code=403, detail="User account is disabled.")
        return user

    entra_oid = token_data.get("oid")
    email = token_data.get("preferred_username") or token_data.get("upn") or token_data.get("email")
    display_name = token_data.get("name")
    
    if not entra_oid or not email:
        raise HTTPException(status_code=401, detail="Token missing required claims (oid, email/preferred_username).")
    
    user = db.query(User).filter(User.entra_object_id == entra_oid).first()
    
    if not user:
        # Fallback to linking by email if entra_object_id was missing previously
        user = db.query(User).filter(User.email == email).first()
        if user:
            user.entra_object_id = entra_oid
            user.display_name = display_name
            db.commit()
            db.refresh(user)
    
    # Create user if it doesn't exist
    if not user:
        new_role = UserRole.USER
        if settings.BOOTSTRAP_ADMIN_EMAIL and email.lower() == settings.BOOTSTRAP_ADMIN_EMAIL.lower():
            new_role = UserRole.ADMIN
            
        user = User(
            entra_object_id=entra_oid,
            email=email,
            display_name=display_name,
            role=new_role,
            status=UserStatus.ACTIVE
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
    if user.status != UserStatus.ACTIVE:
        raise HTTPException(status_code=403, detail="User account is disabled.")
        
    return user

def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not enough permissions. Admin role required.")
    return current_user
