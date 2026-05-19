# Prompt: frontend/app/my-products.tsx

## Responsibility

Render the `我的产品` collection page from the approved video.

## Output

- Inner-page header with back, centered title, and share action.
- `COLLECTION` headline, supporting copy, large layered folder illustration, and footer caption.

## Rules

- Keep the page sparse and centered like the reference.
- Keep Android native chrome hidden so the artboard remains video-like during device QA.
- Re-assert hidden Android status chrome on focus because Expo Go and deep links can restore it between inner pages.
- On native devices, proportionally scale the 375 x 812 artboard to the viewport so the collection screen keeps the same visual size as the surrounding flow.
- Use a real share glyph and a fuller folder composition with visible layered tabs and readable lower-left copy.
- Use the same constructed back glyph as the other approved inner pages; text arrows are not acceptable because Android renders them with mismatched weight and positioning.
- Tune the folder toward the video reference: broad purple back plate, translucent front glass, visible upper tabs, and lower-left `MY COLLECTION OF THE WORLD` copy.
- Do not add unrelated product management controls that are absent from the video.
