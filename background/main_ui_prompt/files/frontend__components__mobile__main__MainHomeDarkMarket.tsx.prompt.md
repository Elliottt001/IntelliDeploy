# Prompt: MainHomeDarkMarket.tsx

## Responsibility

Render the dark AppMarket long page.

## Figma Source

```text
95:1783 深色：应用商店参考2
```

## Inputs

- Active nav state
- `onSwitchTheme`
- Tokens and assets

## Output

- Dark mobile AppMarket page
- Header with AppMarket, search and bell
- Hero banner
- Stats cards
- Hot categories
- Hot ranking
- Editor pick
- Latest recommendations
- Dark bottom nav

## Rules

- Use a vertical `ScrollView`.
- Preserve 375px design proportions while allowing real devices to scale to width.
- Do not route category/ranking/download buttons to nonexistent pages.
- Keep content as static UI data until backend contracts are provided.
