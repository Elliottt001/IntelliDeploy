import base64
import random
import time
from typing import Any, Dict, List, Optional

from app.services.intellideploy_ai import analyze_repository
from app.services.intellideploy_github import github_request_json


def _safe_base64_encode(content: str) -> str:
    try:
        return base64.b64encode(content.encode("utf-8")).decode("utf-8")
    except Exception:
        clean = "".join(ch for ch in content if ord(ch) >= 32 or ch in "\n\r\t")
        return base64.b64encode(clean.encode("utf-8", errors="ignore")).decode("utf-8")


def _has_file(files: List[str], suffix: str) -> bool:
    needle = suffix.lower()
    return any(file.lower().endswith(needle) for file in files)


def _detect_package_manager(files: List[str], pkg: Optional[Dict[str, Any]] = None):
    package_manager = str((pkg or {}).get("packageManager") or "")
    if _has_file(files, "pnpm-lock.yaml") or package_manager.startswith("pnpm"):
        return {"install": "pnpm install --frozen-lockfile", "start": "pnpm start", "build": "pnpm build"}
    if _has_file(files, "yarn.lock") or package_manager.startswith("yarn"):
        return {"install": "yarn install --frozen-lockfile", "start": "yarn start", "build": "yarn build"}
    return {"install": "npm ci", "start": "npm start", "build": "npm run build"}


def _smart_config(
    tech_stack: Optional[List[str]] = None,
    files: Optional[List[str]] = None,
    pkg: Optional[Dict[str, Any]] = None,
):
    stack = [(s or "").lower() for s in (tech_stack or [])]
    file_list = files or []

    if any("python" in s for s in stack) or _has_file(file_list, "requirements.txt"):
        return {
            "baseImage": "python:3.11-slim",
            "installCmd": "pip install --no-cache-dir -r requirements.txt",
            "startCmd": "python app.py",
            "port": 8000,
            "buildCmd": None,
        }

    if any("java" in s or "spring" in s for s in stack) or _has_file(file_list, "pom.xml"):
        return {
            "baseImage": "openjdk:17-slim",
            "installCmd": "./mvnw clean package -DskipTests",
            "startCmd": "java -jar target/*.jar",
            "port": 8080,
            "buildCmd": None,
        }

    if any("go" in s for s in stack) or _has_file(file_list, "go.mod"):
        return {
            "baseImage": "golang:1.21-alpine",
            "installCmd": "go mod download",
            "startCmd": "go run main.go",
            "port": 8080,
            "buildCmd": None,
        }

    if any("rust" in s for s in stack) or _has_file(file_list, "Cargo.toml"):
        return {
            "baseImage": "rust:1.74-slim",
            "installCmd": "cargo build --release",
            "startCmd": "./target/release/app",
            "port": 8080,
            "buildCmd": None,
        }

    if _has_file(file_list, "package.json"):
        pm = _detect_package_manager(file_list, pkg)
        has_start = bool(((pkg or {}).get("scripts") or {}).get("start"))
        return {
            "baseImage": "node:20-alpine",
            "installCmd": pm["install"],
            "startCmd": pm["start"] if has_start else "npm start",
            "port": 3000,
            "buildCmd": pm["build"],
        }

    return {
        "baseImage": "node:20-alpine",
        "installCmd": "npm install --production",
        "startCmd": "npm start",
        "port": 3000,
        "buildCmd": None,
    }


def _build_sealos_yaml(repo: str, result: Dict[str, Any], files: List[str], pkg: Optional[Dict[str, Any]] = None) -> str:
    cfg = _smart_config(result.get("techStack"), files, pkg)
    ports = result.get("ports") or []
    port = ports[0] if ports else cfg["port"]
    app_name = repo.lower().replace("_", "-").replace(".", "-")
    app_name = "".join(ch if (ch.isalnum() or ch == "-") else "-" for ch in app_name)
    while "--" in app_name:
        app_name = app_name.replace("--", "-")
    app_name = app_name.strip("-") or "sealos-app"

    build_cmd = cfg.get("buildCmd") or ""

    return f"""apiVersion: app.sealos.io/v1
kind: App
metadata:
  name: {app_name}
spec:
  image: {result.get('baseImage') or cfg['baseImage']}
  run: |
    set -e
    {result.get('installCmd') or cfg['installCmd']}
    {build_cmd}
    {result.get('startCmd') or cfg['startCmd']}
  containerPort: {port}
  service:
    ports:
    - port: {port}
      targetPort: {port}
  resources:
    limits:
      cpu: 1
      memory: 1Gi
    requests:
      cpu: 0.5
      memory: 512Mi
  healthCheck:
    type: http
    path: /
    port: {port}
"""


