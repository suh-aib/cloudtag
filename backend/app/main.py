import logging
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.api import (
    health, auth, admin_users, cloud, sharepoint, csv_upload,
    inventory, tagging, admin_tags, approvals, scripts,
    admin_assignments, my_assignments
)

# Setup basic logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
)

# CORS configuration
origins = [
    settings.FRONTEND_URL,
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error"},
    )

# Include Routers
app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(admin_users.router, prefix="/api/admin/users", tags=["admin-users"])
app.include_router(admin_tags.router, prefix="/api/admin/tags", tags=["admin-tags"])
app.include_router(cloud.router, prefix="/api/admin/cloud", tags=["admin-cloud"])
app.include_router(sharepoint.router, prefix="/api/admin/sharepoint", tags=["sharepoint"])
app.include_router(csv_upload.router, prefix="/api/admin/csv-upload", tags=["csv_upload"])
app.include_router(admin_assignments.router, prefix="/api/admin", tags=["admin_assignments"])
app.include_router(my_assignments.router, prefix="/api/my", tags=["my_assignments"])
app.include_router(inventory.router, prefix="/api/inventory", tags=["inventory"])
app.include_router(tagging.router, prefix="/api/tagging", tags=["tagging"])
app.include_router(approvals.router, prefix="/api/approvals", tags=["approvals"])
app.include_router(scripts.router, prefix="/api/admin/scripts", tags=["admin-scripts"])

@app.on_event("startup")
async def startup_event():
    logger.info(f"Starting {settings.APP_NAME} API on {settings.APP_ENV} environment. Auth Mode: {settings.AUTH_MODE}")
    
    from app.database import SessionLocal, engine, Base
    import app.models  # Ensure all models are registered with Base
    from app.models.user import User, UserRole, UserStatus
    from sqlalchemy import text, inspect
    from app.utils.security import get_password_hash
    import sys
    
    # Initialize database schema idempotently (creates missing tables)
    logger.info("Initializing database schema...")
    Base.metadata.create_all(bind=engine)
    logger.info("Database schema initialized.")
    
    db = SessionLocal()
    try:
        # DB Migration: Safely add password_hash column if it doesn't exist
        inspector = inspect(engine)
        if 'users' in inspector.get_table_names():
            columns = [col['name'] for col in inspector.get_columns('users')]
            if 'password_hash' not in columns:
                try:
                    db.execute(text("ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) DEFAULT NULL"))
                    db.commit()
                    logger.info("Added password_hash column to users table.")
                except Exception as e:
                    db.rollback()
                    logger.warning(f"Could not add password_hash column: {e}")
            
        if settings.AUTH_MODE == "local":
            if not settings.CLOUDTAG_LOCAL_ADMIN_PASSWORD or settings.CLOUDTAG_LOCAL_ADMIN_PASSWORD == "<set-locally>":
                logger.error("CLOUDTAG_LOCAL_ADMIN_PASSWORD is not set in environment. Required for AUTH_MODE=local.")
                sys.exit(1)
                
            admin_user = db.query(User).filter(User.email == settings.CLOUDTAG_LOCAL_ADMIN_USERNAME).first()
            if not admin_user:
                logger.info(f"Bootstrapping local admin: {settings.CLOUDTAG_LOCAL_ADMIN_USERNAME}")
                hashed_pw = get_password_hash(settings.CLOUDTAG_LOCAL_ADMIN_PASSWORD)
                
                admin_user = User(
                    email=settings.CLOUDTAG_LOCAL_ADMIN_USERNAME,
                    display_name="Local Administrator",
                    role=UserRole.ADMIN,
                    status=UserStatus.ACTIVE,
                    password_hash=hashed_pw
                )
                db.add(admin_user)
                db.commit()
            else:
                logger.info(f"Local admin {settings.CLOUDTAG_LOCAL_ADMIN_USERNAME} already exists.")
    finally:
        db.close()
