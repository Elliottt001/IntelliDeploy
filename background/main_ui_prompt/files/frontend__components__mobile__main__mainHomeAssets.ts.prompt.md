# Prompt: mainHomeAssets.ts

## Responsibility

Centralize main UI asset references.

## Inputs

- Existing local assets under `frontend/assets/images`
- Figma MCP asset URLs when no local equivalent exists

## Output

- Semantic asset constants for cat/avatar, feature images and icons

## Rules

- Prefer existing local assets when they match the design.
- Avoid scattered raw URLs in components.
- Keep names semantic, not Figma-generated.
