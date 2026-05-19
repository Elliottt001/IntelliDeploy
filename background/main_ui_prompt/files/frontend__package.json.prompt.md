# Prompt: frontend/package.json

## Responsibility

Declare frontend runtime dependencies required by the Expo Android mobile implementation.

## Change

- Add `expo-navigation-bar` at the SDK-compatible version so the root layout can suppress Android navigation chrome and keep screenshots aligned with the approved mobile video.

## Acceptance

- `cd frontend && npx tsc --noEmit` passes.
- Expo Android can bundle with the declared dependency present in `package-lock.json`.
