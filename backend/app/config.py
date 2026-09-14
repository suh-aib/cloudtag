from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    APP_NAME: str = "CloudTag"
    APP_ENV: str = "development"
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000
    
    MYSQL_HOST: str = "localhost"
    MYSQL_PORT: int = 3306
    MYSQL_DATABASE: str = "cloudtag"
    MYSQL_USER: str = "cloudtag"
    MYSQL_PASSWORD: str = ""
    
    FRONTEND_URL: str = "http://localhost:5173"
    
    ENTRA_CLIENT_ID: str = ""
    ENTRA_TENANT_ID: str = ""
    BOOTSTRAP_ADMIN_EMAIL: str = ""

    # Local Auth Configuration
    AUTH_MODE: str = "entra"  # "entra" or "local"
    CLOUDTAG_LOCAL_ADMIN_USERNAME: str = "cloudtag.suhaib"
    CLOUDTAG_LOCAL_ADMIN_PASSWORD: str = ""
    LOCAL_AUTH_SECRET_KEY: str = "change-me-in-production-or-use-entra"
    
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def database_url(self) -> str:
        # Using PyMySQL as the MySQL driver
        if self.MYSQL_PASSWORD:
            return f"mysql+pymysql://{self.MYSQL_USER}:{self.MYSQL_PASSWORD}@{self.MYSQL_HOST}:{self.MYSQL_PORT}/{self.MYSQL_DATABASE}"
        return f"mysql+pymysql://{self.MYSQL_USER}@{self.MYSQL_HOST}:{self.MYSQL_PORT}/{self.MYSQL_DATABASE}"

settings = Settings()
