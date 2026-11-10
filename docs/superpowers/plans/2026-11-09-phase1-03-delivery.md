# Phase 1 Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 验证真实业务、构建不可变版本并部署到 Linux 和 Sealos；修改与故障恢复保留用户数据。

**Architecture:** 实现候选产物验证、统一 AppManifest、两种部署及单一发布状态转换。复用现有构建/K8s 中有效部分，Agent 只提供候选代码和清单。

**Tech Stack:** Playwright、Docker/BuildKit、Compose、Kubernetes Python 客户端、SQLAlchemy。

**Spec:** [技术设计](../specs/2026-11-09-intellideploy-phase1-design.md)，[公共接口](2026-11-09-phase1-00-roadmap.md)。基础适配依赖01和02；完整pipeline还依赖04能力及06-F1用量，见03-D6/D7。

## Global Constraints

- “完整交付需要核心验收项全部 PASS。”
- “生产私有数据、用户、文件、第三方账号凭据都不复制。”
- “修复胜出后进入同一个状态转换，外层原始异常不能重新覆盖成功状态。”
- 遵守总计划；未提供真实目标不能将 mock 部署算作通过。

### Task 03-D1: 业务验证及证据

**Files:** Create backend/app/runtime/{__init__,validation}.py、tests/phase1/test_validation.py、tests/phase1/fixtures/notes/{app.py,requirements.txt}、tests/phase1/fixtures/notes/checks.py。Modify backend/app/agent/tools.py。

**Interfaces:** validate_application(base_url: str, requirement: Requirement, browser_checks: list[dict], runtime_controller=None) -> ValidationReport，async。browser_checks 每项为验收项 ID、操作步骤和预期断言；缺少核心 ID 返回 NOT_RUN，不自动删验收项。

- [x] **Step 1: 写能打开但不能保存的失败检查。** notes fixture 支持故意不持久化的模式，由测试启动子进程并清理；断言刷新/重启后的结果。

```python
@pytest.mark.asyncio
async def test_http_200_does_not_prove_persistence(notes_server):
    req = Requirement(prompt='保存笔记', acceptance=[AcceptanceItem(
        id='persist', action='新增笔记后重启并读取', expected='笔记仍存在')])
    report = await validate_application(notes_server.url, req, notes_server.persistence_checks)
    assert not report.passed
    assert next(c for c in report.checks if c.id == 'persist').status == 'FAIL'
```

- [x] **Step 2: 红测。** `.venv/bin/python -m pytest tests/phase1/test_validation.py -q`；安装 Playwright Chromium：`.venv/bin/python -m playwright install chromium`。
- [x] **Step 3: 实现接口和浏览器动作。** 只允许 goto、fill、click、expect_text、expect_count、reload、request 等明确操作；每个断言引用验收 ID。浏览器失败保存截图、DOM 摘要和请求错误；接口失败记录状态与响应片段。

```python
for item in requirement.acceptance:
    check = checks_by_id.get(item.id)
    if check is None:
        results.append(CheckResult(id=item.id, status='NOT_RUN', evidence='no check provided'))
        continue
    try:
        await execute_browser_check(page, check)
        results.append(CheckResult(id=item.id, status='PASS', evidence=artifact_path))
    except Exception as exc:
        results.append(CheckResult(id=item.id, status='FAIL', evidence=str(exc)))
```

execute_browser_check 在本模块定义，验证动作参数和 URL 属于当前应用，测试脚本不能要求访问平台管理端。多人隐私测试使用两个独立 browser context，不共享 cookie。测试数据有 test-run 标记，验收结束后清理。工具表增加 run_browser_check，返回验证结果和证据引用；不能由模型降低既定验收项。

- [x] **Step 4: 绿测。** 同一 fixture 开启持久化后通过；缺测试、错误登录、固定占位响应均失败。截图证据必须与实际执行 ID 对应。
- [x] **Step 5: 提交。** `feat: validate application behavior and persistence`。

### Task 03-D2: 不可变清单、源码和镜像产物

