# Phase 1 Packaging, Gap Repair, and Component Composition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Work sequentially on `main` with one agent; do not use subagents or worktrees. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate useful Dockerfile, local repair, composition, and classification behavior into the existing durable Phase 1 pipeline.

**Architecture:** Hybrid produces typed gap and packaging plans, prepares fixed component sources, and gives the plans to Builder and Review. The existing Worker, Runner, billing, candidate validation, and release modules remain the only effect owners. The old classifier and Solvers are audit inputs, never alternate runtimes.

**Tech Stack:** Python 3.13, Pydantic v2, SQLAlchemy 2, PostgreSQL 17, existing DurableModel, pytest, Docker.

**Spec:** `docs/superpowers/specs/2026-11-12-phase1-algorithm-packaging-and-composition-design.md`

## Global Constraints

- Read `CLAUDE.md`, the spec, this plan, and current Git status before implementation.
- Work on `main`, single-agent and sequential. Preserve concurrent community seed WIP and do not stage it.
- Keep Baseline unchanged. Shadow computes deterministic evidence only and never applies packaging or component changes.
- Do not import `fallback.solvers`, `fallback.schemas`, or `classify_fallback_request` into the active algorithm path. Existing pure detectors may remain.
- Every task runs RED → minimal GREEN → related regression → diff review → scoped commit.
- Model planning uses DurableModel and stable request hashes. UNKNOWN results stop replay; malformed known responses may use a recorded deterministic fallback.
- No new service, dependency, database table, public endpoint, or generic agent framework.
- No automatic base-image, system-package, credential, migration, or business-source changes in Packaging. Builder may handle reviewed tasks through existing controlled tools.
- A remains packaging-only; B preserves the principal and works locally; C requires complete ownership/interface evidence; D uses the current scaffold.
- Source labels, model claims, and successful builds do not prove a business requirement works. Real validation remains mandatory.
- Local PASS never opens real paired rollout gates. `release_ready=false` and `hybrid_default_ready=false` remain until required real evidence passes.

## Execution Clarifications

These are essential implementation details of the approved safety boundaries:

1. Gap `complete` means a complete planning disposition for every acceptance ID, not successful implementation. `LOCAL_REPAIR` needs bound candidate tests before release; an unresolved `BLOCKED` prevents automatic implementation.
2. Existing ranking uses token overlap. Do not promote token overlap into proof of `SATISFIED`. Require a bound evidence handle for positive coverage and keep it provisional until candidate validation.
3. `WORKDIR`, `EXPOSE`, `CMD`, and `ENTRYPOINT` are stage-sensitive. Never insert WORKDIR blindly before COPY or overwrite an entrypoint wrapper. Analyze the final runtime stage; ambiguous cases become Builder findings.
4. `next dev -> next start` needs evidence of a production build and installed runtime. `npm run dev -> npm run start` requires an actual production start script. Without that evidence, return a repair task instead of rewriting.
5. Packaging action `GENERATE` is Builder-owned. The Packaging phase never fabricates a Dockerfile. Re-analyze after Builder finishes so resolved pre-build findings do not permanently block the candidate.
6. C root contains `app/` and `components/<role>/`. RPC paths remain relative to that root. Build contexts and Dockerfiles must point inside `app/`; list/read may inspect components, all write effects are restricted to app.
7. chmod alone is insufficient: upload/unpack recreates files, and commands can modify a writable mount. Persist a trusted C workspace policy on Runner, mount the root read-only and app writable, and enforce the same policy for RPC file writes/imports.
8. Component tree digests are computed on the exact sanitized source bytes uploaded to Runner. Re-fetch/upload/snapshot must not change the evidence silently.
9. B→C requires a validated IntegrationContract and an explicit bounded cost comparison before changing the committed route. If evidence is insufficient, retain a valid local B plan; do not first commit C and then fail contract validation.
10. Adjustment and resume must reuse persisted plans and hashes where inputs match. A changed requirement or source invalidates the relevant plan. Never rerun completed effects silently.

## Shared Test Values

Task 1 creates `tests/phase1/algorithm_plan_fixtures.py` containing these exact pure fixtures. Later snippets import them; no database or model is hidden in these helpers.

