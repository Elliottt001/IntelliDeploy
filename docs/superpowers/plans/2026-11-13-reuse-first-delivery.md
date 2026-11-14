# Reuse First Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Repository contract: main, one agent, sequential execution, no worktrees or subagents. Steps use checkbox (`- [x]`) syntax.

**Goal:** 优先交付满足核心用途的官方服务或现成项目，允许小偏差，阻止把A不成立误当成B/C不可行并自动转D。

**Architecture:** 保留当前API/Worker/AlgorithmOrchestrator和A/B/C/D。增加需求交付策略、证据绑定的能力评估、官方入口识别、独立复用决策和外部链接结果；托管部署复用现有Runner与真实验收门禁。

**Tech Stack:** Python3.13、FastAPI、Pydantic2、SQLAlchemy/PostgreSQL、现有HTTP/Playwright/Runner、Node24、Next.js、Expo、生成OpenAPI客户端；不新增Agent运行时或消息队列。

**Spec:** `docs/superpowers/specs/2026-11-13-reuse-first-delivery-design.md`

## Global Constraints

- main、单agent顺序执行，不建工作树、不使用子代理。
- 外部官方服务优先；明确自托管、独立部署或平台管理时选择HOSTED_INSTANCE。
- allow_generation默认false；未明确接受生成不能进入D。
- 旧AcceptanceItem默认CORE；数据隔离、持久性和明确必要功能不可降级。
- 关键词初筛不直接证明业务缺失；UNKNOWN不能当MISSING或复用不可行证据。
- 小偏差可交付但须披露；许可证/数据/权限/URL边界不放宽。
- 官方服务/演示/镜像/脚本必须保留来源，实际交付不能只凭HTTP200或README评分。
- EXTERNAL_LINK不编造实例/版本，不申请平台login code，不进入平台托管成功率。
- 官方脚本不在控制面执行；未知副作用不盲目重放；MAX_JOB_MODEL_CALLS保持40。
- 保留用户社区WIP：backend/alembic/env.py、backend/app/community/models.py、backend/alembic/versions/0014_community_posts.py、scripts/seed_development_content.py、tests/phase1/test_development_content_seed.py；移动端并发修改亦不得覆盖。
- 文档生成阶段不修改产品代码、不调用付费模型、不启动部署。实施时每任务先RED再GREEN，最后统一真实验收。

## File Map and Interface Contract

现有入口：`backend/app/jobs/execution.py`、`backend/app/agent/orchestrator.py`、`backend/app/jobs/pipeline.py`。新增模块只负责一项判断，不复制执行管线。

| 模块 | 职责与接口 |
| --- | --- |
| core/types.py、agent/contracts.py | DeliveryPolicy、CapabilityEvidence、DeploymentAsset、CandidateAssessment、ReuseDecision、DeploymentPlan、ExternalLinkDelivery |
| agent/deployment_assets.py（新） | `discover_deployment_assets(candidate: RetrievalCandidate) -> list[DeploymentAsset]`，只发现来源，不验证服务 |
| agent/assessment.py（新） | `validate_assessment(value, requirement, profile, evidence) -> CandidateAssessment`；`assess_candidates(requirement, candidates, profiles, model) -> list[CandidateAssessment]` |
| agent/reuse.py（新） | `validate_reuse_decision(decision, requirement, assessments) -> ReuseDecision`；`choose_reuse_decision(requirement, assessments, model) -> ReuseDecision` |
| runtime/official_deployment.py（新） | `plan_official_deployment(profile, decision) -> DeploymentPlan`；`execute_official_deployment(execution, plan) -> CandidateDraft` |
| runtime/external_delivery.py（新） | `verify_external_service(requirement, asset, verifier) -> ExternalVerification`；`persist_external_delivery(session, job, delivery, verification)` |
| apps/service.py、jobs/store.py、diagnostics.py | 外部结果归属、幂等、历史展示和分类报告 |
| web/components/DeliveryCard.tsx、frontend/components/DeliveryCard.tsx | 外部直接打开；托管继续走原实例操作 |

固定字段：CapabilityEvidence={acceptance_id,status:SUPPORTED/MISSING/UNKNOWN,evidence_refs,reason}；CandidateAssessment={repo_url,commit,requirement_revision,capabilities,differences,adaptations,route_verdicts}；route_verdicts按A/B/C分别记录ELIGIBLE/INELIGIBLE/UNKNOWN及证据。DeploymentAsset={kind,location,source_ref,source_digest,verification_status}。ReuseDecision={delivery_kind,route,selected_sources,assessment_refs,deployment_asset,differences,adaptations}。未找到方案用显式NoReusableSolution异常承载候选摘要，不制造有效路线。

