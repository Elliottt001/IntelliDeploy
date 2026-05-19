# Prompt: frontend/app/app-gallery.tsx

## Responsibility

Render the mobile App Gallery detail carousel route.

## Inputs

- Expo Router route `/app-gallery`
- Figma App Gallery mobile frames and card screenshots
- Approved reference video including the inner-page header and right-side ranking drawer
- Remote image assets provided by Figma MCP

## Output

- Full-screen mobile artboard without the native blue stack header.
- Inner-page header, search, filter pills, stacked detail card, carousel dots, bottom actions, and ranking drawer aligned to the approved video.
- App detail cards retain swipe/tap carousel behavior.

## Rules

- Hide route chrome locally with `Stack.Screen`, not by changing the global stack for all routes.
- Hide Android status bar imperatively as well as declaratively so native QA captures keep the artboard visually anchored like the reference frame.
- Re-assert hidden Android status chrome on focus because Expo Go and deep links can restore it after opening dev tools or switching routes.
- On native devices, proportionally scale the 375 x 812 artboard to the viewport so the inner route does not appear as a shrunken fixed canvas after leaving the home screen.
- Keep the screen native React Native; do not add web-only CSS dependencies.
- Preserve existing carousel interactions.
- Use the video page chrome: a constructed back glyph, centered title, and a real share glyph rather than placeholder text symbols.
- `热门榜单` opens the video-style ranking surface: it slides in from the right, covers the artboard instead of leaving a narrow mismatched strip, keeps the same header chrome, and shows the gold-cat banner plus colorful ranked app icons.

## Verification

- `cd frontend && npx tsc --noEmit` passes.
- Android preview shows no blue native title bar above the Figma artboard.
