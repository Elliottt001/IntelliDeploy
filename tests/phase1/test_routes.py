import json
import subprocess

import pytest

from app.agent.retrieval import SearchUnavailable, normalize_candidate, retrieve_sources
from app.agent.routing import choose_route, plan_route, prepare_sources, score_candidate
from app.agent_core.brains.context_rag_agent import RepositoryCandidate
from app.agent_core.brains.github_retriever import GitHubRepositorySearchClient
from app.agent_core.memory.vector_store import BM25ReadmeStore, ReadmeDocument
from app.core.types import AcceptanceItem, CandidateEvaluation, ModelTurn, Requirement


REQ = Requirement(prompt="记录梦境并保存历史", acceptance=[AcceptanceItem(id="save", action="保存梦境", expected="刷新后仍存在")])


class FixedModel:
    def __init__(self, payload): self.payload = payload
    async def complete(self, *_args):
        return ModelTurn(assistant_message={"role": "assistant", "content": json.dumps(self.payload, ensure_ascii=False)})


class SearchClient:
    def __init__(self, candidates=None, error=None): self.candidates, self.error, self.queries = candidates or [], error, []
    async def search_repositories(self, query, per_page=20):
        self.queries.append(query)
        if self.error: raise self.error
        return self.candidates
    async def enrich_repository(self, candidate): return candidate


def candidate(url="https://github.com/example/dreams", **updates):
    data = dict(full_name=url.removeprefix("https://github.com/"), repo_url=url, commit="a" * 40, description="dream journal web app", stars=2,
                file_tree=["package.json", "src/app.ts"], key_files={"README.md": "save dreams", "package.json": '{"scripts":{"start":"node src/app.ts"}}'}, default_branch="main")
    data.update(updates)
    return RepositoryCandidate(**data)


def test_chinese_bm25_query_is_not_empty_and_hits_document():
    store = BM25ReadmeStore()
    store.upsert(ReadmeDocument(repo_id="dream", full_name="a/dream", readme_content="记录梦境并保存历史"))
    assert BM25ReadmeStore._tokenize("记录梦境的工具")
    assert store.search(["记录梦境"])[0].document.repo_id == "dream"


@pytest.mark.asyncio
async def test_retrieval_runs_multiple_queries_and_marks_failure_incomplete():
    ok = SearchClient([candidate()])
    result = await retrieve_sources(REQ, github_client=ok)
    assert result.completed and len(result.queries) >= 3 and result.candidates[0]["repo_url"].endswith("/dreams")
    failed = await retrieve_sources(REQ, github_client=SearchClient(error=RuntimeError("rate limited")))
    assert not failed.completed and failed.errors and not failed.candidates


def test_relevant_low_star_app_beats_popular_framework():
    app = CandidateEvaluation(repo_url="https://github.com/a/dreams", match_score=95, deploy_score=85, quality_score=60,
                              is_web_app=True, compatibility="SUPPORTED", evidence={"features": "source"})
    library = CandidateEvaluation(repo_url="https://github.com/b/framework", match_score=20, deploy_score=80, quality_score=100,
                                  is_web_app=False, compatibility="SUPPORTED", evidence={"type": "library"})
    assert app.total > library.total and app.eligible_a and not library.eligible_a


@pytest.mark.asyncio
async def test_incomplete_search_and_virtual_sources_are_rejected():
    from app.core.types import RetrievalResult
    incomplete = RetrievalResult(queries=["q"], completed=False, errors=["429"])
    with pytest.raises(SearchUnavailable):
        await choose_route(REQ, incomplete, [], FixedModel({"route": "GENERATE_APP", "sources": [], "steps": ["实现"], "reason": "无结果"}))
    complete = RetrievalResult(queries=["q"], completed=True, candidates=[normalize_candidate(candidate())], reuse_rejections=[{"route": "B", "reason": "too much work"}])
    with pytest.raises(ValueError):
        await plan_route(REQ, complete, FixedModel({"route": "MODIFY_EXISTING", "sources": [{"url": "https://github.com/fake/repo", "commit": "a" * 40, "role": "主体"}], "steps": ["改造"], "reason": "合适"}))


@pytest.mark.asyncio
async def test_eligible_existing_app_overrides_model_generation():
    from app.core.types import RetrievalResult
    row = normalize_candidate(candidate())
    search = RetrievalResult(queries=["q"], completed=True, candidates=[row])
    evaluation = CandidateEvaluation(repo_url=row["repo_url"], match_score=95, deploy_score=90, quality_score=60,
                                     is_web_app=True, compatibility="SUPPORTED", evidence={"entry": "package.json"})
    route = await choose_route(REQ, search, [evaluation], FixedModel({"route": "GENERATE_APP", "sources": [], "steps": ["生成"], "reason": "更快"}))
    assert route.route == "DEPLOY_EXISTING" and route.sources[0].url == row["repo_url"]


@pytest.mark.asyncio
async def test_generation_requires_completed_reuse_rejections():
    from app.core.types import RetrievalResult
    search = RetrievalResult(queries=["q"], completed=True, candidates=[], reuse_rejections=[])
    with pytest.raises(ValueError):
        await choose_route(REQ, search, [], FixedModel({"route": "GENERATE_APP", "sources": [], "steps": ["实现"], "reason": "无候选"}))
    search.reuse_rejections = [{"route": "A/B/C", "reason": "查询完成且无可运行来源"}]
    route = await choose_route(REQ, search, [], FixedModel({"route": "GENERATE_APP", "sources": [], "steps": ["实现"], "reason": "无合理复用"}))
    assert route.route == "GENERATE_APP"


def test_prepare_sources_locks_local_fixture_commit(tmp_path):
    repo = tmp_path / "repo"; repo.mkdir()
    subprocess.run(["git", "init", "-q", str(repo)], check=True)
    subprocess.run(["git", "-C", str(repo), "config", "user.email", "test@example.com"], check=True)
    subprocess.run(["git", "-C", str(repo), "config", "user.name", "test"], check=True)
    (repo / "README.md").write_text("fixture")
    subprocess.run(["git", "-C", str(repo), "add", "."], check=True)
    subprocess.run(["git", "-C", str(repo), "commit", "-qm", "fixture"], check=True)
    commit = subprocess.check_output(["git", "-C", str(repo), "rev-parse", "HEAD"], text=True).strip()
    from app.core.types import RepoSource, RoutePlan
    plan = RoutePlan(route="MODIFY_EXISTING", sources=[RepoSource(url=str(repo), commit=commit, role="主体")], steps=["修改"], reason="fixture")
    workspace = tmp_path / "workspace"; workspace.mkdir()
    sources = prepare_sources(str(workspace), plan, allow_local=True)
    assert sources[0].commit == commit and (workspace / "README.md").read_text() == "fixture"


def test_scoring_requires_key_material_and_web_runtime():
    evaluation = score_candidate(normalize_candidate(candidate(key_files={}, file_tree=[])), REQ)
    assert evaluation.unknown_fields and not evaluation.eligible_a


def test_license_must_be_collected_before_source_is_publishable():
    evaluation = score_candidate(normalize_candidate(candidate()), REQ)
    assert "license" in evaluation.unknown_fields and not evaluation.eligible_a
    selected = GitHubRepositorySearchClient._select_key_paths(["README.md", "LICENSE", "src/app.ts"])
    assert "LICENSE" in selected
