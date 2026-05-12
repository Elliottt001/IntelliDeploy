# Prompt: mainHomeTokens.ts

## Responsibility

Store design tokens for the mobile main UI.

## Inputs

- Figma design context
- Local React Native constraints

## Output

- Light tokens
- Dark tokens
- Spacing, radius, typography and shadow constants
- Frame dimensions
- Stacked feature-card metrics and card surface colors

## Rules

- Token names must be semantic.
- Figma exact values should be preserved where practical.
- Do not introduce a global app-wide design system.
- Card metrics should distinguish the full card body height from the visible stacked step.