## Task 1: 需求重要性与交付偏好

**Files:** Modify `backend/app/core/types.py`、`backend/app/agent/requirements.py`、`prompts/generation/requirements.md`；Test `tests/phase1/test_requirement_revision.py`、新`tests/phase1/test_delivery_policy.py`。

**Interfaces:** Requirement.delivery_policy为DeliveryPolicy；AcceptanceItem.importance默认CORE。用户显式策略绑定DemandFact及原消息；平台身份默认只用于要求平台管理的实例。

- [x] 写兼容、官方服务默认、自托管显式、从零生成显式、必要权限不能降级的失败测试。

```python
def test_old_requirement_keeps_core_and_disallows_generation():
    req = Requirement(prompt='私人笔记', acceptance=[{'id':'A1','action':'隔离账号','expected':'不能越权'}])
    assert req.delivery_policy.preference == 'EXISTING_SERVICE_FIRST'
    assert req.delivery_policy.allow_generation is False
    assert req.acceptance[0].importance == 'CORE'
```

- [x] Run `PYTHONPATH=backend .venv/bin/pytest -q tests/phase1/test_delivery_policy.py tests/phase1/test_requirement_revision.py`；先确认新增字段/策略测试RED。
- [x] 实现默认字段；在需求编译/纠正校验中拒绝丢失显式交付策略和把CORE降为PREFERENCE。提示词明确“做一个”不等于“从零生成”。

```python
class DeliveryPolicy(BaseModel):
    preference: Literal['EXISTING_SERVICE_FIRST','SELF_HOSTED'] = 'EXISTING_SERVICE_FIRST'
    allow_generation: bool = False
# Requirement.delivery_policy = Field(default_factory=DeliveryPolicy)
# AcceptanceItem.importance = 'CORE'; validated corrections preserve explicit facts.
```

- [x] 同一命令GREEN；追加中文/英文自托管原句与统一登录适配的编译回归。
- [x] 检查diff后仅提交任务文件：`feat: define reuse first delivery policy`。

## Task 2: 发现官方服务与部署材料

**Files:** Create `backend/app/agent/deployment_assets.py`、`tests/phase1/test_deployment_assets.py`；Modify `backend/app/agent/contracts.py`、`backend/app/agent/profiling.py`。

**Interfaces:** RepositoryProfile.deployment_assets默认空；discover_deployment_assets只读取固定候选key_files和file_tree，无网络副作用。

- [x] 写README官方服务、演示、Compose、Dockerfile、镜像说明、脚本和部署按钮区分的RED。伪造推荐URL与非HTTP协议拒绝。

```python
def test_demo_does_not_become_official_service():
    candidate = RetrievalCandidate(repo_url='https://github.com/example/notes',commit='a'*40,
        key_files={'README.md':'Live demo: https://demo.example/','compose.yml':'services:\n  web:\n    image: example/notes:1'},
        file_tree=['README.md','compose.yml'])
    assets = discover_deployment_assets(candidate)
    assert {x.kind for x in assets} == {'DEMO','COMPOSE'}
    assert all(x.source_ref and x.source_digest for x in assets)
```

- [x] Run `PYTHONPATH=backend .venv/bin/pytest -q tests/phase1/test_deployment_assets.py`；确认RED。
- [x] 结构化解析Markdown链接/Compose/YAML和已知文件位置；URL归类不明确保持未确认，不猜官方服务。脚本只记录位置和摘要。

```python
def discover_deployment_assets(candidate):
    # Parse only supplied bytes. Every emitted asset binds repo_url@commit:path + SHA256.
    # README-labelled demo stays DEMO; install/deploy buttons stay INSTALL_DOC.
    return assets_from_fixed_source(candidate)
```

- [x] 上述`assets_from_fixed_source`作为本模块私有实现，回归新增完整案例；画像测试GREEN。
- [x] Commit `feat: discover evidence bound service and deployment assets`。

## Task 3: 语义能力证据替代关键词缺失判断

**Files:** Create `backend/app/agent/assessment.py`、`tests/phase1/test_reuse_assessment.py`；Modify contracts.py、ranking.py、profiling.py、jobs/execution.py；Test `tests/phase1/test_candidate_ranking.py`。

