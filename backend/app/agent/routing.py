from __future__ import annotations

import json
import re
import subprocess
import tarfile
import tempfile
from pathlib import Path

from app.agent.retrieval import SearchUnavailable, normalize_candidate
from app.core.types import CandidateEvaluation, RepoSource, Requirement, RetrievalResult, RoutePlan


def score_candidate(profile: dict, requirement: Requirement) -> CandidateEvaluation:
    row = normalize_candidate(profile)
    text = " ".join([row.get("description") or "", *(row.get("key_files") or {}).values()]).lower()
    facts = [item for item in re.findall(r"[\u4e00-\u9fff]{2,}|[a-z0-9]+", requirement.prompt.lower()) if len(item) > 1]
    matched = sum(1 for fact in facts if fact in text)
    match = min(100, 55 + 45 * matched / max(1, len(facts))) if text else 0
    files = set(row.get("file_tree") or [])
    manifests = {"package.json", "requirements.txt", "pyproject.toml", "pom.xml", "go.mod", "Dockerfile", "docker-compose.yml"}
    has_manifest = any(Path(path).name in manifests for path in files)
    is_web = any(name in text for name in ["web", "next", "react", "fastapi", "flask", "express"]) or has_manifest
    unknown = []
    if not row.get("key_files"): unknown.append("key_files")
    if not files: unknown.append("file_tree")
    if not any(Path(name).name.lower() in {"license", "license.md", "notice"} for name in (row.get("key_files") or {})):
        unknown.append("license")
    compatibility = row.get("compatibility", "SUPPORTED" if has_manifest else "UNKNOWN")
    evidence = {"files": ",".join(sorted(files)[:8])} if files else {}
    return CandidateEvaluation(repo_url=row["repo_url"], match_score=match,
        deploy_score=80 if has_manifest else 20, quality_score=min(100, 40 + len(row.get("key_files") or {}) * 10),
        is_web_app=is_web if text or files else None, missing_core=[], unknown_fields=unknown,
        evidence=evidence, compatibility=compatibility)


def _content(turn) -> dict:
    content = turn.assistant_message.get("content")
    if not isinstance(content, str):
        raise ValueError("route model must return JSON content")
    return json.loads(content)


async def choose_route(requirement: Requirement, search_result: RetrievalResult,
                       evaluations: list[CandidateEvaluation], model_client) -> RoutePlan:
    if not search_result.completed:
        raise SearchUnavailable("repository search is incomplete")
    known = {row["repo_url"]: row for row in search_result.candidates}
    eligible = sorted((row for row in evaluations if row.eligible_a), key=lambda row: row.total, reverse=True)
    if eligible:
        candidate = known[eligible[0].repo_url]
        commit = candidate.get("commit")
        if not commit or not re.fullmatch(r"[0-9a-f]{40}", commit):
            raise ValueError("eligible source lacks immutable commit")
        return RoutePlan(route="DEPLOY_EXISTING", sources=[RepoSource(url=eligible[0].repo_url, commit=commit, role="完整应用")],
                         steps=["准备并验证现成应用"], reason="候选完整覆盖核心需求且运行兼容")
    turn = await model_client.complete([
        {"role": "system", "content": "只输出RoutePlan JSON；不得引用候选列表外的仓库。"},
        {"role": "user", "content": json.dumps({"requirement": requirement.model_dump(mode="json"),
          "candidates": search_result.candidates, "evaluations": [row.model_dump(mode="json") for row in evaluations],
          "reuse_rejections": search_result.reuse_rejections}, ensure_ascii=False)},
    ], [], "route")
    plan = RoutePlan.model_validate(_content(turn))
    if any(source.url not in known for source in plan.sources):
        raise ValueError("route references an unretrieved repository")
    for source in plan.sources:
        expected = known[source.url].get("commit")
        if expected and source.commit != expected:
            raise ValueError("route source commit differs from evidence")
    if plan.route == "GENERATE_APP":
        if plan.sources or not search_result.reuse_rejections:
            raise ValueError("generation requires complete A/B/C rejection evidence")
    elif not plan.sources:
        raise ValueError("reuse route requires sources")
    if plan.route == "COMPOSE_COMPONENTS" and len(plan.sources) < 2:
        raise ValueError("component composition requires at least two sources")
    return plan


async def plan_route(requirement: Requirement, candidates, model_client) -> RoutePlan:
    result = candidates if isinstance(candidates, RetrievalResult) else RetrievalResult(
        queries=[requirement.prompt], completed=True, candidates=[normalize_candidate(row) for row in candidates])
    evaluations = [score_candidate(row, requirement) for row in result.candidates]
    return await choose_route(requirement, result, evaluations, model_client)


def _extract(repository: Path, commit: str, destination: Path) -> None:
    with tempfile.NamedTemporaryFile(suffix=".tar") as archive:
        subprocess.run(["git", "-C", str(repository), "archive", "--format=tar", "--output", archive.name, commit], check=True)
        destination.mkdir(parents=True, exist_ok=True)
        with tarfile.open(archive.name) as bundle:
            for member in bundle.getmembers():
                target = (destination / member.name).resolve()
                if not target.is_relative_to(destination.resolve()):
                    raise ValueError("unsafe repository archive")
            bundle.extractall(destination, filter="data")


def prepare_sources(workspace_id: str, plan: RoutePlan, allow_local: bool = False) -> list[RepoSource]:
    workspace = Path(workspace_id).resolve()
    prepared = []
    for index, source in enumerate(plan.sources):
        if not re.fullmatch(r"[0-9a-f]{40}", source.commit):
            raise ValueError("source commit must be a full SHA")
        local = Path(source.url)
        if local.exists() and allow_local:
            repository = local.resolve()
            owned_temp = None
        else:
            if not re.fullmatch(r"https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+(?:\.git)?", source.url):
                raise ValueError("only HTTPS GitHub repositories are allowed")
            owned_temp = tempfile.TemporaryDirectory()
            repository = Path(owned_temp.name) / "repo"
            subprocess.run(["git", "clone", "--filter=blob:none", "--no-checkout", source.url, str(repository)], check=True)
        destination = workspace if len(plan.sources) == 1 else workspace / "source_components" / f"{index}-{Path(source.url).stem}"
        _extract(repository, source.commit, destination)
        if owned_temp: owned_temp.cleanup()
        prepared.append(source)
    return prepared

