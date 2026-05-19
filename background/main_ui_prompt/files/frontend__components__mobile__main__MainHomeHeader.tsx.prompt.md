# Prompt: MainHomeHeader.tsx

## Responsibility

Render the mobile top header.

## Inputs

- Current settings menu intent
- Settings press handler
- Intro animation style

## Output

- IntelliDeploy brand mark
- Powered by Sealos | GitHub subtitle
- One settings button

## Rules

- Match Figma header position: x 14, y 47, w 347, h 38.
- Reuse the approved brand artwork rather than substituting a simplified custom mark.
- Keep `Powered by Sealos | GitHub` visually centered under the IntelliDeploy word mark.
- Keep `INTELLIDEPLOY` on a single line at Android device scale; shrink-to-fit is preferred over wrapping.
- The right button follows the approved video reference and acts as settings chrome, not as a dark-mode switch.
- Do not render duplicate settings controls in the top header.
- Do not add settings page navigation.
