# Prompt: backend/app/database.py

## Responsibility

Create the SQLAlchemy engine and session factory for the configured backend database.

## Inputs

- `settings.DATABASE_URL`

## Output

- A ready SQLAlchemy engine, session factory, and declarative base that work for both local SQLite development and PostgreSQL deployments

## Rules

- Support SQLite for local development convenience.
- Preserve PostgreSQL health settings when a PostgreSQL URL is used.
- Reject unsupported database schemes explicitly.

## Verification

- `python -m compileall backend/app` passes.
