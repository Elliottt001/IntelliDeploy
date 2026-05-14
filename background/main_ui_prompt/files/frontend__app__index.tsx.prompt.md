# Prompt: frontend/app/index.tsx

## Responsibility

Keep the route entry as a platform gate.

## Inputs

- `Platform.OS`
- Existing Web landing components
- New `MainHomeScreen`

## Output

- Web: existing `WebHome`
- Native mobile: `MainHomeScreen`

## Rules

- Do not rewrite Web landing sections.
- Do not keep mobile UI implementation details in this file.
- Do not introduce mobile styles here.
- Import mobile main screen from `../components/mobile/main/MainHomeScreen`.

## Verification

- Web branch still compiles.
- Native branch renders the mobile main screen.
