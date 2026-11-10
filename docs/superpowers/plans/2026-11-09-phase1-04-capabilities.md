# Phase 1 Platform Capabilities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为生成应用提供可信身份、独立持久数据、文件、DeepSeek AI 和联网搜索，并确定调用付费方。

**Architecture:** 能力首先是 FastAPI 后端模块，应用用实例范围的访问凭据和平台用户身份调用。模型 Key、数据管理凭据和额度扣费决定留在平台。

**Tech Stack:** FastAPI、JWT/cryptography、PostgreSQL、文件持久卷、httpx、OpenAI SDK。

**Spec:** [技术设计](../specs/2026-11-09-intellideploy-phase1-design.md)，[公共接口](2026-11-09-phase1-00-roadmap.md)。依赖 01；03 使用此能力部署，06-F1 提供账本回调。

## Global Constraints

- “实例之间默认不共享数据。”
- “平台共享的 DeepSeek Key 留在能力模块。”
- “网关登录不能代替应用内部的数据隔离。”
- 遵守总计划；不把 test-only token 或公用管理员凭据放进应用。

### Task 04-C1: 平台身份与可信能力上下文

**Files:** Create backend/app/capabilities/{__init__,identity,models,router}.py、backend/alembic/versions/0006_app_login_codes.py、tests/phase1/test_capability_identity.py；为生成应用创建 fallback/templates/common/platform_identity.py.template。Modify backend/app/main.py、backend/app/config.py。

**Interfaces:** POST /api/instances/{id}/login-code 消费 callback、返回 code/expires_in，应用服务端 POST /api/capabilities/identity/exchange 消费 code/instance_token，返回限定应用身份；同交付说明。issue_app_identity(user_id: int, app_id: str, instance_id: str) -> str；verify_app_identity(token: str, app_id, instance_id) -> int；resolve_context(session, instance_id, user_token, instance_token) -> CapabilityContext。共享策略尚未创建时只允许实例拥有者；05-W2 注册后允许 SPONSOR/VISITOR 策略。

- [x] **Step 1: 写跨应用和匿名付费方检查。** 使用 test-only RSA key fixture，在测试内生成，不写业务配置。

```python
def test_token_for_one_instance_rejected_by_another(identity_keys):
    token = issue_app_identity(7, 'app-a', 'instance-a')
    with pytest.raises(IdentityError):
        verify_app_identity(token, 'app-a', 'instance-b')

def test_visitor_mode_requires_login(context_factory):
    with pytest.raises(IdentityRequired):
        context_factory(policy='VISITOR', user_token=None)
```

- [x] **Step 2: 红测。** `.venv/bin/python -m pytest tests/phase1/test_capability_identity.py -q`。
- [x] **Step 3: 实现限定身份和单次登录交换。** JWT 使用独立的平台应用签名 Key，claims 至少有 sub、aud=app_id、instance_id、exp、iss。校验算法固定为配置的 RS256，应用拿公钥验证。登录在平台完成，回到登记的应用 callback 用单次短期 code 交换身份；code 一次消费、有效期 60 秒且绑定 callback/实例；不把长效 JWT 放进公开 URL。

```python
claims = jwt.decode(token, public_key, algorithms=['RS256'],
                    audience=app_id, issuer='intellideploy')
if claims['instance_id'] != instance_id:
    raise IdentityError('instance mismatch')
return int(claims['sub'])
```

AppLoginCode 在 capabilities/models.py 保存 code_hash、instance_id、user_id、callback、expires_at、consumed_at，数据库事务保证一次消费。resolve_context 从可信实例记录和公开策略决定 payer_id；客户端不能直接提交任意 payer_id。实例凭据只授权当前实例，允许匿名的赞助调用受实例配置限额约束。已存在仓库的账号系统通过映射真实平台身份接入，修改代码时增加两账号测试，不能只在入口加登录就宣布隔离成功。

- [x] **Step 4: 绿测。** 覆盖过期 token、错误 audience/instance、code 重放、未登记 callback、匿名赞助额度限制和伪造 payer_id。
- [x] **Step 5: 提交。** `feat: scope platform identity and capability authorization`。

