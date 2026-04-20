# Intent Retrieval And Ranking Design

## Background

The backend currently supports:

- FastAPI routing under `backend/app/routers/intellideploy/`
- simple GitHub API access in `backend/app/services/intellideploy_github.py`
- a lightweight single-provider AI analyzer in `backend/app/services/intellideploy_ai.py`

The new stage-one capability is different in shape from the existing repository-analysis flow. It starts from a user-written software intent, searches public GitHub repositories, performs dual-track retrieval and ranking, and returns the top matching open-source projects with supporting repository evidence.

This design introduces a dedicated retrieval-and-ranking pipeline instead of extending the current deployment-analysis service directly.

## Goals

- Accept a raw software-development intent and return structured intent output plus Top 3 matching GitHub repositories.
- Implement stage-one structured intent extraction with strict JSON output and rule-based fallback.
- Implement dual-track retrieval:
  - GitHub Search API recall using a system-level token rotation pool
  - local BM25 lexical recall on recalled candidate metadata
- Implement coarse ranking with configurable feature weights.
- Implement LLM fine reranking for Top K coarse candidates.
- Add a reusable unified LLM client supporting OpenAI and Claude with timeout, retry, rate-limit handling, and graceful degradation.
- Expose the capability through a new FastAPI API endpoint and a reusable service entrypoint.

## Non-Goals

- Persisting retrieval results or ranking explanations into the database in phase one.
- Building a background job system for repository enrichment.
- Adding a dedicated vector database.
- Replacing the existing authenticated GitHub repository-management flow used by current product features.

## Success Criteria

- A caller can submit `raw_query` and receive:
  - structured intent JSON
  - Top 3 candidate repositories with scores and repository metadata
  - file tree summaries
  - selected key-file contents or summaries aligned with `.idea/接口.md`
- If the LLM provider is unavailable, the endpoint still returns usable results based on heuristic intent extraction and coarse ranking.
- If embedding support is unavailable, the pipeline still works with BM25 plus metadata features.
- GitHub search traffic uses a system token pool rather than end-user OAuth tokens.

## API Contract

## Endpoint

- `POST /api/intention-match/search`

## Request Body

```json
{
  "raw_query": "我想找一个用 FastAPI 和 React 做的开源问答社区，支持登录、提问、标签和管理后台"
}
```

## Response Shape

The response should align with `.idea/接口.md`:

- `raw_query`
- `structured_intent`
  - `target_output_type`
  - `target_app_type`
  - `expected_features`
  - `preferred_language`
  - `preferred_framework`
  - `constraints`
- `candidates`
  - `rank`
  - `retrieval_score`
  - `repo_url`
  - `default_branch`
  - `description`
  - `topics`
  - `stars`
  - `is_archived`
  - `last_commit_at`
  - `file_tree`
  - `key_files`
- `meta`
  - `degraded`
  - `warnings`
  - `trace`

`meta.degraded` is `true` when any major fallback path was used, such as heuristic intent extraction or skipped LLM reranking.

## High-Level Architecture

The feature should be implemented as a dedicated pipeline:

1. `intent_service` converts `raw_query` into structured intent JSON.
2. `github_search_service` issues GitHub Search API requests through a rotating token pool.
3. `retrieval_service` merges GitHub recall results, builds a temporary BM25 index, and computes coarse scores.
4. `rerank_service` sends Top K candidates into the LLM fine reranker.
5. `pipeline_service` enriches the final Top 3 with file trees and key-file content before returning the response.

The route layer stays thin and delegates the full business flow to one service entrypoint.

## Proposed Backend Module Layout

Suggested new files under `backend/app/`:

- `routers/intellideploy/intent_match.py`
  - FastAPI endpoint for the new search capability
- `schemas/intent_match.py`
  - request and response models
- `services/llm_client.py`
  - unified provider abstraction for OpenAI and Claude
- `services/intent_service.py`
  - structured intent extraction and heuristic fallback
- `services/github_search_service.py`
  - token rotation pool and GitHub public-search helpers
- `services/retrieval_service.py`
  - query generation, candidate dedupe, BM25 indexing, coarse ranking
- `services/rerank_service.py`
  - LLM fine reranking and rationale parsing
- `services/intent_match_pipeline.py`
  - pipeline orchestration entrypoint for routes and future internal callers

Existing files to update:

- `backend/app/config.py`
  - add GitHub token-pool and LLM provider settings
- `backend/app/main.py`
  - register the new router
- `backend/app/routers/intellideploy/__init__.py`
  - export the new router
- `backend/requirements.txt`
  - add HTTP and ranking dependencies if needed

## Retrieval And Ranking Flow

## Step 1: Structured Intent Extraction

Input:

- `raw_query`

