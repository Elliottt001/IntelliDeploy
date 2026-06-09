from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
import math
from typing import Any, Callable, Protocol

from pydantic import BaseModel, Field

from app.agent_core.brains.router_agent import RepoIntent, RouterAgent
from app.agent_core.memory.vector_store import BM25ReadmeStore, ReadmeSearchResult, clean_readme_text
from app.schemas.fallback import PackageManager, RepoProfile

logger = logging.getLogger(__name__)


class RepositoryCandidate(BaseModel):
    rank: int | None = Field(
        default=None,
        description="1-based rank after deployability reranking.",
    )
    full_name: str
    repo_url: str = Field(
        default="",
        description="Canonical GitHub repository URL expected by API consumers.",
    )
    html_url: str = ""
    description: str = ""
    stars: int = 0
    forks: int = 0
    open_issues_count: int | None = None
    is_archived: bool = False
    last_commit_at: str | None = Field(
        default=None,
        description="Timestamp of the latest known commit or push activity.",
    )
    pushed_at: str | None = None
    language: str | None = None
    topics: list[str] = Field(default_factory=list)
    files: list[str] = Field(default_factory=list)
    file_tree: list[str] = Field(
        default_factory=list,
        description="Repository file tree paths used by the downstream Builder Agent.",
    )
    key_files: dict[str, str] = Field(
        default_factory=dict,
        description="Selected README, dependency, build, entrypoint, and config file contents.",
    )
    readme_snippet: str = ""
    default_branch: str | None = None
    retrieval_score: float = Field(
        default=0.0,
        description="Final numeric score copied from score for the public API contract.",
    )
    source_scores: dict[str, float] = Field(default_factory=dict)
    score: float = 0.0
    score_breakdown: dict[str, float] = Field(default_factory=dict)

    def model_post_init(self, __context: Any) -> None:
        if not self.repo_url and self.html_url:
            self.repo_url = self.html_url
        if not self.html_url and self.repo_url:
            self.html_url = self.repo_url
        if self.last_commit_at is None and self.pushed_at is not None:
            self.last_commit_at = self.pushed_at
        if self.pushed_at is None and self.last_commit_at is not None:
            self.pushed_at = self.last_commit_at
        if not self.file_tree and self.files:
            self.file_tree = list(self.files)

    @property
    def repo_key(self) -> str:
        return self.full_name.lower()


class RetrievalResult(BaseModel):
    intent: RepoIntent
    candidates: list[RepositoryCandidate]
    repository_profile: RepoProfile | None = None


class GitHubSearchClient(Protocol):
    async def search_repositories(
        self, query: str, per_page: int = 20
    ) -> list[RepositoryCandidate]:
        ...

    async def enrich_repository(self, candidate: RepositoryCandidate) -> RepositoryCandidate:
        ...