**Files:** Create backend/app/runtime/manifest.py、backend/app/runtime/build.py、tests/phase1/test_build_artifacts.py。Modify backend/app/core/types.py；复用 backend/app/services/image_builder.py 的上下文过滤和诊断逻辑。

**Interfaces:** BuildSpec(service: str, context: str, dockerfile: str)；AppManifest.builds: list[BuildSpec]；build_release(workspace_id, manifest: AppManifest, operation_id: str) -> AppManifest，async；snapshot_release(workspace_id, manifest, report) -> str。候选 image 可是本地标签，发布 image 必须是实际 digest。

- [x] **Step 1: 写缺源码和有依赖服务的检查。** build_executor 是模拟命令返回，仅检查参数和清单替换；真实构建另跑 docker 标记测试。

```python
def test_manifest_rejects_dependency_cycle():
    with pytest.raises(ValueError):
        AppManifest(web_service='web', services=[
            ServiceSpec(name='web', image='web:build', depends_on=['api']),
            ServiceSpec(name='api', image='api:build', depends_on=['web'])])

@pytest.mark.docker
async def test_release_contains_real_digest(sample_workspace, registry):
    result = await build_release(sample_workspace.id, sample_workspace.manifest, 'build-once')
    assert all('@sha256:' in s.image for s in result.services)
```

- [x] **Step 2: 红测。** test_build_artifacts.py，真实构建测试必须连接配置的专用 builder 和测试 registry。
- [x] **Step 3: 按服务生成构建操作。** 校验 context/dockerfile 在工作区内；调用独立 builder 的 buildctl，推送配置仓库并读取 metadata 中 digest。已有镜像也解析并固定 digest。源码快照排除 .git、缓存、生产数据、运行凭据；记录来源 commit、锁文件和内容哈希。

```python
argv = ['buildctl', 'build', '--frontend', 'dockerfile.v0',
        '--local', f'context={context}', '--local', f'dockerfile={dockerfile_dir}',
        '--output', f'type=image,name={image_name},push=true',
        '--metadata-file', str(metadata_file)]
```

不通过 app 容器挂宿主 Docker socket。每个构建 operation_id 保存请求和已完成 digest，重试先核对结果。AppVersion 保存清单、验证和快照路径后不可修改，只创建新版本。

- [x] **Step 4: 绿测。** 增加 context 越界、secret/data 排除、重复构建动作返回同 digest、推送失败不会生成可发布版本的断言。
- [x] **Step 5: 提交。** `feat: build immutable multi-service releases`。

### Task 03-D3: 普通 Linux 发布

**Files:** Create backend/app/runtime/linux.py、infra/linux/Caddyfile.template、tests/phase1/test_linux_deploy.py、scripts/verify_linux_target.py。

**Interfaces:** render_compose(manifest, instance_id, secrets) -> dict；deploy_linux(target_id, instance_id, version_id, manifest, operation_id, requirement) -> DeploymentResult，async。目标登记字段：SSH host、user、受控 key 引用、固定部署根、域名后缀、registry；不把 Key 传模型。

- [x] **Step 1: 写持久卷和失败发布检查。** ssh_executor 接收 argv/stdin，记录命令；不把用户值直接拼进 shell。

```python
def test_compose_namespaces_data_by_instance():
    one = render_compose(manifest_fixture(), 'instance-a', {})
    two = render_compose(manifest_fixture(), 'instance-b', {})
    assert one['volumes'] != two['volumes']
    assert one['services']['web']['restart'] == 'unless-stopped'
```

manifest_fixture 在测试文件创建有 /data 卷、web 服务的 AppManifest。测试失败部署返回明确异常，旧目录和旧版本仍保留。

- [x] **Step 2: 红测。** test_linux_deploy.py；真实验证使用 scripts/verify_linux_target.py --target-id 配置目标。
- [x] **Step 3: 实现目标预检和 Compose。** 预检 Docker/Compose、磁盘、registry 拉取、域名/TLS、资源能力。以 instance_id 生成固定持久卷名；版本目录只放运行配置。服务 memory 限制、healthcheck、depends_on、secret 引用由 AppManifest 转换，避免公开数据库端口。

