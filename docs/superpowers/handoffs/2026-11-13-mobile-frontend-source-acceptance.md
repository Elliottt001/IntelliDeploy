# Mobile frontend source acceptance — 2026-11-13

Task 11 produces a reviewable frontend acceptance collection. Strict source acceptance remains **INCOMPLETE**. A successful collector/test/export is not a claim that all six source aspects or all mobile platforms pass.

## Source, scope and attribution

- Original Kiwi: `/Users/bytedance/Downloads/IntelliDeploy-design-2026-11-10-2221/design-data/document.kiwi.json`.
- SHA-256 freshly checked with `shasum -a 256`: `378b0b88b0e2a5fa420f0178c830f25186b787efc5c1b9d77064aab505ff334e`. Runtime collection independently hashes those bytes.
- The single 26-frame manifest is [mobileEvidence.ts](../../../frontend/design/mobileEvidence.ts). The collector reads original Kiwi nodes, parent chains, geometry blobs, paints, glyph commands, effects and interactions. It does not derive expected values from screenshots or generated rendering constants.
- Existing worktree: `/Users/bytedance/Projects/my/byte-intelli/.worktrees/intellideploy-mobile-figma`, branch `codex/intellideploy-mobile-figma`. Preserve this worktree and the ignored SDD ledger.
- Original recorded baseline: `d390128606973d944427dfad863950c1f38ef8de`. Initial acceptance sync: merge `a91df57`, upstream main `9265b5e`. Final controller sync: merge `d427532`, upstream main `968432e`, without conflicts. Do not substitute changing main for the original baseline.
- At the original Task11 acceptance endpoint `08e9a6c`, the prohibited-path diff from `d390128` equalled `d390128..9265b5e` byte for byte (`cmp` exit 0), and `9265b5e..08e9a6c` had no prohibited-path changes. This earlier verification point is retained as history.
- The controller reports the final `968432e..d427532` prohibited-path delta is zero. The later main changes affect backend types/implementation/docs/tests; frontend and shared API-client code have no new upstream changes. Attribute those changes to upstream main, not Task11. Source/DTO and typecheck post-sync revalidation is recorded separately below.
- Task11 changes frontend tests, the conservative summarizer, this handoff, and the controller-authorized minimal `useSourceMotion` layout-reset repair. No API generation, database migration/seed, backend/shared-DTO/Web-client/source-package/comparator/baseline edits. The main workspace's five WIP files remain owned by the user/controller; Task11 never edits that workspace.

## Implemented collection and limits

[mobile-source-acceptance.spec.ts](../../../frontend/e2e/mobile-source-acceptance.spec.ts) enters each existing visual-fixture state through actual routes, API fixture projections, clicks, press/release, wheel/drag, input focus and scroll. It measures every state at 320/360/375/390/430 × 812, plus 320 × 568 and 430 × 932. Each state retains actual DOM/SVG boxes, matrices, native font CSS, glyph transforms, painted paths/gradients/filter/clip definitions, body text, API fixture responses and before/middle/after/reduced-motion observations.

Actual paths and static glyph commands are compared against original Kiwi blobs, command by command, with a maximum coordinate tolerance of `0.000001` for the existing six-decimal float encoding. Selected SOLID paint colors and static glyph placement/size are compared to original values. The password input also gets direct original parent-chain geometry/font assertions. Product-specific CDP safe-area overrides test five widths; isolated community fixtures record source card paint/radius and drag endpoints for 59/60.

These measurements are partial evidence. Full inventories of structure, responsive geometry, typography and supported effect stacks have not been exhaustively compared, so the corresponding whole-state fields remain `NOT_RUN` where incomplete. Unknown/missing measurements never become PASS. Local spring/drag tests cannot certify every source route or inherited/Symbol override event. Shared BottomNav and source route motion retain `NOT_IMPLEMENTED`.

Full regression also exposed a Mibo replacement race: a newly committed target briefly reused old animated progress (`0.965`) before passive-effect reset. The preserved trace measured character left `94 → 94.9647` and top `45.7771 → 20.9157`; the existing continuity threshold was not relaxed. A deterministic actual-hook unit observed the old `0.965` during the next consumer layout. The minimal repair changes the motion reset to `useLayoutEffect`. Mibo first captures the previous presentation in its own layout while the motion identity is unchanged, then its next render changes motion; the hook resets that new mapping before paint. Completion generation, reversal, reduced motion and native signals retain their existing behavior and regression coverage.

