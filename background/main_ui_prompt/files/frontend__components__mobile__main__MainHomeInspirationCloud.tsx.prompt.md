# Prompt: MainHomeInspirationCloud.tsx

## Responsibility

Render the light mode inspiration pool.

## Inputs

- `cloudVariant`
- `onShuffle`
- `onPressCloud`
- Motion values

## Output

- Section title `灵感池 · 当日有什么新鲜好玩的`
- `换一批🗘` entry
- Word cloud in a 303 x 111 rounded panel

## Rules

- Primary word is `AI Copilot` at 24px.
- Preserve Figma tag hierarchy and approximate positions.
- Pressing the cloud should run the Figma ON_PRESS mapping as a smooth local state animation using the default frame `266:21147` and pressed reference frame `188:16759`.
- The cloud state switch should crossfade and translate tags rather than instantly replacing text positions.
