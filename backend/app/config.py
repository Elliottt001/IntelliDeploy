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
        "env_file": ".env",
    }


settings = Settings()