Primary path:

- call the unified LLM client with a strict JSON-only prompt
- parse into:
  - `target_output_type`
  - `target_app_type`
  - `expected_features`
  - `preferred_language`
  - `preferred_framework`
  - `constraints`

Fallback path:

- use heuristic extraction from keywords and simple pattern rules
- preserve `expected_features`
- infer `preferred_language` and `preferred_framework` when obvious
- default uncertain fields to `"unknown"` or empty collections

Implementation notes:

- reuse the JSON repair approach already present in `fallback/services/json_repair.py`
- keep the intent schema strict and versioned through a Pydantic response model
- include `intent_extraction_mode` in pipeline metadata for observability

## Step 2: GitHub Search Recall

GitHub recall uses a system-level token pool configured through environment variables rather than per-user OAuth credentials.

Suggested new config values:

- `GITHUB_TOKENS`
  - comma-separated token list used for public search rotation
- `GITHUB_SEARCH_PER_QUERY`
  - default item count per search query
- `GITHUB_SEARCH_TIMEOUT_SECONDS`
  - request timeout

Search strategy:

- build 2 to 3 GitHub search queries from the structured intent
- each query combines:
  - app type terms
  - expected feature terms
  - language or framework hints when present
- issue search requests in sequence or bounded parallelism
- merge results by `full_name`

Token-pool behavior:

- maintain an in-process round-robin token selector
- track per-token cooldown when the GitHub API returns primary or secondary rate-limit responses
- skip temporarily blocked tokens until cooldown expires
- if all tokens are cooling down, return a controlled service error or a degraded empty-result response depending on caller policy

This pool is scoped to public-search endpoints only and must not replace the existing logged-in repository access flow.

## Step 3: Candidate Material Collection

For the merged recall set, collect lightweight material before coarse ranking:

- repository name
- description
- topics
- language
- stars
- archived flag
- pushed-at timestamp
- README summary or truncated README content

Candidate enrichment should remain lightweight before fine reranking. Full file-tree and key-file extraction are only required for the final Top 3 candidates.

## Step 4: BM25 Lexical Recall

Build an in-memory BM25 index over each candidate document:

- `repo_name`
- `description`
- `topics`
- README summary

Query tokens should include:

- raw-query tokens
- structured feature tokens
- preferred language and framework tokens

Why BM25 is included:

- GitHub native ranking over-weights popularity
- BM25 helps recover candidates whose wording closely matches the user's requested features
- it is cheap to run over the recalled candidate set and does not require external infrastructure

## Step 5: Coarse Ranking

The coarse-rank engine computes a single numeric score from normalized features.

Recommended initial formula:

```text
coarse_score =
  0.30 * bm25_score +
  0.20 * github_rank_score +
  0.15 * feature_match_score +
  0.10 * language_framework_score +
  0.10 * topic_overlap_score +
  0.10 * activity_score +
  0.10 * popularity_score -
  0.30 * archived_penalty
```

Feature definitions:

- `bm25_score`
  - normalized BM25 score over the temporary local index
- `github_rank_score`
  - normalized inverse rank from GitHub Search results
- `feature_match_score`
  - overlap of expected features with repo description, topics, and README summary
- `language_framework_score`
  - direct hit on preferred language or framework
- `topic_overlap_score`
  - topic intersection ratio
- `activity_score`
  - normalized recency based on last push or last commit timestamp
- `popularity_score`
  - log-normalized stars
- `archived_penalty`
  - `1.0` when archived, otherwise `0.0`

Optional semantic feature:

- if embeddings are configured, compute an intent-to-candidate similarity score over README summaries and blend it into the coarse score
- if embeddings are unavailable, skip without failing the request

Top K after coarse rank:

- send only the best `K` candidates to the LLM reranker
- initial recommendation: `K = 8`

## Step 6: LLM Fine Reranking

The fine reranker receives:

- normalized structured intent
- Top K candidate summaries
- lightweight repository evidence

Candidate evidence for the reranker should include:

- full repository name
- description
- topics
- stars
- archived flag
- recent activity timestamp
- README summary
- detected dependency files or framework hints when cheap to fetch

The reranker prompt must request strict JSON output:

- `final_rank`
- `relevance_score`
- `match_reasons`
- `risk_flags`
- `confidence`

If the reranker call fails, times out, or is rate-limited:

- keep the coarse-ranked order
- set `meta.degraded = true`
- append a warning such as `llm_rerank_skipped`

## Step 7: Final Enrichment For Top 3

Only after final ranking is decided, fetch heavier repository materials for the final Top 3:

- repository file tree
- README
- dependency files
  - `package.json`
  - `requirements.txt`
  - `pyproject.toml`
  - `pom.xml`
  - `go.mod`
