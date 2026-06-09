from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
import math
from typing import Any, Callable, Protocol

from pydantic import BaseModel, Field

from app.agent_core.brains.router_agent import RepoIntent, RouterAgent
from app.agent_core.memory.vector_store import BM25ReadmeStore, ReadmeSearchResult, clean_readme_text
from app.schemas.fallback import PackageManager, RepoProfile


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
        github_top_k: int = 5,
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
            return []

        all_candidates: list[RepositoryCandidate] = []
        for query_index, query in enumerate(self._github_queries(intent)):
            try:
                candidates = await self.github_client.search_repositories(
                    query, per_page=self.github_top_k
                )
            except Exception:
                continue

            for index, candidate in enumerate(candidates):
                candidate.source_scores["github"] = max(
                    candidate.source_scores.get("github", 0.0),
                    max(0.35, 1.0 - query_index * 0.12 - index * 0.04),
                )
                all_candidates.append(candidate)
        return all_candidates

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
            source_scores={"bm25": normalized_score},
        )

    async def _enrich_candidates(
        self, candidates: list[RepositoryCandidate]
    ) -> list[RepositoryCandidate]:
        if self.github_client is None or not hasattr(self.github_client, "enrich_repository"):
            return candidates
        if getattr(self.github_client, "has_auth_token", True) is False:
            return candidates

        async def enrich(candidate: RepositoryCandidate) -> RepositoryCandidate:
            try:
                return await self.github_client.enrich_repository(candidate)
            except Exception:
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
            "application_signal": self._application_signal_score(intent, candidate),
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
            if {"github", "bm25"}.issubset(candidate.source_scores)
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

    def _github_queries(self, intent: RepoIntent) -> list[str]:
        guards = self._query_guards(intent.github_query)
        stack_terms = self._stack_query_terms(intent)
        primary_stack = stack_terms[0] if stack_terms else None
        queries = [intent.github_query]

        def add(parts: list[str]) -> None:
            query = " ".join([part for part in parts if part]).strip()
            if query and query not in queries:
                queries.append(query)

        if intent.target_app_type == "admin_dashboard":
            add([primary_stack, "admin", "dashboard", "template", "docker", guards])
            add([primary_stack, "auth", "database", "postgresql", "starter", guards])
            add([primary_stack, "full", "stack", "template", "docker", guards])
        elif intent.has_database:
            add([primary_stack, "auth", "database", "starter", "docker", guards])
            add([primary_stack, "full", "stack", "template", "docker", guards])
        elif intent.is_frontend_only:
            add([primary_stack, "template", "starter", "portfolio", guards])
        else:
            app_terms = self._high_value_terms(intent.keywords + intent.expected_features)[:3]
            add([primary_stack, *app_terms, "template", "starter", "docker", guards])

        return queries[:4]

    @staticmethod
    def _query_guards(query: str) -> str:
        guards = [
            term
            for term in query.split()
            if term.startswith("stars:>") or term.startswith("pushed:>")
        ]
        return " ".join(guards)

    @staticmethod
    def _stack_query_terms(intent: RepoIntent) -> list[str]:
        terms: list[str] = []
        for stack in intent.tech_stack:
            normalized = stack.lower().replace(".", "").replace(" ", "")
            if normalized in {"python", "javascript", "typescript"}:
                continue
            if normalized == "nextjs":
                normalized = "nextjs"
            if normalized and normalized not in terms:
                terms.append(normalized)
        if not terms:
            for keyword in intent.keywords:
                normalized = keyword.lower().replace(".", "").replace(" ", "")
                if normalized in {"fastapi", "nextjs", "react", "vue", "django", "flask"}:
                    terms.append(normalized)
                    break
        return terms

    def _intent_match_score(self, intent: RepoIntent, candidate: RepositoryCandidate) -> float:
        haystack = self._candidate_text(candidate)
        terms = self._high_value_terms(
            intent.keywords + intent.expected_features + intent.tech_stack
        )
        if not terms:
            return 10.0
        matched = sum(1 for term in terms if self._term_matches(term, haystack))
        return min(30.0, 30.0 * matched / max(len(terms), 1))

    def _deployability_score(self, candidate: RepositoryCandidate) -> float:
        files = self._candidate_paths(candidate)
        names = {self._path_name(file_name) for file_name in files}
        score = 0.0
        if "dockerfile" in names:
            score += 9.0
        if "docker-compose.yml" in names:
            score += 4.0
        if names & {"package.json", "requirements.txt", "pyproject.toml", "go.mod", "pom.xml"}:
            score += 5.0
        if self._detect_entrypoints(files):
            score += 3.0
        if any(name in names for name in {"package-lock.json", "pnpm-lock.yaml", "poetry.lock"}):
            score += 2.0
        if self._has_docker_signal(candidate) and "dockerfile" not in names:
            score += 2.0
        return min(score, 25.0)

    def _application_signal_score(
        self, intent: RepoIntent, candidate: RepositoryCandidate
    ) -> float:
        haystack = self._candidate_text(candidate)
        score = 0.0
        if self._has_template_signal(candidate):
            score += 6.0
        if any(
            term in haystack
            for term in [
                "app",
                "application",
                "dashboard",
                "admin",
                "starter",
                "boilerplate",
                "full stack",
                "full-stack",
            ]
        ):
            score += 4.0
        if intent.target_app_type == "admin_dashboard" and any(
            term in haystack for term in ["admin", "dashboard", "backoffice"]
        ):
            score += 8.0
        if intent.has_database and any(
            term in haystack for term in ["postgres", "postgresql", "database", "sqlmodel"]
        ):
            score += 2.0
        return min(score, 15.0)

    def _stack_match_score(self, intent: RepoIntent, candidate: RepositoryCandidate) -> float:
        score = 0.0
        if self._matches_preferred_stack(intent, candidate):
            score += 8.0
        if intent.preferred_language and candidate.language:
            if intent.preferred_language.lower() == candidate.language.lower():
                score += 4.0
        return min(score, 12.0)

    def _complexity_fit_score(self, candidate: RepositoryCandidate) -> float:
        file_count = len(self._candidate_paths(candidate))
        if file_count == 0:
            return 0.0
        if file_count <= 250:
            return 5.0
        if file_count <= 500:
            return 2.0
        return -5.0

    def _framework_library_penalty(self, candidate: RepositoryCandidate) -> float:
        haystack = self._candidate_text(candidate)
        repo_name = candidate.full_name.lower()
        if self._has_template_signal(candidate):
            return 0.0
        if repo_name in {"fastapi/fastapi", "django/django", "pallets/flask"}:
            return -35.0
        if any(term in haystack for term in ["framework", "library", "sdk"]):
            return -35.0
        return 0.0

    def _tutorial_penalty(self, candidate: RepositoryCandidate) -> float:
        haystack = self._candidate_text(candidate)
        if any(
            term in haystack
            for term in [
                "tutorial",
                "course",
                "learn",
                "awesome",
                "examples collection",
                "hello-python",
                "beginner",
            ]
        ):
            return -30.0
        return 0.0

    def _no_deploy_evidence_penalty(self, candidate: RepositoryCandidate) -> float:
        if self._deployability_score(candidate) <= 2.0 and not self._has_docker_signal(
            candidate
        ):
            return -25.0
        return 0.0

    def _intent_mismatch_penalty(
        self, intent: RepoIntent, candidate: RepositoryCandidate
    ) -> float:
        haystack = self._candidate_text(candidate)
        if intent.target_app_type == "admin_dashboard":
            if not any(
                term in haystack
                for term in ["admin", "dashboard", "backoffice", "management ui"]
            ):
                return -45.0
            if any(term in haystack for term in ["photo", "image", "machine-learning", "compress"]):
                return -15.0
        return 0.0

    @staticmethod
    def _high_value_terms(values: list[str]) -> list[str]:
        generic = {
            "api",
            "app",
            "application",
            "backend",
            "deploy",
            "deployable",
            "repository",
            "service",
            "template",
            "web",
        }
        terms: list[str] = []
        for value in values:
            clean = value.lower().strip()
            if not clean or clean in generic:
                continue
            if clean not in terms:
                terms.append(clean)
        return terms

    @staticmethod
    def _term_matches(term: str, haystack: str) -> bool:
        normalized = term.lower().replace(".", "").strip()
        compact_haystack = haystack.replace(".", "")
        if normalized in compact_haystack:
            return True
        if normalized == "admin dashboard":
            return "admin" in compact_haystack and "dashboard" in compact_haystack
        return False

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

    def _has_docker_signal(self, candidate: RepositoryCandidate) -> bool:
        if self._has_docker(self._candidate_paths(candidate)):
            return True
        haystack = " ".join(
            [candidate.description, candidate.readme_snippet, *candidate.topics]
        ).lower()
        return any(term in haystack for term in {"docker", "container", "compose"})

    def _has_template_signal(self, candidate: RepositoryCandidate) -> bool:
        haystack = self._candidate_text(candidate)
        return any(
            term in haystack
            for term in {
                "template",
                "starter",
                "boilerplate",
                "full-stack",
                "full stack",
                "scaffold",
            }
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
                " ".join(candidate.key_files.keys()),
                " ".join(candidate.key_files.values()),
                candidate.readme_snippet,
            ]
        ).lower()

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
