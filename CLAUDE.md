# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

IntelliDeploy is an AI-assisted deployment platform that takes a natural-language requirement, retrieves a candidate GitHub repository, generates build/deploy artifacts (Dockerfile, k8s YAML), builds an image, deploys to Sealos, and self-heals on failure.

Two top-level apps:
- `backend/` — FastAPI service (Python 3.13)
- `frontend/` — Expo + React Native app (Node 24 / npm 11) with `expo-router`, TypeScript, NativeWind/Tailwind

Auxiliary directories:
- `fallback/` — in-process "fallback" generation pipeline used when no external generation service is configured (see `FALLBACK_SERVICE_URL=inprocess`). Contains classifiers, prompt templates, solvers, validators, and workspace artifacts.
- `contracts/` — Pydantic/JSON schema contracts shared between backend, fallback, and tests. `scripts/check_contract_schema_consistency.py` verifies them.
- `prompts/`, `prompting/` — LLM prompt assets.
- `tests/` — top-level pytest tests (unit/integration). `backend/test_api.py` is a separate API smoke test.

## Common Commands

### Backend (run from `backend/`, virtualenv activated)
```bash
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 9000
```
Health check: `GET http://127.0.0.1:9000/` should return `{"message":"IntelliDeploy API is running"}`. Tables auto-create on startup via `Base.metadata.create_all` in `app/main.py`.

### Frontend (run from `frontend/`)
```bash
npm install
npm run web        # browser at http://127.0.0.1:8081
npm start          # Expo dev server (then a/i for android/ios)
```
API base is hard-coded in `frontend/services/api.ts` (`http://localhost:9000`). For real-device debugging, change to the LAN IP — do **not** use `localhost`.

### Tests
Tests live in the repo-root `tests/` directory and import from `backend/` and `fallback/` via `tests/conftest.py` (which inserts the repo root onto `sys.path`). Run from the **repo root**, not from `backend/`:
```bash
python -m pytest tests/unit -q                              # all unit tests
python -m pytest tests/unit/test_nl2repo_retrieval.py -q    # single file
python -m pytest tests/unit/test_parser.py::TestName -q     # single test
```

### Other
- `python scripts/check_contract_schema_consistency.py` — verify contract schemas.
- `python verify_system.py` / `python main.py` — top-level smoke entrypoints.

## Configuration

All backend config goes through `backend/app/config.py` (`pydantic-settings`) loading `backend/.env`. Key groups:

- **DB / Auth**: `DATABASE_URL` (PostgreSQL via `postgresql+psycopg://`), `SECRET_KEY`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `ALGORITHM`.
- **LLM**: `MODEL_API`/`BASE_URL`, `MODEL_KEY`/`API_KEY`, `MODEL_NAME`. When unset, the retrieval pipeline transparently falls back to local heuristics (no LLM intent structuring, algorithmic rerank only).
- **GitHub**: `GITHUB_TOKEN`, or `GITHUB_SEARCH_TOKENS` (comma-separated for simple round-robin), `GITHUB_SEARCH_TIMEOUT_SECONDS`.
- **Fallback generation**: `FALLBACK_SERVICE_URL` — `"inprocess"` invokes the `fallback/` package directly instead of calling out over HTTP.
- **Build backend**: `KANIKO_KUBECONFIG` selects Kaniko-in-cluster builds; otherwise the image builder falls back to local Docker API. `KANIKO_DESTINATION_REGISTRY` (default `sealos.hub:5000`) is prefixed onto image names so pushes don't accidentally hit Docker Hub.
- **Sealos / deploy**: `SEALOS_API_URL`, `SEALOS_API_TOKEN`, `SEALOS_DOMAIN_SUFFIX`, timeouts and poll intervals.
- **Self-healing**: `MAX_HEALING_RETRIES`, `PARALLEL_HEALING_COUNT`, `HEALING_TIMEOUT`.
- **Redis**: disabled by default (`REDIS_ENABLED=False`) — code paths must tolerate Redis being absent in dev.

`bcrypt==4.0.1` is pinned in `requirements.txt`; do not upgrade without checking the auth flow.

## Backend Architecture

`backend/app/main.py` wires CORS + a custom `HTTPException` handler that reshapes `/api/*` errors to `{"error": ...}` while leaving non-API routes as `{"detail": ...}`. It mounts these routers:

- `auth` — JWT login/register.
- `websocket` — real-time deployment events (see `services/websocket_manager.py`).
- `intellideploy/*` — domain routers: `github`, `projects`, `user_settings`, `generation`, `deployments`, `images`, `rag`, `retrieval`.

### Layering
```
routers/  →  services/  →  agent_core/  +  models/  +  schemas/
```
- `routers/` — thin FastAPI handlers; do request validation and call into services.
- `services/` — orchestration and external integrations. The most important ones:
  - `deployment_orchestrator.py` — end-to-end flow: generate artifacts → build image → deploy to Sealos → health-check → invoke `healing_engine` on failure. Chooses build backend via `_preferred_build_method()` and prefixes image names for the Sealos in-cluster registry.
  - `image_builder.py` — `BuildMethod` enum (`KANIKO` / `DOCKER_API`). Kaniko path submits a k8s Job; Docker path uses the local daemon.
  - `healing_engine.py` — parallel try-fix loop driven by `PARALLEL_HEALING_COUNT` / `MAX_HEALING_RETRIES`.
  - `full_pipeline_runner.py`, `multi_agent_deployment_service.py`, `generation_task_service.py` — higher-level pipelines composing the above.
  - `inprocess_fallback_runner.py` / `fallback_client.py` — switch between in-process `fallback/` invocation and HTTP fallback service based on `FALLBACK_SERVICE_URL`.
  - `retrieval_service.py`, `rag_service.py` — assemble the NL→repo pipeline (see below).
  - `sealos_client.py`, `intellideploy_sealos.py`, `intellideploy_k8s.py`, `intellideploy_github.py` — external-system clients.
- `agent_core/` — LLM/agent logic, isolated from FastAPI:
  - `brains/router_agent.py` — `RouterAgent.structure_intent(query)` turns NL into a `RepoIntent`; LLM if configured, heuristics otherwise.
  - `brains/github_retriever.py` — GitHub Search API client; `enrich_repository` pulls file tree + README + key files.
  - `brains/context_rag_agent.py` — `NL2RepoRetrievalPipeline.retrieve(query, top_n)` runs the full dual-track retrieval: structure intent → GitHub search + BM25 README recall → dedupe → GitHub context enrichment → hard filter → deploy-feasibility prerank → optional LLM rerank → top N.
  - `memory/vector_store.py` — `BM25ReadmeStore` for in-memory BM25 README recall.
  - `brains/llm_clients.py` — OpenAI-compatible client wrappers used across agents.
- `models/intellideploy/*` — SQLAlchemy models (`project`, `deployment`, `deployment_event`, `generation_task`, `github_account`, `analysis`).
- `schemas/` — Pydantic request/response models, and `fallback.py` mirrors the `fallback/` service's response shape.

### Retrieval scoring (see `devREADME-lzh.md` for full detail)
Hard filters drop archived repos, repos with no commits in the past year, and repos whose file tree lacks a recognizable manifest (`package.json`, `requirements.txt`, `pyproject.toml`, `pom.xml`, `go.mod`, `Dockerfile`, `docker-compose.yml`). Prerank score weights BM25/GitHub relevance, `log(stars)`, recency, presence of Dockerfile/compose, tech-stack match against known templates, and a bonus when both GitHub and BM25 hit the same repo.

## Frontend Architecture

Expo Router file-based routing in `frontend/app/` (`index`, `login`, `register`, `chatbot`, `app-gallery`, with `_layout.tsx` as the root layout). Screen implementations live in `frontend/screens/<name>/`. Styling is Tailwind via NativeWind; SVGs are imported as components through `react-native-svg-transformer` (see `metro.config.js` and `svg.d.ts`). All HTTP goes through `frontend/services/api.ts`.

## Notes for Working in This Repo

- The `tests/` directory at the repo root is the authoritative test location; `tests/conftest.py` adjusts `sys.path` so `from app...` and `from fallback...` imports work only when pytest is run from the repo root.
- The retrieval and generation pipelines are explicitly designed to degrade when LLM / GitHub tokens / Redis are missing — preserve those fallbacks when modifying them.
- Image names must be prefixed with `KANIKO_DESTINATION_REGISTRY` when Kaniko is used, otherwise pushes silently target docker.io; reuse `_prefixed_image_name` in `services/deployment_orchestrator.py` rather than hand-formatting.
- The repo has Chinese comments and docs (`README.md`, `devREADME-lzh.md`) — keep that convention when editing existing files in those areas.