**Interfaces:** assess_candidates输入冻结需求、前5个相关候选的固定源码和画像、DurableModel；输出逐验收能力与A/B/C独立verdict，引用必须属于传入证据。

- [x] 写“英文auth关键词未匹配中文验收应UNKNOWN而非MISSING”、已有CRUD缺平台SSO可作为主体、伪造引用拒绝、明确权限缺失不能被小差异掩盖的RED。

```python
def test_unknown_feature_is_not_evidence_of_missing_business():
    assessment = CandidateAssessment(repo_url='https://github.com/example/notes',commit='a'*40,
        requirement_revision=1, capabilities=[{'acceptance_id':'A1','status':'UNKNOWN',
        'evidence_refs':[],'reason':'ownership handler not read'}],
        differences=[],adaptations=[],route_verdicts={})
    assert assessment.capabilities[0].status == 'UNKNOWN'
    assert not assessment.rejects_all_reuse()
```

- [x] Run `PYTHONPATH=backend .venv/bin/pytest -q tests/phase1/test_reuse_assessment.py tests/phase1/test_candidate_ranking.py`；确认RED。
- [x] 初筛仅按类别/业务相关性；前5名批量语义评估，UNKNOWN核心能力读取对应文件后一次再评估。使用现有GitHub固定commit获取能力；保留读取范围、摘要、截断状态。

```python
def validate_assessment(value, requirement, profile, evidence):
    assert_binding(value, requirement.revision, profile.repo_url, profile.commit)
    require_exact_acceptance_ids(value, requirement)
    require_real_references(value, evidence)
    preserve_requirement_importance(value, requirement)
    return value
```

- [x] 上述校验函数实现于assessment.py；反例抛ValueError且不填MISSING。新增CandidateAssessment.rejects_all_reuse仅在A/B/C均INELIGIBLE且有独立证据时true。
- [x] 同命令GREEN；Mock外部IO只验证边界，本地源码样本包含实际CRUD/owner过滤文件。
- [x] Commit `fix: separate unknown capabilities from missing business`。

## Task 4: 独立复用决策和D硬门禁

**Files:** Create `backend/app/agent/reuse.py`、`tests/phase1/test_reuse_decision.py`；Modify routing.py、gaps.py、orchestrator.py、jobs/execution.py、jobs/pipeline.py。

**Interfaces:** choose_reuse_decision输出EXTERNAL_LINK或HOSTED_INSTANCE；route字段仅实例需要A/B/C/D。NoReusableSolution含最接近候选和原因，映射WAITING_USER；不开新Agent。

- [x] 写小界面差异不挡A、缺平台SSO不直接D、A不满足但B可用、核心未知不能D、默认无候选不生成、显式允许生成可D的RED。

```python
def test_no_candidates_cannot_silently_generate():
    req = Requirement(prompt='找私人笔记软件',acceptance=[])
    with pytest.raises(NoReusableSolution):
        validate_reuse_decision(ReuseDecision(delivery_kind='HOSTED_INSTANCE',
            route='GENERATE_APP',selected_sources=[],assessment_refs=[]),req,[])
```

- [x] Run `PYTHONPATH=backend .venv/bin/pytest -q tests/phase1/test_reuse_decision.py tests/phase1/test_routes.py tests/phase1/test_default_execution.py`；确认RED。
- [x] 统一Orchestrator调用新判定，两模式均应用产品策略；Baseline用确定性证据/规则，Hybrid增加持久语义分析。不得让普通用户可随意选择算法模式。

```python
if decision.route == 'GENERATE_APP' and not requirement.delivery_policy.allow_generation:
    raise NoReusableSolution(closest_candidates=assessments)
if decision.route == 'DEPLOY_EXISTING':
    require_supported_core(assessment)
    retain_preferences_as_differences(assessment)
# Validate B independently; a missing_core field alone cannot reject B/C.
```

- [x] 最多2轮搜索；失败/限流映射可恢复检索失败而非D；核心UNKNOWN深读后仍未知则返回未确认候选，不用模型编造拒绝证据。
- [x] GREEN；验证Gap规划在主体选择后发生，已满足能力保护不被重新安排为重写。
- [x] Commit `fix: gate generation behind explicit reuse decisions`。

## Task 5: 优先沿用官方部署

**Files:** Create `backend/app/runtime/official_deployment.py`、`tests/phase1/test_official_deployment.py`；Modify jobs/execution.py、jobs/pipeline.py、runner/service.py、runner/runtimes.py、agent/packaging.py。