[summarize-mobile-source-acceptance.mjs](../../../frontend/scripts/summarize-mobile-source-acceptance.mjs) preserves supplied records and gaps. Missing, unexpected or duplicate frames (including a duplicate expected manifest) and mixed/invalid hashes are rejected. Strict PASS requires precisely the six named checks all PASS and data evidence from an existing API or a read-only API snapshot. Fixture-only records cannot qualify.

## Runtime evidence

- [records.json](../../../frontend/artifacts/source-acceptance/records.json): 26 compact records with six aspect statuses, original-source hash, per-state raw measurement links, supplemental artifacts and exact read-only capability gaps.
- `frontend/artifacts/source-acceptance/frame-<session>-<local>.json`: actual per-state measurements and raw source nodes. These generated files are ignored artifacts and are deliberately not committed as development images.
- [community-component.json](../../../frontend/artifacts/source-acceptance/community-component.json): isolated short/long-body fixture measurements at five widths, real pointer drag samples and reduced-motion reverse. Its scope is component rendering; production `DATA_BINDING` remains `API_UNAVAILABLE`.
- [product-safe-area.json](../../../frontend/artifacts/source-acceptance/product-safe-area.json): Chromium CDP top60/left20/bottom16/right20 measurements for header, closed/expanded folder and unchanged source subtitle font at all five widths. Physical native safe-area/keyboard execution remains `NOT_RUN`.
- [SDD logs](../../../.superpowers/sdd/2026-11-13-mobile-frontend-source-alignment/logs): RED/GREEN, full checks, failures and environment preflight logs; [task-11-report.md](../../../.superpowers/sdd/2026-11-13-mobile-frontend-source-alignment/task-11-report.md) records execution details.

The collector writes an initial `NOT_RUN` summary before collecting, so a interrupted/failed run cannot silently retain an earlier complete report. It attempts each state independently with bounded action/navigation waits and retains errors. No screenshot baseline is created or approved.

## Per-state six-aspect records

All 26 states were actually collected. Matched path counts are partial source-to-runtime evidence, not a whole-aspect PASS. Each row links the original nodes, observed boxes/font/paint/interaction/data fields and explicit gaps. Present business data is fixture evidence; the three unavailable post states explicitly declare `dataEvidence=unavailable`. The read-only API snapshot is separately recorded.

