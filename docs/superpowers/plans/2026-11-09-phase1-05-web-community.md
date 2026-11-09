# Phase 1 Web and Community Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 提供需求对话、真实交付和调整，以及公开应用体验与独立副本。

**Architecture:** 将平台前端改为 Next.js，复用视觉素材；公开页服务端渲染，工作台读取持久 API 和 SSE。社区 Publication 引用验证过的版本，副本使用独立 Instance。

**Tech Stack:** Next.js、TypeScript、Tailwind、FastAPI、PostgreSQL、Playwright。

**Spec:** [技术设计](../specs/2026-11-09-intellideploy-phase1-design.md)，[公共接口](2026-11-09-phase1-00-roadmap.md)。依赖 01、03、04。

## Global Constraints

- “访问公开页不要求登录；进入私有功能或消费个人额度时使用统一的平台身份。”
- “生产私有数据、用户、文件、第三方账号凭据都不复制。”
- “默认每个应用只有一个活跃的修改或发布任务。”
- 遵守总计划；UI 的成功结果必须来自持久的实际发布状态。

### Task 05-W1: Next.js 工作台、登录与可恢复交付

**Files:** Modify frontend/package.json、frontend/tsconfig.json、frontend/package-lock.json、frontend/global.css、.github/workflows/frontend-preview.yml。Create frontend/next.config.ts、frontend/app/layout.tsx、frontend/app/page.tsx、frontend/app/login/page.tsx、frontend/app/apps/page.tsx、frontend/app/apps/[id]/page.tsx、frontend/lib/{api,events}.ts、frontend/components/{AppConversation,DeliveryCard}.tsx、frontend/e2e/workspace.spec.ts。迁移后删除 frontend/app/_layout.tsx 和冲突的 Expo 路由文件，保留现有资产与独立设计组件直到引用清理。

**Interfaces:** api.createApp(prompt, budgetUnits, operationId)；api.sendMessage(appId, content, operationId)；api.getApp(appId)；streamJob(jobId, cursor, onEvent)。Next 服务端 API 代理用安全 session cookie 绑定现有认证，不把平台模型 Key 暴露给浏览器。

- [ ] **Step 1: 写页面恢复与交付门槛测试。** 测试后端 fixture 返回已发布、运行中、失败候选三种持久状态。

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

- [ ] **Step 2: 红测。** 新 package scripts 包含 dev/build/start/typecheck/test:e2e；运行 `npm --prefix frontend run test:e2e -- workspace.spec.ts`。没有页面时应失败。
- [ ] **Step 3: 改造项目与工作台。** 使用 Node 24，Next/React 兼容稳定版本，提交 lockfile；移除 Expo 启动、NativeWind 和 RN-only 依赖后逐文件转换 Web 元素。平台首页复用现有 Logo、配色和素材，不引入额外视觉重设计。

```typescript
export function streamJob(jobId: string, cursor: number, onEvent: (event: JobEvent) => void) {
  const stream = new EventSource(`/api/jobs/${jobId}/events?after_id=${cursor}`);
  stream.onmessage = (message) => onEvent(JSON.parse(message.data));
  return () => stream.close();
}
```

JobEvent 在 frontend/lib/api.ts 从后端契约导出，包括 id、kind、message、status、phase 和已公开用量；若 SSE 使用 named event，events.ts 对对应 kind 注册 addEventListener，不只使用 onmessage。重连游标与应用数据持久在后端，浏览器只缓存游标。当前版本可打开；候选状态显示验证/调整，不能替代线上链接。创建前登录，消息输入可恢复，追问只显示业务问题。

公开部署需要真实 Next 服务端，原 GitHub Pages 的静态 Expo preview 不能执行 SSR/API 代理；CI 改为 typecheck/build/E2E并保存构建产物，本地和服务器用 next start。前端和 API 部署的代理、cookie 和 API_BASE_URL 写入运行说明。

- [ ] **Step 4: 绿测。** 跑 npm typecheck/build 与 E2E；检查移动和桌面尺寸、断线补发、刷新、余额暂停、错误消息及重复点击不创建重复任务。
- [ ] **Step 5: 提交。** `feat: add persistent web app workspace and delivery UI`。

### Task 05-W2: 公开社区页与访问策略

**Files:** Create backend/app/community/{__init__,models,service,router}.py、backend/alembic/versions/0003_publications.py、tests/phase1/test_publications.py、frontend/app/community/page.tsx、frontend/app/community/[id]/page.tsx、frontend/e2e/community.spec.ts。Modify backend/app/main.py、backend/app/capabilities/identity.py。