**Interfaces:** plan_official_deployment(profile,decision)选择已登记asset；execute_official_deployment返回CandidateDraft。IMAGE解析digest，COMPOSE保留服务/卷关系，SCRIPT使用受控Runner执行；无支持方式才SOURCE_BUILD。

- [x] 写有镜像不进入源码Builder、有Compose不重新生成Dockerfile、脚本需宿主特权被拒绝、持久卷不能丢失的RED。

```python
def test_official_compose_wins_over_generated_dockerfile():
    plan = plan_official_deployment(profile_with_compose, hosted_a_decision)
    assert plan.kind == 'COMPOSE'
    assert plan.source_ref.endswith(':compose.yml')
    assert plan.adaptations == []
```

- [x] 上述fixture在tests/phase1/test_official_deployment.py定义：ALLOWED许可证、SUPPORTED运行时、固定commit、核心SUPPORTED、Compose含web和db命名卷。
- [x] Run `PYTHONPATH=backend .venv/bin/pytest -q tests/phase1/test_official_deployment.py tests/phase1/test_runner_protocol.py tests/phase1/test_candidate_pipeline.py`；确认RED。
- [x] 将官方材料翻译成受支持部署计划，保留原材料及摘要；IMAGE走现有解析/启动，COMPOSE审查端口/卷/秘密后受控部署，SCRIPT未知依赖/特权返回UNSUPPORTED。不可用方式不自动启动D。

```python
if plan.kind == 'IMAGE':
    manifest = await resolve_official_image_to_manifest(plan)
elif plan.kind == 'COMPOSE':
    manifest = validated_compose_to_manifest(plan)
elif plan.kind == 'SCRIPT':
    require_runner_supported_script(plan)
# Production validation stays in the existing pipeline; planning never means delivery PASS.
```

- [x] 以上适配函数留在official_deployment.py，使用现有Runner协议而非控制面shell；额外云/特权材料返回明确不支持。
- [ ] GREEN已通过；受控Compose真实卷写入/重启保留验收仍为NOT_RUN，不能用本地回归代替。
- [x] Commit `feat: prefer supported official deployment assets`。

## Task 6: 验证和持久化官方链接交付

**Files:** Create `backend/app/runtime/external_delivery.py`、`tests/phase1/test_external_delivery.py`；Modify core/types.py、jobs/store.py、jobs/pipeline.py、apps/service.py、jobs/diagnostics.py、evaluation/schemas.py。

**Interfaces:** ExternalVerification={service_kind,url,core_checks,source_refs,checked_at,status:PASS/FAIL/NOT_RUN}；DeliveryOutcome为HOSTED_INSTANCE/EXTERNAL_LINK联合类型。现有DeliveryResult默认HOSTED_INSTANCE兼容旧JSON；ResourceRecord登记EXTERNAL_LINK，不新增数据库迁移。

- [x] 写无实例但有真实外部验证可成功、HTTP200无功能证据不能成功、DEMO不能满足私人笔记、外部URL跳转私网被拒绝、旧托管结果仍需真实实例、跨账号记录拒绝的RED。

```python
def test_external_result_never_fabricates_hosted_instance():
    result = ExternalLinkDelivery(app_id='app',job_id='job',url='https://notes.example/',
        repo_url='https://github.com/example/notes',source_ref='repo@commit:README.md',
        summary='官方笔记服务',features=['私人笔记'],differences=[],
        verified_at=utc_now,verification_refs=['verification:job'])
    assert result.kind == 'EXTERNAL_LINK'
    assert 'instance_id' not in result.model_dump()
```

- [x] 测试utc_now固定datetime，真实URL测试通过受控HTTPTransport；不向第三方发送任何平台token/code或真实私人内容。
- [x] Run `PYTHONPATH=backend .venv/bin/pytest -q tests/phase1/test_external_delivery.py tests/phase1/test_evaluation_access.py tests/phase1/test_candidate_pipeline.py`；确认RED。
- [x] 验证官方来源、最终URL、服务入口和核心功能证据，登录/付费障碍用WAITING_USER或推荐结果；NOT_RUN不能终态成功。受控fetch逐跳校验SSRF规则，浏览器独立上下文。