| State / original Frame | STRUCTURE | RESPONSIVE_GEOMETRY | TEXT_STYLE | PAINT_EFFECT | MOTION_INTERACTION | DATA_BINDING | Matched original paths |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [login 01 / 119:76618](../../../frontend/artifacts/source-acceptance/frame-119-76618.json) | NOT_RUN | NOT_RUN | NOT_RUN | NOT_IMPLEMENTED | NOT_RUN | NOT_RUN | 135 |
| [home 02 / 270:26263](../../../frontend/artifacts/source-acceptance/frame-270-26263.json) | NOT_RUN | NOT_RUN | NOT_RUN | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_RUN | 355 |
| [home 29 / 188:16287](../../../frontend/artifacts/source-acceptance/frame-188-16287.json) | NOT_RUN | NOT_RUN | NOT_RUN | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_RUN | 339 |
| [home 30 / 188:16759](../../../frontend/artifacts/source-acceptance/frame-188-16759.json) | NOT_RUN | NOT_RUN | NOT_RUN | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_RUN | 341 |
| [home 31 / 266:21147](../../../frontend/artifacts/source-acceptance/frame-266-21147.json) | NOT_RUN | NOT_RUN | NOT_RUN | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_RUN | 355 |
| [home 32 / 268:22904](../../../frontend/artifacts/source-acceptance/frame-268-22904.json) | NOT_RUN | NOT_RUN | NOT_RUN | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_RUN | 355 |
| [home 33 / 268:23238](../../../frontend/artifacts/source-acceptance/frame-268-23238.json) | NOT_RUN | NOT_RUN | NOT_RUN | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_RUN | 355 |
| [home 34 / 268:23572](../../../frontend/artifacts/source-acceptance/frame-268-23572.json) | NOT_RUN | NOT_RUN | NOT_RUN | NOT_IMPLEMENTED | NOT_IMPLEMENTED | API_UNAVAILABLE | 355 |
| [home 35 / 268:23906](../../../frontend/artifacts/source-acceptance/frame-268-23906.json) | NOT_RUN | NOT_RUN | NOT_RUN | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_RUN | 355 |
| [store 03 / 270:26597](../../../frontend/artifacts/source-acceptance/frame-270-26597.json) | NOT_RUN | NOT_RUN | NOT_RUN | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_RUN | 46 |
| [store 40 / 825:6804](../../../frontend/artifacts/source-acceptance/frame-825-6804.json) | NOT_RUN | NOT_RUN | NOT_RUN | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_RUN | 8 |
| [chatbot 46 / 845:3479](../../../frontend/artifacts/source-acceptance/frame-845-3479.json) | NOT_RUN | NOT_RUN | NOT_RUN | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_RUN | 88 |
| [chatbot 47 / 846:3544](../../../frontend/artifacts/source-acceptance/frame-846-3544.json) | NOT_RUN | NOT_RUN | NOT_RUN | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_RUN | 73 |
| [chatbot 48 / 849:3608](../../../frontend/artifacts/source-acceptance/frame-849-3608.json) | NOT_RUN | NOT_RUN | NOT_RUN | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_RUN | 23 |
| [chatbot 49 / 849:3705](../../../frontend/artifacts/source-acceptance/frame-849-3705.json) | NOT_RUN | NOT_RUN | NOT_RUN | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_RUN | 23 |
| [chatbot 50 / 849:3794](../../../frontend/artifacts/source-acceptance/frame-849-3794.json) | NOT_RUN | NOT_RUN | NOT_RUN | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_RUN | 23 |
| [chatbot 51 / 849:3883](../../../frontend/artifacts/source-acceptance/frame-849-3883.json) | NOT_RUN | NOT_RUN | NOT_RUN | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_RUN | 23 |
| [chatbot 52 / 849:3972](../../../frontend/artifacts/source-acceptance/frame-849-3972.json) | NOT_RUN | NOT_RUN | NOT_RUN | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_RUN | 23 |
| [chatbot 53 / 852:4061](../../../frontend/artifacts/source-acceptance/frame-852-4061.json) | NOT_RUN | NOT_RUN | NOT_RUN | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_RUN | 23 |
| [chatbot 54 / 852:4150](../../../frontend/artifacts/source-acceptance/frame-852-4150.json) | NOT_RUN | NOT_RUN | NOT_RUN | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_RUN | 23 |
| [chatbot 55 / 852:4242](../../../frontend/artifacts/source-acceptance/frame-852-4242.json) | NOT_RUN | NOT_RUN | NOT_RUN | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_RUN | 23 |
| [chatbot 58 / 852:4391](../../../frontend/artifacts/source-acceptance/frame-852-4391.json) | NOT_RUN | NOT_RUN | NOT_RUN | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_RUN | 23 |
| [products 56 / 168:6299](../../../frontend/artifacts/source-acceptance/frame-168-6299.json) | NOT_RUN | NOT_RUN | NOT_RUN | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_RUN | 44 |
| [products 57 / 380:147](../../../frontend/artifacts/source-acceptance/frame-380-147.json) | NOT_RUN | NOT_RUN | NOT_RUN | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_RUN | 44 |
| [community 59 / 168:6358](../../../frontend/artifacts/source-acceptance/frame-168-6358.json) | NOT_RUN | NOT_RUN | NOT_RUN | NOT_IMPLEMENTED | NOT_IMPLEMENTED | API_UNAVAILABLE | 39 |
| [community 60 / 825:6452](../../../frontend/artifacts/source-acceptance/frame-825-6452.json) | NOT_RUN | NOT_RUN | NOT_RUN | NOT_IMPLEMENTED | NOT_IMPLEMENTED | API_UNAVAILABLE | 38 |

