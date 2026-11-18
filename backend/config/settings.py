"""
NexusAI — Configuration Management
Loads settings from environment variables / .env file
"""
from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Optional
import os


class Settings(BaseSettings):
    # App
    app_name: str = Field(default="NexusAI", env="APP_NAME")
    host: str = Field(default="127.0.0.1", env="HOST")
    port: int = Field(default=8765, env="PORT")
    debug: bool = Field(default=True, env="DEBUG")

    # LLM Provider
    llm_provider: str = Field(default="lmstudio", env="LLM_PROVIDER")

    # LM Studio (local)
    lm_studio_base_url: str = Field(
        default="http://localhost:1234/v1", env="LM_STUDIO_BASE_URL"
    )
    lm_studio_model: str = Field(default="local-model", env="LM_STUDIO_MODEL")

    # ngrok tunnel (optional remote access to LM Studio)
    ngrok_base_url: Optional[str] = Field(default=None, env="NGROK_BASE_URL")

    # Cloud API Keys (fallback)
    openai_api_key: Optional[str] = Field(default=None, env="OPENAI_API_KEY")
    anthropic_api_key: Optional[str] = Field(default=None, env="ANTHROPIC_API_KEY")
    gemini_api_key: Optional[str] = Field(default=None, env="GEMINI_API_KEY")

    # Data paths
    data_dir: str = Field(default="./data", env="DATA_DIR")
    chromadb_path: str = Field(default="./data/chromadb", env="CHROMADB_PATH")
    sqlite_path: str = Field(default="./data/nexusai.db", env="SQLITE_PATH")

    # Authentication / OTP
    firebase_service_account_path: Optional[str] = Field(default=None, env="FIREBASE_SERVICE_ACCOUNT_PATH")
    firebase_project_id: Optional[str] = Field(default=None, env="FIREBASE_PROJECT_ID")
    smtp_host: Optional[str] = Field(default=None, env="SMTP_HOST")
    smtp_port: int = Field(default=587, env="SMTP_PORT")
    smtp_user: Optional[str] = Field(default=None, env="SMTP_USER")
    smtp_pass: Optional[str] = Field(default=None, env="SMTP_PASS")
    smtp_from: Optional[str] = Field(default=None, env="SMTP_FROM")
    otp_hmac_secret: Optional[str] = Field(default=None, env="OTP_HMAC_SECRET")
    public_api_base_url: Optional[str] = Field(default=None, env="PUBLIC_API_BASE_URL")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

    def get_llm_base_url(self) -> str:
        """Returns the active LLM base URL depending on provider setting."""
        if self.llm_provider == "ngrok" and self.ngrok_base_url:
            return self.ngrok_base_url
        elif self.llm_provider == "lmstudio":
            return self.lm_studio_base_url
        return self.lm_studio_base_url  # default to local

    def get_llm_model(self) -> str:
        """Returns the litellm-formatted model string."""
        if self.llm_provider in ("lmstudio", "ngrok"):
            return f"openai/{self.lm_studio_model}"
        elif self.llm_provider == "openai":
            return "gpt-4o"
        elif self.llm_provider == "anthropic":
            return "claude-3-5-sonnet-20241022"
        elif self.llm_provider == "gemini":
            return "gemini/gemini-2.0-flash"
        return f"openai/{self.lm_studio_model}"


# Singleton settings instance
settings = Settings()

# Ensure data directories exist
os.makedirs(settings.data_dir, exist_ok=True)
os.makedirs(settings.chromadb_path, exist_ok=True)
