"""绕过自然语言 → GitHub Search 召回，用一个明确的 repo URL 直接触发完整部署链路。

为什么这个脚本存在：
  IntelliDeploy 的生产入口是 /api/rag/chat，它走 NL → GitHub Search → 候选打分 →
  enrich → 选 top1 → fallback → 部署。当我们要验证 "拿到真实 repo 后，
  fallback 是否能用上 file_tree（不再硬编码 [] 走 Decision C）" 时，让
  GitHub Search 凑巧把目标仓库召回是不可控的，每次都得猜 raw_query。

  这个脚本利用 RagChatRequest.prefetched_search 字段绕过召回：脚本自己
  调一次 enrich_repository 把目标仓库的 file_tree + key_files 抓回来，
  封装成一个完整 RagSearchResponse，再 POST /api/rag/chat —— 后端检测到
  prefetched_search 后直接复用，不会再去打 GitHub Search。

  完整保留：JWT 认证、DB Project/Deployment 写入、WS 广播、fallback 真实
  落盘 + Kaniko 真实构建。所以仍然是端到端 production 链路。

用法：
  # 用账号密码（脚本帮你 login）
  python backend/scripts/test_deploy_repo.py \
      --repo https://github.com/SelfhostedPro/Yacht \
      --username alice --password secret123

  # 已经有 JWT
  python backend/scripts/test_deploy_repo.py \
      --repo https://github.com/SelfhostedPro/Yacht \
      --token eyJhbG...

  # 自定义 backend 地址 + 修改提示词（提示词只影响 user_intent 推断，不影响选库）
  python backend/scripts/test_deploy_repo.py \
      --repo https://github.com/owner/repo \
      --backend http://127.0.0.1:9000 \
      --prompt "deploy this self-hosted dashboard" \
      --username alice --password secret123

验证（部署触发后 grep backend/tmp/intellideploy-backend.log）：
  - 应该看到 `decision=A` 或 `decision=B`（不再是 `decision=C`）—— Bug #1 链路接通
  - 如果还是 `decision=C`，应该同时看到 `file_tree_unavailable_possible_fetch_failure`
    或 `github enrichment failed` —— 给出诊断线索（Bug #2/#3 生效）
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
import urllib.parse
from datetime import datetime
from pathlib import Path
from typing import Any

import httpx

# 让脚本可直接 `python backend/scripts/test_deploy_repo.py` 跑
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.agent_core.brains.context_rag_agent import RepositoryCandidate  # noqa: E402
from app.agent_core.brains.github_retriever import (  # noqa: E402
    GitHubRepositorySearchClient,
    GitHubTokenPool,
)
from app.agent_core.brains.router_agent import RepoIntent  # noqa: E402


def parse_repo_url(repo_url: str) -> tuple[str, str]:
    """支持 `https://github.com/owner/repo` 或 `owner/repo` 简写。"""
    if "/" not in repo_url:
        raise ValueError(f"unrecognized repo url: {repo_url!r}")
    if repo_url.startswith("http"):
        path = urllib.parse.urlparse(repo_url).path.strip("/")
        parts = path.split("/")
    else:
        parts = repo_url.strip("/").split("/")
    if len(parts) < 2 or not parts[0] or not parts[1]:
        raise ValueError(f"unrecognized repo url: {repo_url!r}")
    return parts[0], parts[1].removesuffix(".git")


async def enrich_via_project_client(owner: str, repo: str) -> RepositoryCandidate:
    """复用 production 路径的 GitHubRepositorySearchClient.enrich_repository。

    这样验证的就是我们 Bug #4 刚改过的那段代码——default_branch 缺失会
    自动调 /repos/{owner}/{repo} 拿一次，tree 真的能抓回来。
    GitHubTokenPool.from_settings() 会自动读 GITHUB_SEARCH_TOKENS / GITHUB_TOKEN，
    没 token 时也能跑，但会受到 GitHub 60 req/h unauth 限流。
    """
    client = GitHubRepositorySearchClient(token_pool=GitHubTokenPool.from_settings())

    # 给一个最小可用的 candidate，让 enrich_repository 把 file_tree / key_files
    # 填上。default_branch 故意留 None —— 让我们刚加的"自动取默认分支"分支生效。
    candidate = RepositoryCandidate(
        full_name=f"{owner}/{repo}",
        repo_url=f"https://github.com/{owner}/{repo}",
        html_url=f"https://github.com/{owner}/{repo}",
        default_branch=None,
    )
    return await client.enrich_repository(candidate)


def build_prefetched_search(
    raw_query: str,
    enriched: RepositoryCandidate,
) -> dict[str, Any]:
    """把单个 enriched candidate 装成 RagSearchResponse 形状的字典。

    直接用 dict（不 import RagCandidate / RagSearchResponse 类型）是为了
    避免脚本与那些 schema 的字段细节耦合 —— 这条结构是 HTTP 协议的形状，
    POST 出去 FastAPI 那边会做严格 pydantic 校验，没问题。
    """
    full_name = enriched.full_name
    owner, repo = full_name.split("/", 1)

    # 完整 repo_profile：注意 file_tree / key_files 是我们这次新加的字段，
    # 也是这个脚本要验证的关键载荷。
    repo_profile: dict[str, Any] = {
        "source_repo_url": enriched.repo_url,
        "detected_languages": [],
        "detected_frameworks": [],
        "package_manager": None,
        "entrypoints": [],
        "dependency_files": [],
        "has_valid_dockerfile": None,
        "readme_summary": (enriched.readme_snippet or enriched.description or "")[:500] or None,
        "file_tree": list(enriched.file_tree or []),
        "key_files": dict(enriched.key_files or {}),
    }

    candidate_dict: dict[str, Any] = {
        "rank": 1,
        "repo_url": enriched.repo_url,
        "full_name": full_name,
        "name": repo,
        "owner": owner,
        "description": enriched.description,
        "default_branch": enriched.default_branch,
        "topics": list(enriched.topics or []),
        "stars": enriched.stars or 0,
        "forks": enriched.forks or 0,
        "language": enriched.language,
        "is_archived": bool(enriched.is_archived),
        "last_commit_at": enriched.last_commit_at or enriched.pushed_at,
        "retrieval_sources": ["github_search"],
        "retrieval_score": 80.0,
        "deployability_score": 80.0,
        "final_score": 80.0,
        "rerank_stage": "coarse",
        "match_reasons": ["explicit selection via test_deploy_repo.py"],
        "readme_summary": repo_profile["readme_summary"],
        "repo_profile": repo_profile,
        "preferred_stack": {},
        "missing_components": [],
    }

    return {
        "request_id": f"manual-{datetime.now().strftime('%Y%m%d%H%M%S')}",
        # RepoIntent 有 normalized_query / github_query 这两个必填字段；在
        # 脚本场景里它们只用于前端展示，不影响 fallback 选库（仓库已经被
        # selected_repo_url 精确锁定），所以直接拿 raw_query 做占位即可。
        "intent": RepoIntent(
            raw_query=raw_query,
            normalized_query=raw_query,
            github_query=raw_query,
        ).model_dump(),
        "candidates": [candidate_dict],
        "selected": None,
        "generated_at": datetime.now().isoformat(),
        "warnings": [],
    }


def login(backend: str, username: str, password: str) -> str:
    resp = httpx.post(
        f"{backend.rstrip('/')}/auth/login",
        json={"username": username, "password": password},
        timeout=15.0,
    )
    if resp.status_code != 200:
        raise SystemExit(
            f"login failed: HTTP {resp.status_code} — {resp.text}\n"
            "Tip: register first via POST /auth/register, or pass --token directly."
        )
    return resp.json()["access_token"]


def trigger_deployment(
    backend: str,
    token: str,
    raw_query: str,
    prefetched: dict[str, Any],
    selected_repo_url: str,
) -> dict[str, Any]:
    body = {
        "raw_query": raw_query,
        "selected_repo_url": selected_repo_url,
        "prefetched_search": prefetched,
        # trigger_reason 给 LOW_SCORE_ALL，让流水线走"用真实仓库走 Decision A/B/C"
        # 的判定，而不是强制 fallback。这才能验证 Bug #1 修复——如果接通了，
        # 应该看到 decision=A/B；如果没接通，会看到 decision=C 但有 fetch-failure warning。
        "trigger_reason": "LOW_SCORE_ALL",
    }
    resp = httpx.post(
        f"{backend.rstrip('/')}/api/rag/chat",
        headers={"Authorization": f"Bearer {token}"},
        json=body,
        timeout=60.0,
    )
    if resp.status_code != 200:
        raise SystemExit(
            f"/api/rag/chat failed: HTTP {resp.status_code}\n"
            f"body: {resp.text}"
        )
    return resp.json()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--repo", required=True, help="GitHub repo (URL or owner/repo)")
    parser.add_argument("--prompt", default="deploy this repository", help="raw_query used for user_intent (does NOT affect repo selection)")
    parser.add_argument("--backend", default="http://127.0.0.1:9000", help="backend base URL")

    auth = parser.add_mutually_exclusive_group(required=True)
    auth.add_argument("--token", help="JWT bearer token (skip login)")
    auth.add_argument("--username", help="login username (paired with --password)")

    parser.add_argument("--password", help="login password (required with --username)")
    parser.add_argument("--dry-run", action="store_true", help="enrich and print the prefetched payload, do NOT trigger deployment")
    args = parser.parse_args()

    if args.username and not args.password:
        parser.error("--password is required when using --username")

    try:
        owner, repo = parse_repo_url(args.repo)
    except ValueError as exc:
        raise SystemExit(str(exc))

    print(f"[1/3] Enriching {owner}/{repo} via project's GitHubSearchClient ...", flush=True)
    enriched = asyncio.run(enrich_via_project_client(owner, repo))
    tree_count = len(enriched.file_tree or [])
    key_count = len(enriched.key_files or {})
    print(f"      default_branch={enriched.default_branch!r}  file_tree={tree_count} paths  key_files={key_count}")
    if tree_count == 0:
        print(
            "      ⚠ file_tree is EMPTY — enrichment failed silently. Common causes:\n"
            "        - GITHUB_TOKEN missing/expired in backend/.env (60 req/h unauth limit hit)\n"
            "        - repo does not exist or is private without access\n"
            "        - GitHub returned 5xx / network timeout\n"
            "      Check backend logs (or run with --dry-run to see raw response).",
            flush=True,
        )

    prefetched = build_prefetched_search(args.prompt, enriched)

    if args.dry_run:
        print("[dry-run] prefetched_search payload:")
        print(json.dumps(prefetched, indent=2, default=str)[:4000])
        return

    if args.token:
        token = args.token
    else:
        print(f"[2/3] Logging in as {args.username!r} ...", flush=True)
        token = login(args.backend, args.username, args.password)

    print("[3/3] Triggering /api/rag/chat ...", flush=True)
    result = trigger_deployment(args.backend, token, args.prompt, prefetched, enriched.repo_url)
    deployment_id = result.get("deployment_id")
    project_id = result.get("project_id")
    print()
    print("==========================================")
    print(f"  deployment_id = {deployment_id}")
    print(f"  project_id    = {project_id}")
    print(f"  ws            = {args.backend.replace('http', 'ws').rstrip('/')}/ws/deployments/{deployment_id}")
    print("==========================================")
    print()
    print("Next steps:")
    print(f"  tail -f backend/tmp/intellideploy-backend.log | grep -E 'decision=|enrichment|file_tree|deployment_id={deployment_id}|deployment {deployment_id}'")
    print("  Expected: decision=A or decision=B (Bug #1 plumbed correctly).")
    print("  If still decision=C, look for `file_tree_unavailable_possible_fetch_failure` or `github enrichment failed`.")


if __name__ == "__main__":
    main()
