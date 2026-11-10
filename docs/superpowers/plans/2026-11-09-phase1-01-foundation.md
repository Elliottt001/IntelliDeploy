# Phase 1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立持久应用、需求、任务、事件与恢复能力，移除 HTTP 请求中的长任务执行。

**Architecture:** 新业务模块复用 SQLAlchemy Base 和现有 User；任务通过 PostgreSQL 租约认领，Worker 与 API 分进程。保留现有认证，按新模型提供应用 API。

**Tech Stack:** Python 3.13、FastAPI、Pydantic、SQLAlchemy、Alembic、PostgreSQL 17、pytest。

**Spec:** [技术设计](../specs/2026-11-09-intellideploy-phase1-design.md)，[公共接口与全局约束](2026-11-09-phase1-00-roadmap.md)。

## Global Constraints

- “默认每个应用只有一个活跃的修改或发布任务。”
- “WAITING_USER、PAUSED_QUOTA、FAILED 是执行状态，不是额外产品路径。”
- “生成和调整任务只有在核心验收通过且对应版本实际发布后才能 SUCCEEDED。”
- 所有任务同时遵守总计划的 Global Constraints；只使用专用测试数据库。

### Task 01-F1: 公共契约、实体和迁移

**Files:** Create backend/app/core/__init__.py、backend/app/core/types.py、backend/app/apps/{__init__,models}.py、backend/app/jobs/{__init__,models}.py、backend/alembic.ini、backend/alembic/env.py、backend/alembic/versions/0001_phase1.py、backend/requirements-dev.txt、backend/.env.example、pytest.ini、infra/compose.dev.yml、tests/phase1/{conftest,test_contracts,test_migrations}.py。Modify backend/requirements.txt、backend/app/config.py、backend/app/database.py、backend/app/models/__init__.py。

**Interfaces:** 产生总计划全部 Pydantic 类型和 JobStatus、InstanceStatus；SQL 实体 App、Conversation、RequirementRecord、AppVersion、Instance、Job、JobEvent、ToolCallRecord。User 保持整数主键，数据迁移不自动删除旧数据。

- [ ] **Step 0: 准备独立测试环境。** 安装 Python 3.13、创建 .venv 并安装现有后端依赖及 pytest、pytest-asyncio、Alembic。先创建本任务的 infra/compose.dev.yml，使用 PostgreSQL 17、本地开发密码和持久卷，主数据库 intellideploy_dev，另创建 intellideploy_test。数据库可用后开始红测，不能把连接失败当业务红测。

```yaml
services:
  postgres:
    image: postgres:17
    environment:
      POSTGRES_USER: intellideploy
      POSTGRES_PASSWORD: dev-only
      POSTGRES_DB: intellideploy_dev
    ports: ['127.0.0.1:55432:5432']
    volumes: ['postgres-data:/var/lib/postgresql/data']
volumes:
  postgres-data: {}
```

```bash
uv python install 3.13
uv venv --python 3.13 .venv
uv pip install --python .venv/bin/python -r backend/requirements.txt pytest pytest-asyncio alembic
docker compose -p intellideploy-dev -f infra/compose.dev.yml up -d postgres
docker compose -p intellideploy-dev -f infra/compose.dev.yml exec -T postgres pg_isready -U intellideploy
docker compose -p intellideploy-dev -f infra/compose.dev.yml exec -T postgres createdb -U intellideploy intellideploy_test
```

createdb 只在第一次执行；重跑先查数据库存在。conftest 从 TEST_DATABASE_URL 读取连接；未设置时只使用上述本地开发配置的 intellideploy_test，核对数据库名后注入 DATABASE_URL，再导入 app。创建依赖和 Compose 属于本任务环境准备，不提前实现业务模型。


- [ ] **Step 1: 添加契约和迁移失败检查。** conftest 在导入 app 前插入仓库根和 backend 到 sys.path，设置 DATABASE_URL；pg_session 连接 TEST_DATABASE_URL，只接受数据库名 intellideploy_test，并为每个测试回滚事务。运行迁移测试时另外创建临时 schema，不改现有 SQLite。

```python
import pytest
from app.core.types import AppManifest, ServiceSpec, ValidationReport

def test_empty_report_cannot_pass():
    assert not ValidationReport(checks=[]).passed

def test_manifest_rejects_missing_web_service():
    with pytest.raises(ValueError):
        AppManifest(web_service='web', services=[ServiceSpec(name='api', image='api@sha256:1')])

def test_schema_contains_recovery_columns(pg_session):
    from sqlalchemy import inspect
    names = {x['name'] for x in inspect(pg_session.bind).get_columns('jobs')}
    assert {'lease_owner', 'lease_until', 'checkpoint', 'operation_id'} <= names
```