Strict accepted states: **0 / 26**. No state has all six required checks verified with real API data. Full inventory/source placement, font parity and supported effect-stack comparisons remain incomplete; unsupported optical effects and unimplemented route motion are not hidden by the partial path matches.

## API, effects and devices

[capability-final-readonly.json](../../../.superpowers/sdd/2026-11-13-mobile-frontend-source-alignment/capability-final-readonly.json) is the controller's GET-only ASGI audit at the earlier main validation point `9265b5e`, without login/token writes, workers or mutable transactions. It reports 10 apps, four public publications, six database posts, zero favorites and zero recent uses. This snapshot is retained without a new API/database collection at `968432e`; it is acceptance evidence, never runtime business fallback.

The four exact read-only detail failures remain `BACKEND_BLOCKED`:

- `/api/apps/dev-content-app-gh-slim`: 500.
- `/api/apps/dev-content-app-grs-enhance`: 500.
- `/api/apps/external-app-elliottt-site`: 500.
- `/api/apps/external-app-ppt`: 500.

Six database posts have no callable production post API: `API_UNAVAILABLE`. Four publications remain unavailable with no URL/preview. Fixtures exercise actual frontend DTO consumption/auth/draft/key/error flows but do not verify real generation or real post binding. Real Job generation is `NOT_RUN`.

Raw GLASS/NOISE optical/texture effects remain `NOT_IMPLEMENTED`, including complete source parameters. Supported DOM/SVG filter samples do not make a whole effect stack pass. Browser font CSS/glyph verification does not certify native font scaling. Physical iOS/Android execution, native keyboard, device safe-area, accessibility text scaling and physical animations remain `NOT_RUN`. Expo exports are build validation only.

Root cross-client, community-cross-client and payment-cross-client test bodies are `NOT_RUN`. Fresh read-only preflight against the existing local `intellideploy_test` confirms repository head `0013_resource_cleanup` versus database head `0014_community_posts`; `check_schema()` fails with `Database schema is behind; run alembic upgrade head`. No migration was attempted. This is the precise current reason, replacing an unverified shorthand that the migration itself had been executed or fixed.

## Deferred minor findings

- Task2 source lookup diagnostic: `mobile-responsive-layout.spec.ts` still returns `node.size` without an explicit missing-node assertion. Current original-source runs verify those nodes exist; the clearer wrong-source error remains deferred. No functional failure is hidden.
- Task4 authored-only color alpha: a fresh test-only normalizer probe confirms `authoredColor.c3=0.125` yields `sourceColor.a=1`; complete rawPayload remains intact. Existing source samples also provide RGBA and normalized rendering opacity, so this probe is a metadata fallback minor, not a demonstrated current-page alpha failure. Keep it deferred; no full effect PASS is claimed.
- Task4 positive-radius SVG/non-normal group blending: existing focused cases exercise rx0 and normal blending, plus actual CSS card clipping. Positive-radius SVG clipping and non-normal group behavior remain `NOT_RUN`; implementation alone is not runtime verification.
- Task5 password surface/font coverage: strengthened by Task11's direct original `119:76688/76689` geometry and live font checks. Existing account coverage is retained. Environment `NO_COLOR/FORCE_COLOR` and Expo package compatibility notices remain recorded.
- Task9 product-specific non-zero inset coverage: strengthened by the new five-width real browser CDP override. This closes the browser coverage minor while physical native safe-area remains `NOT_RUN`.

## Ordered validation

Command outcomes and exact logs are recorded in `task-11-report.md`. The product motion implementation is unchanged across the final source/DTO, full-mobile, focused, component and export runs (SHA-256 `0e09d9d71a1460f1b80fa98b181bea4ccbeab639686507ee0a36af4e21b4706e`).

