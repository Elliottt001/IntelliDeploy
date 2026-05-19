# Prompt: frontend/app.json

## Responsibility

Configure Expo app metadata that affects the Android mobile video-validation surface.

## Inputs

- Expo app config.
- Approved Android reference video, which shows no native Android time/5G status bar over the rounded artboard.

## Output

- Android Expo experience launches with hidden, translucent status chrome so route-level screens do not inherit a visible native status bar.

## Rules

- Keep this configuration mobile-only and do not change Web bundling behavior.
- Do not alter app identity, icons, scheme, or route configuration while correcting Android chrome.

## Verification

- `cd frontend && npx tsc --noEmit` passes.
- Android screenshots after route changes do not show the native status bar over the artboard.