```python
subprocess.run(['ssh', '-o', 'BatchMode=yes', host, 'python3', remote_script],
               input=json.dumps(deploy_payload), text=True, check=True, timeout=600)
```

remote_script 由平台部署、只接受校验后的 JSON：写版本配置、docker compose pull/up、等待健康、切换反向代理；失败保留旧发布指针，清理新测试容器。Caddy 对实际域名配置 TLS；所有应用路由到不同内部端口或网络，不覆盖其他实例。

- [x] **Step 4: 绿测及真实部署。** 在已配置服务器写入记录、重启容器、读取记录，保存 URL/镜像 digest/报告；无目标配置时记未执行。
- [x] **Step 5: 提交。** `feat: deploy releases to existing Linux servers`。

### Task 03-D4: Sealos/Kubernetes 多服务发布

**Files:** Create backend/app/runtime/kubernetes.py、tests/phase1/test_kubernetes_deploy.py、scripts/verify_kubernetes_target.py。复用 backend/app/services/intellideploy_k8s.py 的 kubeconfig 解析、权限预检和安全上下文。

**Interfaces:** render_resources(manifest, instance_id, namespace, secrets) -> list[dict]；deploy_kubernetes(target_id, instance_id, version_id, manifest, operation_id, requirement) -> DeploymentResult，async。直接 Kubernetes API，不依赖未打包的相邻 skills SDK 目录。

- [ ] **Step 1: 写多服务/PVC 不重建检查。** 用 Kubernetes fake client 只测资源，不代替真实集群。

```python
def test_resources_keep_volume_name_between_versions():
    a = render_resources(manifest_fixture(), 'i1', 'tenant', {})
    b = render_resources(manifest_fixture(image='web@sha256:2'), 'i1', 'tenant', {})
    pvc_a = [x['metadata']['name'] for x in a if x['kind'] == 'PersistentVolumeClaim']
    pvc_b = [x['metadata']['name'] for x in b if x['kind'] == 'PersistentVolumeClaim']
    assert pvc_a == pvc_b
```

- [ ] **Step 2: 红测。** test_kubernetes_deploy.py。
- [ ] **Step 3: 实现资源渲染和发布。** 每个服务生成 Deployment/Service，只有 web 入口生成 Ingress；持久卷名按实例固定，secret 按实例范围创建。预检 RBAC、存储类、Ingress、registry 拉取与 namespace 限额。server-side apply 标记 operation_id；等待 rollout、检查事件、运行真实 URL 验收。失败不覆盖发布版本；不能只凭创建资源返回成功。

```python
for resource in render_resources(manifest, instance_id, namespace, secrets):
    await apply_resource(resource, field_manager='intellideploy')
await wait_rollout(namespace, instance_id, timeout=300)
report = await validate_application(url, requirement, browser_checks)
if not report.passed:
    raise ReleaseValidationError(report)
```

apply_resource、wait_rollout 在该文件定义；同步 K8s 客户端用 asyncio.to_thread，避免阻塞 API/Worker 的心跳。保存镜像拉取、OOM、探针及入口错误证据。

- [ ] **Step 4: 绿测及真实集群检查。** 验证命名隔离、持久卷保留、多服务通信和权限拒绝。真实 Sealos 使用同一个业务样本写入并重启读取数据，与 Linux 报告对照。
- [ ] **Step 5: 提交。** `feat: deploy multi-service releases to Kubernetes`。

### Task 03-D5: 发布状态、调整迁移与停止删除

**Files:** Create backend/app/runtime/releases.py、backend/app/runtime/router.py、tests/phase1/test_releases.py。Modify backend/app/jobs/worker.py、backend/app/main.py。

**Interfaces:** publish_candidate(session, job_id, candidate_version_id) -> DeploymentResult，async；stop_instance(session, instance_id, owner_id)；delete_instance(session, instance_id, owner_id, confirmation, delete_data: bool)。删除必须明确 confirmation='DELETE' 和 data 范围。