```python
def persist_external_delivery(session, job, delivery, verification):
    require_job_owner_and_lease(job)
    require_bound_core_verification(delivery, verification)
    remember_external_resource_idempotently(session, job, delivery, verification)
    job.result = delivery.model_dump(mode='json')
    job.status = 'SUCCEEDED'
# Commit result/resource/status together; same operation with differing hash refuses mutation.
```

- [x] 私有函数在external_delivery.py实现；store.finish_job分支校验EXTERNAL_LINK记录而非放宽原托管检查。app_detail读取最近成功外部交付，不伪造AppVersion；调整时保留历史链接。
- [x] 费用结算复用原父账本，外部服务不计平台实例托管费用；社区COPY、启停和迁移明确拒绝外部结果。
- [x] GREEN；Commit `feat: deliver verified official services without fake instances`。

## Task 7: 两客户端直接打开外部链接

**Files:** Modify `packages/api-client/openapi.json`、`packages/api-client/src/generated.ts`（生成）、`web/components/DeliveryCard.tsx`、`frontend/components/DeliveryCard.tsx`；Test `packages/api-client/tests/client.test.ts`、新`web/components/DeliveryCard.test.tsx`、新`frontend/tests/external-delivery.test.tsx`。

**Interfaces:** delivery.kind判定；EXTERNAL_LINK直接打开url，HOSTED_INSTANCE仍issueLoginCode。外部卡展示官方来源、差异、验证报告，不展示虚假下载源码/实例启停。

- [x] 写外部打开不调用issueLoginCode、旧托管仍申请code、DEMO不出现成功交付卡的RED。

```typescript
// Use an actual DeliveryCard render with an ExternalLinkDelivery fixture.
await user.click(screen.getByRole('link', {name: '打开官方服务'}));
expect(issueLoginCode).not.toHaveBeenCalled();
expect(screen.getByText('第三方官方服务')).toBeVisible();
```

- [x] Run `npm --workspace web test` 和 `npm --workspace frontend test`，先确认新分支RED；不修改移动Figma并发设计文件。
- [x] `npm run api:generate`；卡片按kind分支：

```typescript
if (delivery.kind === 'EXTERNAL_LINK') {
  // Web: a normal https anchor with rel=noreferrer; Expo: Linking.openURL(delivery.url).
  // No platform callback, login code, instance status or hosted artifact controls.
}
```

- [x] 客户端9项及两端新增测试GREEN；重复生成OpenAPI哈希稳定，TypeScript检查通过。
- [x] Commit `feat: open official service deliveries directly`。

## Task 8: 分类报告与真实复用验收

**Files:** Modify `backend/app/jobs/diagnostics.py`、`backend/app/evaluation/schemas.py`、`scripts/summarize_phase1_evaluations.py`、`scripts/run_phase1_acceptance.py`、`tests/phase1/test_evaluation_access.py`；Create `tests/phase1/test_reuse_acceptance.py`；Update `docs/PRD.md`、`docs/一期实施进度.md`、`docs/algorithm/runtime-issues-2026-11-13.md`。

**Interfaces:** record.delivery_kind、route、core_status、differences、assessment_refs；EXTERNAL_LINK独立统计，不填补A/B/C/D托管成功率或服务器重启实测。NoReusableSolution为未交付，不算模型/部署成功。

- [x] 写“官方链接成功不提高自托管部署成功率”“UNKNOWN不能算免费”“找仓库失败不运行生成器”的RED。

```python
def test_external_link_is_not_hosted_deployment_success():
    report = summarize_reuse_records([
        {'delivery_kind':'EXTERNAL_LINK','status':'SUCCEEDED','route':None},
        {'delivery_kind':'HOSTED_INSTANCE','status':'FAILED','route':'DEPLOY_EXISTING'},
    ])
    assert report['external_link_successes'] == 1
    assert report['hosted_successes'] == 0
```

