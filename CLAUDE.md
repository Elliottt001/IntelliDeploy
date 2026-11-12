# CLAUDE.md

This file provides repository guidance for coding agents.

## Current Scope

IntelliDeploy is a Phase 1 AI application generation and hosting platform. The active product path is the persisted PostgreSQL application/job pipeline with a separate API and Worker, shared OpenAPI client, Next.js Web client, and Expo client.

Local implementation evidence is not real delivery evidence. DeepSeek, trusted runners, registries, Linux/Sealos targets, payment merchants, native devices, and production platform exercises may be unavailable; preserve those checks as `NOT_RUN` and keep `release_ready=false` unless controlled evidence exists.

## Repository Layout

- `backend/`: FastAPI API, Worker, SQLAlchemy models, Alembic migrations.
- `web/`: Next.js Web application and authenticated server proxy.
- `frontend/`: Expo/React Native application.
- `packages/api-client/`: generated OpenAPI types and shared requests.
- `tests/phase1/`: authoritative Phase 1 tests and acceptance cases.
- `scripts/`: OpenAPI, evaluation, legacy audit/migration, and operations helpers.
- `infra/`: local development and controlled platform configuration.

The older `fallback/`, `contracts/`, `prompts/`, `prompting/`, legacy routers, and historical tests remain useful implementation history or reused internals. They are not mounted as alternate product APIs and must not be presented as the current delivery path.

## Runtime

Use Python 3.13, Node.js 24, npm, and Docker/Compose. Run commands from the repository root.

```bash
uv venv --python 3.13 .venv
uv pip install --python .venv/bin/python -r backend/requirements.txt -r backend/requirements-dev.txt
npm ci
docker compose -p intellideploy-dev -f infra/compose.dev.yml up -d --wait postgres
DATABASE_URL=postgresql+psycopg://intellideploy:dev-only@127.0.0.1:55432/intellideploy_test \
  PYTHONPATH=backend .venv/bin/python -m alembic -c backend/alembic.ini upgrade head
```

Start the API, Worker, Web, and Expo client separately:

```bash
npm run dev:api
npm run dev:worker
npm run dev:web
npm run dev:mobile
```

The API never calls `create_all`. Startup requires PostgreSQL to be at the single Alembic head and fails if the schema is behind. Do not point local commands at an unidentified database; an unidentified environment is treated as production.

## Active Backend

`backend/app/main.py` mounts only these product routers:

- `auth`: registration and bearer authentication.
- `apps`: persisted applications, conversations, versions, and creation.
- `jobs`: job state, events, answers, cancellation, and resume.
- `billing` and `catalog`: quota, usage, SKUs, orders, subscriptions, and provider callbacks.
- `capabilities`: authenticated AI/search/fetch application capabilities.
- `runtime`: deployment targets, instance lifecycle, and application access.
- `community`: publishing, discovery, favorites, recent use, and copies.
- `evaluation`: developer-only evaluation runs and sanitized diagnostics.
- `health`: live/ready health endpoints.

The API and Worker share PostgreSQL state. Long-running generation, validation, release, and maintenance execute in `app.jobs.worker`, not in HTTP handlers. `QUEUED` means persisted work only; success requires a terminal job, validation evidence, deployment state, and a real URL.

Public API changes must update the generated client:

```bash
npm run api:generate
git diff --exit-code -- packages/api-client/openapi.json packages/api-client/src/generated.ts
```

## Security And Data Rules

- Preserve bearer authentication, ownership checks, developer-only evaluation access, and server-derived diagnostics.
- Never log password hashes, kubeconfig, tokens, merchant secrets, private prompts, or protected evidence.
- Financial writes must keep server-side price/units, ownership, provider signature validation, idempotency, ordering, and append-only audit evidence.
- Do not weaken payment or quota constraints to make fixtures pass.
- Do not run deployment, cleanup, payment, migration, or production operations without a confirmed controlled target and the required human approval.

Legacy SQLite handling is explicit and read-only by default:

```bash
PYTHONPATH=backend .venv/bin/python scripts/audit_legacy_state.py backend/intellideploy.db
```

`scripts/migrate_legacy_users.py` first creates a mode-`0600` SQLite backup snapshot, refuses nonempty legacy business tables, preserves compatible identity/password data, and never migrates kubeconfig or grants developer access. Only run it after old writes are stopped and the target database is explicitly confirmed.

## Verification

Use the dedicated local PostgreSQL test database.

```bash
PYTHONPATH=backend .venv/bin/python -m pytest tests/phase1 -q
npm --workspace @intellideploy/api-client test
npm --workspace web test
npm --workspace web run typecheck
npm --workspace web run build
npm --workspace web run test:e2e
npm --workspace frontend test
npm --workspace frontend run typecheck
npm --workspace frontend exec -- expo export --platform all --output-dir dist
npm --workspace frontend run test:e2e
```

Acceptance suites are `smoke`, `quality`, `flow`, and `faults`. They reuse the real API/Worker path. Keep automatic, forced, fixture, and `NOT_RUN` evidence separate; a case file may declare release requirements but cannot self-assert release check results.

Follow `docs/superpowers/plans/2026-11-10-phase1-execution-order.md`, `docs/一期实施进度.md`, and the relevant task plan. Do not claim Phase 1 complete until all required real model, route, cloud, payment, native, platform, and human review evidence passes.
