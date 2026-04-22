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

    # 杨钞越的降级生成服务地址
    FALLBACK_SERVICE_URL: str = "http://localhost:8001"

    # Redis配置
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_ENABLED: bool = False  # 默认关闭,避免开发环境没有Redis时报错

    # Sealos配置
    SEALOS_API_URL: str = "https://cloud.sealos.io/api"
    SEALOS_API_TOKEN: str = ""

    # 部署配置
    DEPLOYMENT_TIMEOUT: int = 300  # 5分钟
    DEPLOYMENT_POLL_INTERVAL: int = 5  # 5秒轮询间隔
    HEALTHCHECK_TIMEOUT: int = 30  # 30秒
    HEALTHCHECK_RETRIES: int = 3  # 健康检查重试3次
    HEALTHCHECK_INTERVAL: int = 5  # 健康检查间隔5秒

    # 自愈配置
    MAX_HEALING_RETRIES: int = 3  # 最多自愈3次
    PARALLEL_HEALING_COUNT: int = 3  # 并行试错数量
    HEALING_TIMEOUT: int = 600  # 自愈总超时10分钟

    model_config = {
        "env_file": ".env",
    }


settings = Settings()