- [ ] **Step 2: 运行红测。** `.venv/bin/python -m pytest tests/phase1/test_contracts.py tests/phase1/test_migrations.py -q`。首次应因新模型/迁移不存在失败。
- [ ] **Step 3: 定义公共类型并实现实体迁移。** 复制总计划的类型，增加 AppManifest 校验：服务名唯一、入口存在、依赖存在且无环、端口 1..65535、内存为正整数、卷挂载为绝对容器路径、镜像引用非空；拒绝路径穿越和保留挂载目录。SQL 表最低字段如下，JSON 使用 PostgreSQL JSONB；时间使用带时区 datetime。

```python
class Job(Base):
    __tablename__ = 'jobs'
    id = Column(String, primary_key=True)
    app_id = Column(String, ForeignKey('apps.id'), nullable=False)
    operation_id = Column(String, unique=True, nullable=False)
    kind = Column(String, nullable=False)
    status = Column(String, nullable=False)
    phase = Column(String, nullable=False)
    lease_owner = Column(String)
    lease_until = Column(DateTime(timezone=True))
    checkpoint = Column(JSONB, nullable=False, default=dict)
    budget_units = Column(BigInteger, nullable=False)
    used_units = Column(BigInteger, nullable=False, default=0)
    error = Column(Text)
```

新增字符串 UUID 主键用 default=lambda: str(uuid.uuid4())。App 有 owner_id、prompt、active_version_id 和 nullable source_version_id；Conversation 有 app_id 和按顺序追加的消息；RequirementRecord 保存 revision 和验收项；AppVersion 保存 sources、template_version、manifest、validation、artifact_path、immutable 标记；Instance 保存 owner_id、app_id、version_id、target_id、status、url、data_namespace、secret_ref；JobEvent 用自增 ID；ToolCallRecord 对 (job_id, call_id) 唯一，保存 STARTED/COMPLETED/UNKNOWN、输入摘要、结果及用量。对 QUEUED/RUNNING/WAITING_USER/PAUSED_QUOTA 的 app_id 建部分唯一索引。

Alembic 0001 在新 PostgreSQL 建 User 和新表，正式启动不调用 create_all。保留 SQLite URL 仅给旧只读迁移脚本；新 Worker 拒绝 SQLite。开发 Compose 只启动带持久卷的 PostgreSQL 17，创建独立 dev/test 数据库；测试 URL 不指向生产库。dev 依赖包含 pytest、pytest-asyncio、Alembic 和后续 Playwright；pytest.ini 设置 asyncio_mode=auto、testpaths=tests/phase1，登记 real/sandbox/docker 标记；有效旧测试可按显式路径运行。backend/.env.example 只列配置键与开发默认值，不含实际凭据。移除 LangGraph 的动作留到引用清理时。

配置读取固定到 backend/.env 的绝对路径，不依赖启动目录。依次完成 core/types.py、apps/models.py、jobs/models.py、Alembic revision、配置与测试 fixture 六个小改动，每个改动后检查对应导入或迁移，再运行整体绿测。

- [ ] **Step 4: 绿测及迁移回退检查。** 新库 upgrade head 后通过；仅在临时 schema 验证 downgrade/upgrade，再运行契约测试。保留迁移输出但不记录凭据。
- [ ] **Step 5: 提交本任务文件。** `git diff --check`；提交 `feat: add phase one contracts and migrations`。

### Task 01-F2: 任务租约、恢复与事件

**Files:** Create backend/app/jobs/store.py、backend/app/jobs/events.py、backend/app/jobs/worker.py、tests/phase1/test_jobs.py。Modify backend/app/config.py。

**Interfaces:** claim_job(session, worker_id: str, lease_seconds: int = 60) -> Job | None；heartbeat(session, job_id, worker_id)；save_checkpoint(session, job_id, worker_id, Checkpoint)；append_event(session, job_id, kind, public_payload) -> int；events_after(session, job_id, after_id) -> list[JobEvent]。Worker 入口 `python -m app.jobs.worker`。

- [ ] **Step 1: 写真实并发与恢复检查。** job_factory 为专用测试库创建 App、Job 并提交；两次 claim 使用独立连接。

```python
def test_two_workers_never_claim_same_job(job_factory, session_factory):
    job = job_factory()
    with session_factory() as a, session_factory() as b:
        first = claim_job(a, 'worker-a')
        second = claim_job(b, 'worker-b')
        assert first.id == job.id
        assert second is None

def test_expired_lease_preserves_checkpoint(job_factory, session_factory):
    job = job_factory(checkpoint={'messages': [{'role': 'user', 'content': '继续'}]}, expired=True)
    with session_factory() as s:
        recovered = claim_job(s, 'replacement')
        assert recovered.id == job.id
        assert recovered.checkpoint['messages'][0]['content'] == '继续'
```