def _fetch_with_retry(token: str, method: str, url_path: str, body: Optional[Dict[str, Any]] = None, retry: int = 0):
    max_retry = 2
    try:
        return github_request_json(token, method, url_path, body=body)
    except Exception:
        if retry < max_retry:
            time.sleep(retry + 1)
            return _fetch_with_retry(token, method, url_path, body, retry + 1)
        raise


def _get_repository_files(token: str, owner: str, repo: str, branch: str) -> List[str]:
    try:
        ref_data = _fetch_with_retry(token, "GET", f"/repos/{owner}/{repo}/git/refs/heads/{branch}")
        commit_sha = (ref_data or {}).get("object", {}).get("sha")
        if not commit_sha:
            return []

        tree_data = _fetch_with_retry(token, "GET", f"/repos/{owner}/{repo}/git/trees/{commit_sha}?recursive=1")
        if (tree_data or {}).get("truncated"):
            raise ValueError("Repository tree too large")
        return [item.get("path") for item in (tree_data or {}).get("tree", []) if item.get("path")]
    except Exception:
        return []


def _get_package_json(token: str, owner: str, repo: str, branch: str):
    try:
        data = _fetch_with_retry(token, "GET", f"/repos/{owner}/{repo}/contents/package.json?ref={branch}")
        if not data or not data.get("content"):
            return None
        decoded = base64.b64decode(data.get("content")).decode("utf-8", errors="ignore")
        import json as _json

        return _json.loads(decoded)
    except Exception:
        return None


def _check_sealos_exists(token: str, owner: str, repo: str) -> bool:
    try:
        data = _fetch_with_retry(token, "GET", f"/repos/{owner}/{repo}/contents/sealos.yaml")
        return bool(data)
    except Exception:
        return False


def _get_default_branch(token: str, owner: str, repo: str) -> str:
    data = _fetch_with_retry(token, "GET", f"/repos/{owner}/{repo}")
    branch = (data or {}).get("default_branch")
    if not branch:
        raise ValueError("Failed to fetch repo")
    return branch


def _get_branch_sha(token: str, owner: str, repo: str, branch: str) -> str:
    data = _fetch_with_retry(token, "GET", f"/repos/{owner}/{repo}/git/refs/heads/{branch}")
    sha = (data or {}).get("object", {}).get("sha")
    if not sha:
        raise ValueError("Branch not found")
    return sha


def auto_analyze_and_push_sealos(token: str, owner: str, repo: str, readme: Optional[str] = None):
    try:
        base_branch = _get_default_branch(token, owner, repo)
        if _check_sealos_exists(token, owner, repo):
            return {"message": "sealos.yaml already exists, skipped"}

        files = _get_repository_files(token, owner, repo, base_branch)
        pkg = _get_package_json(token, owner, repo, base_branch)

        ai_result: Dict[str, Any] = {}
        try:
            ai_resp = analyze_repository({"files": files[:300], "readme": (readme or "")[:4000]})
            ai_result = ai_resp.get("result") or {}
        except Exception:
            ai_result = {}

        yaml_content = _build_sealos_yaml(repo, ai_result, files, pkg)
        base_sha = _get_branch_sha(token, owner, repo, base_branch)
        branch_name = f"sealos-auto-{int(time.time())}-{random.randint(1000, 9999)}"

        _fetch_with_retry(
            token,
            "POST",
            f"/repos/{owner}/{repo}/git/refs",
            body={"ref": f"refs/heads/{branch_name}", "sha": base_sha},
        )

        _fetch_with_retry(
            token,
            "PUT",
            f"/repos/{owner}/{repo}/contents/sealos.yaml",
            body={
                "message": "auto-generate sealos.yaml",
                "content": _safe_base64_encode(yaml_content),
                "branch": branch_name,
            },
        )

        pr_data = _fetch_with_retry(
            token,
            "POST",
            f"/repos/{owner}/{repo}/pulls",
            body={
                "title": "Auto-generate Sealos config",
                "head": branch_name,
                "base": base_branch,
            },
        )

        return {"message": "Success", "prUrl": (pr_data or {}).get("html_url")}
    except Exception as error:
        return {"error": str(error) or "Unknown error"}
