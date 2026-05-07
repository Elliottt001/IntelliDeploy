# Prompt Governance (Single Source of Truth)

## Directory Convention

- `prompts/templates/<agent>/`: Prompt templates grouped by agent role.
- `prompts/golden_cases/`: Golden input/output fixtures for regression tests.

## Naming Convention

Template file name:

`<agent>.<scenario>.v<major>.<minor>.<patch>.md`

Examples:
- `builder.main_flow.v1.0.0.md`
- `reviewer.main_flow.v1.0.0.md`
- `security.main_flow.v1.0.0.md`

Rules:
- `<agent>` must be one of `builder|reviewer|security`.
- `<scenario>` uses snake_case and represents a stable business scene (for example `main_flow`, `repair_flow`).
- Version follows semantic versioning.

## Metadata Contract (required)

Each template file must start with JSON front-matter:

```text
---
{"prompt_id":"builder.main_flow","version":"1.0.0","agent":"BUILDER","scenario":"main_flow","input_fields":["flow_id","stage","user_intent","repo_profile","constraints"],"output_schema":"BuilderOutput"}
---
```

Required metadata fields:
- `prompt_id`: Stable prompt identity (`<agent>.<scenario>`).
- `version`: Prompt semantic version.
- `agent`: `BUILDER|REVIEWER|SECURITY`.
- `scenario`: Stable scenario key.
- `input_fields`: Explicit required rendering fields.
- `output_schema`: Pydantic model name in `contracts.models`.

## Compatibility Rules

- Prompt metadata `output_schema` must map to a real Pydantic model.
- Changes to required `input_fields` require at least a minor version bump.
- Any change that alters output shape requires major version bump.