**Interfaces:** publish(session, app_id, owner_id, version_id, payer_policy) -> Publication；get_publication(session, publication_id)；unpublish(session, publication_id, owner_id)；payer_policy 为 SPONSOR/VISITOR。公开返回名称、用途、功能、预览、作者、实例 URL、copy 入口，不含内部配置。

- [ ] **Step 1: 写公开可看、私有不可看及未验收不可发布的检查。** publication_factory 为测试库创建一个报告全部 PASS 的版本和正在运行的实例。

```python
def test_unverified_version_cannot_be_published(publication_context):
    with pytest.raises(PublicationError):
        publish(publication_context.session, publication_context.app_id,
                publication_context.owner_id, publication_context.failed_version_id, 'SPONSOR')

def test_public_response_contains_no_secrets(publication_context):
    data = get_publication(publication_context.session, publication_context.publication_id)
    assert 'env_refs' not in data and 'checkpoint' not in data
```

- [ ] **Step 2: 红测。** test_publications.py 与 community.spec.ts。
- [ ] **Step 3: 实现发布验证与公开页。** 发布校验 app 归属、版本验证和实例访问报告；每次更新明确引用版本。取消公开不删除 Instance；其他用户只能看到公开记录。SSR 输出可分享的名称、描述和预览；页面有“直接使用”“创建我的副本”和轻量创建入口。免费公开内容不强制登录；调用个人额度或私有功能使用 04-C1 身份流程。赞助者预算上限不由访问者修改。

```python
if app.owner_id != owner_id or not ValidationReport.model_validate(version.validation).passed:
    raise PublicationError('version cannot be published')
publication.version_id = version_id
publication.payer_policy = payer_policy
publication.visible = True
```

数据库保存报告明细，读取时由 ValidationReport.passed 计算结果，不接受前端提交 passed=true。公开列表只查询 visible=true 和可访问状态，并展示暂不可用状态而非坏链接。

- [ ] **Step 4: 绿测。** 未登录打开公开页、按需登录保留输入、取消公开隐藏页面、伪造 owner 拒绝、作者应用和访客最近使用记录正确。
- [ ] **Step 5: 提交。** `feat: publish applications with public and metered access`。

### Task 05-W3: 独立副本与我的应用

**Files:** Modify backend/app/community/service.py、backend/app/community/router.py、frontend/app/community/[id]/page.tsx、frontend/app/apps/page.tsx。Create tests/phase1/test_copies.py、frontend/e2e/copies.spec.ts。

**Interfaces:** create_copy(session, publication_id, owner_id, operation_id, budget_units) -> (App, Instance, Job)；Job.kind=COPY，引用不可变 source_version_id。copy worker 复用 03 发布器，不重新生成源码。

- [ ] **Step 1: 写私有数据不复制和重复点击检查。** 原始实例写入私有记录和 secret，source_version 仅含公开代码材料。

```python
def test_copy_has_new_data_and_credentials(copy_context):
    copied = create_copy(copy_context.session, copy_context.publication_id,
                         copy_context.visitor_id, 'copy-once', 100)
    assert copied.instance.data_namespace != copy_context.original.data_namespace
    assert copied.instance.secret_ref != copy_context.original.secret_ref
    assert copy_context.read_private_rows(copied.instance) == []
```

- [ ] **Step 2: 红测。** test_copies.py 与 copies.spec.ts。
- [ ] **Step 3: 实现事务与 COPY Worker。** 同一用户/operation_id 幂等创建。引用发布时版本，创建新 App、数据空间、配置和实例。只复制源码、镜像和公开初始化资料，不复制原 User、生产数据、文件或凭据。COPY 作业使用同一验证和部署门槛，只有独立实例实际可用才能成功。

```python
copy_app = App(owner_id=owner_id, source_version_id=publication.version_id)
copy_instance = Instance(owner_id=owner_id, app_id=copy_app.id,
                         data_namespace=new_namespace(), status='PENDING')
job = Job(kind='COPY', checkpoint={'source_version_id': publication.version_id},
          operation_id=operation_id, status='QUEUED')
```

将 copied软件材料映射到新的 AppVersion 并保留原来源；复制后可以继续对话修改。我的应用按创建、复制、最近使用、收藏组织，收藏持久保存而非前端 boolean；最近使用只记公开实例或授权访问，不公开其他用户记录。

- [ ] **Step 4: 绿测及真实副本。** 重新发布原应用不改变已引用副本版本，复制两次不共享数据，多人访问保持权限，副本部署失败不出现成功链接。
- [ ] **Step 5: 提交。** `feat: create independent application copies and library`。
