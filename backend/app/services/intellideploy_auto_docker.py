import base64
import json
import re
import time
from typing import Any, Dict, List, Optional

from app.services.intellideploy_ai import analyze_repository
from app.services.intellideploy_github import github_request_json


def _safe_decode_base64(content: Optional[str], encoding: Optional[str]) -> Optional[str]:
    if not content or encoding != "base64":
        return None
    raw = content.replace("\n", "")
    return base64.b64decode(raw).decode("utf-8", errors="ignore")


def _has_file(files: List[str], matcher: re.Pattern[str]) -> bool:
    return any(matcher.search(file) for file in files)


def _unique_paths(paths: List[str]) -> List[str]:
    dedup: List[str] = []
    seen = set()
    for path in paths:
        p = path.strip()
        if p and p not in seen:
            seen.add(p)
            dedup.append(p)
    return dedup


def _detect_package_manager(files: List[str], package_json: Optional[Dict[str, Any]]):
    package_manager_field = str((package_json or {}).get("packageManager") or "").lower()

    if package_manager_field.startswith("pnpm") or _has_file(files, re.compile(r"(^|/)pnpm-lock\.yaml$", re.I)):
        return {
            "installCmd": "pnpm install --frozen-lockfile",
            "startCmd": "pnpm start",
            "buildCmd": "pnpm run build",
            "manifestFiles": ["package.json", "pnpm-lock.yaml"],
        }

    if package_manager_field.startswith("yarn") or _has_file(files, re.compile(r"(^|/)yarn\.lock$", re.I)):
        return {
            "installCmd": "yarn install --frozen-lockfile",
            "startCmd": "yarn start",
            "buildCmd": "yarn build",
            "manifestFiles": ["package.json", "yarn.lock"],
        }

    if _has_file(files, re.compile(r"(^|/)package-lock\.json$", re.I)) or _has_file(
        files,
        re.compile(r"(^|/)npm-shrinkwrap\.json$", re.I),
    ):
        return {
            "installCmd": "npm ci",
            "startCmd": "npm run start",
            "buildCmd": "npm run build",
            "manifestFiles": ["package.json", "package-lock.json", "npm-shrinkwrap.json"],
        }

    return {
        "installCmd": "npm install",
        "startCmd": "npm run start",
        "buildCmd": "npm run build",
        "manifestFiles": ["package.json"],
    }


def _parse_command_to_json_array(command: str) -> str:
    normalized = re.sub(r"\s+", " ", command.strip())
    tokens = re.findall(r"(?:[^\s\"']+|\"[^\"]*\"|'[^']*')+", normalized)
    cleaned_tokens = [token.strip("\"'") for token in (tokens or [normalized])]
    return json.dumps(cleaned_tokens)


def _infer_node_plan(analysis: Dict[str, Any], files: List[str], package_json: Optional[Dict[str, Any]]):
    package_manager = _detect_package_manager(files, package_json)
    scripts = (package_json or {}).get("scripts") or {}
    has_build_script = isinstance(scripts.get("build"), str) and bool(str(scripts.get("build")).strip())
    has_start_script = isinstance(scripts.get("start"), str) and bool(str(scripts.get("start")).strip())

    return {
        "baseImage": analysis.get("baseImage") or "node:20-alpine",
        "installCmd": package_manager["installCmd"],
        "buildCmd": package_manager["buildCmd"] if has_build_script else None,
        "startCmd": package_manager["startCmd"] if has_start_script else analysis.get("startCmd", "npm run start"),
        "ports": analysis.get("ports") if analysis.get("ports") else [3000],
        "manifestFiles": package_manager["manifestFiles"],
    }


def _infer_python_install_command(files: List[str]) -> str:
    if _has_file(files, re.compile(r"(^|/)requirements\.txt$", re.I)):
        return "pip install --no-cache-dir -r requirements.txt"
    if _has_file(files, re.compile(r"(^|/)pyproject\.toml$", re.I)):
        return "pip install --no-cache-dir ."
    return "pip install --no-cache-dir -r requirements.txt"