| Check | Result | Evidence |
| --- | --- | --- |
| Full original-source / DTO units | 213 PASS, 30 files, no skips | `logs/task-11-full-unit-final.log` |
| Typecheck before full mobile | PASS | `logs/task-11-typecheck-final-before-green.log` |
| All nonvisual mobile E2E, Figma env | 176 PASS | `logs/task-11-full-mobile-final.log` |
| Isolated component config | 11 PASS | `logs/task-11-component.log` |
| Dedicated source collection C2 | 1 PASS / 26 records / zero errors; strict INCOMPLETE | `logs/task-11-acceptance-final.log` |
| Web export | PASS, build only | `logs/task-11-export-web.log` |
| iOS export | PASS, build only | `logs/task-11-export-ios.log` |
| Android export | PASS, build only | `logs/task-11-export-android.log` |
| Motion / responder / source-state focused units | 76 PASS | `logs/task-11-motion-reset-focused-green.log` |
| Mibo / source-rendering focused E2E | 80 PASS | `logs/task-11-motion-mibo-focused.log` |
| Unchanged continuity threshold, repeat10 | 10 PASS | `logs/task-11-motion-reset-repeat10.log` |

Verification version boundary: the 176-test run used collector **C1**, before the additional untagged SVG/source-path pairing and image-load metadata. Dedicated **C2** validated those additions after the component run. The final collector **C3** additionally classifies the unavailable post-data origins accurately and stamps producer hashes; SHA-256 `f430dd19fc46cc008fa09d46ec5de44b0e1a1565aa13371725d4da8ea73f0145`. C3 receives its own final dedicated run; the earlier 176-test result is not represented as a run of C3. Those later changes are acceptance-test metadata only; product code and all three exported product bundles are unchanged. `records.json.producer` identifies the final collector and product implementation.

Final C3 dedicated collection: **1 PASS, 26 records, zero errors**, strict INCOMPLETE (`logs/task-11-acceptance-producer-final.log`). Final typecheck and diff check pass; record/producer/supplement integrity checks pass. The persisted/cross-client suite has the specific schema preflight blocker above.

Post-sync compatibility revalidation at controller merge `d427532` / main `968432e` is complete: the controller ran full npm units with the original Figma environment and real DTO Python interpreter, yielding **30 files / 213 PASS / 0 skips, exit 0**; typecheck and `git diff --check` also exited 0. These are fresh upstream compatibility checks, separate from the earlier runtime acceptance. This metadata sync does not rerun or refresh the 26-state records, devices, API/database snapshot or exports. Existing collector/product producer hashes and all recorded acceptance gaps remain unchanged.

The existing pixel report remains an independent historical **10 PASS / 16 FAIL**. No source/DTO test count or export result changes those numbers.

## Rulings retained in ledger order

All 13 `Ruling:` lines from progress.md are preserved below, in order. Each explanation states why the current decision was made and the cost if it is later judged wrong.

