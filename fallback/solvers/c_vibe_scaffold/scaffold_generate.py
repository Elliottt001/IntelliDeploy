from __future__ import annotations

from fallback.schemas.plan import DockerSpec, FallbackPlan, GeneratedFile
from fallback.schemas.request import FallbackRequest
from fallback.schemas.response import ClassifyResponse
from fallback.services.template_loader import render_template
from fallback.solvers.a_direct_deploy.command_resolver import (
    build_env_specs,
    infer_app_name,
    render_env_example,
    resolve_base_image,
    resolve_container_port,
    resolve_healthcheck_path,
    resolve_install_command,
    resolve_start_command,
)


def _backend_feature_blocks(template_family: str, components: list[str]) -> str:
    blocks: list[str] = []
    if "chat_endpoint" in components:
        if template_family == "python_fastapi":
            blocks.append(
                """
class ChatRequest(BaseModel):
    message: str


@app.post("/chat")
def chat(payload: ChatRequest):
    return {"reply": f"echo: {payload.message}"}
""".strip()
            )
        elif template_family == "python_flask":
            blocks.append(
                """
@app.post("/chat")
def chat():
    payload = request.get_json(silent=True) or {}
    return jsonify({"reply": f"echo: {payload.get('message', '')}"})
""".strip()
            )
        elif template_family == "node_express":
            blocks.append(
                """
app.post("/chat", (req, res) => {
  const message = req.body?.message ?? "";
  res.json({ reply: `echo: ${message}` });
});
""".strip()
            )
    if "auth_module" in components:
        if template_family == "python_fastapi":
            blocks.append(
                """
@app.post("/auth/login")
def login():
    return {"token": "demo-token"}
""".strip()
            )
        elif template_family == "python_flask":
            blocks.append(
                """
@app.post("/auth/login")
def login():
    return jsonify({"token": "demo-token"})
""".strip()
            )
        elif template_family == "node_express":
            blocks.append(
                """
app.post("/auth/login", (_req, res) => {
  res.json({ token: "demo-token" });
});
""".strip()
            )
    if "task_crud" in components:
        if template_family == "python_fastapi":
            blocks.append(
                """
_tasks = [{"id": 1, "title": "first-task"}]


@app.get("/tasks")
def list_tasks():
    return {"items": _tasks}
""".strip()
            )
        elif template_family == "python_flask":
            blocks.append(
                """
_tasks = [{"id": 1, "title": "first-task"}]


@app.get("/tasks")
def list_tasks():
    return jsonify({"items": _tasks})
""".strip()
            )
        elif template_family == "node_express":
            blocks.append(
                """
const tasks = [{ id: 1, title: "first-task" }];

app.get("/tasks", (_req, res) => {
  res.json({ items: tasks });
});
""".strip()
            )
    if "webhook_handler" in components and template_family == "python_fastapi":
        blocks.append(
            """
@app.post("/webhook")
def webhook(payload: dict):
    return {"received": True, "payload_keys": list(payload.keys())}
""".strip()
        )
    return "\n\n".join(blocks).strip()


def _frontend_feature_markup(components: list[str]) -> str:
    lines = ["<li>Deployment-ready scaffold</li>"]
    if "chat_endpoint" in components:
        lines.append("<li>Chat interaction placeholder</li>")
    if "auth_module" in components:
        lines.append("<li>Authentication flow placeholder</li>")
    if "task_crud" in components:
        lines.append("<li>Task list placeholder</li>")
    if "payment_adapter" in components:
        lines.append("<li>Payment integration placeholder</li>")
    return "\n        ".join(lines)


def build_template_project(
    request: FallbackRequest,
    classify_response: ClassifyResponse,
    *,
    template_family: str,
    components: list[str] | None = None,
    assumed_env_vars: list[str] | None = None,
    artifact_type: str = "TEMPLATE_PROJECT",
    summary: str,
) -> FallbackPlan:
    components = components or ["healthcheck"]
    port = resolve_container_port(request, classify_response)
    start_command = resolve_start_command(request, classify_response, port=port)
    install_command = resolve_install_command(classify_response) or ""
    base_image = resolve_base_image(classify_response)
    healthcheck_path = resolve_healthcheck_path(request, classify_response)
    app_name = infer_app_name(request, classify_response)

    env_vars = build_env_specs(classify_response, assumed_names=assumed_env_vars)
    generated_files: list[GeneratedFile] = []

    template_map = {
        "python_fastapi": [
            ("main.py", "main.py.template"),
            ("requirements.txt", "requirements.txt.template"),
            ("README.md", "README.md.template"),
        ],
        "python_flask": [
            ("app.py", "app.py.template"),
            ("requirements.txt", "requirements.txt.template"),
            ("README.md", "README.md.template"),
        ],
        "node_express": [
            ("server.js", "server.js.template"),
            ("package.json", "package.json.template"),
            ("README.md", "README.md.template"),
        ],
        "react_vite": [
            ("src/App.jsx", "src_App.jsx.template"),
            ("package.json", "package.json.template"),
            ("README.md", "README.md.template"),
        ],
        "nextjs": [
            ("app/page.tsx", "app_page.tsx.template"),
            ("package.json", "package.json.template"),
            ("README.md", "README.md.template"),
        ],
    }

    variables = {
        "app_name": app_name,
        "port": port,
        "start_command": start_command,
        "install_command": install_command,
        "base_image": base_image,
        "healthcheck_path": healthcheck_path or "/",
        "feature_blocks": _backend_feature_blocks(template_family, components),
        "feature_markup": _frontend_feature_markup(components),
    }
    for output_path, template_name in template_map[template_family]:
        generated_files.append(
            GeneratedFile(
                path=output_path,
                content=render_template(template_family, template_name, variables),
            )
        )

    dockerfile_content = render_template(
        template_family,
        "Dockerfile.template",
        variables,
    )
    docker_spec = DockerSpec(
        dockerfile_content=dockerfile_content,
        start_command=start_command,
        exposed_port=port,
        base_image=base_image,
        package_manager=classify_response.repo_fact_summary.package_manager or ("pip" if template_family.startswith("python_") else "npm"),
        install_command=install_command,
        healthcheck_path=healthcheck_path,
    )
    generated_files.append(GeneratedFile(path="Dockerfile", content=dockerfile_content))

    if env_vars:
        generated_files.append(GeneratedFile(path=".env.example", content=render_env_example(env_vars)))

    return FallbackPlan(
        decision="C",
        generated_files=generated_files,
        modified_files=[],
        docker_spec=docker_spec,
        env_vars=env_vars,
        artifact_type=artifact_type,
        warnings=[],
        summary=summary,
        deploy_ready=not any(env_var.source == "ASSUMED" and env_var.required for env_var in env_vars),
        next_action="DEPLOY",
        source_repo_url=classify_response.repo_fact_summary.repo_url,
    )


def scaffold_generate(request: FallbackRequest, classify_response: ClassifyResponse, *, template_family: str) -> FallbackPlan:
    return build_template_project(
        request,
        classify_response,
        template_family=template_family,
        artifact_type="TEMPLATE_PROJECT",
        summary="Built a minimal runnable scaffold from the selected golden template.",
    )