def _build_dockerfile(analysis: Dict[str, Any], files: List[str], package_json: Optional[Dict[str, Any]]) -> str:
    runtime = analysis.get("runtime")

    if runtime == "node":
        node_plan = _infer_node_plan(analysis, files, package_json)
        manifest_files = []
        for file in node_plan["manifestFiles"]:
            matcher = re.compile(rf"(^|/){re.escape(file)}$", re.I)
            if file == "package.json" or _has_file(files, matcher):
                manifest_files.append(file)

        lines = [
            f"FROM {node_plan['baseImage']}",
            "WORKDIR /app",
            "ENV NODE_ENV=production",
            f"COPY {' '.join(manifest_files)} ./" if manifest_files else "COPY package.json ./",
            f"RUN {node_plan['installCmd']}",
            "COPY . .",
        ]
        if node_plan["buildCmd"]:
            lines.append(f"RUN {node_plan['buildCmd']}")
        lines.append(f"EXPOSE {' '.join(str(p) for p in node_plan['ports'])}")
        lines.append(f"CMD {_parse_command_to_json_array(node_plan['startCmd'])}")
        return "\n".join(lines) + "\n"

    if runtime == "python":
        ports = analysis.get("ports") or [8000]
        lines = [
            f"FROM {analysis.get('baseImage') or 'python:3.12-slim'}",
            "WORKDIR /app",
            "ENV PYTHONDONTWRITEBYTECODE=1",
            "ENV PYTHONUNBUFFERED=1",
            "COPY . .",
            f"RUN {_infer_python_install_command(files)}",
            f"EXPOSE {' '.join(str(p) for p in ports)}",
            f"CMD {_parse_command_to_json_array(analysis.get('startCmd') or 'python app.py')}",
        ]
        return "\n".join(lines) + "\n"

    if runtime == "go":
        ports = analysis.get("ports") or [8080]
        lines = [
            f"FROM {analysis.get('baseImage') or 'golang:1.22-alpine'}",
            "WORKDIR /app",
            "COPY go.mod go.sum* ./",
            "RUN go mod download",
            "COPY . .",
            f"EXPOSE {' '.join(str(p) for p in ports)}",
            f"CMD {_parse_command_to_json_array(analysis.get('startCmd') or 'go run ./')}",
        ]
        return "\n".join(lines) + "\n"

    ports = analysis.get("ports") or [3000]
    lines = [
        f"FROM {analysis.get('baseImage') or 'node:20-alpine'}",
        "WORKDIR /app",
        "COPY . .",
        f"RUN {analysis.get('installCmd') or 'npm install'}",
        f"EXPOSE {' '.join(str(p) for p in ports)}",
        f"CMD {_parse_command_to_json_array(analysis.get('startCmd') or 'npm run start')}",
    ]
    return "\n".join(lines) + "\n"


def _build_dockerignore(files: List[str]) -> str:
    lines = [
        ".git",
        ".github",
        "node_modules",
        ".next",
        "dist",
        "build",
        ".env",
        ".env.*",
    ]
    if _has_file(files, re.compile(r"(^|/)pnpm-lock\.yaml$", re.I)):
        lines.append(".pnpm-store")
    return "\n".join(_unique_paths(lines)) + "\n"


def _build_workflow(default_branch: str) -> str:
    return f"""name: Build and Push Docker Image

on:
  push:
    branches:
      - {default_branch}
  workflow_dispatch:

permissions:
  contents: read
  packages: write

jobs:
  docker:
    runs-on: ubuntu-latest
    steps:
      - name: Check out source code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{{{ github.actor }}}}
          password: ${{{{ secrets.GITHUB_TOKEN }}}}

      - name: Extract image metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{{{ github.repository }}}}
          tags: |
            type=ref,event=branch
            type=sha
            type=raw,value=latest,enable=${{{{ github.ref == 'refs/heads/{default_branch}' }}}}

      - name: Build and push image
        uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: ${{{{ steps.meta.outputs.tags }}}}
          labels: ${{{{ steps.meta.outputs.labels }}}}
"""


def _get_branch_sha(token: str, owner: str, repo: str, branch: str) -> str:
    ref = github_request_json(token, "GET", f"/repos/{owner}/{repo}/git/ref/heads/{branch}")
    sha = (ref or {}).get("object", {}).get("sha")
    if not sha:
        raise ValueError(f"Failed to resolve HEAD SHA for {owner}/{repo}@{branch}")
    return sha


def _get_tree_sha_from_commit(token: str, owner: str, repo: str, commit_sha: str) -> str:
    commit = github_request_json(token, "GET", f"/repos/{owner}/{repo}/git/commits/{commit_sha}")
    tree_sha = (commit or {}).get("tree", {}).get("sha")
    if not tree_sha:
        raise ValueError(f"Failed to resolve tree SHA for commit {commit_sha}")
    return tree_sha


def _get_repository_files(token: str, owner: str, repo: str, branch: str) -> List[str]:
    commit_sha = _get_branch_sha(token, owner, repo, branch)
    tree_sha = _get_tree_sha_from_commit(token, owner, repo, commit_sha)
    tree = github_request_json(token, "GET", f"/repos/{owner}/{repo}/git/trees/{tree_sha}?recursive=1")

    if (tree or {}).get("truncated"):
        raise ValueError(f"Repository tree for {owner}/{repo} is too large to analyze recursively")

    return [entry.get("path") for entry in (tree or {}).get("tree", []) if entry.get("path")]


def _get_file_content(token: str, owner: str, repo: str, path: str, branch: str):
    encoded_path = "/".join([part for part in path.split("/") if part])
    return github_request_json(
        token,
        "GET",
        f"/repos/{owner}/{repo}/contents/{encoded_path}?ref={branch}",
        allow_404=True,
    )


def _file_exists(token: str, owner: str, repo: str, path: str, branch: str) -> bool:
    file_data = _get_file_content(token, owner, repo, path, branch)
    return bool(file_data and file_data.get("sha"))


