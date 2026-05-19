# Prompt: backend/app/config.py

## Responsibility

Expose backend runtime settings used by authentication bootstrap logic.

## Inputs

- Environment variables loaded by `pydantic-settings`
- Local development requirement for a built-in login account

## Output

- Local-dev-friendly database defaults plus configurable built-in admin seed settings with safe override points for non-local environments

## Rules

- Keep the seed account configurable rather than scattering credentials across backend modules.
- Keep the default local database runnable on a fresh Windows machine without requiring PostgreSQL installation.
- Default values must satisfy the local verification account requested by the user.
- Preserve all existing backend settings and environment-file behavior.

## Verification

- `python -m compileall backend/app` passes.
