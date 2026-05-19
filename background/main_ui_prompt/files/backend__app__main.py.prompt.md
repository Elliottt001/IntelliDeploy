# Prompt: backend/app/main.py

## Responsibility

Create the FastAPI application and run startup initialization that must exist before requests are served.

## Inputs

- SQLAlchemy metadata and engine
- Built-in admin bootstrap service

## Output

- Database tables created on startup
- Built-in local verification account ensured before the app accepts requests

## Rules

- Keep auth bootstrap inside the existing lifespan hook.
- Do not change public route contracts.
- Keep startup work deterministic and idempotent.

## Verification

- `python -m compileall backend/app` passes.
