from pathlib import Path
from typing import Literal
from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    ENVIRONMENT: Literal['development','test','production'] = 'development'
    LOG_DIRECTORY: str = ''
    DEPLOYMENT_SECRET_FILES: dict[str,str] = {}
    DEPLOYMENT_KNOWN_HOSTS_FILE: str = ''
    REPOSITORY_SEEDS_FILE: str = ''
    WORKSPACE_RETENTION_DAYS: int = Field(default=7,ge=7)
    EVIDENCE_RETENTION_DAYS: int = Field(default=30,ge=30)
    TEMP_RETENTION_DAYS: int = Field(default=7,ge=7)
    CANDIDATE_RETENTION_HOURS: int = Field(default=1,ge=1)
    WORKSPACE_MIN_FREE_MB: int = Field(default=256,ge=0)
    SECRET_KEY: str = "your-secret-key-change-in-production"
    DATABASE_URL: str = "postgresql+psycopg://intellideploy:dev-only@127.0.0.1:55432/intellideploy_dev"
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:8081"]
    DEFAULT_BUDGET_UNITS: int = Field(default=10000, gt=0)
    HARD_CAP_UNITS: int = Field(default=100000, gt=0)
    DEEPSEEK_API_KEY: str = ""
    DEEPSEEK_BASE_URL: str = "https://api.deepseek.com"
    DEEPSEEK_MODEL: str = "deepseek-flash"
    ALGORITHM_MODE: Literal['baseline', 'shadow', 'hybrid'] = 'baseline'
    CAPABILITY_RESERVATION_UNITS: int = Field(default=1000, gt=0)
    CAPABILITY_HTTP_TIMEOUT_SECONDS: float = Field(default=120, gt=0)
    CAPABILITY_RETRY_DELAY_SECONDS: float = Field(default=0.25, ge=0)
    ARTIFACTS_ROOT: str = str(Path(__file__).resolve().parents[2] / "artifacts")
    ENABLE_EVALUATION_UI: bool = False
    PRICE_VERSION: str = 'dev-v1'
    FREE_GRANT_UNITS: int = Field(default=1000, ge=0)
    FREE_GRANT_POLICY_VERSION: str = 'initial-v1'
    FREE_GRANT_DAYS: int = Field(default=30, gt=0)
    FAILED_USAGE_RULE: str = '已发生且有证据的模型及执行用量计费，未用预留释放；平台故障按账本返还。'
    APP_IDENTITY_PRIVATE_KEY: str = ""
    APP_IDENTITY_PUBLIC_KEY: str = ""
    APP_IDENTITY_ISSUER: str = "intellideploy"
    APP_IDENTITY_TTL_SECONDS: int = Field(default=900, ge=60, le=3600)
    INSTANCE_FILES_ROOT: str = str(Path(__file__).resolve().parents[2] / "artifacts/instance-files")
    INSTANCE_SECRETS_ROOT: str = str(Path(__file__).resolve().parents[2] / "artifacts/instance-secrets")
    INSTANCE_FILE_MAX_BYTES: int = Field(default=10 * 1024 * 1024, gt=0)
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
    REPOSITORY_INDEX_PATH: str = str(Path(__file__).resolve().parents[2] / "artifacts/repository-index/current.json")
    AGENT_WORKSPACE_ROOT: str = str(Path(__file__).resolve().parents[2] / "artifacts/agent-workspaces")
    AGENT_EXECUTOR_IMAGE: str = ""
    RUNNER_URL: str = ""
    RUNNER_CA_FILE: str = ""
    RUNNER_CERT_FILE: str = ""
    RUNNER_KEY_FILE: str = ""
    RUNNER_RPC_TOKEN: str = ""
    PLATFORM_CAPABILITY_URL: str = ""
    INSTANCE_DATABASE_ADMIN_URL: str = ""
    INSTANCE_DATABASE_HOST: str = ""
    INSTANCE_POSTGRES_IMAGE: str = ""
    DEEPSEEK_MAX_OUTPUT_TOKENS: int = Field(default=2048,gt=0)
    DEEPSEEK_PRICE_PREFIX: str = 'model.flash'
    MAX_JOB_MODEL_CALLS: int = Field(default=40,gt=0)
    PAYMENT_PLATFORM_ORIGIN: str = ''
    PAYMENT_NOTIFY_BASE_URL: str = ''
    ALIPAY_APP_ID: str = ''
    ALIPAY_SELLER_ID: str = ''
    ALIPAY_GATEWAY: str = 'https://openapi.alipay.com/gateway.do'
    ALIPAY_PRIVATE_KEY_FILE: str = ''
    ALIPAY_PUBLIC_KEY_FILE: str = ''
    WECHAT_APP_ID: str = ''
    WECHAT_MCH_ID: str = ''
    WECHAT_MERCHANT_SERIAL: str = ''
    WECHAT_PRIVATE_KEY_FILE: str = ''
    WECHAT_PUBLIC_KEY_FILE: str = ''
    WECHAT_PLATFORM_SERIAL: str = ''
    WECHAT_API_V3_KEY_FILE: str = ''
    STRIPE_SECRET_KEY_FILE: str = ''
    STRIPE_WEBHOOK_SECRET_FILE: str = ''
    STRIPE_API_VERSION: str = '2025-03-31.basil'

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
    # 留空时镜像构建器会自动用 GHCR_* / KANIKO_DESTINATION_REGISTRY 生成并 upsert
    # 一个 kubernetes.io/dockerconfigjson 类型的 Secret。
    KANIKO_DOCKER_CONFIG_SECRET: str = "kaniko-registry-auth"
    KANIKO_JOB_TIMEOUT_SECONDS: int = 600
    KANIKO_CONTEXT_MAX_BYTES: int = 900_000
    # Kaniko build 出来后 push 到的 registry 前缀。
    # 留空（默认）→ 用 GHCR_SERVER/GHCR_NAMESPACE 推算（ghcr.io/<namespace>）。
    # 显式写明完整前缀（如 "registry.cn-hangzhou.aliyuncs.com/myns"）会优先生效。
    # 历史值 "sealos.hub:5000" 在 Sealos 用户命名空间内不可达，已废弃。
    KANIKO_DESTINATION_REGISTRY: str = ""
    # 仅当 push 到自签证书的内部 registry 时才打开；外部 registry（GHCR / DockerHub / ACR）必须关闭。
    KANIKO_INSECURE_REGISTRY: bool = False
    # Kaniko 拉 docker.io base image 用的镜像源（用户 Dockerfile `FROM alpine:3.20` 走这里）。
    # Sealos 杭州集群对 docker.io 直连不可达，但 docker.m.daocloud.io 可达。
    # 设为空字符串关闭此功能（让 Kaniko 走默认 docker.io）。
    KANIKO_REGISTRY_MIRROR: str = "docker.m.daocloud.io"
    # Sealos 用户命名空间默认 LimitRange 的 ephemeral-storage default 是 100Mi，
    # Kaniko 解 base image rootfs 直接超限会被 kubelet Evict。
    # 这里显式给两个容器写 requests/limits，覆盖默认值。
    # max 一般 >= 60Gi（Sealos 公有云常态），所以 4Gi 安全。
    KANIKO_EPHEMERAL_STORAGE_REQUEST: str = "512Mi"
    KANIKO_EPHEMERAL_STORAGE_LIMIT: str = "4Gi"
    # Kaniko 主容器内存上限（busybox initContainer 用不了多少，单独写就行）
    KANIKO_MEMORY_REQUEST: str = "512Mi"
    KANIKO_MEMORY_LIMIT: str = "4Gi"
    KANIKO_CPU_REQUEST: str = "200m"
    KANIKO_CPU_LIMIT: str = "2"

    # GitHub Container Registry（默认 Kaniko push 目标）
    GHCR_SERVER: str = "ghcr.io"
    GHCR_USERNAME: str = ""
    GHCR_TOKEN: str = ""
    GHCR_NAMESPACE: str = ""  # 留空则等同于 GHCR_USERNAME（小写）

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
        "env_file": str(Path(__file__).resolve().parents[1] / ".env"),
    }


settings = Settings()