实施证据（2026-11-10）：使用测试内临时 RSA 密钥完成 RS256 app/instance 绑定身份、可撤销实例凭据、同源 callback 的 60 秒单次 code、服务端付费方选择及入口伪造头拒绝；`test_capability_identity.py` 与 `test_runtime_access.py` 共 7 项通过，迁移往返与 OpenAPI 关联检查 2 项通过。真实生产密钥与公开 Publication 策略接入仍分别由外部配置和 05-W2 完成。

### Task 04-C2: 独立数据与文件持久化

**Files:** Create backend/app/capabilities/data.py、backend/app/capabilities/files.py、backend/alembic/versions/0002_instance_data.py、tests/phase1/test_instance_data.py。Modify backend/app/apps/models.py、backend/app/capabilities/models.py、backend/app/capabilities/router.py。

**Interfaces:** provision_data_space(instance_id) -> dict[str, str]；create_file(context: CapabilityContext, stream, filename, public=False) -> str；read_file(context, file_id) -> bytes；destroy_data_space(instance_id, confirmed: bool)。返回数据连接参数只供部署器，浏览器只获得文件 ID。

- [x] **Step 1: 写真实数据隔离与文件越权检查。** 专用 PostgreSQL 创建两个实例角色/数据库；file fixture 使用 tmp_path，但元数据写专用测试库。

```python
def test_private_file_is_not_readable_by_other_user(file_store, contexts):
    file_id = file_store.create(contexts.alice, b'dream', 'note.txt', public=False)
    with pytest.raises(FileAccessDenied):
        file_store.read(contexts.bob, file_id)

def test_update_does_not_recreate_database(data_store):
    first = data_store.provision('instance-a')
    data_store.write_record(first, 'saved')
    again = data_store.provision('instance-a')
    assert data_store.read_records(again) == ['saved']
```

- [x] **Step 2: 红测。** test_instance_data.py；数据库角色隔离必须用 PostgreSQL，不能用字典代替。
- [x] **Step 3: 实现实例范围资源。** 数据库名和角色名由服务器生成，仅用 psycopg.sql.Identifier 构造管理 SQL；应用角色不能连接控制面库或其他实例库。生成随机凭据，部署时通过 Secret/env_refs 引用。已有仓库的其他数据库记录由部署器管理，不能静默换成 PostgreSQL。

```python
path = files_root / context.instance_id / uuid.uuid4().hex
with path.open('xb') as out:
    shutil.copyfileobj(stream, out)
record = FileRecord(instance_id=context.instance_id, owner_id=context.user_id,
                    path=str(path), public=public, filename=filename)
```

FileRecord 在 capabilities/models.py 保存 id、instance_id、owner_id、path、filename、public、size、created_at。私有上传需要登录，不能令 owner_id=None 的访客共享私有权限。上传限制大小与类型，filename 仅作元数据，不作为真实路径。访问按实例和文件 owner/public 校验。元数据、文件卷和实例数据库跨源码版本保留；删除需要确认并按记录处理。创建副本生成新的数据空间，旧凭据不复用。

- [x] **Step 4: 绿测。** 覆盖 ../ 文件名、其他实例文件、重复 provision 幂等、停止保留数据、明示删除及实例角色跨库拒绝。
- [x] **Step 5: 提交。** `feat: preserve per-instance data and file access`。

实施证据（2026-11-10）：专用测试 PostgreSQL 中为实例创建独立 role/database，撤销控制库及实例库的 PUBLIC CONNECT；重复 provision 与 STOPPED 状态保留原记录，确认销毁后数据库/角色/secret reference 清理。文件元数据落测试库、内容使用服务端 UUID 路径及 0600 权限，覆盖跨用户/实例、公开读取、匿名私有上传、路径/类型/大小校验及实例身份 API，共 6 项通过。

### Task 04-C3: AI、Search/Fetch 与用量记录

**Files:** Create backend/app/capabilities/ai.py、backend/app/capabilities/search.py、tests/phase1/test_ai_search_capabilities.py。Modify backend/app/capabilities/router.py、backend/app/config.py、backend/app/agent/tools.py。

**Interfaces:** chat(context, messages, model, operation_id) -> dict，async；search(context, query, operation_id, count=5) -> list[dict]，async；fetch(context, url, operation_id) -> dict，async。消费 06-F1 reserve/record_usage/settle；尚无价格配置的收费调用拒绝，不编造免费费用。

