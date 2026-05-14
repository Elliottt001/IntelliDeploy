# Prompt: frontend/app/login.tsx

## Inputs

- Figma login frame `119:76618` from the IntelliDeploy design file.
- Existing Expo Router `/login` route and authentication API integration.
- Local image assets under `frontend/assets/images/login-*.png`.

## Output

- Native mobile login screen visually matching Figma `119:76618`.
- Android route chrome and status bar hidden so the Figma artboard is not interrupted.
- Login, privacy agreement, remember-me, forgot-password, social login, and register controls remain present.

## Design Object

- A 375 x 812 rounded mobile artboard with a light gradient background, top brand bar, central cat illustration, IntelliDeploy title, two inputs, privacy/remember controls, primary login button, social login row, and bottom register prompt.
- On native devices, the artboard scales proportionally from the 375 x 812 Figma baseline to reduce outer device whitespace while preserving Figma coordinates.

## Implementation

- Keep business logic, API calls, validation messages, storage behavior, and navigation targets unchanged.
- Use React Native `StyleSheet`, `Animated`, and static local `require` assets.
- Convert Figma SVG assets to native-renderable PNG files before requiring them in React Native.
- Use local layout constants and absolute positioning only where the Figma frame requires pixel-level placement.
- Keep background atmosphere layers subdued so the form and title hierarchy remain as light as the Figma reference.
- Approximate the primary button's Figma purple-to-blue light gradient using native layered views, without adding a gradient dependency.

## Acceptance

- `cd frontend && npx tsc --noEmit` passes.
- Android `/login` screenshot shows no blue native header and no Android status bar over the artboard.
- Android `/login` screenshot keeps the Figma frame close to the screen edges instead of centering a small fixed canvas with large white margins.
- Brand, settings, cat, background layers, social icons, checkbox defaults, and primary login button match the Figma first viewport closely.
- Empty account/password fields keep the login button visually active; tapping login still performs existing validation.