| # | Exact ledger ruling | Explanation and cost if wrong |
| --- | --- | --- |
| 1 | Ruling: Task2 tests parent/background width growth; inner cards/folders in Tasks6/9 — file ownership respected — adjust test targets if wrong. | Parent adaptation was separated from later page-specific internals. A wrong target would require correcting the specific E2E assertions and rerunning responsive/page tests; no backend change. |
| 2 | Ruling: useNativeDriver=false for layout-driven animation — source duration/curve preserved — native performance tuning may follow. | Animated layout properties need the JS driver. If device measurements reveal unacceptable performance, rework the relevant animation mapping/driver and rerun source midpoint, cancellation and native tests; device cost remains unknown until measured. |
| 3 | Ruling: Source GLASS/NOISE unsupported remains NOT_IMPLEMENTED with capability evidence — spec allows independent tasks to continue — strict effect acceptance stays incomplete. | Unsupported optical/texture behavior remains an honest gap. If a faithful supported renderer exists, integrate it and rerun effect/paint/device acceptance; substantial effect work cannot be replaced by relabeling blur. |
| 4 | Ruling: Preserve ledger after final review — user forbids deleting workspaces — ignored scratch only. | Keep source evidence/review history and the existing worktree. A mistaken retention policy costs cleanup only after explicit authorization; deleting evidence early would require rebuilding audit history. |
| 5 | Ruling: Static UI/source-backed constants permitted and app-gallery stays created — latest confirmed spec overrides older audit — no backend/API edits. | Static UI/source geometry is allowed while business records stay in APIs and default product semantics stay created. If user intent changes, revise the page policy and regression cases; business-contract changes require new scope. |
| 6 | Ruling: Installed SDD scripts lack executable bits; invoke bash and pass explicit brief output; do not chmod skill bundle — same script behavior — review package may use equivalent file redirect if helper cannot execute. | Invocation compensates for tool installation permissions without modifying shared skill files. If output semantics differ, regenerate the review package through the canonical helper and redo review; product code is unaffected. |
| 7 | Ruling: Task1 manifest already holds complete approved26 states and is consumed directly by extractor; no spec requires changing its content. Amend plan/brief Modify mobileEvidence to Read (existing single manifest), rather than an unused export/cosmetic change — fulfills spec without second manifest — costs only task-record update. Strengthen two task-local regression checks while preserving honest GREEN on already-correct behavior. | Reuse the authoritative manifest. If the source selection is wrong, fix that single manifest and regenerate extraction plus 26-state acceptance; avoid competing manifests. |
| 8 | Ruling: existing react-dom is present but no DOM/hook renderer (react-test-renderer/jsdom/happy-dom/testing-library/esbuild absent). Focused tests should render actual React hook with mocked native dependencies; if needed allow one frontend-only happy-dom dev dependency and its lock entries, per confirmed dependency scope. No production test seam/new product route — meaningful lifecycle evidence without fake hooks — cost is one test-only dependency. | Actual hook/DOM lifecycle tests need a renderer. If this dependency choice is unsuitable, replace the test renderer and rerun hook/responder units and E2E; no new runtime product route or backend library. |
| 9 | Ruling: Runtime effect representation must preserve original color/alpha and complete raw record while maintaining typed consumer compatibility; no casts may conceal mismatch. Render supported node/group effects exactly once in scope, keep unsupported optical/noise as NI. | Preserve raw fidelity and typed supported rendering. If normalization/composition is wrong, adjust the frontend extractor/renderer, regenerate affected evidence and rerun deterministic/unit/effect tests; authored-only alpha minor remains separately documented. |
| 10 | Ruling: Task4 report accidentally tracked under ignored SDD directory; remove only this created report from index, keep file on disk and append logs there — preserve workspace/user WIP — no product change. | Keep scratch evidence local while commits stay scoped. If a tracked report is required later, explicitly add that file; no product rerun is necessary for index ownership alone. |
| 11 | Ruling: Task5 placeholder source transform is16.5/16.5 with derived baseline11.460000038; old audit called stackPadding28 a text offset, but actual source placement differs. Use current original transform/derived data, not historical audit28. Source input stroke0.3000000119 remains mismatch. | The raw parent/text chain overrides an older audit label. If interpretation is wrong, redo the original-source login geometry/baseline analysis and input assertions, then rerun auth/responsive tests; do not adjust source screenshots. |
| 12 | Ruling: Task7 dispatch text named payload frames270:26244 and376:4769, but neither exists in the supplied document.kiwi.json or design-data/audit files. Current original package plus confirmed spec/plan identify formal store270:26597 and ranking825:6804. Use those existing first-source frames and record the correction; never fabricate absent nodes. | Bind tests/implementation to existing approved store/ranking frames. If a different source package is later authorized, re-audit those pages and regenerate their evidence/acceptance against its new hash; absent nodes cannot be synthesized. |
| 13 | Ruling: Task11 full runtime regression exposed Mibo old-progress/new-mapping paint race. Allow minimal frontend source-motion layout-reset timing fix plus deterministic hook/continuity regressions rather than only reporting or relaxing thresholds — approved source-motion/no-jump specification is binding — if wrong, shared Home/Product/Mibo timing needs reversible frontend rework and affected regressions. | Repair the paint ordering with a deterministic RED/GREEN layout observation and unchanged continuity thresholds. If ordering is wrong, revert or revise the frontend reset/capture timing and rerun every shared hook, Home/Product/Mibo/completion/reduced-motion/native-signal regression; no backend work is involved. |

## Review and integration handoff

Controller performs independent Task11 review and full-branch review after the scoped commit. Important frontend defects return to their task with a failing regression and minimal source-based fix. Retain unsupported effects, API blockers, native NOT_RUN and unverified aspect inventories in that review.

No push, main-workspace merge, worktree removal, ledger removal, source/baseline approval or WIP overwrite is performed by Task11. Integration requires the controller's authorized WIP-safe workflow and fresh checks for any subsequent changes.