- [ ] **Step 1: 写自愈状态不反转和迁移保护检查。** fixture 发布器先返回失败证据，再返回通过的 DeploymentResult；当前 active_version 保持到所有检查通过。

```python
@pytest.mark.asyncio
async def test_failed_candidate_keeps_live_version(release_context):
    before = release_context.app.active_version_id
    await release_context.publish_failing_candidate()
    release_context.refresh()
    assert release_context.app.active_version_id == before
    assert release_context.instance.status == 'RUNNING'
    assert release_context.job.status == 'FAILED'
```

- [ ] **Step 2: 红测。** test_releases.py。
- [ ] **Step 3: 统一状态转换。** 获取应用锁；验证03-D6候选报告与固定digest/需求revision一致（不重建未测试镜像），在数据副本试运行迁移、保存发布相关恢复材料，再执行指定部署器。验证实际访问后在单个事务切换 version、instance 和 Job 终态。修复流程返回新候选后从同一门槛重试，原异常只保留为事件。

```python
if not deployment_result.report.passed:
    fail_job(job, 'release verification failed')
    return
app.active_version_id = candidate.id
instance.version_id = candidate.id
instance.status = 'RUNNING'
job.status = 'SUCCEEDED'
```

迁移失败阻止发布；有数据时不可用“重建空数据库”恢复。停止保留卷和数据库；删除校验拥有者、确认字符串和数据选项后按资源记录操作，重复请求返回已删除状态。版本失败不会撤掉已有可用实例。

- [ ] **Step 4: 绿测。** 自愈成功最终状态成功、两次发布动作幂等、迁移后原记录仍在、停止后数据仍在、未确认删除拒绝、其他用户删除拒绝。
- [ ] **Step 5: 提交。** `feat: publish verified versions and preserve instance data`。

### Task 03-D6: 隔离候选运行、自动验证修复与原子发布（P2）

**Files:** Create backend/app/runtime/candidate.py、backend/app/runtime/check_plan.py、backend/app/jobs/pipeline.py、tests/phase1/test_candidate_pipeline.py、tests/phase1/test_live_repair.py。Modify backend/app/runtime/validation.py、backend/app/runtime/build.py、backend/app/runtime/releases.py、backend/app/runtime/linux.py、backend/app/runtime/kubernetes.py、backend/app/agent/loop.py、backend/app/jobs/worker.py、backend/app/core/types.py。依赖02-G2/G4/G6、03-D1/D2、04能力及06-F1；发布接03-D3/D4/D5。本任务是这些模块的集成入口，不能另建第二个Agent。

**Interfaces:** start_candidate(job_id, attempt_id, manifest: AppManifest, requirement: Requirement) -> CandidateRuntime，async；stop_candidate(runtime_id, preserve_evidence=True)，async；compile_browser_checks(requirement, source_tree, model_client) -> list[BrowserCheck]，async；validate_application(base_url, requirement, browser_checks, runtime_controller=None) -> ValidationReport，async；run_pipeline(job_id: str) -> None，async。CandidateRuntime/BrowserCheck在core/types.py定义，candidate_controller在runtime/candidate.py定义，runtime_controller由candidate_controller(runtime_id)取得，提供restart_service(name)及两个隔离test_user身份；pipeline管理phase/预算/锁，run_generation只返回候选；03-D5仅发布已验证相同digest的候选，不再重新生成未测镜像。

- [ ] **Step 1: 写自动失败修复和已验证产物一致性检查。** pipeline_context提供真实小笔记服务、测试隔离runner和固定模型transport，模型第一次写不持久实现，第二次依失败证据修复；真实DeepSeek复测在07-E4。

