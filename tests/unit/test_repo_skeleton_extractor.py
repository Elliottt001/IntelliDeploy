from __future__ import annotations

import base64
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from app.services.repo_skeleton_extractor import RemoteRepoSkeletonExtractor  # noqa: E402


def _encoded(content: str) -> dict[str, str]:
    return {
        "encoding": "base64",
        "content": base64.b64encode(content.encode("utf-8")).decode("ascii"),
    }


def test_skeleton_extractor_detects_lockfile_package_manager_and_validates_dockerfile(monkeypatch):
    files = {
        "package.json": '{"dependencies":{"next":"latest"},"scripts":{"start":"next start"}}',
        "pnpm-lock.yaml": "lockfileVersion: '9.0'",
        "README.md": "# Demo",
        "src/App.tsx": "export default function App() { return null; }",
        "Dockerfile": "FROM node:20-alpine\nWORKDIR /app\nCOPY . .\nRUN pnpm install\nEXPOSE 3000\nCMD [\"pnpm\", \"start\"]\n",
    }
    tree = [{"type": "blob", "path": path} for path in files]

    def fake_github_request_json(token, method, path_or_url, body=None, allow_404=False):
        if path_or_url == "/repos/acme/demo":
            return {"default_branch": "main"}
        if path_or_url == "/repos/acme/demo/git/ref/heads/main":
            return {"object": {"sha": "commit-sha"}}
        if path_or_url == "/repos/acme/demo/git/commits/commit-sha":
            return {"tree": {"sha": "tree-sha"}}
        if path_or_url == "/repos/acme/demo/git/trees/tree-sha?recursive=1":
            return {"tree": tree}
        prefix = "/repos/acme/demo/contents/"
        if path_or_url.startswith(prefix):
            repo_path = path_or_url.removeprefix(prefix)
            return _encoded(files[repo_path])
        raise AssertionError(path_or_url)

    monkeypatch.setattr(
        "app.services.repo_skeleton_extractor.github_request_json",
        fake_github_request_json,
    )

    skeleton = RemoteRepoSkeletonExtractor(token="token", owner="acme", repo="demo").extract()

    assert "pnpm-lock.yaml" in skeleton.repo_profile.dependency_files
    assert skeleton.repo_profile.package_manager == "pnpm"
    assert skeleton.repo_profile.has_valid_dockerfile is True


def test_skeleton_extractor_does_not_treat_invalid_dockerfile_as_valid(monkeypatch):
    files = {
        "requirements.txt": "fastapi\nuvicorn\n",
        "main.py": "from fastapi import FastAPI\napp = FastAPI()\n",
        "Dockerfile": "FROM python:3.12-slim\n",
    }
    tree = [{"type": "blob", "path": path} for path in files]

    def fake_github_request_json(token, method, path_or_url, body=None, allow_404=False):
        if path_or_url == "/repos/acme/api":
            return {"default_branch": "main"}
        if path_or_url == "/repos/acme/api/git/ref/heads/main":
            return {"object": {"sha": "commit-sha"}}
        if path_or_url == "/repos/acme/api/git/commits/commit-sha":
            return {"tree": {"sha": "tree-sha"}}
        if path_or_url == "/repos/acme/api/git/trees/tree-sha?recursive=1":
            return {"tree": tree}
        prefix = "/repos/acme/api/contents/"
        if path_or_url.startswith(prefix):
            repo_path = path_or_url.removeprefix(prefix)
            return _encoded(files[repo_path])
        raise AssertionError(path_or_url)

    monkeypatch.setattr(
        "app.services.repo_skeleton_extractor.github_request_json",
        fake_github_request_json,
    )

    skeleton = RemoteRepoSkeletonExtractor(token="token", owner="acme", repo="api").extract()

    assert skeleton.repo_profile.has_valid_dockerfile is False
