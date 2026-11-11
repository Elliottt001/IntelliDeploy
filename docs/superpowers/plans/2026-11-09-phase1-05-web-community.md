# Phase 1 Web and Community Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 提供需求对话、真实交付和调整，以及公开应用体验与独立副本。

**Architecture:** 在 web/ 新增 Next.js，保留 frontend/ Expo；Web 复用视觉素材；公开页服务端渲染，工作台读取持久 API 和 SSE。社区 Publication 引用验证过的版本，副本使用独立 Instance。

**Tech Stack:** Next.js、TypeScript、Tailwind、FastAPI、PostgreSQL、Playwright。

**Spec:** [技术设计](../specs/2026-11-09-intellideploy-phase1-design.md)，[公共接口](2026-11-09-phase1-00-roadmap.md)。05-W1 基础联调依赖 01、07-E1；交付联调依赖 03、04；05-W2/W3 依赖 03、04。

## Global Constraints

- “访问公开页不要求登录；进入私有功能或消费个人额度时使用统一的平台身份。”
- “生产私有数据、用户、文件、第三方账号凭据都不复制。”
- “默认每个应用只有一个活跃的修改或发布任务。”
- 遵守总计划；UI 的成功结果必须来自持久的实际发布状态。

### Task 05-W1: Next.js 工作台、登录与可恢复交付

**Files:** Create web/package.json、web/tsconfig.json、web/global.css、.github/workflows/web.yml。Create web/next.config.ts、web/app/layout.tsx、web/app/page.tsx、web/app/login/page.tsx、web/app/apps/page.tsx、web/app/apps/[id]/page.tsx、web/lib/{api,events}.ts、web/components/{AppConversation,DeliveryCard}.tsx、web/e2e/workspace.spec.ts。保留 frontend/app/_layout.tsx、Expo 路由、依赖、Metro 与 NativeWind 配置；手机改造见 07-E2。新增 web 的 CI，原 Expo preview 工作流保留并修复新 API 配置。

**Interfaces:** api.createApp(prompt, budgetUnits, operationId)；api.sendMessage(appId, content, operationId)；api.getApp(appId)；api.getJob(jobId)；streamJob(jobId, cursor, onEvent)。Next 服务端 API 代理用安全 HttpOnly、Secure、SameSite=Lax session cookie 绑定现有认证；修改请求校验 Origin，代理只转发允许的路径。登录代理接 JSON 并保存返回 Bearer token，浏览器不直接读取 token；401 保留输入并跳转登录。认证细节见 07-E1，不把平台模型 Key 暴露给浏览器。

- [x] **Step 1: 写页面恢复与交付门槛测试。** 测试后端 fixture 返回已发布、运行中、失败候选三种持久状态。

```typescript
test('refresh keeps the existing task and delivery link', async ({ page }) => {
  await page.goto('/apps/example');
  await expect(page.getByRole('link', { name: '打开应用' })).toHaveAttribute('href', 'https://app.example.org');
  await page.reload();
  await expect(page.getByRole('link', { name: '打开应用' })).toBeVisible();
});

test('a failed candidate keeps the previous live version', async ({ page }) => {
  await page.goto('/apps/failed-adjustment');
  await expect(page.getByText('本次调整未完成')).toBeVisible();
  await expect(page.getByRole('link', { name: '打开应用' })).toHaveAttribute('href', 'https://old.example.org');
});
```

- [x] **Step 2: 红测。** 新 package scripts 包含 dev/build/start/typecheck/test:e2e；运行 `npm --prefix web run test:e2e -- workspace.spec.ts`。没有页面时应失败。
- [x] **Step 3: 改造项目与工作台。** 使用 Node 24，Next/React 兼容稳定版本，提交 lockfile；在独立 web 包使用 Web 元素；从 frontend 复用配色、Logo 和资产，客户端组件不强制共享。平台首页复用现有 Logo、配色和素材，不引入额外视觉重设计。