```python
@pytest.mark.asyncio
async def test_pipeline_repairs_without_manual_start(pipeline_context):
    await run_pipeline(pipeline_context.job_id)
    record = pipeline_context.refresh()
    assert record.job.status == 'SUCCEEDED'
    assert record.attempts[0].report.passed is False
    assert record.attempts[1].report.passed is True
    assert record.deployed_digest == record.attempts[1].manifest_digest

@pytest.mark.asyncio
async def test_live_failure_keeps_old_release(live_context):
    before = live_context.active_version_id
    await live_context.fail_live_check_and_exhaust_repairs()
    assert live_context.active_version_id == before
    assert live_context.old_data_is_readable()
```

- [ ] **Step 2: 红测。** pytest test_candidate_pipeline.py/test_live_repair.py；真实runner缺配置记NOT_RUN，不能以容器连接失败当业务红测。
- [ ] **Step 3: 实现确定的流水线与测试运行环境。** GENERATE/ADJUST依次：冻结需求→检索/路由（ADJUST通常沿用源码，新增功能可检索组件）→run_generation→清单/兼容检查→构建固定digest→启动隔离候选→编译核心检查→执行真实候选验证→准备版本材料→部署到隔离发布槽→线上验证→最终切换入口与发布指针。COPY复用source_version清单与已保存检查，仍创建独立身份/数据、候选和实际URL检查，不重跑生成。Worker process_job直接await run_pipeline；状态和租约继续由01-F2管理。

Candidate runner是独立可信执行节点的控制程序，通过登记的mTLS执行端点接收校验清单。它操作该节点的rootless容器/Compose；管理socket仅控制程序持有，不挂进项目容器。使用job/attempt命名的网络、空数据卷、只限当前任务的能力凭据，真实AI/搜索走平台能力并计入同一job预算。候选入口只给runner和验证浏览器访问，不向用户交付；浏览器同样在隔离节点，不能访问宿主/平台管理网段。依赖按清单启动、健康检查最长180秒；初始化失败返回结构化诊断。每次验证用新test_users，存储加run_id；重启测试通过runtime_controller重启服务并等待健康。未配置持久卷或未运行重启检查的持久化项为NOT_RUN，不凭reload冒充重启。

BrowserCheck每项明确验收item_id、actor=owner/other/anonymous、actions及expected；actions为03-D1允许的goto/fill/click/expect_text/expect_count/reload/request，另加受控restart_service。动作不得改需求清单。编译检查两轮无效即CHECK_PLAN_INVALID；每个核心ID必须有动作和行为断言，任何缺项不通过。动态输入（随机笔记内容、不同用户）检查持久保存、权限及非固定响应；AI/搜索项核对平台CapabilityCall实际成功及来源，不只看页面文字。所有报告绑定requirement_revision/attempt_id/manifest_hash，构建后改源码则重建重测；旧报告不能复用到新digest。

```python
for attempt in range(policy.max_attempts):
    runtime = None
    await check_lease_and_budget(job_id)
    try:
        candidate = await implement_and_build(job_id, attempt)
        runtime = await start_candidate(job_id, candidate.attempt_id,
                                        candidate.manifest, requirement)
        report = await validate_application(runtime.base_url, requirement,
                                            candidate.browser_checks, candidate_controller(runtime.id))
        await persist_attempt(job_id, candidate, report)
        if not report.passed:
            await append_repair_evidence(job_id, report)
            continue
        await publish_verified_candidate(job_id, candidate)
        return
    except RepairableCandidateError as exc:
        await append_repair_evidence(job_id, exc.report)
    finally:
        if runtime is not None:
            await stop_candidate(runtime.id, preserve_evidence=True)
raise PipelineFailure('core checks did not pass')
```