```python
from app.agent.contracts import EvidenceRef, RepositoryProfile
from app.core.types import AcceptanceItem, CompatibilityReport, RepoSource, Requirement, RoutePlan


def source(role="principal", char="a"):
    return RepoSource(url=f"https://github.com/example/{role}", commit=char * 40, role=role)


def requirement():
    return Requirement(prompt="保存笔记并搜索来源", acceptance=[
        AcceptanceItem(id="save", action="保存笔记", expected="刷新保留"),
        AcceptanceItem(id="search", action="搜索", expected="显示来源"),
    ])


def profile(item, covered=(), license_status="ALLOWED"):
    return RepositoryProfile(
        repo_url=item.url, commit=item.commit, project_type="web_app",
        frameworks=["Next.js"], dependency_files=["package.json"],
        lock_files=["package-lock.json"], package_manager="npm",
        entrypoints=["app/page.tsx"], start_commands=["npm run start"],
        build_commands=["npm run build"], ports=[3000],
        license_status=license_status,
        compatibility=CompatibilityReport(status="SUPPORTED", runtime="node"),
        evidence_refs=[EvidenceRef(kind="PROFILE", reference=f"coverage:{acceptance_id}",
                                   digest="f" * 64, access="PRIVATE") for acceptance_id in covered],
    )


def route(name="MODIFY_EXISTING", items=None):
    return RoutePlan(route=name, sources=items if items is not None else [source()],
                     steps=["prepare"], reason="fixture", confidence="HIGH")
```

## Task 1: Freeze the Classification Audit and Add Contract Compatibility

**Files:**
- Create: `docs/algorithm/classify-fallback-rule-audit.md`
- Create: `tests/phase1/test_classification_rule_audit.py`
- Create: `tests/phase1/algorithm_plan_fixtures.py`
- Modify: `backend/app/agent/contracts.py`
- Modify: `tests/phase1/test_algorithm_checkpoint.py`

**Interfaces:** Add spec classes `PackagingFinding`, `SafeDockerEdit`, `PackagingPlan`, `AcceptanceGap`, `GapPlan`, `ComponentWorkspace`. Add defaulted checkpoint fields `gap_plan`, `packaging_plans`, `component_workspaces`; add stages GAP/PACKAGING/COMPOSITION. Require relative paths, full commit hashes, 64-character digests, nonempty commands and unique acceptance/role entries. Preserve old checkpoint reads.

Implement the added spec evidence contract and backward-compatible field in the same task:

```python
class CompositionCost(BaseModel):
    model_config = ConfigDict(extra="forbid")
    local_units: int = Field(ge=0)
    composition_units: int = Field(ge=0)
    evidence_refs: list[str] = Field(min_length=1)

# GapPlan:
composition_cost: CompositionCost | None = None
# IntegrationContract; old checkpoints need no service map until Hybrid C executes:
role_services: dict[str, str] = Field(default_factory=dict)
```

- [ ] **Step 1: Add RED compatibility and audit tests.**

```python
from pathlib import Path
from app.agent.checkpoint import load_algorithm_checkpoint


def test_old_checkpoint_has_empty_new_plans():
    old = {"algorithm": {"schema_version": 1, "requirement_revision": 1,
                         "mode": "baseline", "algorithm_version": "fusion-v1"}}
    restored = load_algorithm_checkpoint(old, 1)
    assert restored.gap_plan is None
    assert restored.packaging_plans == []
    assert restored.component_workspaces == []


def test_audit_exists_and_keeps_old_route_semantics_explicit():
    root = Path(__file__).resolve().parents[2]
    text = (root / "docs/algorithm/classify-fallback-rule-audit.md").read_text()
    assert "CLS-OLD-C-REGENERATE" in text
    assert "CLS-OLD-D-MANUAL" in text
    assert "REJECTED" in text
```

Run `PYTHONPATH=backend .venv/bin/python -m pytest tests/phase1/test_algorithm_checkpoint.py tests/phase1/test_classification_rule_audit.py -q`. Expect missing fields/document failures.

- [ ] **Step 2: Add the exact spec contracts and shared fixtures.**

Use `extra="forbid"` on new plan models. Optional fields default to None and collections to `Field(default_factory=list)`. Keep checkpoint schema version 1 for additive reads; do not rewrite old jobs.

```python
# Add to AlgorithmCheckpoint after defining the spec models.
gap_plan: GapPlan | None = None
packaging_plans: list[PackagingPlan] = Field(default_factory=list)
component_workspaces: list[ComponentWorkspace] = Field(default_factory=list)
```

- [ ] **Step 3: Inventory every decision-producing branch.**

Read completely: `fallback/classifier/classify.py`, `rules.py`, `scoring.py`, `extract_facts.py`, and `fallback/solvers/b_patch_repo/missing_component.py`. Assign a stable rule ID to every branch group. Minimum IDs: CLS-UNCLEAR-MATERIAL, CLS-NO-REAL-CODE, CLS-RUNTIME-CHAIN, CLS-PACKAGING-ONLY-A, CLS-LIMITED-REPAIR-B, CLS-REWRITE-COST, CLS-OLD-C-REGENERATE, CLS-OLD-D-MANUAL, CLS-MISSING-COMPONENT, CLS-UNKNOWN-SOFT. Add further IDs if the branch inventory reveals uncovered rules.