- [x] summarize_reuse_records实现于`scripts/summarize_phase1_evaluations.py`；既有summarize/summarize_pairs分别过滤交付类型并保留总结果分类。Run `PYTHONPATH=backend .venv/bin/pytest -q tests/phase1/test_reuse_acceptance.py tests/phase1/test_evaluation_access.py`；确认RED→GREEN。
- [x] 静态PRD更新成官方链接/独立实例两种交付，用户登录与平台SSO区别、小偏差规则和D许可保持一致。
- [x] 全量 `PYTHONPATH=backend .venv/bin/pytest -q tests/phase1 --disable-warnings`；两客户端测试/类型检查、`npm run api:generate`、`git diff --check`。通过后不重复宽泛回归，除非代码再次变化。
- [ ] 制作新真实验收记录，使用用户授权凭据与受控Linux目标，禁止强制路线：①普通需求→官方可用服务；②明确独立部署→官方镜像/Compose；③小偏差→不改业务源码；④核心缺口→合理主体B；⑤无合适来源→返回候选而非D。第三方注册/收费需实际用户信息时保持WAITING_USER，不虚构账号或PASS。
- [ ] 对此前19个候选逐个保存人工判断与算法结论，先确认误拒绝原因；再以至少一个实际选中主体完成部署或官方链接交付。没有选中来源/真实验收就不能宣布复用目标完成。
- [x] 更新问题状态：纠正此前RT-09的包装路径推断；写清实际工具路径错误仍属独立运行时缺口。真实托管遇到该错误时记录阻塞，不改本方案范围来掩盖。
- [ ] Commit `test: verify reuse first delivery outcomes`；汇总已执行/NOT_RUN与已知/UNKNOWN费用，Hybrid默认切换另按既有配对门槛验收。

## Plan Self Review and Handoff

- 产品偏好与小差异：Task1/4/7；官方链接和部署入口：Task2/5/6；错误评价与过早D：Task3/4；接口、报告、客户端：Task6/7/8；真实验证：Task8。
- 本计划不恢复旧LangGraph/Celery/fallback运行时，不把D技术栈施加于A/B/C，不修改用户WIP，不把链接结果伪装成平台实例。
- Task1–4优先完成并审阅真实候选评价，随后Task5–8完成端到端交付；任一阶段失败都提供具体证据，不能只堆生成器补丁。
- 实施方式已由仓库约束确定为本agent使用executing-plans顺序执行，不再询问是否使用子代理。用户后续已明确授权按本方案完成代码，直接在main顺序执行，不开subagent。


## 执行记录（2026-11-14）

Task 1–7 已实现并提交：61b51f9、2f44160、ef9ad8a、545dbb9、968432e、b6b6e2e、185a2d9。Task 8 的分类统计和回归实现于b5ea281，真实验收及文档收口继续执行。勾选表示代码/本地步骤已执行；真实Compose持久性与端到端交付须单独核对。

真实试验驱动的范围内补丁：坏引用隔离、Homepage保留、固定真实commit、服务使用许可与源码许可分开、小改造排序、CORE与PREFERENCE后置门禁、来源归档与确认续接。013a2d4把需求审阅限定为需求定义，并限制新入口最多补全5个唯一仓库；6d71c05让源码工具读取algorithm.retrieval，兼容旧检查点，并接受严格绑定的完整源码引用。

完整引用兼容只接受当前仓库、当前commit、已读取文件及匹配原文；不接受其他仓库/commit/未知文件。搜索命中仍全部保留，未深读为UNKNOWN/PARTIAL。MAX_JOB_MODEL_CALLS=40不变。

19个旧候选的逐项核对保存在私有original-19-audit.json，性质是assistant audit，不冒称人工验收。真实结果和剩余NOT_RUN见docs/algorithm/reuse-first-delivery-acceptance-2026-11-14.md。

最终全量（2a54fff）：后端601 passed / 4 skipped；浏览器清理补丁（d6a6e8d）专项12 passed；共享SDK 9、Web 27、Expo116/9跳过；类型检查、OpenAPI重复生成、Web生产构建、外部直接打开Playwright专项1项及范围Ruff均通过。真实外部验收尚未全部满足，保留对应未勾选项。

实际验收接线补充：96cb58a修正“不要求保存”不等于“禁止保存”；be2e24c优先根目录部署文件并允许真实匿名操作处理模型误判的用户操作前置；3c9bdec让有业务证据且无已确认核心缺失的官方候选先做实际验证来核对UNKNOWN访问条件。选择候选不标成功，全部CORE实际检查仍须通过。

最终官方服务交付验收：713d0041-7baa-4516-b61f-0f3339aff719普通API、Baseline、无强制路线，在72.685秒SUCCEEDED；doocs/md官方https://md.doocs.org/三项CORE真实浏览器PASS，外观/可选同步差异不挡交付。满足“至少一个实际选中来源完成官方链接交付”。19候选assistant audit不冒称人类review；受支持官方部署、Compose持久性、B/C完整交付、成功配对仍保持未勾选/NOT_RUN。旧be2e24c Worker抢到部分试跑，JSON已标actual_snapshot_commit，最终成功由单一2a54fff Worker完成。