- [ ] **Step 2: 红测。** `.venv/bin/python -m pytest tests/phase1/test_jobs.py -q`。
- [ ] **Step 3: 实现认领与权限检查。** 使用 PostgreSQL 时间计算，事务内更新状态和租约；save_checkpoint/heartbeat 只允许当前有效 lease_owner。恢复只认领 QUEUED 或租约过期的 RUNNING，不自动重启 WAITING_USER、PAUSED_QUOTA 或终态。

```sql
WITH candidate AS (
 SELECT id FROM jobs
 WHERE status = 'QUEUED'
    OR (status = 'RUNNING' AND lease_until < now())
 ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1
)
UPDATE jobs SET status='RUNNING', lease_owner=:worker,
 lease_until=now()+make_interval(secs=>:seconds)
WHERE id=(SELECT id FROM candidate) RETURNING *;
```

Worker 10 秒续约，正常无任务等待 1 秒；执行器作为明确的 async process_job(job_id) 回调，在 02-G4/03-D5 接入。SIGTERM 保存检查点并释放或到期租约；取消任务保留事件。JobEvent.public_payload 只含业务状态、消息和用量，不含思考文本、Key 或原始工具日志。

- [ ] **Step 4: 绿测。** 增加失去租约后禁止写入、事件 ID 补读、终态不重领三项断言，运行同一测试文件。
- [ ] **Step 5: 提交。** `feat: persist job leases checkpoints and events`。

### Task 01-F3: 应用 API、消息续接和 SSE

**Files:** Create backend/app/apps/service.py、backend/app/apps/router.py、backend/app/jobs/router.py、tests/phase1/test_apps_api.py。Modify backend/app/main.py、backend/app/config.py。

**Interfaces:** create_app(session, owner_id, prompt, operation_id, budget_units) -> (App, Job)；add_message(session, app_id, owner_id, content, operation_id) -> Job；GET /api/jobs/{id}/events?after_id=；GET /api/apps/{id} 返回持久状态。

- [ ] **Step 1: 写认证、幂等和续接检查。** api_client 使用专用库及 User fixture；请求头 Idempotency-Key 保存为 operation_id。

```python
def test_create_is_idempotent(api_client, owner_headers):
    headers = {**owner_headers, 'Idempotency-Key': 'create-once'}
    one = api_client.post('/api/apps', json={'prompt': '梦境记录', 'budget_units': 100}, headers=headers)
    two = api_client.post('/api/apps', json={'prompt': '梦境记录', 'budget_units': 100}, headers=headers)
    assert one.status_code == two.status_code == 201
    assert one.json()['app_id'] == two.json()['app_id']

def test_other_user_cannot_read_app(api_client, app_record, other_headers):
    assert api_client.get(f'/api/apps/{app_record.id}', headers=other_headers).status_code == 404
```

- [ ] **Step 2: 红测。** `.venv/bin/python -m pytest tests/phase1/test_apps_api.py -q`。
- [ ] **Step 3: 实现事务内创建和访问控制。** create_app 在同一事务建立 App、Conversation、Job；相同用户和请求键返回原结果，其他用户不能用同键访问。add_message 追加消息；有活跃任务时不创建第二个修改任务，WAITING_USER 时恢复原任务，成功或失败任务后的调整创建新 Job。确认旧 SQLite User schema 后，认证继续使用现有 security.py；main 默认只挂载认证和新应用/任务路由，旧部署入口在 06-F4 审计后退休。

```python
def encode_event(event) -> str:
    payload = json.dumps(event.public_payload, ensure_ascii=False)
    return f'id: {event.id}\nevent: {event.kind}\ndata: {payload}\n\n'
```

SSE 先验证归属，从 Last-Event-ID 或 after_id 恢复，以数据库 ID 补发；无新事件发送心跳，客户端断线结束查询。设置响应缓存禁用。服务启动检查迁移版本，不自动 ALTER 或 create_all。

- [ ] **Step 4: 绿测。** 补充 SSE 补发只返回 ID 大于游标的事件、刷新读到原任务、业务补充恢复而非新建任务，以及未登录创建返回 401 的检查。
- [ ] **Step 5: 提交。** `feat: add persistent app conversations and event stream`。

## 本计划完成条件

新库迁移可复现；两个 Worker 不同时认领；事件可补读；应用访问有归属检查；HTTP 创建请求不执行模型或构建；旧数据库未被清空。此时可以独立测试状态系统，尚不能声明应用已生成。