- lock files
  - `package-lock.json`
  - `pnpm-lock.yaml`
  - `yarn.lock`
  - `poetry.lock`
  - `uv.lock`
- build files
  - `Dockerfile`
  - `docker-compose.yml`
  - `Makefile`
- entry files
  - `main.py`
  - `app.py`
  - `server.js`
  - `index.js`
  - `src/main.ts`
- config files
  - `vite.config.ts`
  - `next.config.js`
  - `Procfile`

Large file contents should be truncated to safe limits before returning or before passing into the reranker.

## Unified LLM Client Design

The new LLM client should be reusable across intent extraction and fine reranking.

## Supported Providers

- OpenAI-compatible chat models
- Anthropic Claude

## Responsibilities

- provider routing based on model name or explicit provider
- request timeout handling
- retry with exponential backoff for transient failures
- rate-limit detection
- graceful downgrade to heuristic or non-LLM paths
- JSON response extraction and repair

## Suggested Interface

```python
class UnifiedLLMClient:
    def generate_json(
        self,
        *,
        task: str,
        model: str,
        system_prompt: str,
        user_prompt: str,
        timeout_seconds: float | None = None,
    ) -> dict[str, Any]:
        ...

    def embed(
        self,
        *,
        texts: list[str],
        model: str,
        timeout_seconds: float | None = None,
    ) -> list[list[float]]:
        ...
```

Suggested configuration:

- `LLM_PROVIDER`
- `OPENAI_BASE_URL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_EMBEDDING_MODEL`
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_MODEL`
- `LLM_TIMEOUT_SECONDS`
- `LLM_MAX_RETRIES`

Design notes:

- extract provider-specific request logic behind internal adapters
- keep JSON repair shared with the fallback package logic when practical
- return structured error types so pipeline stages can degrade intentionally instead of catching bare exceptions

## Error Handling And Degradation Policy

Phase one should favor returning usable ranked results over hard failure.

## Degrade Cases

- intent extraction LLM failure
  - fallback to heuristic intent extraction
- GitHub token rate limit on one token
  - rotate to next healthy token
- all GitHub tokens temporarily unavailable
  - return a controlled upstream-unavailable error
- embedding failure
  - skip semantic feature and continue with BM25 plus metadata
- reranker failure
  - return coarse Top 3 as final output

## Response Warnings

The response metadata should include warnings such as:

- `intent_heuristic_fallback`
- `embedding_skipped`
- `llm_rerank_skipped`
- `github_partial_results`

## Observability

Even in phase one, the pipeline should emit structured logs for:

- request id
- intent extraction mode
- number of GitHub queries issued
- token-rotation events
- candidate counts before and after dedupe
- coarse-rank Top K
- rerank status
- degraded flags
- end-to-end latency

This is important because ranking quality issues are difficult to debug without seeing stage-level evidence.

## Dependency Recommendations

Likely additions to `backend/requirements.txt`:

- `httpx`
  - cleaner timeout and retry integration than raw `urllib`
- `rank-bm25`
  - lightweight BM25 implementation

These dependencies keep phase one simple without introducing infrastructure-heavy components.

## Testing Strategy

Testing should cover three levels.

## Unit Tests

- strict JSON parsing and repair for intent extraction and rerank outputs
- heuristic intent extraction fallback
- GitHub token-pool round-robin and cooldown logic
- coarse-rank score calculation and feature normalization
- rerank downgrade behavior

## Service Integration Tests

With mocked GitHub and mocked LLM providers:

- structured intent plus retrieval pipeline happy path
- LLM extraction failure fallback path
- GitHub partial failure with remaining healthy tokens
- reranker timeout path returning coarse-ranked results

## API Tests

- request validation for `raw_query`
- response shape alignment with `.idea/接口.md`
- degraded response metadata
- upstream failure mapping

## Phase-One Delivery Order

Recommended implementation order:

1. Add schemas and route contract.
2. Implement unified LLM client with JSON generation support.
3. Implement intent extraction with heuristic fallback.
4. Implement GitHub token pool and search service.
5. Implement BM25-based retrieval and coarse ranking.
6. Implement LLM fine reranking.
7. Implement final Top 3 enrichment.
8. Add tests across unit, service, and API levels.

## Design Decision Summary

- Add a new dedicated retrieval-and-ranking module instead of growing the current deployment-analysis service.
- Use system-level GitHub tokens for public search.
- Use dual-track retrieval: GitHub recall plus local BM25.
- Keep embeddings optional in phase one.
- Use LLM reranking only on Top K coarse candidates.
- Keep the route thin and expose a single reusable pipeline service entrypoint.
- Keep results real-time and in-memory in phase one rather than persisting retrieval output.
