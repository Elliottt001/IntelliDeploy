# Prompt: frontend/app/_layout.tsx

## Responsibility

Configure the Expo Router stack for app-level navigation chrome and route transition motion.

## Inputs

- Expo Router `Stack`
- React Native `Platform`
- Registered app routes: `index`, `login`, `register`, `app-gallery`, `chatbot`
- Figma prototype transition intent from `background/main_ui_prompt/global/03_motion_and_interactions.md`

## Output

- Native mobile routes use a bottom-to-top slide transition that matches the PPT-like Figma route change direction.
- Web keeps the existing header behavior and avoids mobile-only animation assumptions.
- Existing route registrations and titles remain intact.

## Rules

- Do not add new routes here.
- Do not move mobile home UI implementation into this file.
- Keep transition settings declarative through `Stack` screen options.
- Preserve the existing route list and page titles unless a product route is explicitly confirmed.

## Verification

- `cd frontend && npx tsc --noEmit` passes.
- Native route pushes to `/chatbot` and `/app-gallery` use the configured slide-from-bottom animation.
- Web branch still compiles and keeps the existing web landing entry.
