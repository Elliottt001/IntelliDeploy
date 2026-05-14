# Prompt: MainHomeHeader.tsx

## Responsibility

Render the mobile top header.

## Inputs

- Current theme
- Theme toggle handler
- Intro animation style

## Output

- IntelliDeploy brand mark
- Powered by Sealos | GitHub subtitle
- One settings/theme toggle button

## Rules

- Match Figma header position: x 14, y 47, w 347, h 38.
- Keep `Powered by Sealos | GitHub` visually centered under the IntelliDeploy word mark.
- Keep `INTELLIDEPLOY` on a single line at Android device scale; shrink-to-fit is preferred over wrapping.
- The right button can act as the light/dark switch until a dedicated settings route exists.
- Do not render duplicate settings controls in the top header.
- Do not add settings page navigation.
