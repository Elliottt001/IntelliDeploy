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
- Mibo, App Gallery, My Products and Square route entries that match the approved video flow

## State

- `expandedCard`: gallery, products, square, profile or null
- `activeTab`: home, apps, square, profile. In the approved video, App/Square shortcut interactions keep the visible bottom-nav pill on `首页`.
- `cloudVariant`: numeric batch index

## Rules

- Keep layout orchestration here, not low-level drawing.
- Use `Animated` for page intro and child transitions.
- Do not push routes that are not registered.
- Do not duplicate token values if `mainHomeTokens.ts` contains them.
- Before entering a real second-level route, clear `expandedCard` so returning home does not preserve a stale expanded card that the approved video does not show.
- Bottom nav `应用` mirrors the video App Gallery sequence: first tap expands the App Gallery card, second tap enters `/app-gallery?app=pawzzle`; do not visibly select the bottom `应用` pill.
- Bottom nav `广场` mirrors the video Square sequence: first tap expands the Square hot-post card, second tap enters `/square`; do not visibly select the bottom `广场` pill.

## Verification

- Mobile branch renders without runtime errors.
- Mibo opens `/chatbot`.
- App Gallery opens `/app-gallery`.
- My Products opens `/my-products`.
- Square opens `/square`.
- Bottom nav `应用` and `广场` preserve the video's expand-then-enter behavior.
- Returning from App Gallery, My Products, or Square leaves the homepage in the collapsed baseline state unless the user expands a card again.