RepairableCandidateError在jobs/pipeline.py定义并携带结构化失败report；构建/候选启动/线上业务检查可修复错误转此类型，publish_verified_candidate先核对/回滚后再抛出它。平台凭据、资源故障和预算暂停分别抛TargetUnavailable/PauseQuota，由run_pipeline外层保存FAILED或PAUSED_QUOTA，不能落入模型修复循环；源码/候选错误才继续attempt。上述implement_and_build、check_lease_and_budget、persist_attempt、append_repair_evidence、publish_verified_candidate全部在jobs/pipeline.py定义并复用已有模块。policy从后端预算配置读，max_attempts初始4（首次+最多3次修复），与02-G4无进展/路线切换规则共用同一个总计数，不能嵌套各重试4次。构建、启动、测试、部署错误保存分类/evidence，Agent仅收到脱敏必要诊断；部署凭据/目标网络故障由控制端有界重试，同错误三次无进展结束，不让模型“修复”平台密钥。FAILED保留证据，用户继续对话可以建立新任务。

发布器两阶段prepare_release→verify_release→activate_release：Linux新web端口/K8s候选Deployment使用发布槽标识，候选Ingress/域名独立，旧入口继续服务；通过后Caddy路由/Service selector切换到新槽，核对入口再提交DB发布指针。ADJUST先在数据副本运行迁移、做回归，再采用短暂维护窗口冻结旧写入，生成恢复材料，执行正式迁移及线上检查；旧/新镜像不能同时无保护写同一升级中的数据。失败恢复原数据和旧入口，通过后解锁写入；恢复无法证实时保留维护状态、明确失败并交管理员，不假称旧应用仍可用。COPY只使用新空数据空间。新功能需要额外配置时用业务追问/平台配置，不把别人的生产凭据复制给候选。

每次外部prepare/migrate/activate保存ReleaseAttempt(operation_id、slot、step、observed_effect)；崩溃后凭外部资源标记/digest/入口与恢复材料核对效果，finish事务前确认仍持有租约和实例锁。取消在安全点中止，若已切换需完成核对或回滚，禁止无条件标CANCELLED并留下未知线上版本。成功只经publish_verified_candidate同一入口写SUCCEEDED。

- [ ] **Step 4: 绿测与真实闭环。** 错误持久化自动修复、漏测试阻止发布、重启检查、两账号隔离、假搜索响应失败、已验证digest一致、部署故障分类、迁移维护/恢复、切换后崩溃核对、取消、所有修复失败无假URL。使用真实DeepSeek让平台从Expo/Web输入笔记需求自动交付，再添加搜索，人工无需启动容器或改源码；验证旧笔记仍在。
- [ ] **Step 5: 提交。** `feat: integrate candidate verification repair and atomic delivery`。

### Task 03-D7: 实例操作、状态核对与周期资源计量（P3）

**Files:** Create backend/app/runtime/operations.py、backend/app/runtime/reconcile.py、backend/app/jobs/maintenance.py、backend/app/billing/metering.py、tests/phase1/test_instance_operations.py、tests/phase1/test_metering_reconcile.py。Modify backend/app/runtime/router.py、backend/app/runtime/linux.py、backend/app/runtime/kubernetes.py、backend/app/apps/models.py、backend/app/jobs/worker.py、backend/app/billing/ledger.py、backend/app/core/types.py、backend/alembic/versions/（唯一head后追加实例操作/采样迁移）。依赖03-D3/D4/D5、06-F1；客户端接入05-W1与07-E2。

**Interfaces:** request_instance_operation(session, instance_id, owner_id, kind, operation_id, delete_data=False) -> InstanceOperation；reconcile_instance(instance_id) -> InstanceSnapshot，async；collect_resource_window(instance_id, window_start, window_end) -> ResourceWindow，async；run_maintenance_once(now) -> None，async。公开GET /api/instances/{id}、POST /api/instances/{id}/start、/stop、DELETE /api/instances/{id}、GET /api/instance-operations/{operation_id}。InstanceOperation独立于生成Job，状态QUEUED/RUNNING/SUCCEEDED/FAILED；生成Job仍只有GENERATE/ADJUST/COPY，避免把管理操作结果伪装DeliveryResult。

- [ ] **Step 1: 写恢复、并发与重复计量检查。** 真实PG记录instance、operation、资源采样；target_adapter可注入故障，真实恢复另在Linux和Sealos验证。

