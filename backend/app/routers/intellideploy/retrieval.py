from fastapi import APIRouter, Depends, HTTPException, status

from app.schemas.retrieval import (
    ReadmeUpsertRequest,
    ReadmeUpsertResponse,
    RepoSearchRequest,
    RepoSearchResponse,
)
from app.services.retrieval_service import RetrievalService, get_retrieval_service


router = APIRouter(prefix="/api/retrieval", tags=["retrieval"])


@router.post("/repos/search", response_model=RepoSearchResponse)
async def search_repositories(
    request: RepoSearchRequest,
    service: RetrievalService = Depends(get_retrieval_service),
):
    """Return the Top-N repositories for a raw user request.

    The response mirrors the phase-one interface document:
    raw intent, structured intent fields, Top repositories, each repository's
    file tree, and selected key file contents for downstream Builder Agents.
    """
    try:
        return await service.search(request)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Repository retrieval failed: {exc}",
        ) from exc


@router.post("/readmes", response_model=ReadmeUpsertResponse)
async def upsert_readme_corpus(
    request: ReadmeUpsertRequest,
    service: RetrievalService = Depends(get_retrieval_service),
):
    """Load crawled README records into the BM25 side of hybrid retrieval."""
    accepted = service.upsert_readmes(request.documents)
    return ReadmeUpsertResponse(accepted=accepted)
