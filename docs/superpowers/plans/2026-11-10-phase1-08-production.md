# Phase 1 Platform Production and Maintenance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将IntelliDeploy平台自身部署为可恢复的服务，提供基本管理与安全资源清理。

**Architecture:** Web/API/Worker和维护循环沿用同一产品仓库；PostgreSQL保存状态，独立执行节点承载项目代码与构建。先用管理CLI和结构化日志管理目标/价格/权限，不建设大型后台。

**Tech Stack:** Docker Compose、Caddy、PostgreSQL、FastAPI、Next.js、Python标准库argparse/logging、现有SSH/Kubernetes适配。

**Spec:** [技术设计](../specs/2026-11-09-intellideploy-phase1-design.md)、[总计划](2026-11-09-phase1-00-roadmap.md)、[交付协议](../../一期交付与测试说明.md)。依赖01、07-E1；真实运行依赖03-D6/D7、06账本，最终并入06-F4。

## Global Constraints

- 平台托管在已经准备的服务器；不购买或开通新云资源。
- 项目执行/构建节点与平台控制面隔离；项目容器和模型不持有控制面数据库、云部署凭据或管理socket。
- 清理不能删除当前版本、活跃/可恢复任务、社区引用版本或用户持久数据。
- 本计划是一期基本运行底座；主动运维保障、长期维护服务与创作者变现仍属二期。

### Task 08-O1: 平台生产发布、管理CLI与可观察状态（P5）

**Files:** Create infra/platform/{compose.prod.yml,Caddyfile,Dockerfile.api,Dockerfile.web}、infra/executor/compose.yml、backend/app/admin/{__init__,cli,service}.py、backend/app/core/health.py、tests/phase1/test_platform_admin.py、tests/phase1/test_platform_health.py、scripts/verify_platform_production.py、docs/平台上线运行指南.md。Modify backend/app/main.py、backend/app/config.py、backend/app/jobs/worker.py、backend/app/jobs/maintenance.py、backend/app/models/user.py、backend/app/runtime/models.py（消费01-F1基本实体及03资源登记）、backend/alembic/versions/（只有新增管理字段时从唯一head追加，DeploymentTarget基础表由01-F1建立）、.github/workflows/phase1-ci.yml、README.md。User.is_developer沿用07-E3迁移，不重复加列。

**Interfaces:** admin CLI子命令targets add/check/list/disable、prices import/list、users developer grant/revoke、jobs inspect、maintenance status/run-once；GET /health/live、GET /health/ready。DeploymentTarget保存id/kind/enabled/health/architecture/capacity/domain_suffix/secret_ref，不存明文Key；管理CLI通过平台服务器权限运行，无公开无鉴权admin API。维护租约接口复用03-D7。

- [x] **Step 1: 写权限和健康检查。** admin_context使用专用PG和test-only secret ref；API检查不能依赖真实DeepSeek或支付可用。

```python
def test_register_cannot_grant_developer(api_client):
    response = api_client.post('/auth/register', json={
        'username': 'visitor', 'email': 'visitor@example.test',
        'password': 'test-password', 'is_developer': True})
    assert response.status_code == 422

def test_ready_fails_when_schema_is_behind(health_context):
    health_context.set_migration_behind()
    assert health_context.get('/health/ready').status_code == 503
```

- [x] **Step 2: 红测。** pytest test_platform_admin.py/test_platform_health.py；Docker compose config先通过，开发服务配置不得指生产库。
- [x] **Step 3: 实现平台发布及最小管理。** compose.prod包括postgres、api、worker、web、caddy；API/Worker用同一锁定Python依赖镜像，Worker运行jobs.worker并包含03-D7维护循环。Web实际Next服务端承载SSR/BFF，不用静态导出代替。PostgreSQL、源码产物、文件、索引和必要恢复材料使用持久卷或登记持久存储；api/worker共享受限产物存储，不把控制面数据卷挂给项目代码。API/数据库内网访问，Caddy公开平台Web、/docs按生产配置、原生API域名和能力路由，TLS来源/证书续期写指南；SSE禁缓存、代理不截断长连接。控制面及能力API域名与生成应用域名分开，不混用session cookie。

执行节点预先安装03-D6可信runner、独立builder、受限容器网络及mTLS；infra/executor/compose.yml只描述这些基础服务，不包含真实凭据。runner验证URL/DNS解析结果与目的地址、禁止控制面私网/metadata/loopback访问，必要平台能力仅通过带任务凭据的允许代理；每个请求复核，不能靠文档声称隔离。控制面登记EXECUTOR_URL和证书路径引用；health/ready校验数据库迁移及持久存储可用，Worker/执行节点健康由管理员status单独看，模型限流不把整个平台API变为不可访问。

