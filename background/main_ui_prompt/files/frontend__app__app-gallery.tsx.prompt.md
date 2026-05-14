# Prompt: frontend/app/app-gallery.tsx

## Responsibility

Render the mobile App Gallery detail carousel route.

## Inputs

- Expo Router route `/app-gallery`
- Figma App Gallery mobile frames and card screenshots
- Remote image assets provided by Figma MCP

## Output

- Full-screen mobile artboard without the native blue stack header.
- Header logo, search, filter pills, stacked detail card, carousel dots and bottom actions aligned to Figma.
- App detail cards retain swipe/tap carousel behavior.

## Rules

- Hide route chrome locally with `Stack.Screen`, not by changing the global stack for all routes.
- Hide Android status bar and keep the artboard visually anchored like the Figma mobile frame.
- Keep the screen native React Native; do not add web-only CSS dependencies.
- Preserve existing carousel interactions.
- Use Figma-like logo mark instead of placeholder glyphs.

## Verification

- `cd frontend && npx tsc --noEmit` passes.
- Android preview shows no blue native title bar above the Figma artboard.
