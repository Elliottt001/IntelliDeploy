# Prompt: frontend/app/login.tsx

## Inputs

- Figma login frame `119:76618` from the IntelliDeploy design file.
- Approved mobile reference video showing login menu, submitting state, and home transition.
- Existing Expo Router `/login` route and authentication API integration.
- Local image assets under `frontend/assets/images/login-*.png`.

## Output

- Native mobile login screen visually matching Figma `119:76618`.
- Android route chrome and status bar hidden so the Figma artboard is not interrupted.
- Login, privacy agreement, remember-me, forgot-password, social login, and register controls remain present.
- Settings menu and authenticated handoff behavior match the approved video reference.

## Design Object

- A 375 x 812 rounded mobile artboard with a light gradient background, top brand bar, central cat illustration, IntelliDeploy title, two inputs, privacy/remember controls, primary login button, social login row, bottom register prompt, and the three-item settings dropdown seen in the video.
- On native devices, the artboard scales proportionally from the 375 x 812 Figma baseline to reduce outer device whitespace while preserving Figma coordinates.
- The first viewport keeps the approved video's light vertical rhythm: the cat stays compact and airy, the title block does not overpower the form, and the form stack starts early enough that the button/social/footer cadence does not drift downward.

## Implementation

- Preserve business logic, API calls, validation messages, and storage behavior while changing the visual handoff to match the video flow.
- Use React Native `StyleSheet`, `Animated`, and static local `require` assets.
- Convert Figma SVG assets to native-renderable PNG files before requiring them in React Native.
- Use local layout constants and absolute positioning only where the Figma frame requires pixel-level placement.
- Keep background atmosphere layers subdued so the form and title hierarchy remain as light as the Figma reference.
- Approximate the primary button's Figma purple-to-blue light gradient using native layered views, without adding a gradient dependency.
- Render the top-right settings control as a small white circular button with a constructed eight-tooth gear glyph; do not use the oversized bitmap settings asset because it reads as a grey overlay on Android, and avoid crosshair-like geometry that differs from the video.
- After valid credentials are submitted, show the submitting state from the video immediately by removing form/social/footer controls and any form-like white glow bars, keeping the brand/cat/title stack visible, and changing the hero hint to `正在登录，精彩即刻呈现...`; do not overlay a second large title over the input area.
- Re-assert hidden native status chrome when the screen regains focus so emulator re-entry does not reintroduce Android bars absent from the approved video.

## Acceptance

- `cd frontend && npx tsc --noEmit` passes.
- Android `/login` screenshot shows no blue native header and no Android status bar over the artboard.
- Android `/login` screenshot keeps the Figma frame close to the screen edges instead of centering a small fixed canvas with large white margins.
- Brand, settings, cat, background layers, social icons, checkbox defaults, and primary login button match the Figma first viewport closely.
- The settings button remains light, compact, and consistent with the video; it must read as a gear icon, not a large grey floating overlay or crosshair.
- Cat scale/opacity, title sizing, and the spacing from title -> hint -> form read as the same hierarchy as the approved video first screen.
- Empty account/password fields keep the login button visually active; tapping login still performs existing validation.
- Settings button reveals `偏好设置 / 语言与地区 / 联系我们`.
- Successful login visibly enters the same staged transition shown in the approved video: no account/password fields, no social row, only the centered cat/title and submitting hint for a readable beat before the homepage opens.
