from __future__ import annotations

import re

from fallback.schemas.plan import EnvVarSpec
from fallback.schemas.request import FallbackRequest
from fallback.schemas.response import ClassifyResponse


def _clean_command(command: str | None) -> str | None:
    if not command:
        return None
    return command.strip().strip("`").strip()


def resolve_template_family(classify_response: ClassifyResponse) -> str:
    preferred_framework = (classify_response.user_intent_summary.preferred_framework or "").lower()
    preferred_language = (classify_response.user_intent_summary.preferred_language or "").lower()
    detected_framework = (classify_response.repo_fact_summary.detected_framework or "").lower()
    target_app_type = classify_response.user_intent_summary.target_app_type

    marker = " ".join([preferred_framework, detected_framework, preferred_language, target_app_type]).lower()
    if "spring" in marker or "springboot" in marker or preferred_language == "java":
        return "java_springboot"
    if "django" in marker:
        return "python_django"
    if "go" in marker or "golang" in marker:
        return "go_gin"
    if "vue" in marker:
        return "vue_vite"
    if target_app_type == "static_site" and not any(item in marker for item in ("react", "vue", "vite", "next")):
        return "static_site"
    if "next" in marker:
        return "nextjs"
    if "react" in marker or "vite" in marker or target_app_type in {"frontend_web", "dashboard"}:
        return "react_vite"
    if "worker" in marker or "automation" in marker or target_app_type in {"automation_tool", "worker"}:
        return "python_worker" if preferred_language in {"python", ""} else "node_express"
    if "flask" in marker:
        return "python_flask"
    if "express" in marker or preferred_language in {"javascript", "typescript", "node"}:
        return "node_express"
    return "python_fastapi"


def resolve_container_port(request: FallbackRequest, classify_response: ClassifyResponse) -> int:
    """Canonical container-port resolution — IntelliDeploy 内部唯一的端口决策点。

    优先级（高 → 低）——核心准则："仓库硬证据 > Agent 猜测 > 框架默认"：

    1) `target_port_candidates[0]` —— 由 extract_facts 从**仓库自身**抽出的硬证据：
       - 已有 Dockerfile 的 `EXPOSE` 指令
       - 源码里出现的 listen/bind 端口字面量
       这是唯一能确认 app 启动后真实绑定端口的来源，必须最高优先。
       否则 Yacht 这种自带 Dockerfile（EXPOSE 8000）的项目会被 Builder Agent
       的 8080 启发式猜测覆盖，导致 plan 内部自相矛盾（docker_spec.exposed_port
       与 target_port_candidates[0] 不一致 → port_validator 报
       `TARGET_PORT_MISMATCH` blocking → 整管线降级到 ARTIFACT_NOT_READY）。

    2) `constraints.target_port` —— 当前由 Multi-Agent Builder Agent 写入，
       属于"LLM 启发式猜测"。仅在 repo 没有任何硬证据时使用，作为比模板默认
       值更智能的兜底。未来如果引入用户显式指定的端口字段，应单独建模为
       `constraints.user_target_port` 并放在优先级 (1) 之上。

    3) `detected_ports` —— 与 target_port_candidates 通常重合，分开存以兼容
       未来 detector 拆分。

    4) 框架默认值。

    这道排序是 IntelliDeploy 端口合约的唯一权威来源。port_validator 比较的
    `target_port_candidates[0]` 与 `docker_spec.exposed_port` 由它保证一致：
    候选若存在则两边都用它；候选若不存在则 validator 那边也不会拉出
    target_port 来比，自然不冲突。
    """
    if classify_response.repo_fact_summary.target_port_candidates:
        return classify_response.repo_fact_summary.target_port_candidates[0]

    constraints = request.user_intent.constraints or {}
    target_port = constraints.get("target_port")
    if isinstance(target_port, int) and target_port > 0:
        return target_port

    if classify_response.repo_fact_summary.detected_ports:
        return classify_response.repo_fact_summary.detected_ports[0]
    if classify_response.user_intent_summary.target_app_type in {"frontend_web", "dashboard", "static_site"}:
        return 80
    return 8000


def _resolve_python_module(entry_candidates: list[str], fallback_name: str) -> str:
    for candidate in entry_candidates:
        if candidate.endswith(".py"):
            return candidate[:-3].replace("/", ".").replace("\\", ".")
    return fallback_name


def resolve_start_command(request: FallbackRequest, classify_response: ClassifyResponse, *, port: int) -> str:
    for command in classify_response.repo_fact_summary.detected_start_commands:
        cleaned = _clean_command(command)
        if cleaned:
            return cleaned

    template_family = resolve_template_family(classify_response)
    entry_candidates = classify_response.repo_fact_summary.entry_candidates
    if template_family == "python_fastapi":
        module_name = _resolve_python_module(entry_candidates, "main")
        return f"uvicorn {module_name}:app --host 0.0.0.0 --port {port}"
    if template_family == "python_flask":
        entry = next((candidate for candidate in entry_candidates if candidate.endswith(".py")), "app.py")
        return f"python {entry}"
    if template_family == "node_express":
        entry = next((candidate for candidate in entry_candidates if candidate.endswith(".js")), "server.js")
        return f"node {entry}"
    if template_family == "python_django":
        return f"gunicorn app.wsgi:application --bind 0.0.0.0:{port}"
    if template_family == "go_gin":
        return "./server"
    if template_family == "java_springboot":
        return "java -jar app.jar"
    if template_family == "python_worker":
        entry = next((candidate for candidate in entry_candidates if candidate.endswith(".py")), "worker.py")
        return f"python {entry}"
    if template_family == "nextjs":
        return "npm run start"
    return 'nginx -g "daemon off;"'