- [ ] **Step 1: 写权限、来源和失败计量检查。** MockTransport 返回官方响应；真实 DeepSeek 集成作为 real 标记测试。

```python
@pytest.mark.asyncio
async def test_empty_search_records_provider_usage(search_context):
    search_context.respond({'results': []})
    result = await search(search_context.identity, '梦境研究', 'search-once')
    assert result == []
    assert search_context.billed_successes == search_context.provider_billable_requests

@pytest.mark.asyncio
async def test_search_returns_sources(search_context):
    search_context.respond({'results': [{'title': '资料', 'url': 'https://example.org', 'summary': '摘要'}]})
    result = await search(search_context.identity, '资料', 'source-once')
    assert result[0]['url'] == 'https://example.org'
```

- [ ] **Step 2: 红测。** test_ai_search_capabilities.py。
- [ ] **Step 3: 调用直接 API 并绑定账本。** Search POST https://api.deepseek.com/v1/tools/search，query 长度 1..128、count 1..50、need_content=true；Fetch POST /v1/tools/fetch，HTTP(S) URL 无用户密码。返回 title/url/summary/content，保留来源，不用模型虚构摘要代替获取失败。

```python
response = await http_client.post('/v1/tools/search',
    json={'query': query, 'count': count, 'need_content': True})
response.raise_for_status()
results = response.json()['results']
provider_units = parse_provider_search_usage(response)
if provider_units is None:
    save_unknown_usage(operation_id, response.status_code)
else:
    record_usage(UsageInput(operation_id=operation_id, payer_id=context.payer_id,
                           kind='search.success', units=provider_units, price_version=price_version,
                           reservation_operation_id=reservation_operation_id))
```

工具表增加 web_search 和 fetch_page，绑定当前任务的可信付费上下文。AI 请求用统一 DeepSeekClient，返回内容与真实使用量；平台 Key 不出现在应用响应。请求前预留预算，按供应商实际用量结算，失败释放未用部分；平台额度不足暂停，供应商402为UPSTREAM_UNAVAILABLE、429/408/5xx 有界退避，其他 4xx 明确失败。客户端取消和上游结果不确定时记录待核对事件，不重复扣用户费用。

- [ ] **Step 4: 绿测和真实调用。** 包含第三方 401/402/429、重复 operation_id、赞助/访客正确付费方、空搜索按供应商实际成功请求费记录、真实搜索 URL 来源和 AI 回答保存。真实 Key 未就绪只标未执行。
- [ ] **Step 5: 提交。** `feat: provide metered AI and live web search`。

#### 候选测试身份与用量衔接

03-D6为候选登记ephemeral测试Instance（app_id/job_id/attempt_id绑定、独立data_namespace、expires_at），04-C1校验任务拥有者并只为该候选签发test_user身份。测试身份不能登录平台控制面或其他实例；真实AI/搜索费用归创建job父Reservation，不另扣访客。stop_candidate撤销身份/凭据，恢复新候选需重签；已过期调用拒绝。parse_provider_search_usage、save_unknown_usage在capabilities/search.py定义，前者按供应商响应/明确计费成功请求数解析，后者保存待核对账本事件；没有上游计费规则就拒绝收费调用，不猜空结果免费。

#### 公开访问撤销与部署入口同步

04-C1补平台入口访问检查（backend/app/runtime/access.py及tests/phase1/test_runtime_access.py）：Linux Caddy forward_auth/K8s登记的入口鉴权组件经受控通道查询实例与visible Publication。公开允许的匿名入口可访问；未公开/已取消公开仅拥有者或授权实例身份，callback/code交换路径由平台限定。数据库/应用服务不公开绕过入口的端口。每次入口访问核对当前公开策略，不能只在一次登录时检查；传入身份头由可信入口重写，不信任浏览器自填user_id。能力/data/files仍在服务端按实例及用户检查；A/B/C账号映射与D脚手架接相同身份，不把入口放行当作多人数据隔离完成。测试取消公开后直接URL匿名访问拒绝、拥有者仍可用、伪造身份头拒绝、私有callback一次交换和公开策略更改即时生效。临时候选入口只对runner/测试身份开放。
