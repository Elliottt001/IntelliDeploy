# Runtime Reliability Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Repository contract requires one agent on main, no worktrees or subagents. Steps use checkbox syntax.

**Goal:** 修复真实 API 试验后的 RT-01–RT-08，使需求纠正可靠、边界清楚、费用可核对，再验证真实交付。

**Architecture:** Reuse Job.checkpoint and durable MODEL_CALL records for correction history and replay. Preserve existing requirement, lease, budget and release gates; project safe diagnostics and compact routing input without modifying source evidence.

**Tech Stack:** Python 3.13, Pydantic, SQLAlchemy/PostgreSQL, FastAPI, Node.js 24, Linux AMD64 Runner.

**Spec:** `docs/superpowers/specs/2026-11-13-runtime-reliability-repair-design.md`.

## Global Constraints

- main, single agent, no worktree or subagent; preserve community WIP.
- Python 3.13, Node.js 24, existing dependencies and tables; no migration needed.
- Corrections remain limited to three rounds. Default model calls remain limited to 40.
- Original user quotes, frozen acceptance, privacy, lease, budget, unknown-effect and real release gates remain enforced.
- Default users remain Baseline. External missing evidence remains NOT_RUN; no fabricated URLs, token usage or fees.
- Routing excerpts: 200 paths, 16384 key-file characters total, 4096 per file, 1000 description characters per candidate; full source evidence retained.

## Task 1: Stateful correction, issue closure and questions

**Files:** Modify `backend/app/agent/requirements.py`, `prompts/generation/requirements.md`; test `tests/phase1/test_requirement_revision.py`.

**Interfaces:** Existing compile_requirement and validate_revision; add optional persist callback to compile_requirement. Current draft is separate from frozen previous. Review resolutions contain issue, acceptance_ids, evidence.

- [ ] Write failing tests for lost acceptance after correction, current draft/history present in retry JSON, valid stale-issue resolution, missing/unknown closure evidence rejection, question returned before review and three-round exhaustion.

```python
async def complete(messages, tools, model):
    payload = json.loads(messages[1]['content'])
    if 'current_draft' in payload:
        assert payload['current_draft']['acceptance'][0]['id'] == 'save'
    return next(recorded_turns)
```

- [ ] Run `PYTHONPATH=backend .venv/bin/pytest -q tests/phase1/test_requirement_revision.py`; confirm new regressions fail for the intended missing behavior.
- [ ] Add JSON retry state and previous draft/history; preserve prior acceptance and source references with existing validation. Add strict review resolution parsing and valid-current-evidence closure only. Return questions before independent review.

```python
payload.update(current_draft=current_draft, review_history=history,
               correction=correction, platform_defaults={'identity': 'platform'})
# A resolution closes only a reported issue whose acceptance_ids exist now.
```

- [ ] Run the requirement tests and inspect retained guards; commit only task files.

## Task 2: Worker checkpoints and authorized requirement diagnostics

**Files:** Modify `backend/app/jobs/execution.py`, `backend/app/jobs/pipeline.py`, `backend/app/jobs/diagnostics.py`, `backend/app/evaluation/schemas.py`; test `tests/phase1/test_default_execution.py`, `tests/phase1/test_evaluation_access.py`; regenerate `packages/api-client/`.

**Interfaces:** compile_requirement(..., persist=callback); RequirementInvalid structured details; optional EvaluationRecord.requirement_compilation projection. Job.checkpoint key requirement_compilation.

- [ ] Add RED for checkpoint on retry/failure, replay using existing durable responses, REQUIREMENT_INVALID final error, and safe owner/developer-only projection.

```python
assert record['requirement_compilation']['attempt_count'] == 3
assert 'draft' not in record['requirement_compilation']
```

- [ ] Run affected tests before implementation.
- [ ] Pass `persist=lambda state: self.save(requirement_compilation=state)`, catch RequirementInvalid separately, and project only diagnostic fields. Reconstruct retries by durable response replay; no changed-input replay or new tables.
- [ ] Run affected tests, `npm run api:generate`, shared API client tests and generation stability check; commit scoped files.

## Task 3: Output policy, known protocol failure billing and cancellation

**Files:** Modify `backend/app/config.py`, `backend/app/core/types.py`, `backend/app/agent/deepseek.py`, `backend/app/jobs/execution.py`; test `tests/phase1/test_deepseek.py`, `tests/phase1/test_default_execution.py`.

**Interfaces:** ModelTurn.finish_reason/provider_request_id/protocol_error default to None. Shared completion_options(tools) pins max_tokens and thinking policy in durable request hash. ModelProtocolError can carry a received turn.

- [ ] Add RED for disabled planning thinking, preserved enabled tool reasoning, default8192, length/empty/invalid-tool response carrying known usage, one charge on cached failure, and CancelledError creating UNKNOWN.

```python
assert request_body['extra_body']['thinking']['type'] == 'disabled'
assert request_body['max_tokens'] == 8192
assert saved_record.state == 'UNKNOWN'
```

