# Prompt: MainHomeHero.tsx

## Responsibility

Render avatar, greeting and Mibo chat entry.

## Inputs

- Mibo/cat asset
- Greeting data from `GET /api/home/feed`
- `onOpenMibo`
- Intro and pulse animation values

## Output

- Avatar at Figma position x 36, y 107
- `Hi！{nickname}✨` with local fallback to Oasis
- Bubble text from API with local fallback
- `<<< 点击此处与Mibo^^ AI对话`

## Rules

- Greeting and subtitle should keep the Figma center-aligned text block at x 118, y 107, w 148.
- Pressing the sparkle/greeting or Mibo entry must call `/chatbot` through parent.
- Avatar press can trigger visual emphasis but must not navigate to an unimplemented page.
