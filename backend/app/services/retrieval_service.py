from __future__ import annotations

from app.agent_core.brains.context_rag_agent import NL2RepoRetrievalPipeline
from app.agent_core.brains.router_agent import RouterAgent
from app.agent_core.memory.vector_store import BM25ReadmeStore, ReadmeDocument
from app.schemas.retrieval import (
    ReadmeCorpusItem,
    RepoSearchRequest,
    RepoSearchResponse,
)


class RetrievalService:
    """Application service for phase-one repository retrieval."""

    def __init__(
        self,
        github_client=None,
        readme_store: BM25ReadmeStore | None = None,
        router: RouterAgent | None = None,
        llm_reranker=None,
    ):
        if github_client is None:
            from app.agent_core.brains.github_retriever import GitHubRepositorySearchClient

            github_client = GitHubRepositorySearchClient()
        self.github_client = github_client
        self.readme_store = readme_store or BM25ReadmeStore()
        self.router = router or self._build_router()
        self.llm_reranker = llm_reranker or self._build_llm_reranker()

    async def search(self, request: RepoSearchRequest) -> RepoSearchResponse:
        # Request-scoped README records let tests, demos, and future crawlers
        # inject fresh corpus data without mutating the process-wide BM25 store.
        store = self._store_for_request(request.readme_corpus or [])
        pipeline = NL2RepoRetrievalPipeline(
            router=self.router,
            github_client=self.github_client,
            readme_store=store,
            llm_reranker=self.llm_reranker,
        )
        result = await pipeline.retrieve(
            request.natural_language_query,
            top_n=request.top_n,
        )
        return RepoSearchResponse.model_validate(result.model_dump())

    def upsert_readmes(self, items: list[ReadmeCorpusItem]) -> int:
        # This endpoint is intentionally simple for the first phase. A later
        # crawler can swap the backing store for ES/Meili/pgvector without
        # changing Router Agent or Context/RAG Agent call sites.
        documents = [self._document_from_item(item) for item in items]
        self.readme_store.upsert_many(documents)
        return len(documents)

    def _store_for_request(self, items: list[ReadmeCorpusItem]) -> BM25ReadmeStore:
        if not items:
            return self.readme_store

        scoped_store = BM25ReadmeStore()
        scoped_store.upsert_many(self.readme_store.all_documents())
        scoped_store.upsert_many(self._document_from_item(item) for item in items)
        return scoped_store

    @staticmethod
    def _document_from_item(item: ReadmeCorpusItem) -> ReadmeDocument:
        return ReadmeDocument(
            repo_id=item.repo_id,
            full_name=item.full_name,
            description=item.description,
            readme_content=item.readme_content,
            metadata=item.metadata,
        )

    @staticmethod
    def _build_router() -> RouterAgent:
        try:
            from app.agent_core.brains.llm_clients import OpenAICompatibleIntentClient
            from app.config import settings

            # Use the configured low-latency model only when credentials are
            # present. Otherwise RouterAgent falls back to deterministic rules.
            api_base = settings.MODEL_API or settings.BASE_URL
            api_key = settings.MODEL_KEY or settings.API_KEY
            if api_base and api_key and settings.MODEL_NAME:
                return RouterAgent(
                    model_client=OpenAICompatibleIntentClient(
                        api_base=api_base,
                        api_key=api_key,
                        model=settings.MODEL_NAME,
                    ),
                    # LLM 不可用（403/超时/网络）时走启发式 intent,
                    # 不要因为意图模型挂掉就把整条检索链路 500 掉。
                    fallback_on_model_error=True,
                )
        except Exception:
            pass
        return RouterAgent()

    @staticmethod
    def _build_llm_reranker():
        try:
            from app.agent_core.brains.llm_clients import OpenAICompatibleRepoReranker
            from app.config import settings

            # LLM reranking is optional. The coarse deployability scorer remains
            # the source of truth when model access is unavailable or times out.
            api_base = settings.MODEL_API or settings.BASE_URL
            api_key = settings.MODEL_KEY or settings.API_KEY
            if api_base and api_key and settings.MODEL_NAME:
                return OpenAICompatibleRepoReranker(
                    api_base=api_base,
                    api_key=api_key,
                    model=settings.MODEL_NAME,
                )
        except Exception:
            pass
        return None


_retrieval_service: RetrievalService | None = None


def get_retrieval_service() -> RetrievalService:
    global _retrieval_service
    if _retrieval_service is None:
        _retrieval_service = RetrievalService()
    return _retrieval_service
