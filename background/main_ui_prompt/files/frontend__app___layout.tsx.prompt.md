# Prompt: frontend/app/_layout.tsx

## Responsibility

Configure the Expo Router stack for app-level navigation chrome and route transition motion.

## Inputs

- Expo Router `Stack`
- React Native `Platform`
- Registered app routes: `splash`, `index`, `login`, `register`, `app-gallery`, `my-products`, `square`, `chatbot`
- Figma prototype transition intent from `background/main_ui_prompt/global/03_motion_and_interactions.md`

## Output

- Native mobile routes use a bottom-to-top slide transition that matches the PPT-like Figma route change direction.
- Web keeps the existing header behavior and avoids mobile-only animation assumptions.
- Video-aligned routes are registered with titles and route transitions matching their role in the mobile flow.
- Native Android status/navigation chrome is suppressed from the root layout so Expo Go cannot reintroduce the time/5G bar or bottom gesture bar between deep links, dev-menu interactions, or route returns.

## Rules

- Add only routes that are explicitly present in the approved video reference flow.
- Do not move mobile home UI implementation into this file.
- Keep transition settings declarative through `Stack` screen options.
- Keep the Android chrome suppression mobile-only; do not change Web chrome.
- Use `expo-navigation-bar` only at the root layout layer to hide the Android navigation bar and keep route pages focused on video artboard rendering.
- Preserve page titles unless the approved video reference provides a clearer route title.

## Verification

- `cd frontend && npx tsc --noEmit` passes.
- Native route pushes to `/chatbot`, `/app-gallery`, `/my-products`, and `/square` use the configured motion where applicable.
- Android screenshots after route changes do not show the native time/5G status bar or bottom navigation/gesture bar over the video artboard.
- Web branch still compiles and keeps the existing web landing entry.
