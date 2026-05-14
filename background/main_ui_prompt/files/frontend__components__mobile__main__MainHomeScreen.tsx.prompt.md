# Prompt: MainHomeScreen.tsx

## Responsibility

Compose the mobile main UI and own page-level state.

## Inputs

- Expo Router `useRouter`
- System color scheme if available
- Child components from `frontend/components/mobile/main`
- Tokens, motion constants and assets

## Output

- Light homepage matching Figma `266:21147`
- Dark AppMarket page matching Figma `95:1783`
- Theme switch entry
- Mibo and App Gallery route entries

## State

- `theme`: light or dark
- `expandedCard`: gallery, products, square, profile or null
- `activeTab`: home, apps, square, profile
- `cloudVariant`: numeric batch index

## Rules

- Keep layout orchestration here, not low-level drawing.
- Use `Animated` for page intro and child transitions.
- Do not push routes that are not registered.
- Do not duplicate token values if `mainHomeTokens.ts` contains them.

## Verification

- Mobile branch renders without runtime errors.
- Switching light/dark does not lose navigation state.
- Mibo opens `/chatbot`.
- App Gallery opens `/app-gallery`.
