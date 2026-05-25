from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    SECRET_KEY: str = "your-secret-key-change-in-production"
    DATABASE_URL: str = (
        "postgresql+psycopg://postgres:your_password@"
        "127.0.0.1:5432/intellideploy"
    )
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    ALGORITHM: str = "HS256"
    MODEL_API: str = ""
    MODEL_KEY: str = ""
    MODEL_NAME: str = ""
    BASE_URL: str = ""
    API_KEY: str = ""
    SEALOS_DOMAIN_SUFFIX: str = "usw.sealos.io"
    GITHUB_TOKEN: str = ""
    GITHUB_SEARCH_TOKENS: str = ""
    GITHUB_SEARCH_TIMEOUT_SECONDS: float = 10.0

    # 降级生成服务地址（"inprocess" 走进程内直调，避免依赖独立 HTTP 服务）
    FALLBACK_SERVICE_URL: str = "inprocess"

    # Redis配置
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_ENABLED: bool = False  # 默认关闭,避免开发环境没有Redis时报错

    # Sealos配置
    SEALOS_API_URL: str = "https://cloud.sealos.io/api"
    SEALOS_API_TOKEN: str = ""
    SEALOS_BUILD_TIMEOUT_SECONDS: int = 600
    SEALOS_BUILD_POLL_INTERVAL_SECONDS: int = 5

    # Kaniko云端构建配置
    KANIKO_KUBECONFIG: str = ""
    KANIKO_NAMESPACE: str = "default"
    KANIKO_IMAGE: str = "gcr.io/kaniko-project/executor:latest"
    KANIKO_DOCKER_CONFIG_SECRET: str = ""
    KANIKO_JOB_TIMEOUT_SECONDS: int = 600
    KANIKO_CONTEXT_MAX_BYTES: int = 900_000
    # Kaniko build 出来后 push 到的 registry 前缀。
    # Sealos 集群内部 registry 是 sealos.hub:5000，
    # 同集群的 Job 不需要外部凭证；留空则不加前缀（push 到 docker.io）。
    KANIKO_DESTINATION_REGISTRY: str = "sealos.hub:5000"
    # Kaniko push 到自签证书的内部 registry 时需要加 --insecure。
    KANIKO_INSECURE_REGISTRY: bool = True

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
