# Forbidden Changes

Do not change:

- `backend/**`
- database schemas
- authentication flows
- login/register business logic
- Web landing page visuals under `frontend/components/web/**`
- global dependency versions unless a design fidelity blocker is documented
- Expo Router route names beyond existing main route integration

Do not:

- Collapse all mobile UI into `frontend/app/index.tsx`.
- Add a new design system.
- Add placeholder screens for unconfirmed target pages.
- Replace Figma-driven spacing/colors with arbitrary values.
- Use web-only CSS APIs in native-only components.
- Treat Web preview as final mobile validation.

Allowed scope:

- `background/main_ui_prompt/**`
- `frontend/app/index.tsx`
- `frontend/components/mobile/main/**`
- `frontend/assets/**` only for main UI assets when needed