Table columns: `Rule ID | Legacy source and branch | Meaning | Status | New owner | New test and runtime caller | Reason`. MIGRATE rows remain unresolved until both tests and real callers exist. Old C regeneration and old D manual exits are REJECTED as route names; their useful behavior maps to new D or WAITING_USER only through current product rules.

- [ ] **Step 4: Run GREEN and related regression.**

Run the Step 1 command plus `tests/phase1/test_evaluation_access.py`. Add round-trip and malformed-path/digest tests using the new contracts. Confirm unrelated public DTOs do not gain private fields.

- [ ] **Step 5: Scoped commit.**

```bash
git add backend/app/agent/contracts.py tests/phase1/algorithm_plan_fixtures.py \
  tests/phase1/test_algorithm_checkpoint.py tests/phase1/test_classification_rule_audit.py
git add -f docs/algorithm/classify-fallback-rule-audit.md
git diff --cached --check
git commit -m "feat: define packaging contracts and audit legacy decisions"
```

## Task 2: Deterministic Packaging Analysis and Atomic Normalization

**Files:** Create `backend/app/agent/packaging.py`, `tests/phase1/test_packaging_plan.py`.

**Interfaces:**
- `plan_packaging(workspace_id: str, profile: RepositoryProfile | None, route: RoutePlan) -> PackagingPlan`
- `apply_packaging_plan(workspace_id: str, plan: PackagingPlan) -> PackagingPlan`
- `tree_digest(root: Path) -> str`

- [ ] **Step 1: Write RED for safe normalization.**

```python
from algorithm_plan_fixtures import profile, route, source
from app.agent.packaging import plan_packaging, apply_packaging_plan


def test_packaging_replaces_only_evidenced_start_command(tmp_path):
    text = ('FROM node:20-alpine\nWORKDIR /app\nCOPY . .\n'
            'RUN npm ci && npm run build\nEXPOSE 3000\nCMD ["npm", "run", "dev"]\n')
    (tmp_path / "Dockerfile").write_text(text)
    (tmp_path / "package.json").write_text(
        '{"scripts":{"dev":"next dev","build":"next build","start":"next start"}}')
    (tmp_path / "package-lock.json").write_text("{}")
    planned = plan_packaging(str(tmp_path), profile(source()), route())
    assert planned.action == "NORMALIZE"
    apply_packaging_plan(str(tmp_path), planned)
    actual = (tmp_path / "Dockerfile").read_text()
    assert actual == text.replace('["npm", "run", "dev"]', '["npm", "run", "start"]')
    again = plan_packaging(str(tmp_path), profile(source()), route())
    assert again.safe_edits == []
```

Run `PYTHONPATH=backend .venv/bin/python -m pytest tests/phase1/test_packaging_plan.py -q`; expect missing module failure.

- [ ] **Step 2: Implement analysis and allowlisted edits.**

Use stdlib JSON/shlex to parse supported command forms. Preserve stage structure and unrelated bytes. Determine one production command from actual scripts/files, not framework guesses. Reject ambiguous ENTRYPOINT+CMD combinations, multiline shell commands, conflicting ports/lockfiles, and missing production builds with stable findings. Only rewrite an install-only RUN when its one manager and lockfile agree; do not rewrite compound RUN commands. Do not auto-insert WORKDIR where it changes existing relative COPY/RUN semantics.

```python
# Apply only when the recorded source digest still matches.
if current_digest != plan.input_digest:
    raise ValueError("packaging input changed")
# Same-directory tempfile -> fsync -> os.replace; reject all path symlinks first.
```

- [ ] **Step 3: Add safety RED cases before supporting them.**

Cover no-build Next.js, multi-stage Dockerfile, ENTRYPOINT wrapper, missing Dockerfile, multiple lockfiles, stale plan hash, symlink ancestor, path escape, exposed-port/source disagreement, and twice-applied plans. Verify FROM, system packages and business files remain byte-identical. GENERATED/ambiguous cases are Builder-owned findings, not fake successes.

- [ ] **Step 4: GREEN plus old behavior comparison.**

Run new packaging tests, `tests/phase1/test_repository_profiler.py`, `fallback/tests/test_dockerfile_reuse_lint.py`, and `fallback/tests/test_port_resolution.py`. Keep old tests in a separate invocation if their fixtures conflict; document old unsafe heuristics deliberately not migrated.

- [ ] **Step 5: Commit packaging module and test only.**

