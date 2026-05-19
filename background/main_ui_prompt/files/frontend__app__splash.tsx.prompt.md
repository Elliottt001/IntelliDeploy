# Prompt: frontend/app/splash.tsx

## Responsibility

Render the first mobile scene from the approved video before login.

## Output

- Light rounded artboard background.
- Centered Mibo emergence with soft ripple/wave motion.
- Automatic handoff into `/login`.

## Rules

- Keep the scene minimal; do not surface login controls here.
- Match the video timing and visual calm rather than inventing extra branding.
- Use native `Animated` and existing local assets.
- On native devices, proportionally scale the 375 x 812 artboard to the viewport so the splash occupies the same visual frame size as the approved video and the following login page.

## Verification

- Native launch first shows the splash scene before `/login`.
- The transition feels continuous with the following login page.