- [ ] Run selected protocol/billing regressions before implementation.
- [ ] Implement shared completion options; preserve provider finish/id/usage before reporting protocol errors. Meter received errors once; prohibit replay of REQUESTED/UNKNOWN. On waiting-request cancellation, record uncertainty then re-raise.
- [ ] Run protocol/default execution/billing tests; commit scoped files and any regenerated public schema if affected.

## Task 4: Runner validation before STARTED

**Files:** Modify `backend/app/runner/service.py`; test `tests/phase1/test_runner_protocol.py`, `tests/phase1/test_runner_commands.py`.

**Interfaces:** Existing tool RPC and completed replay; invalid arguments produce422 detail.code=TOOL_ARGUMENTS_INVALID, missing executor503. Preserve409 for unknown effect.

- [ ] Add RED for timeout300000, invalid argv/path, missing executor, no operations record, and completed/unknown replay preservation.

```python
response = await client.post(path+'/tools', json={'call': invalid}, headers=headers)
assert response.status_code == 422
assert not list((tmp_path/job/'operations').glob('*.json'))
```

- [ ] Run tests; confirm failure before implementation.
- [ ] Validate ARGUMENTS, safe_path and executor before saving STARTED. Keep existing policy and hash fencing.
- [ ] Run runner/worker boundary regressions and commit task files.

## Task 5: Audit and retain unresolved model usage

**Files:** Add `scripts/reconcile_model_usage.py`; reuse task3 unknown-record helper in `backend/app/jobs/execution.py`; test `tests/phase1/test_default_execution.py` or new `tests/phase1/test_model_reconciliation.py`.

**Interfaces:** Read-only audit of MODEL_CALL by job id; explicit --mark-unknown moves unresolved no-response REQUESTED to UNKNOWN idempotently, with UnknownUsage record. Never calls a model or invents a bill.

- [ ] Add RED for default audit no mutation, explicit unknown transition, idempotency, and refusal to change a known/metered result.

```python
assert audit_row['state'] == 'REQUESTED'
assert mark_unknown_twice.operation_id == original.operation_id
assert provider_calls == 0
```

- [ ] Run new regressions before implementation.
- [ ] Implement guarded SQL-only audit/update with DATABASE_URL from environment; output operation/state/provider id, no credentials or raw responses. Use known controlled test database for the old unresolved trial.
- [ ] Verify local record becomes explicitly auditable unknown; actual vendor fee remains pending if no authoritative per-request invoice. Commit and update RT-07 honestly.

## Task 6: Retrieval deduplication and bounded route evidence

**Files:** Modify `backend/app/agent/retrieval.py`, `backend/app/agent/routing.py`; test `tests/phase1/test_hybrid_retrieval.py`, `tests/phase1/test_hybrid_routing.py`, `tests/phase1/test_routes.py`.

**Interfaces:** retrieve_sources return unchanged; local enrichment cache bound to canonical URL/ref/commit. Route input compaction preserves selected source, evidence digests, profiles/evaluations and full stored candidate.

- [ ] Add RED for repeated candidate enriched once, separate refs retained, failure remains incomplete, route input bounded and source evidence unchanged.

```python
assert enrich_calls == 1
assert candidate.key_files['README.md'] == original_readme
assert len(route_payload['candidates'][0]['key_files']['README.md']) <= 4096
```

- [ ] Run regressions before implementation.
- [ ] Cache per-call enrichment and known empty rejection; compact only route-model payload. Retain file digests/counts and full checkpoint data; do not trim license/coverage decisions.
- [ ] Run retrieval/routing/default execution regressions and commit scoped files.

## Task 7: Full regression and real API acceptance

**Files:** Update `docs/algorithm/runtime-issues-2026-11-13.md`, `docs/一期实施进度.md`, new dated acceptance report/evidence. Private test launcher/config remains outside repo.

**Interfaces:** Same real POST /api/evaluation/runs, independent baseline/hybrid jobs and observer; existing business/release evidence gates.

- [ ] Run full Phase1 suite, affected shared-client checks, diff check and inspect scoped changes. Fix new failures before any passing claim.
- [ ] Refresh clean tracked snapshot, ensure authorized test target/runner health, run the original one-sentence baseline/hybrid pair serially. Use same model/output/budget and clarification policy, preserve all failed attempts.
- [ ] Inspect actual CRUD, restart/refresh persistence and multi-user isolation with runtime evidence. No report-only or build-only pass.
- [ ] Record reached stages, failures, known/unknown fees and precise closure status for each RT item; supplier bill and additional route/cloud evidence stay pending when unavailable.

## Coverage and execution

RT-01/02/03→Task1; RT-06→Task2; RT-04→Task3; RT-05→Task4; RT-07→Task3/5; RT-08→Task6. Task7 verifies shared behavior and truthful external results. User authorized code changes against the issue document; execute inline under the repository's single-agent contract.