```bash
git add backend/app/agent/packaging.py tests/phase1/test_packaging_plan.py
git diff --cached --check
git commit -m "feat: plan safe production Dockerfile normalization"
```

## Task 3: Acceptance Gaps and Transactional B-to-C Promotion

**Files:** Create `backend/app/agent/gaps.py`, `tests/phase1/test_gap_plan.py`; modify `backend/app/agent/routing.py`, `integration.py`, `orchestrator.py`, `jobs/execution.py`, and `tests/phase1/test_hybrid_routing.py`.

**Interfaces:**
- `deterministic_gap_plan(requirement, provisional, profiles, evaluations) -> GapPlan`
- `validate_gap_plan(gaps, requirement, provisional, profiles, evaluations) -> GapPlan`
- `async plan_acceptance_gaps(requirement, provisional, profiles, evaluations, model=None) -> GapPlan`
- `finalize_route_with_gaps(provisional, gaps, retrieval, profiles, evaluations, requirement, *, integration_contract=None) -> RoutePlan`
- Orchestrator owns invoking planning/finalization and saving accepted route/gaps/contract together.

- [ ] **Step 1: Write RED for local-only default repair.**

```python
from algorithm_plan_fixtures import requirement, profile, route, source
from app.agent.ranking import rank_candidate
from app.agent.gaps import deterministic_gap_plan


def test_missing_acceptance_is_local_and_satisfied_work_is_preserved():
    req = requirement()
    principal = source()
    facts = profile(principal, covered=["save"])
    gaps = deterministic_gap_plan(req, route(), [facts], [rank_candidate(facts, req)])
    assert {g.acceptance_id for g in gaps.gaps} == {"save", "search"}
    by_id = {g.acceptance_id: g for g in gaps.gaps}
    assert by_id["save"].status == "SATISFIED"
    assert by_id["search"].status == "LOCAL_REPAIR"
    assert "save" in by_id["search"].preserve
```

Run `PYTHONPATH=backend .venv/bin/python -m pytest tests/phase1/test_gap_plan.py -q`; expect missing module.

- [ ] **Step 2: Implement deterministic disposition and strict model overlay.**

Exactly one gap per acceptance. Separate explicit coverage evidence from heuristic rank score. A local plan carries preserve IDs and bounded suggested edits, not fabricated filenames. D without a principal plans new implementation, not blocked reuse. Empty acceptance requirements cannot establish full business coverage.

Model overlay may propose providers/costs/interfaces but cannot delete acceptance IDs or invent sources. Stable operation is `gaps:{revision}:{input_hash}`. Record malformed known response fallback; propagate UNKNOWN or quota failures.

- [ ] **Step 3: Write RED for promotion gate and fallback.**

Use `source("search", "b")`, `profile(provider, covered=["search"])`, current `build_integration_contract` and its valid fixture from `tests/phase1/test_integration_contract.py`. Set one gap to COMPONENT_SOURCE. Verify C is returned only with full retrieval membership, allowed license, fixed SHA, capability evidence, validated owner/API contract, and explicit nonnegative same-unit local-versus-composition cost estimates showing composition is cheaper. Store comparison as typed evidence in GapPlan; add contract fields only for these named costs and evidence references.

Concrete promotion assertion using the existing contract fixture and shared values:

```python
from algorithm_plan_fixtures import requirement, profile, route, source
from app.agent.contracts import CompositionCost
from app.agent.gaps import deterministic_gap_plan
from app.agent.ranking import rank_candidate


def test_unknown_composition_cost_cannot_authorize_promotion():
    req = requirement()
    facts = profile(source(), covered=["save"])
    gaps = deterministic_gap_plan(req, route(), [facts], [rank_candidate(facts, req)])
    assert gaps.composition_cost is None
    known_cost = CompositionCost(local_units=1000, composition_units=500,
                                 evidence_refs=["cost:fixed-estimate"])
    assert known_cost.composition_units < known_cost.local_units
```

For each missing condition, verify the local B plan is retained when viable, or BLOCKED is explicit. Do not construct `RepoSource(commit=None)` in tests: test missing/short commit in raw model payload and expect validation failure. Validate contract before persisting C; invalid contract must not leave a committed C checkpoint.

- [ ] **Step 4: Wire Hybrid once and preserve Shadow.**

Hybrid selection saves query/retrieval/profile evidence, computes provisional route, plans gaps, validates optional composition contract, then atomically persists final route/gaps/contract. Shadow deterministic analysis is recorded separately from Baseline execution context; do not let Shadow profiles drive the Baseline Review policy. Review inputs must match selected sources rather than taking `profiles[0]` blindly.

