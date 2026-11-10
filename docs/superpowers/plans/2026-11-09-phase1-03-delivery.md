# Phase 1 Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 验证真实业务、构建不可变版本并部署到 Linux 和 Sealos；修改与故障恢复保留用户数据。

**Architecture:** 实现候选产物验证、固定栈 AppManifest、两种部署及单一发布状态转换。复用现有构建/K8s 中有效部分，Agent 只提供候选代码和清单。

**Tech Stack:** Playwright、Docker/BuildKit、Compose、Kubernetes Python 客户端、SQLAlchemy。

**Spec:** [技术设计](../specs/2026-11-09-intellideploy-phase1-design.md)，[公共接口](2026-11-09-phase1-00-roadmap.md)。依赖 01 和 02。

## Global Constraints

- “完整交付需要核心验收项全部 PASS。”
- “生产私有数据、用户、文件、第三方账号凭据都不复制。”
- “修复胜出后进入同一个状态转换，外层原始异常不能重新覆盖成功状态。”
- 遵守总计划；未提供真实目标不能将 mock 部署算作通过。

### Task 03-D1: 业务验证及证据

**Files:** Create backend/app/runtime/{__init__,validation}.py、tests/phase1/test_validation.py、tests/phase1/fixtures/notes/{app.py,requirements.txt}、tests/phase1/fixtures/notes/checks.py。Modify backend/app/agent/tools.py。

**Interfaces:** validate_application(base_url: str, requirement: Requirement, browser_checks: list[dict]) -> ValidationReport，async。browser_checks 每项为验收项 ID、操作步骤和预期断言；缺少核心 ID 返回 NOT_RUN，不自动删验收项。

- [ ] **Step 1: 写能打开但不能保存的失败检查。** notes fixture 支持故意不持久化的模式，由测试启动子进程并清理；断言刷新/重启后的结果。

```python
@pytest.mark.asyncio
async def test_http_200_does_not_prove_persistence(notes_server):
    req = Requirement(prompt='保存笔记', acceptance=[AcceptanceItem(
        id='persist', action='新增笔记后重启并读取', expected='笔记仍存在')])
    report = await validate_application(notes_server.url, req, notes_server.persistence_checks)
    assert not report.passed
    assert next(c for c in report.checks if c.id == 'persist').status == 'FAIL'
```

- [ ] **Step 2: 红测。** `.venv/bin/python -m pytest tests/phase1/test_validation.py -q`；安装 Playwright Chromium：`.venv/bin/python -m playwright install chromium`。
- [ ] **Step 3: 实现接口和浏览器动作。** 只允许 goto、fill、click、expect_text、expect_count、reload、request 等明确操作；每个断言引用验收 ID。浏览器失败保存截图、DOM 摘要和请求错误；接口失败记录状态与响应片段。

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

- [ ] **Step 4: 绿测。** 同一 fixture 开启持久化后通过；缺测试、错误登录、固定占位响应均失败。截图证据必须与实际执行 ID 对应。
- [ ] **Step 5: 提交。** `feat: validate application behavior and persistence`。

### Task 03-D2: 不可变清单、源码和镜像产物

**Files:** Create backend/app/runtime/manifest.py、backend/app/runtime/build.py、tests/phase1/test_build_artifacts.py。Modify backend/app/core/types.py；复用 backend/app/services/image_builder.py 的上下文过滤和诊断逻辑。

**Interfaces:** BuildSpec(service: str, context: str, dockerfile: str)；AppManifest.builds: list[BuildSpec]；build_release(workspace_id, manifest: AppManifest, operation_id: str) -> AppManifest，async；snapshot_release(workspace_id, manifest, report) -> str。候选 image 可是本地标签，发布 image 必须是实际 digest。

- [ ] **Step 1: 写缺源码和超出单服务范围的检查。** build_executor 是模拟命令返回，仅检查参数和清单替换；真实构建另跑 docker 标记测试。

```python
def test_manifest_rejects_multiple_app_services():
    with pytest.raises(ValueError):
        AppManifest(web_service='web', services=[
            ServiceSpec(name='web', image='web:build'),
            ServiceSpec(name='extra', image='extra:build')])

@pytest.mark.docker
async def test_release_contains_real_digest(sample_workspace, registry):
    result = await build_release(sample_workspace.id, sample_workspace.manifest, 'build-once')
    assert all('@sha256:' in s.image for s in result.services)
```

- [ ] **Step 2: 红测。** test_build_artifacts.py，真实构建测试必须连接配置的专用 builder 和测试 registry。
- [ ] **Step 3: 构建固定 Next.js 应用。** 校验 context/dockerfile 在工作区内；调用独立 builder 的 buildctl，推送配置仓库并读取 metadata 中 digest。固定脚手架构建运行 npm ci、prisma generate 和 next build，Next 配置 output=standalone；镜像包含实际所需 Prisma Client/引擎及静态资源，不能只复制 Next server.js。源码快照排除 .git、缓存、生产数据、运行凭据；记录模板版本、锁文件和内容哈希。

```python
argv = ['buildctl', 'build', '--frontend', 'dockerfile.v0',
        '--local', f'context={context}', '--local', f'dockerfile={dockerfile_dir}',
        '--output', f'type=image,name={image_name},push=true',
        '--metadata-file', str(metadata_file)]
```

不通过 app 容器挂宿主 Docker socket。每个构建 operation_id 保存请求和已完成 digest，重试先核对结果。AppVersion 保存清单、验证和快照路径后不可修改，只创建新版本。

- [ ] **Step 4: 绿测。** 增加 context 越界、secret/data 排除、重复构建动作返回同 digest、推送失败不会生成可发布版本的断言。
- [ ] **Step 5: 提交。** `feat: build immutable Next.js Prisma releases`。