## Execution record

- Task 1: initial regressions confirmed RED for lost correction acceptance, stale issue closure, question-before-review and persisted failure state; GREEN: requirement suite17 passed, default execution20 passed. Retry JSON preserves current draft/history; current evidence is required to close a self-reported issue.
- Task 2: checkpoint, specific failure code, authorized projection and interrupted-worker replay confirmed RED then GREEN; combined requirements/default/evaluation suite50 passed; client9 passed; regenerated schema stable on repeat generation.
- Task 3: six regressions confirmed RED; protocol/default execution36 passed, requirement/ledger checks passed. Provider finish/id and known usage retained before protocol errors; cancellation explicitly UNKNOWN; default planning thinking disabled, output8192, call cap40 unchanged.
- Task 4: five direct-RPC regressions confirmed RED (500 errors and premature STARTED); GREEN runner/default suite38 passed, 1 skipped. Argument/path and executor validation now precede STARTED; completed and unknown effect fencing retained.
- Task 5: five audit regressions RED→GREEN. Read-only audit preserves records; explicit reconciliation is hash-bound, terminal-job-only and idempotent. The old test request was recorded UNKNOWN with no replay or invented fee; supplier fee remains unconfirmed, evidence in private reports/uncertainty-reconciliation.json.
- Task 6: duplicate enrichment, duplicate failure and unbounded context confirmed RED; GREEN retrieval/routing/default57 passed. Full sources and commit conflicts retained; route excerpts carry SHA256/count metadata and bounded content.
- Cancellation boundary follow-up: a RED proved cancel_requested still admitted a new paid request. Added a pre-request cancellation guard; received responses still meter before stopping. Final regression is repeated after this change.
- Task 7 live follow-up: both real paths froze requirements in approximately8/6 seconds. Baseline failed after20 implementation turns while still writing files; the first pair is preserved and superseded. Five round-budget/platform-contract/concurrency tests and one partial-mutation failure test confirmed RED. GREEN combined retrieval/routing/default64 passed; generation reserves6 downstream calls under global40 cap and enrichment concurrency is4.
- Second post-repair pair: bounded retrieval reached generation in58/90 seconds but a list_files absolute path was correctly rejected by Runner and incorrectly surfaced as node outage. Two error-mapping regressions confirmed RED; known pre-effect TOOL_ARGUMENTS_INVALID is now recoverable tool feedback without execution charges. File-tool paths are explicitly relative in Builder contract.
- Structured verification audit: three RED tests showed browser-plan and independent review schemas were not sent to models. Added actual BrowserCheck/action argument schema and strict review schema; verification/review25 passed. Main suite after safe runner mapping517 passed / 4 skipped; verification schema changes are covered by the focused25 checks and final full run follows.
- Live generation reached npm/Prisma and a successful Next production build. The readonly executor default npm home caused an actual install error; a RED confirmed missing writable cache configuration. Added npm_config_cache=/tmp/npm-cache while retaining readonly isolation; runner15 passed / 1 skipped.
- Live follow-up: source build passed but model used all31 rounds for additional local fixtures without manifest. Added persisted FINALIZE phase and replay credit for a received uncheckpointed model turn; closure still submits only a candidate. Hybrid encountered exhausted container loop nodes (host allocated loop8, container lacked it); bounded missing loop nodes are now prepared before quota mounting. Combined quota/loop/default45 passed.
- Latest live baseline hit a known MODEL_OUTPUT_TRUNCATED at8192 during code writing. Added bounded received-error corrections that retain raw reasoning/tool IDs, append explicit no-effect tool feedback, preserve replay position and known billing; at most two corrections (three errors stop). Manifest-only finalization uses planning thinking policy. RED3 regressions→GREEN57 protocol/loop/default checks.
- FINALIZE follow-up: a real Hybrid turn requested `run_command rm -f ...` after only `finish_implementation` was offered. RED2→GREEN59: no extra tool executes, one persisted correction is allowed beyond the implementation round count, and a second violation exhausts. Subsequent real samples formed manifests without executing the cleanup command.
- Later live failures confirmed three additional boundaries. Confirmed `NOT_STARTED` Runner calls retry once; BrowserCheck actions use eight typed schemas; readonly GET/snapshot retries once while writes still reconcile state. BuildKit Registry was corrected to explicit TLS and an independent candidate build/push succeeded. Build and BLOCKING review details now enter private repair evidence, production-build success moves directly to FINALIZE, and the global model-call cap remains40. Full final local suite536 passed / 4 skipped; client9 passed.
- Final real pair on commit `d8dab5d`: Baseline `1ea12775-a506-44af-8fe3-f87b78340502` failed at600.669s and Hybrid `a0222c82-c110-4454-ac77-784d15fb4e3f` failed at432.091s; both reported `plan path must be relative`, with business checks NOT_RUN. Task7 therefore remains open: there is still no successful CRUD, restart persistence or cross-account isolation evidence and no completion-time comparison.
