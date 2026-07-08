"""Configuration loaded from environment variables (12-factor style)."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    mongo_uri: str = "mongodb://localhost:27017"
    db_name: str = "catalog_db"
    rest_port: int = 8001
    grpc_port: int = 50051

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
