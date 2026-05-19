# Prompt: frontend/app/square.tsx

## Responsibility

Render the `广场` community page from the approved video.

## Output

- Inner-page header with back, centered title, and share action.
- Hero heading, compact utilities, horizontal masonry-like card row, and featured-topic section.

## Rules

- Keep copy, density, and hierarchy close to the approved video.
- Keep Android native chrome hidden and use video-consistent line icons in the inner-page header and utility row.
- Re-assert hidden Android status chrome on focus because Expo Go and deep links can restore it between route changes.
- On native devices, proportionally scale the 375 x 812 artboard to the viewport so the page fills the same mobile frame as the video reference.
- Keep the community-card cluster and featured-topic card visually separated; no card may overlap another at 375px artboard width.
- Preserve the right-edge partial-card treatment from the video rather than squeezing every card fully on screen.
- Do not replace the open layout with generic dashboard cards.
