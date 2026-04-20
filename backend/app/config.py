from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    SECRET_KEY: str = "your-secret-key-change-in-production"
    DATABASE_URL: str = "sqlite:///./intellideploy.db"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    ALGORITHM: str = "HS256"
    MODEL_API: str = ""
    MODEL_KEY: str = ""
    MODEL_NAME: str = ""
    BASE_URL: str = ""
    API_KEY: str = ""
    SEALOS_DOMAIN_SUFFIX: str = "usw.sealos.io"

    model_config = {
        "env_file": ".env",
    }


settings = Settings()
