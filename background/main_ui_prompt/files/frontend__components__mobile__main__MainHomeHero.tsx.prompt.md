# Prompt: MainHomeHero.tsx

## Responsibility

Render avatar, greeting and Mibo chat entry.

## Inputs

- Mibo/cat asset
- `onOpenMibo`
- Intro and pulse animation values

## Output

- Avatar at Figma position x 36, y 107
- `Hi！Oasis✨`
- `今天又有什么新想法？`
- `<<< 点击此处与Mibo^^ AI对话`

## Rules

- Greeting and subtitle should keep the Figma center-aligned text block at x 118, y 107, w 148.
- Pressing Mibo entry must call `/chatbot` through parent.
- Avatar press can trigger visual emphasis but must not navigate to an unimplemented page.
