from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

# Base directory for the project (lec14)
BASE_DIR = Path(__file__).resolve().parent.parent.parent
ENV_FILE = BASE_DIR / ".env"

class Settings(BaseSettings):
    # Google AI / Gemini Configuration
    google_api_key: Optional[str] = Field(default=None, alias="GOOGLE_API_KEY")
    gemini_model: str = Field(default="gemini-1.5-flash", alias="GEMINI_MODEL")

    # GitHub Integration
    github_token: Optional[str] = Field(default=None, alias="GITHUB_TOKEN")
    github_webhook_secret: Optional[str] = Field(default=None, alias="GITHUB_WEBHOOK_SECRET")

    # SMTP Email Configuration
    smtp_email: Optional[str] = Field(default=None, alias="SMTP_EMAIL")
    smtp_app_password: Optional[str] = Field(default=None, alias="SMTP_APP_PASSWORD")
    smtp_host: str = Field(default="smtp.gmail.com", alias="SMTP_HOST")
    smtp_port: int = Field(default=587, alias="SMTP_PORT")
    recipient_email: Optional[str] = Field(default=None, alias="RECIPIENT_EMAIL")

    # Application settings
    database_url: str = Field(
        default=f"sqlite:///{BASE_DIR / 'pr_chronicler.db'}", 
        alias="DATABASE_URL"
    )
    log_file_path: str = Field(
        default=str(BASE_DIR / "pr_chronicler.log"),
        alias="LOG_FILE_PATH"
    )
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000", "*"]

    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE) if ENV_FILE.exists() else None,
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