```python
def test_start_is_idempotent_and_keeps_data(instance_context):
    first = instance_context.start('start-once')
    again = instance_context.start('start-once')
    assert first.id == again.id
    instance_context.execute_operations()
    assert instance_context.read_original_note() == 'saved'

def test_same_resource_window_is_charged_once(meter_context):
    meter_context.process_window('2026-11-10T01:00:00Z')
    meter_context.process_window('2026-11-10T01:00:00Z')
    assert meter_context.runtime_entries() == 1
```

- [ ] **Step 2: 红测。** pytest test_instance_operations.py/test_metering_reconcile.py；业务失败不以SSH/集群连接不可用替代。
- [ ] **Step 3: 实现意图与观测分离。** Instance增加desired_state=RUNNING/STOPPED/DELETED、observed_state沿用PENDING/RUNNING/STOPPED/FAILED/DELETED、stop_reason=USER/QUOTA/ERROR|null、observed_at、resource_spec/price_version。status是公开observed_state；公网200并不自动改desired_state。操作以(user,instance,kind,Idempotency-Key)唯一；同键不同payload409。GET只读归属，操作请求202返回id/instance_id/kind/status，执行不在HTTP内阻塞。实例锁与生成/发布使用同一app互斥；正在修改/发布时管理请求409，用户可先取消该任务，取消完成后再操作。

start校验拥有者、已发布版本、未删除、额度与容量；重用固定镜像/卷/账号/URL，预留下一资源窗口，不重新生成源码。已经运行返回已完成幂等操作；首次未交付实例不能start。stop关闭Web/API等计算服务，独立数据库等计算服务也计入停止范围；持久文件/数据保留。delete确认DELETE和delete_data范围后撤入口/凭据/运行资源，保留数据时记录可保留数据资源，仍按明确存储价格计量，不创建新可运行入口；删除未确认404/409按交付协议。启动失败保存状态/原因/诊断，不能返回RUNNING；已删除不能恢复原实例，需创建新实例。

维护任务复用Worker进程的独立async循环，每30秒一个tick，数据库维护租约防止多Worker重复执行；生成并行仍续租。任务包含实例操作认领、真实目标状态采样、托管配额窗口、周期grant、每日索引更新、08-O2清理。每种任务有独立deadline/last_success/retry_after，单个目标故障不阻塞其他目标。异步SSH/K8s操作不持有数据库事务；记录intent后外部执行，回库核对锁版本/操作标记，再更新observed_state；失去租约只核对不重复副作用。

资源窗口以UTC分钟、instance_id、kind唯一，price_version固定在首次建窗记录中；CPU/内存按配置分配量×可证实资源存在时长计算（不伪称实测CPU消耗），所有app依赖服务都计入。存储按登记分配容量×存续时长，与运行状态分开。采样含target/时间/计算/存储状态及证据摘要；网络不可达标UNKNOWN，不假填0，也不直接认定停机。未知窗口保存待核对且不向用户追扣未证明用量；账单标计量待核对，平台承担无法核对部分。每运行窗口先预留上限，结束按证据结算，operation_id=instance:window:kind；状态变化按观测时间拆分，不重叠扣费。价格变更从下一窗口生效，不回写已结算窗口。

```python
window_key = f'{instance.id}:{window_start.isoformat()}:resource'
if observation.compute_state == 'UNKNOWN':
    save_pending_window(window_key, observation)
else:
    reserve_next_window_or_stop(instance)
    settle_observed_window(window_key, observation)
```

save_pending_window/reserve_next_window_or_stop/settle_observed_window在billing/metering.py定义；预留不足记录stop_reason=QUOTA并排入同一实例操作队列，不执行到余额为负。托管计算允许最多一个预先预留的分钟窗口，API/搜索并发也使用同一grant锁，不能各用同一余额。存储欠费只标待续费/限制新增写入，不自动删用户数据；已欠费时不新建计算窗口，存储不足时未预留的保留成本由平台承担并记录未收费成本，后续充值不追扣这段未预留费用；恢复后按新窗口规则计费，不产生负余额。后续长期数据处置留到独立服务规则。一期基本配额采集包含这些规则，不扩展主动运维服务。