- [ ] **Step 5: GREEN regression and commit.**

Run gap, hybrid route, integration, default execution and candidate ranking tests. Scope commit to the named production/test files:

```bash
git add backend/app/agent/gaps.py backend/app/agent/routing.py \
  backend/app/agent/integration.py backend/app/agent/orchestrator.py \
  backend/app/jobs/execution.py tests/phase1/test_gap_plan.py \
  tests/phase1/test_hybrid_routing.py
git diff --cached --check
git commit -m "feat: bind local repairs and component promotion to evidence"
```

## Task 4: Component Materialization and Runner-Enforced Read-Only Policy

**Files:** Modify `backend/app/agent/integration.py`, `routing.py`, `jobs/execution.py`, `runner/client.py`, `runner/service.py`, `runner/docker.py`; tests in `test_integration_contract.py`, `test_runner_protocol.py`, `test_runner_commands.py`.

**Interfaces:**
- `prepare_component_workspaces(workspace_id, plan, profiles, allow_local=False) -> list[ComponentWorkspace]`
- `verify_component_workspaces(workspace_id, components) -> None`
- `assert_component_write_allowed(path, components) -> None`
- Runner upload accepts a typed internal workspace policy: mode, writable root `app`, component roles/digests. Policy is stored with upload input hash and fenced by lease generation; changed replay is conflict.

Define the internal Runner policy in `runner/service.py` and validate the same JSON in the client upload protocol. The model cannot supply this policy through its tools:

```python
class ComponentPolicyEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: str = Field(pattern=r"^[a-z][a-z0-9_-]{0,31}$")
    relative_path: str
    tree_digest: str = Field(pattern=r"^[0-9a-f]{64}$")

class ComponentWorkspacePolicy(BaseModel):
    model_config = ConfigDict(extra="forbid")
    mode: Literal["COMPOSITION"] = "COMPOSITION"
    writable_root: Literal["app"] = "app"
    components: list[ComponentPolicyEntry] = Field(min_length=2)
```

Validate `relative_path == "components/" + role` and uniqueness before storing. Keep the legacy upload request valid with no policy for Baseline/A/B/D; a supplied policy is authenticated and included in the replay hash.

- [ ] **Step 1: Write RED for separate extraction and digest preservation.**

```python
import subprocess
from algorithm_plan_fixtures import profile, route
from app.core.types import RepoSource
from app.agent.integration import prepare_component_workspaces, verify_component_workspaces


def test_component_sources_with_same_filename_do_not_overwrite(tmp_path):
    sources = []
    for role in ("records", "search"):
        repo = tmp_path / role
        repo.mkdir()
        subprocess.run(["git", "init", str(repo)], check=True, capture_output=True)
        (repo / "shared.txt").write_text(role)
        subprocess.run(["git", "-C", str(repo), "add", "."], check=True)
        subprocess.run(["git", "-C", str(repo), "-c", "user.name=fixture",
                        "-c", "user.email=fixture@test", "commit", "-m", "fixture"],
                       check=True, capture_output=True)
        sha = subprocess.check_output(["git", "-C", str(repo), "rev-parse", "HEAD"], text=True).strip()
        sources.append(RepoSource(url=str(repo), commit=sha, role=role))
    output = tmp_path / "workspace"
    output.mkdir()
    components = prepare_component_workspaces(str(output), route("COMPOSE_COMPONENTS", sources),
                                             [profile(s) for s in sources], allow_local=True)
    assert (output / "components/records/shared.txt").read_text() == "records"
    assert (output / "components/search/shared.txt").read_text() == "search"
    assert (output / "app").is_dir()
    verify_component_workspaces(str(output), components)
```

Run integration tests; expect missing helper failure.

- [ ] **Step 2: Implement trusted policy and mounts.**

Use safe role names `^[a-z][a-z0-9_-]{0,31}$`, unique paths, safe archive extraction, and the exact uploaded tree digest. Local source paths remain test-only through allow_local. Import policy is frozen at initial Runner upload; derive its constraints from trusted checkpoint values, not repository files.

```python
# For C command execution; ordinary workspaces retain their existing mount.
mounts = [f"{root}:/workspace:ro", f"{root / 'app'}:/workspace/app:rw"]
cwd = "/workspace/app"
```

RPC list/read still uses workspace root. Write/patch/import require a path under app with symlink/ancestor checks. Do not accept arbitrary writable mount paths from the model. Runner re-applies policy after restart and verifies digests after snapshot/import.

- [ ] **Step 3: Add boundary RED tests then GREEN.**