生产发布先取平台控制面DB/文件必要备份，停新任务认领并等待已认领任务完成或保存安全检查点，再执行唯一Alembic head迁移；启动新API/Worker/Web，verify生产入口、队列恢复和应用访问。不在每次启动create_all。仅代码兼容时回退镜像；不兼容DB迁移需按备份恢复流程处理，避免声称随意降级能恢复。Linux控制面是首个发行目标；用户应用仍有Linux与Sealos两个部署器，无须为平台自身再建设一套多云采购服务。

```bash
docker compose -p intellideploy-platform -f infra/platform/compose.prod.yml config
docker compose -p intellideploy-platform -f infra/platform/compose.prod.yml run --rm api python -m alembic -c /app/backend/alembic.ini upgrade head
docker compose -p intellideploy-platform -f infra/platform/compose.prod.yml up -d
PYTHONPATH=backend .venv/bin/python scripts/verify_platform_production.py --base-url https://platform.example
```

脚本中的域名由实际配置替换，verify只打印脱敏状态，不输出token。Docker工作目录/PYTHONPATH固定：镜像/app，Python模块/app/backend。指南给出完整.env.example键、卷/证书路径、registry登录方式、迁移和四个真实验证入口；不能把这段示例当已部署。

CLI使用argparse：targets add --id --kind linux|kubernetes --config-file、targets check --id、targets disable --id；config-file中敏感内容改为权限受限文件的secret_ref，输出只列id/kind/health/capacity。prices import --file验证整数比例/版本/SKU/币种，已有账单版本不可覆写；users developer grant --user-id复用07-E3字段并写AdminAudit；jobs inspect --id输出脱敏阶段/错误/证据引用，不能在终态直接改status=SUCCEEDED；maintenance run-once调用相同租约tick，不绕过幂等计量。用户kubeconfig旧字段不再用来提供托管目标，平台目标属于管理员配置。

日志统一JSON包含request_id/job_id/instance_id/operation_id/phase/error_code/耗时；Key、cookie、私人内容和模型思考不打印。stdout轮转保留7天，任务证据存有权限的产物目录，管理员能查模型/构建/验证/部署/计费的具体失败分类。基本平台数据备份和发布恢复属于一期自有平台运行，客户应用主动备份恢复服务仍在二期。

- [ ] **Step 4: 绿测及真实发布演练。** 注册不能提升权限、停用目标不被新任务选择、价格版本不可改历史、secret不进入日志、health schema检查；平台服务器重启后API可访问、Worker租约恢复、原任务/报告/额度仍在；在执行节点测试阻止控制面/metadata访问并允许登记能力代理；Linux/Sealos原应用地址仍可用。CI以fixture验证配置与业务；真实演练记录环境及证据，缺服务器为NOT_RUN。
- [x] **Step 5: 提交。** `feat: deploy platform services and expose basic administration`。

实施记录（2026-11-12）：生产Compose、执行节点Compose、管理CLI、live/ready、白名单JSON日志、drain/恢复和只读生产验证脚本已实现；两份Compose配置、API/Web/runner镜像及隔离PG17/API/Next fixture smoke通过。完整Phase 1后端回归为307 passed / 3 skipped，Web/Expo两套浏览器回归为27/12 passed。平台服务器、真实域名/证书、可信runner节点、重启后队列/数据恢复及Linux/Sealos存量地址复核尚无受控资源，Step 4真实发布演练保持NOT_RUN，不能由本机镜像或fixture替代。

### Task 08-O2: 可恢复任务及产物的保留与资源清理（P5）

**Files:** Create backend/app/runtime/cleanup.py、tests/phase1/test_resource_cleanup.py。Modify backend/app/jobs/maintenance.py、backend/app/runtime/models.py、backend/app/runtime/candidate.py、backend/app/runtime/releases.py、backend/app/runtime/operations.py、backend/app/admin/cli.py、backend/app/config.py。

**Interfaces:** plan_cleanup(session, now) -> list[CleanupAction]；execute_cleanup(action_id: str) -> None，async；protected_resource_ids(session) -> set[str]。ResourceRecord保存id/type/target_id/app_id/job_id/version_id/operation_id/state/created_at/last_seen_at；CleanupAction保存资源/理由/状态，Unique(resource_id,action_kind)，ResourceRecord基础表由01-F1建立，本任务在runtime/models.py追加CleanupAction并迁移；不是遍历宿主路径按时间盲删。

