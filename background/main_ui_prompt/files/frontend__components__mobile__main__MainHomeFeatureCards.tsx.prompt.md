# Prompt: MainHomeFeatureCards.tsx

## Responsibility

Render and coordinate the four light mode feature cards.

## Inputs

- `expandedCard`
- `onToggleCard`
- `onOpenGallery`
- Motion values

## Output

- Section title `功能广场 · 立即探索你的新世界`
- App Gallery card
- 我的产品 card
- 广场 card
- 个人主页 card
- Default state renders as four full-height stacked cards, not four independent rows.

## Rules

- Default state uses a 195px card body with roughly 68-70px visible step between cards, matching Figma's stacked-card composition.
- Expanded target height is 195px.
- Expanded card positions follow the Figma state frames:
  - gallery expanded: y 328
  - products expanded: y 401
  - square expanded: y 465
  - profile expanded: y 544
- Collapsed card top positions follow the default Figma frame:
  - gallery: y 447
  - products: y 517
  - square: y 587
  - profile: y 657
- Only App Gallery may navigate to an existing route.