Build on existing RunnerService/ASGITransport fixtures in `test_runner_protocol.py`: upload C policy, attempt write and patch into components (reject), write inside app (accept), attempt changed policy replay (409), restart service and retry forbidden write (reject). Use the fake Docker binary pattern in `test_runner_commands.py` to assert root :ro, app :rw and cwd. Add a real fixed-image check when local image is available proving run_command cannot modify components or parent policy while app writes succeed.

- [ ] **Step 4: Regression and commit.**

Run integration, Runner protocol/commands, source artifact, default execution tests; verify snapshot round-trip matches component digests. Commit only named files including modified tests. Record optional real-image NOT_RUN separately from unit/argv results.

## Task 5: Persist Plans and Deliver Them to the Real Builder

**Files:** Modify `backend/app/jobs/execution.py`, `agent/orchestrator.py`, `jobs/pipeline.py`, `runner/service.py`, `runtime/build.py`; tests in `test_default_execution.py`, `test_candidate_pipeline.py`, `test_build_artifacts.py`.

**Interfaces:**
- `JobExecution.prepare_algorithm_inputs(requirement, route, workspace) -> tuple[list[PackagingPlan], list[ComponentWorkspace]]`
- `builder_payload(requirement, route, checkpoint) -> dict` with requirement, plan, gap_plan, packaging_plans, integration_contract, component_workspaces, manifest_schema.
- RPC root remains job source root; C build contexts resolve beneath app, only final app is packaged as mutable business output. Persist component provenance with the release.

- [ ] **Step 1: Add RED for actual Builder messages.**

Extend existing `test_default_generation_calls_existing_loop_on_a_prepared_scaffold` fixture: freeze mode hybrid, supply valid typed gap/packaging checkpoints, intercept the existing `run_generation` argument `checkpoint.messages[1]`, and assert all named payload keys contain actual plan values. Use the existing FilesRunner fixture, not a mock of `builder_payload` itself. Return a bound GenerationOutput and verify saved plans survive Worker reconstruction.

```python
# Put these assertions in the run_generation interception callback.
initial = json.loads(checkpoint.messages[1]["content"])
assert initial["gap_plan"]["requirement_revision"] == checkpoint.requirement_revision
assert "packaging_plans" in initial
assert "integration_contract" in initial
assert "component_workspaces" in initial
```

Run default execution test and confirm missing payload failure.

- [ ] **Step 2: Implement Hybrid preparation and resume.**

A/B prepare current principal; C uses Task 4 policy/layout; D preserves current scaffold. Persist plan REQUESTED/input before each model/effect and completed output after. Safe packaging edits happen before upload only on matching input, and are not repeated on resume. A may delegate packaging fixes to Builder but cannot change business behavior silently.

C keeps Checkpoint.workspace at RPC root, prompts paths relative to root, executes commands with cwd app, builds under app and snapshots root for evidence checks. Do not merely change CandidateDraft.workspace_id to app while Runner still builds from root. Release stores source commits/component digests and preserves source layout for later ADJUST/COPY.

- [ ] **Step 3: Add RED for bound repair feedback.**

Make the existing default generation test retry after a failed acceptance. Capture the new user message before the model responds. Assert it contains only relevant LOCAL_REPAIR changes, preserve IDs for existing accepted functionality, structured failure stage and actual review/validation references. Inspect the correct captured message, not `messages[-1]` after tools append completion text.

Persist repair_evidence from Pipeline with real findings; do not replace all errors with a generic 'candidate repair required'. On resume reload it and the last HealingDecision before selecting the next attempt. Gate every retry by unchanged requirement/source input.

- [ ] **Step 4: GREEN plus default/recovery/ledger regression.**

Run default execution, candidate pipeline/race, agent loop, build artifacts, copies and ledger tests. Add the C source preservation round-trip for an adjustment so component layout is not lost after first delivery.

- [ ] **Step 5: Scoped commit of the Task 5 files.**

```bash
git add backend/app/jobs/execution.py backend/app/agent/orchestrator.py \
  backend/app/jobs/pipeline.py backend/app/runner/service.py backend/app/runtime/build.py \
  tests/phase1/test_default_execution.py tests/phase1/test_candidate_pipeline.py \
  tests/phase1/test_build_artifacts.py
git diff --cached --check
git commit -m "feat: execute builder plans with durable component provenance"
```

## Task 6: Enforce Packaging, Repair and Integration at Review

**Files:** Modify `backend/app/agent/review.py`, `integration.py`, `orchestrator.py`, `jobs/execution.py`; tests in `test_candidate_review.py`, `test_integration_contract.py`, `test_candidate_pipeline.py`.

**Interfaces:** Extend review_deterministic keyword-only context with gap_plan, packaging_plans, integration_contract, component_workspaces. Preserve all existing callers using None/defaults.

