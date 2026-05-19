# Prompt: frontend/app/chatbot.tsx

## Responsibility

Render the Mibo assistant flow from the approved video.

## Output

- Inner-page header with back, centered title, and share action.
- Hero mascot stage.
- Staged assistant states: welcome, analyzing, installing, and complete.
- Bottom input dock retained through the flow.
- A short entry-only mascot stage before the welcome controls appear, matching the video's route-entry moment.

## Rules

- This is a task-progress assistant, not a conventional chat transcript.
- Keep the page stateful and sequential like the video.
- Keep Android native chrome hidden and use the video-consistent share glyph in the inner-page header.
- Re-assert hidden Android status chrome on focus because Expo Go and deep links can restore it between route changes.
- Use the same constructed back glyph as the other approved inner pages; text arrows are not acceptable because Android renders them with mismatched weight and positioning.
- On native devices, proportionally scale the 375 x 812 artboard to the viewport so the Mibo flow preserves the same stage proportions as the approved video.
- The mascot stage remains visibly rendered in every phase after scaling; welcome/analyzing/installing/complete may swap artwork, but no phase may collapse into a text-only screen.
- Tapping a suggestion may directly start the staged analysis flow so the manual validation path matches the video without requiring an extra send tap.
- Do not preserve obsolete message-bubble layout when it conflicts with the approved reference.