```typescript
export function streamJob(jobId: string, cursor: number, onEvent: (event: JobEvent) => void) {
  const stream = new EventSource(`/api/jobs/${jobId}/events?after_id=${cursor}`);
  stream.onmessage = (message) => onEvent(JSON.parse(message.data));
  return () => stream.close();
}
```

JobEvent 在 packages/api-client/src/generated.ts 从 OpenAPI 导出，包括 id、kind、message、status、phase 和已公开用量；若 SSE 使用 named event，events.ts 对对应 kind 注册 addEventListener，不只使用 onmessage。重连游标与应用数据持久在后端，浏览器只缓存游标。当前版本可打开；候选状态显示验证/调整，不能替代线上链接。创建前登录，消息输入可恢复，追问只显示业务问题。

公开 Web 部署需要真实 Next 服务端；Expo 静态 preview 仅用于其浏览器预览；新增 Web CI 执行 typecheck/build/E2E并保存构建产物；Expo CI 执行 typecheck/export，本地和服务器用 next start。前端和 API 部署的代理、cookie 和 API_BASE_URL 写入运行说明。

- [x] **Step 4: 绿测。** 跑 npm typecheck/build 与 E2E；检查移动和桌面尺寸、断线补发、刷新、余额暂停、错误消息及重复点击不创建重复任务。
- [x] **Step 5: 提交。** `feat: add persistent web app workspace and delivery UI`。

### Task 05-W2: 公开社区页与访问策略

**Files:** Create backend/app/community/{__init__,models,service,router}.py、backend/alembic/versions/0007_community.py、tests/phase1/test_publications.py、web/app/community/page.tsx、web/app/community/[id]/page.tsx、web/e2e/community.spec.ts。Modify backend/app/main.py、backend/app/capabilities/identity.py。

**Interfaces:** publish(session, app_id, owner_id, version_id, payer_policy) -> Publication；get_publication(session, publication_id)；unpublish(session, publication_id, owner_id)；payer_policy 为 SPONSOR/VISITOR。公开返回名称、用途、功能、预览、作者、实例 URL、copy 入口，不含内部配置。

- [x] **Step 1: 写公开可看、私有不可看及未验收不可发布的检查。** publication_factory 为测试库创建一个报告全部 PASS 的版本和正在运行的实例。

```python
def test_unverified_version_cannot_be_published(publication_context):
    with pytest.raises(PublicationError):
        publish(publication_context.session, publication_context.app_id,
                publication_context.owner_id, publication_context.failed_version_id, 'SPONSOR')

def test_public_response_contains_no_secrets(publication_context):
    data = get_publication(publication_context.session, publication_context.publication_id)
    assert 'env_refs' not in data and 'checkpoint' not in data
```

- [x] **Step 2: 红测。** test_publications.py 与 community.spec.ts。
- [x] **Step 3: 实现发布验证与公开页。** 发布校验 app 归属、版本验证和实例访问报告；每次更新明确引用版本。取消公开不删除 Instance；其他用户只能看到公开记录。SSR 输出可分享的名称、描述和预览；页面有“直接使用”“创建我的副本”和轻量创建入口。免费公开内容不强制登录；调用个人额度或私有功能使用 04-C1 身份流程。赞助者预算上限不由访问者修改。

```python
if app.owner_id != owner_id or not ValidationReport.model_validate(version.validation).passed:
    raise PublicationError('version cannot be published')
publication.version_id = version_id
publication.payer_policy = payer_policy
publication.visible = True
```

数据库保存报告明细，读取时由 ValidationReport.passed 计算结果，不接受前端提交 passed=true。公开列表只查询 visible=true 和可访问状态，并展示暂不可用状态而非坏链接。

- [ ] **Step 4: 绿测。** 未登录打开公开页、按需登录保留输入、取消公开隐藏页面、伪造 owner 拒绝、作者应用和访客最近使用记录正确；与 07-E2 手机社区联调验证同一 Publication。
- [x] **Step 5: 提交。** `feat: publish applications with public and metered access`。

### Task 05-W3: 独立副本与我的应用

**Files:** Modify backend/app/community/service.py、backend/app/community/router.py、web/app/community/[id]/page.tsx、web/app/apps/page.tsx。Create tests/phase1/test_copies.py、web/e2e/copies.spec.ts。