- [ ] **Step 4: 绿测和两类目标。** stop→start数据/URL不变、重复start/stop/delete、操作越权、发布与停止互斥、欠费停机保留数据、补额度用户start后恢复、停机不计计算但计存储、跨窗口价格、目标未知待核对、双Worker不重复计量、周期grant/索引任务断点恢复。服务器重启后观察状态与实际一致，不只检查ORM字段。
- [ ] **Step 5: 提交。** `feat: reconcile instance lifecycle and resource billing`。

#### 既有适配的同步要求

03-D1将旧dict检查（id）在入口统一转换BrowserCheck(item_id)，checks_by_id只按item_id索引，验证结果仍CheckResult.id；execute_browser_check显式处理actor和restart_service，无controller时重启类验收NOT_RUN。03-D2的snapshot_release只能创建候选材料引用，未发布版本保留candidate状态；03-D6测试通过后将来源/报告/digest形成不可变AppVersion，运行槽和Activation状态记录在ReleaseAttempt，不改不可变源码和报告。03-D3/D4实现prepare_release/verify_release/activate_release及rollback_release，由03-D5封装；兼容deploy_linux/deploy_kubernetes保留为完整三阶段调用，但pipeline按阶段调用以便恢复。03-D7统一接管03-D5 stop/delete HTTP操作，03-D5保留底层目标动作，避免两个router定义同一路径。

#### 候选和计量类型补充

jobs/pipeline.py定义PipelineCandidate（attempt_id、manifest、manifest_hash、workspace_id、browser_checks），implement_and_build加载冻结Requirement、调用run_generation和build_release，再compile_browser_checks填入该对象；run_pipeline开始从Job.requirement_revision加载requirement和budget policy。runtime/candidate.py定义RuntimeController及candidate_controller，restart_service只接受当前候选清单的服务名；不暴露任意宿主命令。PipelineFailure在pipeline.py定义，所有修复耗尽保存FAILED/失败报告并由finally释放未消费额度；不得把程序异常吞掉后留RUNNING。

ResourceWindow.compute_units为分配CPU/内存时长换算后的资源计费单位，storage_units独立；记录ResourceObservation（target_id/采样时间/每服务资源规格/计算状态/分配存储容量/证据）由runtime/reconcile.py产生，billing/metering.py据相同价格版本换算。缺价格拒绝新增收费执行，UNKNOWN窗口不计假0。reserve_next_window_or_stop、settle_observed_window还传当前价格版本及父Reservation记录，不能仅凭UI字段扣费。

## 实施进度（2026-11-10）

03-D1：新增受控 Playwright 业务验证、同源 URL 限制、actor 隔离 context、验收 ID 完整性与截图/DOM/网络错误证据；服务重启只通过 runtime controller，缺 controller 记 NOT_RUN。易失/持久笔记真实子进程、缺检查、跨域、占位响应、错误身份预期和浏览器工具适配共 8 项通过；完整 phase1 回归 140 项通过、1 项专用沙箱默认跳过。真实候选节点与线上目标未执行。

03-D2：新增工作区内 BuildKit 构建、外部镜像 digest 解析、operation 幂等记录和不可变源码 zip；拒绝路径/operation ID 注入，排除凭据、缓存、运行数据及越界符号链接。构建专项 8 项通过，专用 builder/registry 真实构建 1 项因未配置保持 NOT_RUN；完整 phase1 148 项通过、2 项跳过。未连接任何远程 registry。

03-D3：新增 digest-only Compose 渲染、实例固定卷、数据库非公网暴露、受控 secret file、Linux 目标容量/健康/镜像拉取预检，以及 prepare/validate/activate/rollback 发布适配。SSH 仅使用 argv 与 JSON stdin，固定远程脚本不插入用户值；专项 7 项、完整 phase1 155 项通过。未提供明确 dev/test/boe Linux 目标，真实写入/重启/读取保持 NOT_RUN，未发起远程 SSH。