- [x] **Step 1: 写保留与并发检查。** cleanup_context在PG建立active/candidate/publication/copy/paused各引用和过期废弃容器；磁盘资源用tmp_path，远程删除用Fake target。

```python
def test_cleanup_protects_paused_job_and_publication(cleanup_context):
    actions = plan_cleanup(cleanup_context.session, cleanup_context.now)
    chosen = {a.resource_id for a in actions}
    assert cleanup_context.paused_workspace not in chosen
    assert cleanup_context.published_version not in chosen
    assert cleanup_context.orphan_container in chosen

def test_new_reference_cancels_preplanned_cleanup(cleanup_context):
    action = cleanup_context.plan_orphan()
    cleanup_context.attach_version_reference(action.resource_id)
    cleanup_context.execute(action.id)
    assert cleanup_context.resource_exists(action.resource_id)
```

- [x] **Step 2: 红测。** pytest test_resource_cleanup.py；不可连接真实用户资源执行测试删除。
- [x] **Step 3: 实现引用保护及两阶段清理。** 每日维护tick调用plan_cleanup，再execute；管理员cleanup plan/run可调用同一入口。保护：全部QUEUED/RUNNING/WAITING_USER/PAUSED_QUOTA任务的工作区/检查点/恢复材料；App.active_version、当前/候选实例和ReleaseAttempt未完成槽；可见Publication及副本source_version；用户所有尚可下载的AppVersion源码/报告和登记持久数据。项目自身没有确认delete_data，不删数据库/文件/PVC；未来版本历史清理另行定义，第一版保留用户版本，不因“非active”自动删。

失败终态工作区保留7天；所有终态任务的简明报告/证据保留30天且用户AppVersion关联证据仍保护；STOPPED实例配置/卷继续保留。完成或失败的未引用临时候选容器至少静置1小时；缓存镜像/无引用临时产物7天清理。重试/WAITING_USER/额度暂停无自动到期删除，资源上限由平台配额限制并告知用户取消，不删除后声称可恢复。保留时间是初始可配置运行参数，容量不足拒绝新任务并提示平台排队/暂不可用，不抢删被保护材料。

执行前再次锁ResourceRecord并查询保护引用，确认远端资源的instance/job标签和operation_id匹配，先mark DELETING提交，外部删除后核对不存在再mark DELETED。远端失联标UNKNOWN重试，不直接从库删记录；路径删除仅在登记根目录内，拒绝符号链接穿越。清理镜像前遍历所有已登记运行/候选/版本引用；registry全局GC不开启，初期只清可证实归本平台的无引用缓存。管理员不得以cleanup工具绕过用户数据删除确认。

```python
if action.resource_id in protected_resource_ids(session):
    action.status = 'CANCELLED'
    return
mark_deleting_and_commit(action)
await remove_labeled_resource(action)
await confirm_absent_and_finish(action)
```

mark_deleting_and_commit/remove_labeled_resource/confirm_absent_and_finish在runtime/cleanup.py定义，按资源type调用candidate/target/storage适配；返回完整审计，不记录内容或凭据。对象建立时立即写ResourceRecord，崩溃落下的无记录资源仅管理员核对归属后导入清理，不能随意删除服务器上其他服务。

- [x] **Step 4: 绿测与隔离环境演练。** 活跃/暂停/社区/版本引用保护、用户数据保留、新引用阻止旧清理、重复删除幂等、Worker死于mark/远程删除之间可恢复、远端失联UNKNOWN、其他项目资源不删。实例delete_data=true后仅对应已确认范围由03-D7操作清理，不顺带删除共用资源。
- [x] **Step 5: 提交。** `feat: clean orphan resources while protecting recoverable work`。

实施记录（2026-11-12）：资源在工作区、执行容器、候选容器和验证证据创建时登记；清理先生成唯一动作，执行前重新锁定并复核引用与归属标签。活跃/暂停任务、公开版本/副本来源、当前与候选实例、用户版本和持久数据均受保护；本地路径限制在登记根目录且拒绝符号链接穿越，远端不确定标UNKNOWN并在重试时先inspect。隔离测试覆盖新引用取消、幂等删除、崩溃恢复、daemon/远端故障、其他项目归属拒绝和容量不足不抢删已有工作区；未对任何真实用户资源执行测试删除。