**Interfaces:** create_copy(session, publication_id, owner_id, operation_id, budget_units) -> (App, Instance, Job)；Job.kind=COPY，引用不可变 source_version_id。copy worker 复用 03 发布器，不重新生成源码。

- [x] **Step 1: 写私有数据不复制和重复点击检查。** 原始实例写入私有记录和 secret，source_version 仅含公开代码材料。

```python
def test_copy_has_new_data_and_credentials(copy_context):
    copied = create_copy(copy_context.session, copy_context.publication_id,
                         copy_context.visitor_id, 'copy-once', 100)
    assert copied.instance.data_namespace != copy_context.original.data_namespace
    assert copied.instance.secret_ref != copy_context.original.secret_ref
    assert copy_context.read_private_rows(copied.instance) == []
```

- [x] **Step 2: 红测。** test_copies.py 与 copies.spec.ts。
- [x] **Step 3: 实现事务与 COPY Worker。** 同一用户/operation_id 幂等创建。引用发布时版本，创建新 App、数据空间、配置和实例。只复制源码、镜像和公开初始化资料，不复制原 User、生产数据、文件或凭据。COPY 作业使用同一验证和部署门槛，只有独立实例实际可用才能成功。

```python
copy_app = App(owner_id=owner_id, source_version_id=publication.version_id)
copy_instance = Instance(owner_id=owner_id, app_id=copy_app.id,
                         data_namespace=new_namespace(), status='PENDING')
job = Job(kind='COPY', checkpoint={'source_version_id': publication.version_id},
          operation_id=operation_id, status='QUEUED')
```

将 copied软件材料映射到新的 AppVersion 并保留原来源；复制后可以继续对话修改。我的应用按创建、复制、最近使用、收藏组织，收藏持久保存而非前端 boolean；最近使用只记公开实例或授权访问，不公开其他用户记录。

- [ ] **Step 4: 绿测及真实副本。** 重新发布原应用不改变已引用副本版本，复制两次不共享数据，多人访问保持权限，副本部署失败不出现成功链接。
- [x] **Step 5: 提交。** `feat: create independent application copies and library`。

## 双客户端边界

本计划实现 Web 和社区后端；07-E2 将同一接口接入保留的 Expo 手机客户端。社区接口纳入 07-E1 的共享客户端：listPublications、getPublication、publish、unpublish、createCopy、listMyApps、listRecentApps、listFavorites、setFavorite。收藏和最近使用由 community 后端按用户持久保存，分页格式沿用交付说明。05-W3 实现 /api/library/recent、/api/library/favorites 和 PUT/DELETE /api/library/favorites/{publication_id}；05-W2 增加 GET/DELETE /api/publications/{id}。两客户端提供额度、订阅、购买入口，接 06-F1/F2/F3；手机通过外部浏览器打开平台托管的支付页，订单状态由同一后端核对，返回后刷新额度，不额外要求接原生支付 SDK。原生商店上架发行与审核规则需在确定发行方式时核对，本计划的原生验收是可运行客户端及真实联调。

#### 发布版本、实例恢复及费用提示的同步

05-W1交付卡同时显示instance.status/stop_reason，STOPPED提供“恢复运行”，调用03-D7 start接口后轮询InstanceOperation；FAILED显示错误和可重试入口，历史delivery不能当实际在线状态。客户端消费后端BudgetPolicy/余额及报价提示，普通用户不填技术预算参数，提交时可省略budget_units；生成与失败已发生用量的计费规则在首次执行前可见。

05-W2发布必须version_id==App.active_version_id==Instance.version_id且实际运行验证PASS；版本不匹配409，不能公开一个链接指向另一版。共享同一运行实例按每个用户隔离私有记录，公开详情/预览不从拥有者私有数据取样。发布设置保存在Publication；作者继续调整已公开应用时UI提示将更新公开应用，通过03-D5激活事务同步所有该实例visible Publication.version_id，失败则两者保持旧版；公开应用页面显示最新版本，不假称固定在旧版。既有副本仍固定source_version不随作者更新。若作者不愿更新公开应用，可先取消公开；平台不擅自复制生产数据建立新公开实例。