def _has_lock_file(classify_response: ClassifyResponse, *names: str) -> bool:
    """检查 classify 阶段是否在 repo 里发现指定 lockfile（按 basename 匹配）。

    用来在没 lockfile 时把 `npm ci` / `--frozen-lockfile` / `uv sync --frozen`
    自动降级成普通 install —— 否则 Kaniko build 会在 `npm ci` 这步直接报
    EUSAGE: missing package-lock.json 而炸。
    """
    targets = {name.lower() for name in names}
    for path in classify_response.repo_fact_summary.lock_files or []:
        basename = path.rsplit("/", 1)[-1].lower()
        if basename in targets:
            return True
    return False


def resolve_install_command(classify_response: ClassifyResponse) -> str | None:
    package_manager = classify_response.repo_fact_summary.package_manager
    if package_manager == "npm":
        # 无 package-lock.json 时 `npm ci` 必定失败，降级成 `npm install`。
        return "npm ci" if _has_lock_file(classify_response, "package-lock.json") else "npm install"
    if package_manager == "pnpm":
        return (
            "pnpm install --frozen-lockfile"
            if _has_lock_file(classify_response, "pnpm-lock.yaml")
            else "pnpm install"
        )
    if package_manager == "yarn":
        return (
            "yarn install --frozen-lockfile"
            if _has_lock_file(classify_response, "yarn.lock")
            else "yarn install"
        )
    if package_manager == "poetry":
        return "poetry install --no-interaction --no-root"
    if package_manager == "uv":
        return "uv sync --frozen" if _has_lock_file(classify_response, "uv.lock") else "uv sync"
    if package_manager == "pip":
        return "pip install --no-cache-dir -r requirements.txt"
    if package_manager == "go":
        return "go mod download"
    if package_manager == "maven":
        return "mvn -B -DskipTests package"
    if package_manager == "gradle":
        return "./gradlew bootJar --no-daemon"

    template_family = resolve_template_family(classify_response)
    if template_family.startswith("python_"):
        return "pip install --no-cache-dir -r requirements.txt"
    if template_family in {"node_express", "nextjs", "react_vite", "vue_vite"}:
        # 模板兜底分支 —— 同样要看是否真的有 package-lock.json。
        return "npm ci" if _has_lock_file(classify_response, "package-lock.json") else "npm install"
    if template_family == "go_gin":
        return "go mod download"
    if template_family == "java_springboot":
        return "mvn -B -DskipTests package"
    return None


def resolve_base_image(classify_response: ClassifyResponse) -> str:
    template_family = resolve_template_family(classify_response)
    if template_family in {"python_fastapi", "python_flask", "python_django", "python_worker"}:
        return "python:3.11-slim"
    if template_family in {"react_vite", "vue_vite", "static_site"}:
        return "nginx:1.27-alpine"
    if template_family == "go_gin":
        return "golang:1.22-alpine"
    if template_family == "java_springboot":
        return "eclipse-temurin:21-jre-alpine"
    return "node:20-alpine"


def resolve_healthcheck_path(request: FallbackRequest, classify_response: ClassifyResponse) -> str | None:
    target_app_type = classify_response.user_intent_summary.target_app_type
    if target_app_type in {"backend_api", "chatbot", "automation_tool"}:
        return "/health"
    if resolve_template_family(classify_response) in {"react_vite", "vue_vite", "static_site"}:
        return "/"
    return None


def build_env_specs(classify_response: ClassifyResponse, assumed_names: list[str] | None = None) -> list[EnvVarSpec]:
    env_specs = [
        EnvVarSpec(
            name=item.name,
            required=item.required,
            example_value=item.example_value,
            description=item.description,
            source=item.source,
        )
        for item in classify_response.repo_fact_summary.env_var_details
    ]

    existing = {item.name for item in env_specs}
    for name in assumed_names or []:
        if name in existing:
            continue
        env_specs.append(
            EnvVarSpec(
                name=name,
                required=True,
                example_value="replace-me",
                description="Generated from user intent during fallback scaffold.",
                source="ASSUMED",
            )
        )
    return env_specs


def render_env_example(env_specs: list[EnvVarSpec]) -> str:
    lines = []
    for env_var in env_specs:
        value = env_var.example_value or "replace-me"
        lines.append(f"{env_var.name}={value}")
    return "\n".join(lines).strip() + ("\n" if lines else "")


def infer_app_name(request: FallbackRequest, classify_response: ClassifyResponse) -> str:
    if classify_response.repo_fact_summary.description:
        return classify_response.repo_fact_summary.description.strip()
    query = re.sub(r"\s+", " ", request.raw_query or "").strip()
    return query[:60] if query else "Fallback App"
