# Prompt: MainHomeFeatureCard.tsx

## Responsibility

Render one feature card and its expanded detail.

## Inputs

- Card id
- Title and subtitle
- Collapsed y position
- Expanded state
- Press handlers
- Theme tokens

## Output

- Card shell with Figma-like rounded glass surface
- Title, subtitle and action arrow
- Optional detail content per card
- Full-height stacked card body with only the top band exposed when another card sits above it

## Rules

- Keep card-specific detail content declarative.
- Use `Animated` top position, detail opacity, scale and local press feedback, not layout jumps.
- Do not collapse the physical card body to a 70px strip; use stacking and z-order to create the exposed-card effect.
- The `我的产品` expanded detail must contain filled visual content, not empty placeholder blocks.
- Press feedback should use the spring mapping from Figma settings arrows where possible.
