from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


MODEL_EXTENSIONS = (".pt", ".pth", ".onnx", ".bin", ".safetensors", ".ckpt")


def _normalize_paths(file_tree: list[Any]) -> list[str]:
    output: list[str] = []

    def visit(node: Any) -> None:
        if isinstance(node, str):
            output.append(node.replace("\\", "/"))
            return
        if isinstance(node, dict):
            path = (node.get("path") or node.get("name") or "").replace("\\", "/")
            if path and node.get("type", "file") != "dir":
                output.append(path)
            for child in node.get("children", []):
                visit(child)

    for item in file_tree:
        visit(item)
    return output


def detect_archive_risk(repo_info: dict) -> list[str]:
    return ["repository_archived"] if repo_info.get("is_archived") else []


def detect_stale_risk(repo_info: dict) -> list[str]:
    last_commit_at = repo_info.get("last_commit_at")
    if not last_commit_at:
        return []
    try:
        parsed = datetime.fromisoformat(str(last_commit_at).replace("Z", "+00:00"))
    except ValueError:
        return []
    age_days = (datetime.now(timezone.utc) - parsed.astimezone(timezone.utc)).days
    return ["stale_repository"] if age_days > 730 else []


def detect_fork_risk(repo_info: dict) -> list[str]:
    topic_blob = " ".join(repo_info.get("topics", [])).lower()
    description = (repo_info.get("description") or "").lower()
    if "fork" in topic_blob or "fork" in description:
        return ["possible_fork"]
    return []


def detect_gpu_risk(repo_fact_summary: dict, key_files: dict[str, str]) -> list[str]:
    blob = "\n".join(key_files.values()).lower()
    if any(token in blob for token in ("cuda", "tensorflow-gpu", "nvidia", "gpu", "torch.cuda")):
        return ["gpu_required"]
    return []


def detect_model_file_risk(repo_fact_summary: dict, key_files: dict[str, str], file_tree: list[Any]) -> list[str]:
    blob = "\n".join(key_files.values()).lower()
    paths = _normalize_paths(file_tree)
    if any(token in blob for token in ("load_model", "from_pretrained", "checkpoint", "weights")) and not any(
        path.lower().endswith(MODEL_EXTENSIONS) for path in paths
    ):
        return ["missing_model_file"]
    return []


def detect_database_risk(repo_fact_summary: dict, key_files: dict[str, str]) -> list[str]:
    blob = "\n".join(key_files.values()).lower()
    envs = set(repo_fact_summary.get("detected_env_vars", []))
    risks: list[str] = []
    db_markers = ("database_url", "sqlalchemy", "prisma", "typeorm", "postgresql", "mysql", "mongodb", "sqlite")
    if any(marker in blob for marker in db_markers) or "DATABASE_URL" in envs:
        risks.append("database_required")
        if not envs.intersection({"DATABASE_URL", "POSTGRES_URL", "MYSQL_URL", "MONGODB_URI", "SQLALCHEMY_DATABASE_URI"}):
            risks.append("database_config_missing")
    return risks


def detect_external_api_risk(repo_fact_summary: dict) -> list[str]:
    envs = set(repo_fact_summary.get("detected_env_vars", []))
    api_envs = {name for name in envs if name.endswith("_API_KEY") or name in {"OPENAI_API_KEY", "ANTHROPIC_API_KEY"}}
    return ["external_api_required"] if api_envs else []


def detect_large_runtime_risk(repo_fact_summary: dict, key_files: dict[str, str]) -> list[str]:
    blob = "\n".join(key_files.values()).lower()
    if any(token in blob for token in ("llama", "stable diffusion", "transformers", "cuda", "pytorch")):
        return ["large_runtime_risk"]
    return []


def detect_all_risks(repo_info: dict, repo_fact_summary: dict, key_files: dict[str, str], file_tree: list[Any]) -> dict:
    risk_items = (
        detect_archive_risk(repo_info)
        + detect_stale_risk(repo_info)
        + detect_fork_risk(repo_info)
        + detect_gpu_risk(repo_fact_summary, key_files)
        + detect_model_file_risk(repo_fact_summary, key_files, file_tree)
        + detect_database_risk(repo_fact_summary, key_files)
        + detect_external_api_risk(repo_fact_summary)
        + detect_large_runtime_risk(repo_fact_summary, key_files)
    )
    return {
        "risk_items": sorted(dict.fromkeys(risk_items)),
        "warnings": [],
    }