收藏/最近使用分页响应字段明确items及next_cursor；直接使用记录publication_id/instance_id，匿名按允许功能访问；VISITOR消费个人额度前登录，SPONSOR受服务端赞助上限（period/limit_units）控制。赞助上限在Publication保存，resolve_context与06-F1预留同事务检查，访问者不能改上限。取消公开阻止新匿名/社区身份进入共享实例；实例拥有者仍可访问，实例停机时社区显示暂不可用。05-W2测试公开版本更新与实际入口一致、取消公开后的匿名拒绝、赞助超限；05-W3测试已有副本不升级、不复制私人数据。

## 实施进度（2026-11-10）

05-W1工作台基础已实现：首页创建/登录/注册、我的应用、持久对话、交付卡、继续调整、取消/额度恢复、命名SSE/快照补读、源码下载、业务验证报告及创建草稿刷新恢复。第8步已补实例start/stop/delete、社区发布/副本及私有登录交换的本地联调；私有登录code返回401会保留应用详情路径并进入登录。Web单测14项、Playwright 9项及Next build/typecheck通过。不将夹具URL标真实交付，本任务包含真实模型/云的最终验收仍未完成。


### 第8步本地实施与验证（2026-11-10）

05-W2已实现Publication、公开列表/详情、发布/取消公开、当前版本与需求/报告/digest绑定、SPONSOR/VISITOR政策和周期赞助预留。成功发布事务同步公开版本；停止显示暂不可用，取消公开拒绝新的匿名/访客入口及身份交换，拥有者仍有访问权。公开Schema只返回业务描述、作者和入口，不返回配置/私有数据/工具记录。

05-W3已实现幂等COPY事务、新App/Instance/凭据/预留、固定source_version、安全源码解包及保留来源、复用已验证digest和业务检查。COPY经过同一候选验证与发布器，失败无交付链接、终态释放未用预留；不重复生成或构建源镜像。复制不带生产数据/文件/密钥/工具日志，所有环境变量引用重新绑定为副本引用。复制后的实例数据库和所需配置需由受控runner/部署接入，未配置时不能声称副本可用。

Web/Expo已接社区、分享详情、直接使用、收藏/最近使用、独立副本、发布政策和取消公开；两端补实例start/stop/delete及操作轮询，删除要求DELETE与明确数据选项。客户端打开私有应用只传60秒code；D脚手架补callback、应用HttpOnly会话和逐请求平台授权。A/B/C仓库仍需在真实流水线中接入对应身份/业务权限，不假设任意项目无需改造。

检查位置：tests/phase1/test_publications.py、test_copies.py、test_releases.py、test_mobile_acceptance_workflows.py；packages/api-client/tests/client.test.ts；web/e2e/community.spec.ts；web/tests/platform-client.test.ts；frontend/e2e/community.spec.ts、community-cross-client.spec.ts；frontend/.maestro/{generate,recover,community}.yaml。红测已实际执行，数据库使用intellideploy_test；浏览器/发布记录夹具显式标fixture。三份Maestro文件已通过结构测试但未在设备执行。实际测试数量以一期实施进度为准。

Step 4保留未勾选：本地协议、浏览器绿测和设备流程入口已完成，真实模型、runner、registry、Linux/Sealos副本/多人数据及原生设备执行仍NOT_RUN。此状态不表示重做已实现代码，也不表示第8步的真实验收已通过。

提交：05-W2 `11332ba`；05-W3 `bd80012`；双客户端、脚手架接入与文档另以第8步联调提交记录。真实验收状态仍按上述NOT_RUN边界。

提交前复核补充：供应商用量UNKNOWN时，该调用的上界继续占用当期赞助预算，避免用多次新请求绕过上限；已知失败释放预算，未知账单不记假0。关联检查test_unknown_provider_usage_keeps_sponsor_budget_bounded与并发赞助预留检查，用户账户与赞助预算分别核对。
