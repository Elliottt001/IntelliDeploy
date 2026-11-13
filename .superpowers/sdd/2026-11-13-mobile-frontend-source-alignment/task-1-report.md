## Task 1 Report: Preserve the full source contract and resolve effective motion

### Scope and baseline

- Worktree: `/Users/bytedance/Projects/my/byte-intelli/.worktrees/intellideploy-mobile-figma`
- Branch: `codex/intellideploy-mobile-figma`
- Baseline HEAD before implementation: `d390128606973d944427dfad863950c1f38ef8de`
- Source env used: `INTELLIDEPLOY_FIGMA_SOURCE=/Users/bytedance/Downloads/IntelliDeploy-design-2026-11-10-2221`
- Implemented only Task 1 frontend/source-contract files. No backend, API, shared client, Web, DB, dependency install, `api:generate`, worktree, or main-branch operations.

### Files changed

- Added `frontend/tests/figmaSource.ts`
- Added `frontend/scripts/extract-source-motion.mjs`
- Added `frontend/design/sourceMotionEvidence.ts`
- Added `frontend/tests/sourceMotionEvidence.test.ts`
- Added `frontend/e2e/sourceAssertions.ts`

`frontend/design/mobileEvidence.ts` was intentionally left unchanged because it already contains the sole approved 26-frame mobile manifest. The generator imports `mobileApprovedFrameIds` from that file, so there is no second manual frame list.

### RED evidence

Command:

```bash
INTELLIDEPLOY_FIGMA_SOURCE=/Users/bytedance/Downloads/IntelliDeploy-design-2026-11-10-2221 npm --workspace frontend test -- sourceMotionEvidence.test.ts
```

Expected RED result:

```text
FAIL  tests/sourceMotionEvidence.test.ts
Error: Cannot find module '../design/sourceMotionEvidence'
Test Files  1 failed (1)
Tests  no tests
```

This was the required module-missing RED before adding production source-motion files.

### Implementation summary

- `frontend/tests/figmaSource.ts` reads the original `design-data/document.kiwi.json` directly under `INTELLIDEPLOY_FIGMA_SOURCE`, indexes by complete `sessionID:localID`, and computes `sourceBox(frameId,nodeId)` by multiplying the full parent transform chain and converting four corners to an AABB.
- `frontend/scripts/extract-source-motion.mjs` reads the original Kiwi document, walks descendants of the existing `mobileApprovedFrameIds`, merges inherited/own/override prototype interactions by complete interaction ID, and preserves root-path and child-path override identity.
- The extractor writes `frontend/design/sourceMotionEvidence.ts` by staging to a temp file and renaming. Output contains no local Downloads/source path.
- `SourceMotion` preserves raw `event`, `navigation`, `transition`, `targetNodeId`, `interactionId`, `durationMs`, `prototypeDelayMs`, raw `easingType`, and full `easingFunction`.
- `SCROLL_TO` with no target or the `4294967295:4294967295` sentinel is preserved as `navigation: "SCROLL_TO"` and `targetNodeId: null`.
- `frontend/e2e/sourceAssertions.ts` provides test-only Playwright helpers for source fixture installation, horizontal overflow checks, and 44x44 touch-target checks.

### Source checks covered

- Folder expand source action: node `280:26962`, interaction `386:137`, target `380:147`, duration `1.277617216s -> 1277.617216ms`, `GENTLE_SPRING`, easing `[1,64,12,0]`.
- Mibo timeout source action: frame `846:3544`, interaction `852:4337`, timeout `0.300000012s -> 300.000012ms`, action duration `1.250122905s -> 1250.122905ms`, raw `SPRING_PRESET_THREE`, easing `[1,80,20,0]`.
- The generated evidence includes raw `SPRING_PRESET_THREE` entries for Task 3 consumers; easing type is not normalized.
- Existing 26-frame mobile manifest is used as the only frame manifest.
- Override replacement/deletion is tested with an isolated Kiwi fixture.
- `sourceBox` verifies parent-chain matrix AABB against a formal folder child node.

### Rulings

- Ruling: Generated source-motion evidence may contain 93 effective source records because each approved descendant interaction/override is preserved, but this is not a claim of 93 independent product animations. Runtime policy/mapping belongs to later tasks.
- Ruling: A `guidPath` containing only the symbol root is the same effective owner/path as the instance root; such overrides merge into the root interaction set by complete interaction ID.
- Ruling: The extractor requires `INTELLIDEPLOY_FIGMA_SOURCE` or an explicit `designSource`; it does not hardcode the local Downloads path.
- Ruling: `mobileEvidence.ts` stayed unchanged because it already provides the approved 26-frame manifest and changing it would add no contract value.

### GREEN and verification evidence

Final command bundle:

```bash
export INTELLIDEPLOY_FIGMA_SOURCE=/Users/bytedance/Downloads/IntelliDeploy-design-2026-11-10-2221
node frontend/scripts/extract-source-motion.mjs
npm --workspace frontend test -- sourceMotionEvidence.test.ts mobileDesignExtraction.test.ts
export TASK_MOTION_TMP=$(mktemp -d)
node --input-type=module -e "import {extractSourceMotion} from './frontend/scripts/extract-source-motion.mjs'; import path from 'node:path'; for (const name of ['a.ts','b.ts']) await extractSourceMotion({designSource:process.env.INTELLIDEPLOY_FIGMA_SOURCE,outputPath:path.join(process.env.TASK_MOTION_TMP,name)});"
cmp "$TASK_MOTION_TMP/a.ts" "$TASK_MOTION_TMP/b.ts"
npm --workspace frontend run typecheck
npm --workspace frontend test
```