### Task 03-D3: 普通 Linux 发布

**Files:** Create backend/app/runtime/linux.py、infra/linux/Caddyfile.template、tests/phase1/test_linux_deploy.py、scripts/verify_linux_target.py。

**Interfaces:** render_compose(manifest, instance_id, secrets) -> dict；deploy_linux(target_id, instance_id, version_id, manifest, operation_id, requirement) -> DeploymentResult，async。目标登记字段：SSH host、user、受控 key 引用、固定部署根、域名后缀、registry；不把 Key 传模型。

- [ ] **Step 1: 写持久卷和失败发布检查。** ssh_executor 接收 argv/stdin，记录命令；不把用户值直接拼进 shell。

```python
def test_compose_namespaces_data_by_instance():
    one = render_compose(manifest_fixture(), 'instance-a', {})
    two = render_compose(manifest_fixture(), 'instance-b', {})
    assert one['volumes'] != two['volumes']
    assert one['services']['web']['restart'] == 'unless-stopped'
```

manifest_fixture 在测试文件创建有 /data 卷、web 服务的 AppManifest。测试失败部署返回明确异常，旧目录和旧版本仍保留。

- [ ] **Step 2: 红测。** test_linux_deploy.py；真实验证使用 scripts/verify_linux_target.py --target-id 配置目标。
- [ ] **Step 3: 实现目标预检和 Compose。** 预检 Docker/Compose、磁盘、registry 拉取、域名/TLS、资源能力。以 instance_id 生成固定持久卷名；版本目录只放运行配置。Web 服务 memory 限制、healthcheck、实例数据连接与 secret 引用由 AppManifest 转换，避免公开数据库端口。

```python
subprocess.run(['ssh', '-o', 'BatchMode=yes', host, 'python3', remote_script],
               input=json.dumps(deploy_payload), text=True, check=True, timeout=600)
```

remote_script 由平台部署、只接受校验后的 JSON：写版本配置、docker compose pull/up、等待健康、切换反向代理；失败保留旧发布指针，清理新测试容器。Caddy 对实际域名配置 TLS；所有应用路由到不同内部端口或网络，不覆盖其他实例。

- [ ] **Step 4: 绿测及真实部署。** 在已配置服务器写入记录、重启容器、读取记录，保存 URL/镜像 digest/报告；无目标配置时记未执行。
- [ ] **Step 5: 提交。** `feat: deploy releases to existing Linux servers`。

### Task 03-D4: Sealos/Kubernetes 固定栈发布

**Files:** Create backend/app/runtime/kubernetes.py、tests/phase1/test_kubernetes_deploy.py、scripts/verify_kubernetes_target.py。复用 backend/app/services/intellideploy_k8s.py 的 kubeconfig 解析、权限预检和安全上下文。

**Interfaces:** render_resources(manifest, instance_id, namespace, secrets) -> list[dict]；deploy_kubernetes(target_id, instance_id, version_id, manifest, operation_id, requirement) -> DeploymentResult，async。直接 Kubernetes API，不依赖未打包的相邻 skills SDK 目录。

- [ ] **Step 1: 写实例数据连接配置不随版本重建的检查。** 用 Kubernetes fake client 只测资源，不代替真实集群。

```python
def test_resources_keep_instance_secret_name_between_versions():
    a = render_resources(manifest_fixture(), 'i1', 'tenant', {})
    b = render_resources(manifest_fixture(image='web@sha256:2'), 'i1', 'tenant', {})
    secret_a = [x['metadata']['name'] for x in a if x['kind'] == 'Secret']
    secret_b = [x['metadata']['name'] for x in b if x['kind'] == 'Secret']
    assert secret_a and secret_a == secret_b
```

- [ ] **Step 2: 红测。** test_kubernetes_deploy.py。
- [ ] **Step 3: 实现资源渲染和发布。** 一个 Next.js 服务生成 Deployment/Service/Ingress；PostgreSQL 和文件由平台实例数据空间提供，secret 名与数据连接按实例固定，不随版本创建空库。预检 RBAC、存储类、Ingress、registry 拉取与 namespace 限额。server-side apply 标记 operation_id；等待 rollout、检查事件、运行真实 URL 验收。失败不覆盖发布版本；不能只凭创建资源返回成功。

```python
for resource in render_resources(manifest, instance_id, namespace, secrets):
    await apply_resource(resource, field_manager='intellideploy')
await wait_rollout(namespace, instance_id, timeout=300)
report = await validate_application(url, requirement, browser_checks)
if not report.passed:
    raise ReleaseValidationError(report)
```

apply_resource、wait_rollout 在该文件定义；同步 K8s 客户端用 asyncio.to_thread，避免阻塞 API/Worker 的心跳。保存镜像拉取、OOM、探针及入口错误证据。

- [ ] **Step 4: 绿测及真实集群检查。** 验证实例命名隔离、PostgreSQL 数据保留、平台能力接入和权限拒绝。真实 Sealos 使用同一个业务样本写入并重启读取数据，与 Linux 报告对照。
- [ ] **Step 5: 提交。** `feat: deploy Next.js Prisma releases to Kubernetes`。

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
- [ ] **Step 3: 统一状态转换。** 获取应用锁；验证候选核心检查、构建真实 digest、在验证数据空间试运行 Prisma 迁移、保存发布相关恢复材料，正式数据迁移仅执行已验证的 prisma migrate deploy，再执行指定部署器。验证实际访问后在单个事务切换 version、instance 和 Job 终态。修复流程返回新候选后从同一门槛重试，原异常只保留为事件。

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