def _get_readme_content(token: str, owner: str, repo: str, branch: str) -> Optional[str]:
    readme = _get_file_content(token, owner, repo, "README.md", branch)
    if not isinstance(readme, dict):
        return None
    return _safe_decode_base64(readme.get("content"), readme.get("encoding"))


def _get_package_json(token: str, owner: str, repo: str, branch: str):
    file_data = _get_file_content(token, owner, repo, "package.json", branch)
    if not isinstance(file_data, dict):
        return None
    decoded = _safe_decode_base64(file_data.get("content"), file_data.get("encoding"))
    if not decoded:
        return None
    try:
        return json.loads(decoded)
    except Exception:
        return None


def _create_branch(token: str, owner: str, repo: str, branch_name: str, sha: str) -> None:
    github_request_json(
        token,
        "POST",
        f"/repos/{owner}/{repo}/git/refs",
        body={"ref": f"refs/heads/{branch_name}", "sha": sha},
    )


def _create_or_update_file(
    token: str,
    owner: str,
    repo: str,
    branch: str,
    path: str,
    content: str,
    message: str,
) -> None:
    existing = _get_file_content(token, owner, repo, path, branch)
    payload: Dict[str, Any] = {
        "message": message,
        "content": base64.b64encode(content.encode("utf-8")).decode("utf-8"),
        "branch": branch,
    }
    if isinstance(existing, dict) and existing.get("sha"):
        payload["sha"] = existing.get("sha")

    github_request_json(
        token,
        "PUT",
        f"/repos/{owner}/{repo}/contents/{path}",
        body=payload,
    )


def _create_pr(token: str, owner: str, repo: str, branch_name: str, base_branch: str) -> str:
    response = github_request_json(
        token,
        "POST",
        f"/repos/{owner}/{repo}/pulls",
        body={
            "title": "Add generated Docker assets for deployment",
            "head": branch_name,
            "base": base_branch,
            "body": "\n".join(
                [
                    "This PR was generated automatically by AICD.",
                    "",
                    "Included assets:",
                    "- Dockerfile",
                    "- .dockerignore",
                    "- GitHub Actions workflow for building and publishing the image to GHCR",
                ]
            ),
        },
    )

    pr_url = (response or {}).get("html_url")
    if not pr_url:
        raise ValueError("GitHub did not return a pull request URL")
    return pr_url


def _build_analysis_signal(files: List[str], readme: Optional[str]) -> Dict[str, Any]:
    relevant_files = [
        file
        for file in files
        if not file.startswith(".git/") and not file.startswith("node_modules/") and not file.startswith(".next/")
    ][:500]
    return {"files": relevant_files, "readme": (readme or "")[:4000] if readme else None}


def _already_has_container_assets(files: List[str]) -> bool:
    matcher = re.compile(r"(^|/)(dockerfile|containerfile)$", re.I)
    return any(matcher.search(file) for file in files)


def auto_analyze_and_push(token: str, owner: str, repo: str, readme: Optional[str] = None):
    repo_meta = github_request_json(token, "GET", f"/repos/{owner}/{repo}")
    base_branch = (repo_meta or {}).get("default_branch")

    if not base_branch:
        raise ValueError(f"Failed to resolve default branch for {owner}/{repo}")

    files = _get_repository_files(token, owner, repo, base_branch)
    if _already_has_container_assets(files):
        return {"message": "Repository already contains a container definition file."}

    readme_content = readme if readme is not None else _get_readme_content(token, owner, repo, base_branch)
    package_json = _get_package_json(token, owner, repo, base_branch)

    signal = _build_analysis_signal(files, readme_content)
    analyzed = analyze_repository(signal)
    result = analyzed["result"]

    dockerfile_content = _build_dockerfile(result, files, package_json)
    docker_ignore_content = _build_dockerignore(files)
    workflow_content = _build_workflow(base_branch)

    sha = _get_branch_sha(token, owner, repo, base_branch)
    branch_name = f"aicd-docker-assets-{int(time.time() * 1000)}"

    _create_branch(token, owner, repo, branch_name, sha)

    files_to_commit = [
        {
            "path": "Dockerfile",
            "content": dockerfile_content,
            "message": "Add generated Dockerfile",
        },
        {
            "path": ".dockerignore",
            "content": docker_ignore_content,
            "message": "Add generated docker ignore rules",
        },
        {
            "path": ".github/workflows/docker.yml",
            "content": workflow_content,
            "message": "Add container build workflow",
        },
    ]

    workflow_exists = _file_exists(token, owner, repo, ".github/workflows/docker.yml", base_branch)
    if workflow_exists:
        files_to_commit[2] = {
            "path": ".github/workflows/docker.yml",
            "content": workflow_content,
            "message": "Update container build workflow",
        }

    for file_item in files_to_commit:
        _create_or_update_file(
            token,
            owner,
            repo,
            branch_name,
            file_item["path"],
            file_item["content"],
            file_item["message"],
        )

    pr_url = _create_pr(token, owner, repo, branch_name, base_branch)
    return {"prUrl": pr_url}