Final output summary:

```text
Extracted 93 source motions from 26 approved frames.
sourceMotionEvidence.test.ts + mobileDesignExtraction.test.ts: 2 files passed, 12 tests passed.
cmp a.ts b.ts: exit 0.
frontend typecheck: tsc --noEmit exit 0.
full frontend units: 21 files passed, 129 tests passed, 2 skipped.
```

Note: Node printed `MODULE_TYPELESS_PACKAGE_JSON` warnings while importing `mobileEvidence.ts` from the `.mjs` generator. This is an existing package-module metadata warning, not a verification failure.

### Self-review

- Re-read the Task 1 brief, global constraints, shared signatures, confirmed spec, source/test skills, and relevant existing frontend extraction/fixture code before implementation.
- Verified raw Kiwi field names (`event.interactionType`, `actions[0].transitionNodeID`) instead of relying on simplified examples.
- Confirmed generated runtime evidence contains no local source path.
- Confirmed `SPRING_PRESET_THREE`, `CUSTOM_SPRING`, `GENTLE_SPRING`, and easing arrays are preserved as raw values.
- Confirmed no backend/API/shared-client/Web files were touched.
- Confirmed deterministic generation with two temporary outputs and `cmp`.

### Exact limitations

- This task only creates the source-motion contract and source assertions. It does not implement runtime animation policy, easing sampling, reduced-motion behavior, or component-level motion playback.
- `sourceBox` is a source AABB without effect expansion; mask/ancestor opacity/final painted bounds remain later-task concerns.
- E2E helpers are test-only fixtures and do not assert any page yet unless later tests import them.
- Generated evidence records source interactions; later tasks must decide which interactions become product runtime transitions and must not treat prototype timers as business state progression.

## Fix round 1

### Review findings addressed

- Corrected the local Task 1 plan record: `frontend/design/mobileEvidence.ts` is now listed as a read/preserved file, not a required modified file. Controller ruling says the existing manifest already has the complete 26 states and the extractor consumes it directly. No unused export or cosmetic product edit was added.
- Strengthened `frontend/tests/sourceMotionEvidence.test.ts` with a real source-backed nested rotated/skewed `sourceBox` AABB proof using node `119:76644` under frame `119:76618`.
- Strengthened `frontend/tests/sourceMotionEvidence.test.ts` with a synthetic child-path override replacement/deletion fixture that verifies effective owner identity is retained as `1:101/2:200/2:201`.
- No production code or public API changed in this fix round.

### Plan regeneration command

The requested command was run explicitly:

```bash
bash task-brief PLAN 1
```

Output:

```text
bash: task-brief: No such file or directory
```

No `task-brief` script or command is present in this worktree or PATH, so the authorized plan-record correction was applied directly to `task-1-brief.md`.

### DTO skip boundary correction

The first full-suite command in this report omitted:

```bash
INTELLIDEPLOY_DTO_PYTHON=/Users/bytedance/Projects/my/byte-intelli/.venv/bin/python
```

That omission is the exact reason the earlier full unit summary had 2 skips. The main interpreter exists; the skips were not caused by an unavailable interpreter.

### Warning origin correction

The Node warning is emitted when `frontend/scripts/extract-source-motion.mjs` dynamically imports `../design/mobileEvidence.ts` while the package has no module type metadata:

```text
MODULE_TYPELESS_PACKAGE_JSON ... mobileEvidence.ts is not specified and it doesn't parse as CommonJS.
```

No package config change was made just to suppress this warning.

### Fix-round verification

Focused command:

```bash
export INTELLIDEPLOY_FIGMA_SOURCE=/Users/bytedance/Downloads/IntelliDeploy-design-2026-11-10-2221
export INTELLIDEPLOY_DTO_PYTHON=/Users/bytedance/Projects/my/byte-intelli/.venv/bin/python
npm --workspace frontend test -- sourceMotionEvidence.test.ts mobileDesignExtraction.test.ts
```

Output summary:

```text
sourceMotionEvidence.test.ts + mobileDesignExtraction.test.ts: 2 files passed, 14 tests passed.
```

Typecheck and full source+DTO-enabled unit command:

```bash
export INTELLIDEPLOY_FIGMA_SOURCE=/Users/bytedance/Downloads/IntelliDeploy-design-2026-11-10-2221
export INTELLIDEPLOY_DTO_PYTHON=/Users/bytedance/Projects/my/byte-intelli/.venv/bin/python
npm --workspace frontend run typecheck
npm --workspace frontend test
```

Output summary:

```text
frontend typecheck: tsc --noEmit exit 0.
full frontend units with DTO env: 21 files passed, 133 tests passed, 0 skipped.
```

Determinism was not rerun in fix round 1 because `frontend/scripts/extract-source-motion.mjs` and generated `frontend/design/sourceMotionEvidence.ts` were unchanged.