- [ ] **Step 1: Write RED for BLOCKED acceptance.**

```python
from app.agent.contracts import AcceptanceGap, GapPlan
from app.agent.review import review_deterministic
from test_candidate_review import draft, notes_requirement, route


def test_review_blocks_unresolved_gap(tmp_path):
    req = notes_requirement()
    gaps = GapPlan(requirement_revision=req.revision, principal_source=None,
        gaps=[AcceptanceGap(acceptance_id="save-note", status="BLOCKED",
                            capability="persistence", required_changes=[], preserve=[],
                            evidence_refs=[], reason="missing evidence")],
        complete=False, input_digest="a" * 64)
    report = review_deterministic("attempt", draft(tmp_path), req, route(), gap_plan=gaps)
    assert any(f.id == "gap:blocked:save-note" and f.severity == "BLOCKING" for f in report.findings)
```

Run review tests; expect unsupported keyword/missing finding failure.

- [ ] **Step 2: Implement findings from current candidate evidence.**

Stable finding IDs: gap:blocked:<id>, gap:uncovered:<id>, packaging:blocking:<code>, integration:missing-contract, integration:acceptance-unmapped:<id>, integration:component-source-changed, integration:service-owner-mismatch.

Re-analyze final candidate Dockerfile and files after Builder, not only the pre-Builder plans. Keep original findings as history but do not block solved problems forever. LOCAL_REPAIR is allowed to reach business validation when its current implementation/check mapping is present; never claim static mappings prove real success.

IntegrationContract needs an explicit role-to-final-service map validated against selected roles and manifest names. Multiple roles can share one final service if their adapters/data ownership are explicit; multiple sources do not necessarily require multiple containers. Changed tree evidence blocks before build. Preserve existing data-migration proof and access tests.

- [ ] **Step 3: RED/GREEN for packaging solved/unsolved and component ownership.**

Use existing valid IntegrationContract fixture; add invalid owner/missing mapped service/changed source cases. Resolve a packaging finding through Builder-produced Dockerfile and verify it no longer blocks. In `test_candidate_pipeline.py`, use an AsyncMock build and actual Review to prove blocking findings cause zero builds.

- [ ] **Step 4: Regression and scoped commit.**

Run candidate review, LLM review policy, integration, default execution, candidate pipeline and releases. Commit the named files/tests only.

## Task 7: Close Rule Audit with Real Callers and End-to-End Evidence

**Files:** Modify `docs/algorithm/classify-fallback-rule-audit.md`, `tests/phase1/test_classification_rule_audit.py`, `test_default_execution.py`, `test_hybrid_routing.py`.

- [ ] **Step 1: Add RED for unresolved migration decisions and runtime imports.**

```python
import ast
from pathlib import Path


def test_active_algorithms_do_not_import_old_solvers():
    root = Path(__file__).resolve().parents[2]
    for folder in ("agent", "jobs", "runtime"):
        for path in (root / "backend/app" / folder).rglob("*.py"):
            for node in ast.walk(ast.parse(path.read_text())):
                if isinstance(node, ast.ImportFrom):
                    assert not (node.module or "").startswith("fallback.solvers")
                    assert all(alias.name != "classify_fallback_request" for alias in node.names)
                elif isinstance(node, ast.Import):
                    assert all(not alias.name.startswith("fallback.solvers") for alias in node.names)


def test_audit_has_no_unresolved_migrations():
    root = Path(__file__).resolve().parents[2]
    text = (root / "docs/algorithm/classify-fallback-rule-audit.md").read_text()
    assert "| MIGRATE |" not in text
    covered = [line for line in text.splitlines() if "| COVERED |" in line]
    assert covered
    assert all("tests/phase1/" in line and "backend/app/" in line for line in covered)
```

- [ ] **Step 2: Confirm all migration rows have exercised callers.**

Do not mark Packaging rows COVERED merely because plan_packaging unit tests pass. Link Task 5 execution and Task 6 gate tests. Likewise link B→C model-to-route-to-source-to-Builder tests, not only validation helpers. Add one invalid-contract full execution test proving no route C is persisted/no source is uploaded. Add a Baseline/Shadow no-new-effect test and old C/D semantic regression.

- [ ] **Step 3: GREEN and legacy comparison.**

Run audit/default/hybrid-route tests; separately run `fallback/tests/test_classify.py`, `test_dockerfile_reuse_lint.py`, `test_patch_repo_missing_component.py`. Report retained legacy failures honestly if they conflict with approved new safety behavior, with exact rule IDs. Never weaken the new rules to match unsafe historical heuristics.

