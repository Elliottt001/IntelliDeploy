# Prompt: backend/app/services/bootstrap_admin.py

## Responsibility

Ensure the local built-in admin account exists for manual verification.

## Inputs

- Built-in admin settings
- SQLAlchemy session factory
- User model and password hashing utility

## Output

- A deterministic local login account that can be used after backend startup

## Rules

- Be idempotent across repeated startups.
- Respect the enable/disable setting.
- Re-activate and refresh the requested built-in account credentials so the documented login remains usable.
- Keep password storage hashed; never store plaintext in the database.

## Verification

- `python -m compileall backend/app` passes.
