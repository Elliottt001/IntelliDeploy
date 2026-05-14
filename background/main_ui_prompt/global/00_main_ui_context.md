# Main UI Context

## Scope

Implement the IntelliDeploy mobile main UI inside the existing Expo React Native frontend.

The implementation must focus on:

- Mobile homepage layout.
- Light and dark visual modes.
- Figma fidelity for text, spacing, color, card hierarchy and key assets.
- Prototype interactions and navigation entries that exist in the current project.
- Maintainable component structure.

Do not implement backend behavior, authentication refactors, or unrelated pages.

## Repository Context

Frontend root:

```text
frontend/
```

Relevant files:

```text
frontend/app/index.tsx
frontend/app/app-gallery.tsx
frontend/app/chatbot.tsx
frontend/app/_layout.tsx
frontend/components/web/**
frontend/assets/images/**
```

Existing frontend stack:

- Expo
- React Native
- Expo Router
- TypeScript strict
- `react-native-safe-area-context`

## Entry Rule

`frontend/app/index.tsx` remains the platform gate:

- Web must keep rendering the existing Web landing page.
- Native mobile must render the new mobile main UI.

## Quality Rule

Follow `background/vibe_coding原则.md`:

```text
Prompt First, Code Second.
Structure First, Implementation Second.
Contract First, Generation Second.
```

Every important new or changed code file in this scope must have a corresponding prompt file under `background/main_ui_prompt/files/`.