- [ ] **Step 4: Commit tests and audit table.**

```bash
git add tests/phase1/test_classification_rule_audit.py \
  tests/phase1/test_default_execution.py tests/phase1/test_hybrid_routing.py
git add -f docs/algorithm/classify-fallback-rule-audit.md
git diff --cached --check
git commit -m "test: verify selective algorithm migration through the worker"
```

## Task 8: Final Regression and Delivery Record

**Files:** Modify `docs/一期实施进度.md` only after reading actual verification results.

- [ ] **Step 1: Run all new focused suites and changed existing suites.**

```bash
PYTHONPATH=backend .venv/bin/python -m pytest \
  tests/phase1/test_packaging_plan.py tests/phase1/test_gap_plan.py \
  tests/phase1/test_classification_rule_audit.py tests/phase1/test_default_execution.py \
  tests/phase1/test_integration_contract.py tests/phase1/test_candidate_review.py \
  tests/phase1/test_runner_protocol.py tests/phase1/test_runner_commands.py -q
```

Use a separate controlled test DB if another job is running tests.

- [ ] **Step 2: Run the complete tracked Phase 1 suite on temporary PostgreSQL 17.**

```bash
set -e
verify_container="intellideploy-packaging-verify-$$"
cleanup_verify() { docker rm -f "$verify_container" >/dev/null 2>&1 || true; }
trap cleanup_verify EXIT INT TERM
docker run --rm -d --name "$verify_container" \
  -e POSTGRES_USER=intellideploy -e POSTGRES_PASSWORD=dev-only \
  -e POSTGRES_DB=intellideploy_test -p 127.0.0.1::5432 postgres:17 >/dev/null
for attempt in {1..30}; do
  docker exec "$verify_container" pg_isready -U intellideploy \
    -d intellideploy_test >/dev/null 2>&1 && break
  sleep 1
done
docker exec "$verify_container" pg_isready -U intellideploy -d intellideploy_test
verify_port=$(docker port "$verify_container" 5432/tcp | sed 's/.*://')
verify_url="postgresql+psycopg://intellideploy:dev-only@127.0.0.1:${verify_port}/intellideploy_test"
DATABASE_URL="$verify_url" PYTHONPATH=backend .venv/bin/python \
  -m alembic -c backend/alembic.ini upgrade head
TEST_DATABASE_URL="$verify_url" PYTHONPATH=backend .venv/bin/python \
  -m pytest $(git ls-files 'tests/phase1/test_*.py') -q
```

Capture exit code and final test counts. This test DB may contain concurrently tracked migrations; record exact HEAD and tested paths. New tests must be tracked before this command. No shared persistent DB migrations or cleanup.

- [ ] **Step 3: Static, protocol, and scope verification.**

```bash
uvx ruff check --select F backend/app tests/phase1
npm run api:generate
git diff --exit-code -- packages/api-client/openapi.json packages/api-client/src/generated.ts
git diff --check
git status --short
```

API generation must show zero unrelated/public contract drift. If intended internal changes affect public schema, inspect and include the required generated files rather than hide drift. No frontend behavioral change is planned, so do not rerun all browser suites without a discovered interface impact.

- [ ] **Step 4: Document and commit actual outcome.**

Record packaging allowlist/limits, local preservation, B→C conditions, component policy/mounts, rule status counts, exact test totals, skips and real external NOT_RUN. If any required implementation check fails, fix root cause and rerun only affected checks before final full run; do not mark task complete.

```bash
git add -f docs/一期实施进度.md
git diff --cached --check
git commit -m "docs: record packaging and composition migration verification"
```

Deliver scoped commits, test evidence, unresolved limitations, and preserved WIP paths. Do not promote Hybrid default or perform deployment.

## Spec Coverage and Execution Handoff

| Spec requirement | Tasks |
| --- | --- |
| Legacy rule dispositions and runtime independence | 1, 7 |
| Typed plans and backward-compatible checkpoints | 1 |
| Evidence-prioritized safe packaging and idempotency | 2, 5, 6 |
| Local acceptance repairs and preserved behavior/data | 3, 5, 6 |
| Evidence-gated B→C and complete integration ownership | 3, 6, 7 |
| Namespaced immutable sources and actual write boundary | 4, 5, 6 |
| Durable model/effect recovery and bounded usage | 3, 5, 8 |
| Builder and Review consume plans, not standalone helpers | 5, 6, 7 |
| Baseline/Shadow boundaries and real rollout gates | 3, 5, 7, 8 |

After user confirms this plan, execute inline with `superpowers:executing-plans`; repository instructions rule out the subagent execution option. No product code is changed during plan preparation.