class NL2RepoRetrievalPipeline:
    """Dual-track retrieval and deployability reranking for NL2Repo."""

    def __init__(
        self,
        router: RouterAgent | None = None,
        github_client: GitHubSearchClient | None = None,
        readme_store: BM25ReadmeStore | None = None,
        llm_reranker: Callable[[RepoIntent, list[RepositoryCandidate]], list[str]] | None = None,
        github_top_k: int = 20,
        readme_top_k: int = 20,
    ):
        self.router = router or RouterAgent()
        self.github_client = github_client
        self.readme_store = readme_store or BM25ReadmeStore()
        self.llm_reranker = llm_reranker
        self.github_top_k = github_top_k
        self.readme_top_k = readme_top_k

    async def retrieve(self, natural_language_query: str, top_n: int = 3) -> RetrievalResult:
        intent = self.router.structure_intent(natural_language_query)

        # Run exact GitHub search and README BM25 retrieval concurrently. The
        # slower path determines latency, so neither path should block the other.
        github_task = self._github_search(intent)
        readme_task = self._readme_search(intent)
        github_candidates, readme_candidates = await asyncio.gather(
            github_task, readme_task
        )

        # Dedupe before enrichment so the same repository only pays the GitHub
        # contents/readme lookup cost once.
        merged = self._merge_candidates(github_candidates + readme_candidates)
        enriched = await self._enrich_candidates(merged)
        filtered = [candidate for candidate in enriched if self._passes_hard_rules(candidate)]

        # Coarse ranking is deterministic and cheap. Optional LLM reranking only
        # sees the Top 10 summaries to avoid context-window and latency blowups.
        ranked = self._coarse_rank(intent, filtered)
        ranked = self._llm_rank(intent, ranked[:10])
        selected = ranked[:top_n]
        for index, candidate in enumerate(selected, start=1):
            candidate.rank = index
            candidate.retrieval_score = candidate.score
            candidate.repo_url = candidate.repo_url or candidate.html_url
            candidate.last_commit_at = candidate.last_commit_at or candidate.pushed_at
        profile = self.extract_repository_profile(selected[0]) if selected else None
        return RetrievalResult(
            intent=intent,
            candidates=selected,
            repository_profile=profile,
        )

    async def _github_search(self, intent: RepoIntent) -> list[RepositoryCandidate]:
        if self.github_client is None:
            logger.warning(
                "GitHub search skipped: github_client is None. Check RetrievalService init."
            )
            return []

        return await self._github_search_multi(intent)

        # 渐进式降级：原始 query → 砍掉 pushed/stars 限制 → 砍掉次要关键词。
        # GitHub Search 是严格 AND，关键词稍多就 0 结果，需要逐步放宽。
        queries = self._relaxed_query_variants(intent.github_query)
        last_error: Exception | None = None

        for attempt, query in enumerate(queries):
            try:
                candidates = await self.github_client.search_repositories(
                    query, per_page=self.github_top_k
                )
            except Exception as exc:
                last_error = exc
                logger.exception(
                    "GitHub search attempt %d failed for query=%r: %s. "
                    "Verify tokens with: curl -H 'Authorization: Bearer <TOKEN>' "
                    "https://api.github.com/rate_limit",
                    attempt,
                    query,
                    exc,
                )
                continue

            if candidates:
                if attempt > 0:
                    logger.info(
                        "GitHub search recovered with relaxed query (attempt %d): %r → %d candidates",
                        attempt,
                        query,
                        len(candidates),
                    )
                else:
                    logger.info(
                        "GitHub search returned %d candidate(s) for query=%r.",
                        len(candidates),
                        query,
                    )
                for index, candidate in enumerate(candidates):
                    candidate.source_scores.setdefault("github_search", 1.0 - index * 0.02)
                return candidates

            logger.warning(
                "GitHub search returned 0 items for query=%r (attempt %d). Trying relaxed variant.",
                query,
                attempt,
            )

        if last_error is None:
            logger.warning(
                "GitHub search exhausted all relaxed variants with 0 results. "
                "Original query: %r",
                intent.github_query,
            )
        return []

    async def _github_search_multi(self, intent: RepoIntent) -> list[RepositoryCandidate]:
        last_error: Exception | None = None
        aggregated: dict[str, RepositoryCandidate] = {}

        for query_index, base_query in enumerate(self._github_queries(intent)):
            for variant_index, query in enumerate(self._relaxed_query_variants(base_query)):
                try:
                    candidates = await self.github_client.search_repositories(
                        query, per_page=self.github_top_k
                    )
                except Exception as exc:
                    last_error = exc
                    logger.exception(
                        "GitHub search failed for query=%r: %s. "
                        "Verify tokens with: curl -H 'Authorization: Bearer <TOKEN>' "
                        "https://api.github.com/rate_limit",
                        query,
                        exc,
                    )
                    continue

                if not candidates:
                    logger.warning(
                        "GitHub search returned 0 items for query=%r. Trying next variant.",
                        query,
                    )
                    continue

                logger.info(
                    "GitHub search returned %d candidate(s) for query=%r.",
                    len(candidates),
                    query,
                )
                for index, candidate in enumerate(candidates):
                    source_score = max(
                        0.35,
                        1.0
                        - query_index * 0.12
                        - variant_index * 0.04
                        - index * 0.04,
                    )
                    existing = aggregated.get(candidate.repo_key)
                    if existing is None:
                        candidate.source_scores["github_search"] = max(
                            candidate.source_scores.get("github_search", 0.0),
                            source_score,
                        )
                        aggregated[candidate.repo_key] = candidate
                    else:
                        existing.source_scores["github_search"] = max(
                            existing.source_scores.get("github_search", 0.0),
                            source_score,
                        )

        if not aggregated and last_error is None:
            logger.warning(
                "GitHub search exhausted all query variants with 0 results. "
                "Original query: %r",
                intent.github_query,
            )
        return list(aggregated.values())

    def _github_queries(self, intent: RepoIntent) -> list[str]:
        guards = self._query_guards(intent)
        guard_suffix = " ".join(guards)
        stack_terms = self._stack_query_terms(intent)
        primary_stack = stack_terms[0] if stack_terms else ""
        high_value = " ".join(self._high_value_terms(intent)[:3])
        queries = [intent.github_query]

        def add(query: str) -> None:
            cleaned = " ".join(query.split())
            if cleaned:
                queries.append(cleaned)

        if intent.target_app_type == "admin_dashboard":
            add(f"{primary_stack} admin dashboard template docker {guard_suffix}")
            add(f"{primary_stack} auth database postgresql starter {guard_suffix}")
            add(f"{primary_stack} full stack template docker {guard_suffix}")
        elif intent.has_database:
            add(f"{primary_stack} auth database starter docker {guard_suffix}")
            add(f"{primary_stack} full stack template docker {guard_suffix}")
            add(f"{high_value} application template {guard_suffix}")
        elif intent.is_frontend_only:
            add(f"{primary_stack} template starter portfolio {guard_suffix}")
            add(f"{primary_stack} personal website template {guard_suffix}")
        else:
            add(f"{primary_stack} {high_value} template starter docker {guard_suffix}")
            add(f"{primary_stack} full stack template docker {guard_suffix}")

        seen: set[str] = set()
        deduped: list[str] = []
        for query in queries:
            cleaned = " ".join((query or "").split())
            if cleaned and cleaned not in seen:
                seen.add(cleaned)
                deduped.append(cleaned)
        return deduped[:4]

    @staticmethod
    def _query_guards(intent: RepoIntent) -> list[str]:
        guards: list[str] = []
        for token in (intent.github_query or "").split():
            if token.startswith(("stars:", "pushed:", "language:", "topic:")):
                guards.append(token)
        return guards

    @staticmethod
    def _stack_query_terms(intent: RepoIntent) -> list[str]:
        raw_terms = list(intent.tech_stack)
        if intent.preferred_framework:
            raw_terms.insert(0, intent.preferred_framework)
        if intent.preferred_language:
            raw_terms.append(intent.preferred_language)

        mapping = {
            "nextjs": "nextjs",
            "react": "react",
            "vue": "vue",
            "typescript": "typescript",
            "javascript": "javascript",
            "python": "python",
            "fastapi": "fastapi",
            "django": "django",
            "flask": "flask",
        }
        terms: list[str] = []
        seen: set[str] = set()
        for term in raw_terms:
            normalized = term.lower().replace(".", "").replace(" ", "")
            mapped = mapping.get(normalized)
            if mapped and mapped not in seen:
                seen.add(mapped)
                terms.append(mapped)
        return terms

    @staticmethod
    def _relaxed_query_variants(query: str) -> list[str]:
        """
        给一个 GitHub 查询生成 1~4 个递进放宽的版本：
        0) 原始 query
        1) 去掉 pushed:>... 限制
        2) 只保留 topic: + stars: + language:, 砍掉所有自由文本关键词
        3) 只保留 stars:, 连 topic 也砍掉 —— 兜底确保有结果
        """
        if not query:
            return []
        tokens = query.split()
        variants: list[str] = [query]

        no_pushed = [tok for tok in tokens if not tok.startswith("pushed:")]
        if no_pushed != tokens:
            variants.append(" ".join(no_pushed))

        skeleton = [tok for tok in tokens if tok.startswith(("topic:", "stars:", "language:"))]
        if skeleton and skeleton not in (tokens, no_pushed):
            variants.append(" ".join(skeleton))

        # 兜底：纯 stars 过滤。topic 太窄或者 GitHub Search 抖时,这一档保命。
        stars_only = [tok for tok in tokens if tok.startswith("stars:")]
        if stars_only:
            variants.append(" ".join(stars_only))

        seen: set[str] = set()
        deduped: list[str] = []
        for variant in variants:
            if variant and variant not in seen:
                seen.add(variant)
                deduped.append(variant)
        return deduped

    async def _readme_search(self, intent: RepoIntent) -> list[RepositoryCandidate]:
        results = self.readme_store.search(intent.keywords, top_k=self.readme_top_k)
        if not results:
            return []

        max_score = max((result.score for result in results), default=1.0) or 1.0
        return [
            self._candidate_from_readme_result(result, result.score / max_score)
            for result in results
        ]

    def _candidate_from_readme_result(
        self, result: ReadmeSearchResult, normalized_score: float
    ) -> RepositoryCandidate:
        document = result.document
        metadata = document.metadata
        readme_snippet = clean_readme_text(document.readme_content)[:1000]
        return RepositoryCandidate(
            full_name=document.full_name,
            html_url=metadata.get("html_url") or f"https://github.com/{document.full_name}",
            description=document.description or metadata.get("description", ""),
            stars=int(metadata.get("stars") or 0),
            forks=int(metadata.get("forks") or 0),
            open_issues_count=metadata.get("open_issues_count"),
            pushed_at=metadata.get("pushed_at"),
            last_commit_at=metadata.get("last_commit_at") or metadata.get("pushed_at"),
            language=metadata.get("language"),
            topics=list(metadata.get("topics") or []),
            files=list(metadata.get("files") or []),
            file_tree=list(metadata.get("file_tree") or metadata.get("files") or []),
            key_files=dict(metadata.get("key_files") or {}),
            readme_snippet=readme_snippet,
            default_branch=metadata.get("default_branch"),
            is_archived=bool(metadata.get("is_archived") or metadata.get("archived") or False),
            source_scores={"readme_bm25": normalized_score},
        )

    async def _enrich_candidates(
        self, candidates: list[RepositoryCandidate]
    ) -> list[RepositoryCandidate]:
        if self.github_client is None or not hasattr(self.github_client, "enrich_repository"):
            return candidates

        async def enrich(candidate: RepositoryCandidate) -> RepositoryCandidate:
            try:
                return await self.github_client.enrich_repository(candidate)
            except Exception as exc:
                # 静默吞掉 enrichment 异常会让下游拿到空 file_tree，
                # 进而被 fallback classifier 错判成「仓库本身是空的」，
                # 然后默默走 Decision C 生成与原仓库无关的脚手架 —— 而日志里
                # 没有任何线索说明 GitHub 调用其实失败了。这里必须发声，
                # 同时保留容错行为（返回原 candidate）让上层重试 / 评分链路继续跑。
                logger.warning(
                    "github enrichment failed for %s (%s): %s",
                    getattr(candidate, "repo_url", "<unknown>"),
                    type(exc).__name__,
                    exc,
                )
                return candidate

        return list(await asyncio.gather(*(enrich(candidate) for candidate in candidates)))

    def _merge_candidates(
        self, candidates: list[RepositoryCandidate]
    ) -> list[RepositoryCandidate]:
        merged: dict[str, RepositoryCandidate] = {}
        for candidate in candidates:
            key = candidate.repo_key
            if key not in merged:
                merged[key] = candidate.model_copy(deep=True)
                continue

            current = merged[key]
            current.source_scores.update(candidate.source_scores)
            current.stars = max(current.stars, candidate.stars)
            current.forks = max(current.forks, candidate.forks)
            current.description = current.description or candidate.description
            current.html_url = current.html_url or candidate.html_url
            current.language = current.language or candidate.language
            current.pushed_at = self._newer_timestamp(current.pushed_at, candidate.pushed_at)
            current.last_commit_at = self._newer_timestamp(
                current.last_commit_at, candidate.last_commit_at
            )
            current.topics = sorted(set(current.topics) | set(candidate.topics))
            current.files = sorted(set(current.files) | set(candidate.files))
            current.file_tree = sorted(set(current.file_tree) | set(candidate.file_tree))
            current.key_files = {**candidate.key_files, **current.key_files}
            current.readme_snippet = current.readme_snippet or candidate.readme_snippet
            current.default_branch = current.default_branch or candidate.default_branch
            current.is_archived = current.is_archived or candidate.is_archived
        return list(merged.values())

    def _passes_hard_rules(self, candidate: RepositoryCandidate) -> bool:
        if candidate.is_archived:
            return False

        pushed_at = self._parse_timestamp(candidate.pushed_at)
        if pushed_at is not None:
            cutoff = datetime.now(timezone.utc) - timedelta(days=365)
            if pushed_at < cutoff:
                return False

        candidate_paths = self._candidate_paths(candidate)
        if candidate_paths and not self._has_engineering_structure(candidate_paths):
            return False

        return True

    def _coarse_rank(
        self, intent: RepoIntent, candidates: list[RepositoryCandidate]
    ) -> list[RepositoryCandidate]:
        ranked: list[RepositoryCandidate] = []
        for candidate in candidates:
            candidate = candidate.model_copy(deep=True)
            breakdown = self._score_candidate(intent, candidate)
            candidate.score_breakdown = breakdown
            candidate.score = sum(breakdown.values())
            ranked.append(candidate)

        ranked.sort(key=lambda candidate: candidate.score, reverse=True)
        return ranked

    def _llm_rank(
        self, intent: RepoIntent, candidates: list[RepositoryCandidate]
    ) -> list[RepositoryCandidate]:
        if self.llm_reranker is None or not candidates:
            return candidates

        try:
            ordered_names = self.llm_reranker(intent, candidates)
        except Exception:
            return candidates

        order = {name.lower(): index for index, name in enumerate(ordered_names)}
        return sorted(
            candidates,
            key=lambda candidate: (
                order.get(candidate.repo_key, len(order)),
                -candidate.score,
            ),
        )

    def _score_candidate(
        self, intent: RepoIntent, candidate: RepositoryCandidate
    ) -> dict[str, float]:
        source_score = max(candidate.source_scores.values(), default=0.0)
        deployability = self._deployability_score(candidate)
        breakdown = {
            "retrieval_relevance": 20.0 * source_score,
            "intent_match": self._intent_match_score(intent, candidate),
            "deployability": deployability,
            "application_signal": self._application_signal_score(candidate),
            "stack_match": self._stack_match_score(intent, candidate),
            "stars": min(math.log(candidate.stars + 1, 10) * 1.25, 5.0),
            "recency": self._recency_score(candidate.pushed_at),
            "docker_bonus": 8.0
            if self._has_docker_signal(candidate)
            else 0.0,
            "template_stack_bonus": 5.0
            if self._has_template_signal(candidate)
            and self._matches_preferred_stack(intent, candidate)
            else 0.0,
            "package_structure": min(deployability, 10.0)
            if self._has_engineering_structure(self._candidate_paths(candidate))
            else 0.0,
            "dual_track_bonus": 4.0
            if {"github_search", "readme_bm25"}.issubset(candidate.source_scores)
            else 0.0,
            "complexity_fit": self._complexity_fit_score(candidate),
            "framework_library_penalty": self._framework_library_penalty(candidate),
            "tutorial_penalty": self._tutorial_penalty(candidate),
            "no_deploy_evidence_penalty": self._no_deploy_evidence_penalty(candidate),
            "intent_mismatch_penalty": self._intent_mismatch_penalty(intent, candidate),
        }
        return breakdown

    def extract_repository_profile(self, candidate: RepositoryCandidate) -> RepoProfile:
        dependency_files = [
            file_name
            for file_name in self._candidate_paths(candidate)
            if self._path_name(file_name)
            in {
                "package.json",
                "requirements.txt",
                "pyproject.toml",
                "poetry.lock",
                "go.mod",
                "pom.xml",
                "build.gradle",
                "build.gradle.kts",
                "dockerfile",
                "docker-compose.yml",
            }
        ]
        frameworks = self._detected_frameworks(candidate)
        package_manager = self._detect_package_manager(self._candidate_paths(candidate))
        return RepoProfile(
            source_repo_url=candidate.repo_url or candidate.html_url,
            detected_languages=[candidate.language] if candidate.language else None,
            detected_frameworks=frameworks or None,
            package_manager=package_manager,
            entrypoints=self._detect_entrypoints(self._candidate_paths(candidate)) or None,
            dependency_files=dependency_files or None,
            has_valid_dockerfile=self._has_docker(self._candidate_paths(candidate)),
            readme_summary=(candidate.readme_snippet or candidate.description)[:500] or None,
            # 同 rag_service._profile_from_retrieval_candidate：必须把 GitHub
            # 抓到的 file_tree / key_files 一并塞进 RepoProfile，否则 fallback
            # 拿不到任何源码原料，必然走 Decision C。
            file_tree=list(getattr(candidate, "file_tree", None) or []),
            key_files=dict(getattr(candidate, "key_files", None) or {}),
        )

    def _recency_score(self, pushed_at: str | None) -> float:
        pushed = self._parse_timestamp(pushed_at)
        if pushed is None:
            return 3.0
        age_days = (datetime.now(timezone.utc) - pushed).days
        if age_days <= 365:
            return 8.0
        if age_days <= 730:
            return 4.0
        return 0.0

    def _intent_match_score(self, intent: RepoIntent, candidate: RepositoryCandidate) -> float:
        terms = self._high_value_terms(intent)
        if not terms:
            return 0.0

        text = self._candidate_text(candidate)
        matches = sum(1 for term in terms if self._term_matches(term, text))
        return min(30.0, 30.0 * matches / max(len(terms), 1))

    def _deployability_score(self, candidate: RepositoryCandidate) -> float:
        paths = self._candidate_paths(candidate)
        names = {self._path_name(path) for path in paths}
        key_text = " ".join(candidate.key_files.values()).lower()
        score = 0.0
        if "dockerfile" in names:
            score += 10.0
        if "docker-compose.yml" in names or "compose.yml" in names:
            score += 5.0
        if names & {
            "package.json",
            "requirements.txt",
            "pyproject.toml",
            "go.mod",
            "pom.xml",
            "build.gradle",
            "build.gradle.kts",
        }:
            score += 5.0
        if names & {
            "package-lock.json",
            "pnpm-lock.yaml",
            "yarn.lock",
            "poetry.lock",
            "uv.lock",
        }:
            score += 2.0
        if self._detect_entrypoints(paths):
            score += 3.0
        if any(token in key_text for token in ("expose ", "cmd ", "entrypoint ", "npm start")):
            score += 2.0
        return min(score, 25.0)

    def _application_signal_score(self, candidate: RepositoryCandidate) -> float:
        text = self._candidate_text(candidate)
        signals = [
            "template",
            "starter",
            "boilerplate",
            "full stack",
            "fullstack",
            "dashboard",
            "admin",
            "backoffice",
            "app",
            "application",
        ]
        hits = sum(1 for signal in signals if signal in text)
        return min(15.0, hits * 3.0)

    def _stack_match_score(self, intent: RepoIntent, candidate: RepositoryCandidate) -> float:
        if not intent.tech_stack and not intent.preferred_language:
            return 0.0
        score = 0.0
        if self._matches_preferred_stack(intent, candidate):
            score += 9.0
        if intent.preferred_language and candidate.language:
            if intent.preferred_language.lower() == candidate.language.lower():
                score += 3.0
        return min(score, 12.0)

    def _complexity_fit_score(self, candidate: RepositoryCandidate) -> float:
        file_count = len(self._candidate_paths(candidate))
        if file_count == 0:
            return 1.0
        if file_count <= 80:
            return 5.0
        if file_count <= 250:
            return 3.0
        return -3.0

    def _framework_library_penalty(self, candidate: RepositoryCandidate) -> float:
        text = self._candidate_text(candidate)
        name = candidate.full_name.lower()
        library_markers = [
            "framework",
            "library",
            "sdk",
            "toolkit",
            "package",
            "plugin",
        ]
        if name in {"fastapi/fastapi", "django/django", "pallets/flask", "expressjs/express"}:
            return -35.0
        if any(marker in text for marker in library_markers) and not self._has_template_signal(candidate):
            return -20.0
        return 0.0

    def _tutorial_penalty(self, candidate: RepositoryCandidate) -> float:
        text = self._candidate_text(candidate)
        tutorial_markers = [
            "tutorial",
            "course",
            "learn",
            "awesome",
            "examples",
            "example collection",
            "beginner",
            "hello-python",
        ]
        return -30.0 if any(marker in text for marker in tutorial_markers) else 0.0

    def _no_deploy_evidence_penalty(self, candidate: RepositoryCandidate) -> float:
        deployability = self._deployability_score(candidate)
        if self._has_docker_signal(candidate):
            return 0.0
        return -25.0 if deployability <= 2.0 else 0.0

    def _intent_mismatch_penalty(self, intent: RepoIntent, candidate: RepositoryCandidate) -> float:
        text = self._candidate_text(candidate)
        penalty = 0.0
        if intent.target_app_type == "admin_dashboard":
            admin_terms = ["admin", "dashboard", "backoffice", "management ui"]
            if not any(term in text for term in admin_terms):
                penalty -= 45.0
            off_target_terms = [
                "photo",
                "image",
                "compress",
                "compression",
                "machine learning",
                "deep learning",
            ]
            if any(term in text for term in off_target_terms):
                penalty -= 15.0
        return penalty

    @staticmethod
    def _high_value_terms(intent: RepoIntent) -> list[str]:
        generic = {
            "deployable",
            "web app",
            "app",
            "application",
            "tool",
            "template",
            "starter",
        }
        terms: list[str] = []
        for term in [*intent.expected_features, *intent.keywords, *intent.tech_stack]:
            cleaned = term.lower().strip()
            if cleaned and cleaned not in generic and not cleaned.startswith(("stars:", "pushed:")):
                terms.append(cleaned)
        seen: set[str] = set()
        deduped: list[str] = []
        for term in terms:
            if term not in seen:
                seen.add(term)
                deduped.append(term)
        return deduped[:8]

    @staticmethod
    def _term_matches(term: str, text: str) -> bool:
        normalized_term = term.lower().replace(".", "").replace("-", " ")
        normalized_text = text.lower().replace(".", "").replace("-", " ")
        if normalized_term in normalized_text:
            return True
        words = [word for word in normalized_term.split() if len(word) > 2]
        return bool(words) and all(word in normalized_text for word in words)

    def _has_docker_signal(self, candidate: RepositoryCandidate) -> bool:
        if self._has_docker(self._candidate_paths(candidate)):
            return True
        return any(
            token in self._candidate_text(candidate)
            for token in ("docker", "container", "compose", "deployment")
        )

    def _has_template_signal(self, candidate: RepositoryCandidate) -> bool:
        text = self._candidate_text(candidate)
        return any(
            token in text
            for token in ("template", "starter", "boilerplate", "scaffold", "full stack", "fullstack")
        )

    @staticmethod
    def _candidate_text(candidate: RepositoryCandidate) -> str:
        return " ".join(
            [
                candidate.full_name,
                candidate.description,
                candidate.language or "",
                " ".join(candidate.topics),
                " ".join(candidate.files),
                " ".join(candidate.file_tree),
                candidate.readme_snippet,
                " ".join(candidate.key_files.values()),
            ]
        ).lower()

    def _matches_preferred_stack(
        self, intent: RepoIntent, candidate: RepositoryCandidate
    ) -> bool:
        haystack = " ".join(
            [
                candidate.full_name,
                candidate.description,
                candidate.language or "",
                " ".join(candidate.topics),
                " ".join(candidate.files),
                " ".join(candidate.file_tree),
            ]
        ).lower()
        for stack in intent.tech_stack:
            normalized = stack.lower().replace(".", "").replace(" ", "")
            if normalized in haystack.replace(".", "").replace(" ", ""):
                return True
            if normalized == "nextjs" and "next" in haystack:
                return True
        return False

    def _detected_frameworks(self, candidate: RepositoryCandidate) -> list[str]:
        text = " ".join(
            [
                candidate.description,
                " ".join(candidate.topics),
                " ".join(candidate.files),
                " ".join(candidate.file_tree),
            ]
        ).lower()
        frameworks: list[str] = []
        for label, markers in {
            "Next.js": ["nextjs", "next.js", "next"],
            "React": ["react"],
            "Vue": ["vue"],
            "FastAPI": ["fastapi"],
            "Django": ["django"],
            "Flask": ["flask"],
        }.items():
            if any(marker in text for marker in markers):
                frameworks.append(label)
        return frameworks

    @staticmethod
    def _detect_package_manager(files: list[str]) -> PackageManager | None:
        names = {NL2RepoRetrievalPipeline._path_name(file_name) for file_name in files}
        if "pnpm-lock.yaml" in names:
            return PackageManager.pnpm
        if "yarn.lock" in names:
            return PackageManager.yarn
        if "package.json" in names:
            return PackageManager.npm
        if "poetry.lock" in names or "pyproject.toml" in names:
            return PackageManager.poetry
        if "requirements.txt" in names:
            return PackageManager.pip
        if "go.mod" in names:
            return PackageManager.go
        if "pom.xml" in names:
            return PackageManager.maven
        if "build.gradle" in names or "build.gradle.kts" in names:
            return PackageManager.gradle
        return None

    @staticmethod
    def _detect_entrypoints(files: list[str]) -> list[str]:
        names = {NL2RepoRetrievalPipeline._path_name(file_name) for file_name in files}
        entrypoints: list[str] = []
        for file_path in files:
            if NL2RepoRetrievalPipeline._path_name(file_path) in {
                "dockerfile",
                "package.json",
                "main.py",
                "app.py",
                "server.js",
                "index.js",
                "main.ts",
                "go.mod",
            }:
                entrypoints.append(file_path)
        return entrypoints

    @staticmethod
    def _has_docker(files: list[str]) -> bool:
        names = {NL2RepoRetrievalPipeline._path_name(file_name) for file_name in files}
        return "dockerfile" in names or "docker-compose.yml" in names

    @staticmethod
    def _has_engineering_structure(files: list[str]) -> bool:
        names = {NL2RepoRetrievalPipeline._path_name(file_name) for file_name in files}
        return bool(
            names
            & {
                "package.json",
                "pom.xml",
                "requirements.txt",
                "pyproject.toml",
                "go.mod",
                "dockerfile",
                "docker-compose.yml",
            }
        )

    @staticmethod
    def _candidate_paths(candidate: RepositoryCandidate) -> list[str]:
        return sorted(set(candidate.files) | set(candidate.file_tree))

    @staticmethod
    def _path_name(file_path: str) -> str:
        return file_path.replace("\\", "/").rsplit("/", 1)[-1].lower()

    @staticmethod
    def _newer_timestamp(first: str | None, second: str | None) -> str | None:
        first_dt = NL2RepoRetrievalPipeline._parse_timestamp(first)
        second_dt = NL2RepoRetrievalPipeline._parse_timestamp(second)
        if first_dt is None:
            return second
        if second_dt is None:
            return first
        return second if second_dt > first_dt else first

    @staticmethod
    def _parse_timestamp(value: str | None) -> datetime | None:
        if not value:
            return None
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
