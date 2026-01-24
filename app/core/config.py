from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Safety Platform"
    api_prefix: str = "/api"
    
    # Security
    secret_key: str = "change_this_to_a_secure_random_key_in_production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # Database
    db_host: str = "127.0.0.1"
    db_port: int = 3306
    db_user: str = "root"
    db_password: str = "123456"
    db_name: str = "safety_platform"
    db_charset: str = "utf8mb4"

    model_config = SettingsConfigDict(env_prefix="SAFETY_", env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
