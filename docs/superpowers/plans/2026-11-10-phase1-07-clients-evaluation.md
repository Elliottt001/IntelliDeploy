# Phase 1 Shared Clients and Evaluation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 保留 Expo 手机客户端，接入与 Web/API 同一真实生成链路，并提供可用的开发者评测和启动入口。

**Architecture:** 共享 OpenAPI 类型和请求包，平台 Web 用服务端认证代理，Expo 用 Bearer 请求与持久任务轮询。评测复用产品 API/Worker，不新建生成引擎。

**Tech Stack:** 现有 Expo/React Native/expo-router、Next.js、TypeScript、FastAPI、openapi-typescript、Vitest、Playwright、Maestro。

**Spec:** [技术设计](../specs/2026-11-09-intellideploy-phase1-design.md)、[公共接口与依赖](2026-11-09-phase1-00-roadmap.md)、[一期交付与测试说明](../../一期交付与测试说明.md)。交付说明中的公开响应字段是本计划接口依据。

## Global Constraints

- “生成和调整任务只有在核心验收通过且对应版本实际发布后才能 SUCCEEDED。”
- `frontend/` 保留现有 Expo 客户端；`web/` 为新增 Next.js，不能删除 Expo 路由/Metro/NativeWind 来实现 Web。
- 用户生成应用仍为 Web；A/B/C/D 全保留，D 的固定栈不能约束全部路线。
- 初次客户端联调可用确定性夹具验证协议，最终交付必须真实 DeepSeek、服务器和业务操作。
- 普通用户不看内部日志；评测诊断需后端开发者权限和任务归属双重检查。

### Task 07-E1: 共用 API 客户端、认证和启动入口

**Files:** Create package.json、package-lock.json、packages/api-client/{package.json,tsconfig.json,openapi.json}、packages/api-client/src/{generated,client,index}.ts、packages/api-client/tests/client.test.ts、scripts/export_openapi.py、docs/开发运行指南.md、web/app/api/[...path]/route.ts、web/lib/session.ts。Create web/package.json、web/next.config.ts（最小Next包用于workspace安装，05-W1扩展）；Modify frontend/package.json、frontend/metro.config.js、backend/app/utils/security.py、backend/app/main.py、backend/.env.example、.gitignore、README.md。已有单包 lockfile 确认 npm workspace 解析成功后迁移到根 lock，不先删依赖再排错。

**Interfaces:** 消费 01-F1/F3 的公开 Schema；createApiClient({baseUrl, getToken?, fetchImpl?}) 产出 createApp、sendMessage、getApp、listMyApps、getJob、getReport、resumeJob、cancelJob、getArtifactUrl、issueLoginCode，以及05社区和06额度/订单方法。每个写方法接 operationId，传 Idempotency-Key；组件不能自行生成第二套 API 地址或结果结构。Web baseUrl为空字符串，同源请求path本身含`/api`；避免/api/api重复前缀，Expo 为配置的后端地址。

- [ ] **Step 1: 写传输和认证协议测试。** 使用 Vitest 注入 Fetch 夹具，仅证明请求行为；在 backend 测试 HTTPBearer 与 JSON 登录共存。

```typescript
import { expect, test, vi } from 'vitest';
import { createApiClient } from '../src/client';

test('create carries token and retry key without changing the payload', async () => {
  const transport = vi.fn<typeof fetch>(async (_input, _init) => new Response(JSON.stringify({
    app_id: 'a', job_id: 'j', status: 'QUEUED'
  }), { status: 201, headers: { 'Content-Type': 'application/json' } }));
  const api = createApiClient({ baseUrl: 'https://api.test',
    getToken: async () => 'fixture-token', fetchImpl: transport });
  await api.createApp('笔记', 100, 'once');
  const [url, options] = transport.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe('https://api.test/api/apps');
  expect(new Headers(options.headers).get('Authorization')).toBe('Bearer fixture-token');
  expect(new Headers(options.headers).get('Idempotency-Key')).toBe('once');
  expect(JSON.parse(options.body as string)).toEqual({ prompt: '笔记', budget_units: 100 });
});
```

- [ ] **Step 2: 红测。** `npm --workspace @intellideploy/api-client test`；未实现函数应失败。先建立根 workspaces=`["frontend","web","packages/api-client"]`，不把 Expo 的 React 版本强制替换为 Web 版本。
- [ ] **Step 3: 实现协议包及运行入口。** export_openapi.py 导入 app.main.app，写 app.openapi() 到包内 JSON；该导入不可写数据库或 require 云凭据。openapi-typescript 生成 components/schemas 类型；client.ts 从 Schema 获取 JobSnapshot/AppDetail 等响应。共享包使用 TypeScript 编译成 dist ESM，package exports/types 指向 dist；Next 和 Expo 的解析均实际验证。api:generate 先导出，再生成类型，最后构建包；CI 再生成后 git diff --exit-code 检查协议漂移。

```typescript
export type ClientOptions = {
  baseUrl: string;
  getToken?: () => Promise<string | null>;
  fetchImpl?: typeof fetch;
};
```

客户端内部 request(path, method, body?, operationId?) 在请求时读 token，统一解析交付说明错误，401抛带 code 的异常，组件保留业务输入并转登录。网络重试重用 operationId；GET 可重试，写请求只以同幂等键重试。下载用认证 fetch，或 Web BFF 的同源下载，不将 Bearer token 拼在下载 URL。POST/messages 在409后回读已有任务。

Web BFF映射/api/auth/login、/api/auth/register、/api/auth/me分别到后端/auth/login、/auth/register、/auth/me；/api/auth/logout本地清cookie，不代理模型。登录映射/api/auth/login到后端/auth/login，其余 `/api/*` 到列明产品路径；使用 cookie 存签名/加密的 token session（服务端 SESSION_SECRET），退出清除 cookie；校验修改请求的 Origin。SSE 直接流式转发并传 Last-Event-ID；不缓冲全部事件；设置 no-store。API_BASE_URL 只服务端读取，禁止客户端提交任意代理目标。登录成功只返回用户必要字段，不回传 access_token 给浏览器。Expo 直接 JSON 登录/Bearer；auth/security.py 保留 JWT验证与密码哈希，OAuth2PasswordBearer 改 HTTPBearer，统一401错误。

根 scripts 必须包含以下映射；api:generate 的 OpenAPI 导出运行前需配置后端环境。

```json
{
  "scripts": {
    "api:generate": "PYTHONPATH=backend .venv/bin/python scripts/export_openapi.py && npm --workspace @intellideploy/api-client run generate && npm --workspace @intellideploy/api-client run build",
    "dev:api": "PYTHONPATH=backend .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 9000",
    "dev:worker": "PYTHONPATH=backend .venv/bin/python -m app.jobs.worker",
    "dev:web": "npm --workspace web run dev -- --port 3000",
    "dev:mobile": "npm --workspace frontend start"
  }
}
```

运行指南包含环境样例、PostgreSQL/迁移、独立 Worker 和隔离构建节点配置、云目标登记、四终端命令、Web/docs/Expo入口；手机 LAN 地址、Android模拟器地址、CORS/HTTPS与回到前台刷新。明确缺配置为未执行，API启动成功不等于应用生成成功。artifacts/evaluations 加 Git 忽略，不能忽略需要提交的契约或测试代码。

- [ ] **Step 4: 绿测及联调。** 共享包 Vitest、后端 auth/API协议检查；Next 登录/SSE代理测试覆盖401、越权、Origin不匹配、流重连、源码下载和退出；用真实API创建后 GET job，在 Expo transport 中读到同一id。检查导出/生成文件无凭据、变更后再生成无 diff。
- [ ] **Step 5: 提交。** `feat: share API contracts and client startup paths`。此任务交付可联调协议，尚不代表引擎已交付业务应用。

### Task 07-E2: 接通保留的 Expo 客户端

**Files:** Modify frontend/services/api.ts、frontend/screens/chatbot/ChatbotScreen.tsx、frontend/screens/app-gallery/AppGalleryScreen.tsx、frontend/screens/home/HomeScreen.tsx、frontend/screens/login/LoginScreen.tsx、frontend/screens/register/RegisterScreen.tsx、frontend/app.json、frontend/package.json。Create frontend/services/{jobPolling,authStorage}.ts、frontend/screens/app-detail/AppDetailScreen.tsx、frontend/screens/billing/BillingScreen.tsx、frontend/components/DeliveryCard.tsx、frontend/app/app-detail/[id].tsx、frontend/app/billing.tsx、frontend/.maestro/{generate,recover,community}.yaml、frontend/tests/jobPolling.test.ts、docs/原生客户端验收记录.md。新页面使用根Expo路由，旧页面保留并接入新状态；创建入口和已有主页提供到/app-detail/{id}和/billing的跳转。

**Interfaces:** 消费07-E1请求包及01/05/06 API。subscribeJob(jobId, onSnapshot) -> unsubscribe；authStorage.getToken/setToken/clearToken；DeliveryCard 从 AppDetail.delivery/instance_status 和 latest_job 读取。身份code由04-C1提供。基础联调依赖01/07-E1；真实交付依赖03/04，社区和购买联调依赖05/06。

- [ ] **Step 1: 写轮询与旧版本保持检查。** Vitest 使用fake timer，fixture仅验证恢复逻辑；测试token为空回到登录，失败候选仍显示原delivery，不能把非空URL当作任务成功。

```typescript
import { expect, test } from 'vitest';
import { shouldPoll } from '../services/jobPolling';

test('poll only active jobs and pause while app is in background', () => {
  expect(shouldPoll('RUNNING', 'active')).toBe(true);
  expect(shouldPoll('RUNNING', 'background')).toBe(false);
  expect(shouldPoll('SUCCEEDED', 'active')).toBe(false);
  expect(shouldPoll('PAUSED_QUOTA', 'active')).toBe(false);
});
```

- [ ] **Step 2: 红测。** `npm --workspace frontend test -- jobPolling.test.ts`，shouldPoll 未实现应失败；新增独立 test script，保留原start/ios/android/web命令。
- [ ] **Step 3: 替换旧数据链路。** api.ts 创建共享API实例，登录接/auth JSON，原生token用expo-secure-store；Expo浏览器预览存储适配单独处理。登录读取时迁移旧AsyncStorage token到SecureStore后删除旧值，退出清除两者。ChatbotScreen 不再调用 rag search/chat 或旧WebSocket来判断交付，改createApp/sendMessage/getApp/getJob。持久app_id及输入草稿，前台每3秒串行轮询，后台停止、重新前台立即GET；网络失败退避到30秒，清理timer/AbortController，禁止重叠请求。WAITING_USER显示业务问题，PAUSED_QUOTA提供充值/恢复，终态回读AppDetail；连续轮询失败提示网络状态而不改变后端Job。

```typescript
export function shouldPoll(status: string, appState: string): boolean {
  return appState === 'active' && ['QUEUED', 'RUNNING'].includes(status);
}
```

AppDetailScreen 提供对话、候选/当前版本、打开应用、继续修改、发布入口；生成状态以持久快照为准。应用私有访问调用issueLoginCode，再用Linking.openURL打开登记callback，公网app URL独立于手机LAN API地址。发布页选SPONSOR/VISITOR；图库读真实Publication，不用缓存RAG卡片代替社区；收藏/最近使用按服务端持久记录。BillingScreen 接余额、套餐和订单接口，三个支付渠道打开平台HTTPS支付页（订单绑定用户），回到前台查订单并刷新额度；不能按浏览器返回参数自行加额度。停止/删除走共用实例API，删除展示数据范围确认。

保留视觉资产、Metro/NativeWind及现有Expo路由，不为共享API包改掉全部UI。使用expo install安装与当前SDK兼容的SecureStore等模块。配置明确的iOS bundleIdentifier/Android package，避免覆盖其他应用；运行指南记录所选标识和开发构建命令。

- [ ] **Step 4: 绿测、原生与跨端验收。** typecheck/Vitest；`npm --workspace frontend exec -- expo export --platform all` 检查打包。运行iOS/Android开发构建；Maestro覆盖登录→需求→离开/恢复→交付→打开浏览器→返回→调整→社区/副本/额度。Maestro文件以实际appId/testID定位，不等待一个固定生成时长，轮询后端状态并记录超时；等待中的手机恢复可测试预先真实发起的job。自动化不可用时，两平台按同一流程记录设备/构建/时间/app_id/job_id/截图和每一步结果，未执行不得写PASS。Web创建手机读取、手机回答Web续接必须读同一id和持久对话；失败调整保留旧线上数据。
- [ ] **Step 5: 提交。** `feat: retain Expo client with shared app delivery flows`。

### Task 07-E3: 开发者真实评测页与 CLI

**Files:** Create backend/app/jobs/diagnostics.py、backend/app/evaluation/{__init__,schemas,router}.py、web/app/dev/evaluation/page.tsx、web/components/EvaluationResult.tsx、tests/phase1/test_evaluation_access.py、tests/phase1/test_acceptance_runner.py、tests/phase1/cases/real.json、web/e2e/evaluation.spec.ts、scripts/run_phase1_acceptance.py。Modify backend/app/jobs/router.py、backend/app/config.py、backend/app/models/user.py、backend/alembic/versions/（从唯一head延长developer权限迁移）、web/lib/session.ts。06-F4继续扩展本CLI为最终验收，不新建第二个runner。

**Interfaces:** GET /api/evaluation/targets 返回已登记且可用的target_id/name/kind列表，同开发者权限；GET jobs/{id}/diagnostics -> EvaluationRecord，要求ENABLE_EVALUATION_UI、is_developer和owner；CLI调用apps/messages/jobs/report及artifact，默认routing_mode=automatic。EvaluationRecord字段沿用交付说明的来源/评分/用量/费用/时间/checks/evidence，并含app_id/job_id/version_id、source_mode、routing_mode、target_id。未知费用null+cost_status=unknown；从数据库事件时间算阶段耗时，不由客户端猜。

- [ ] **Step 1: 写越权和假成功拒绝检查。** developer_job 为专用PG fixture，evaluation_runner 的依赖注入API transport；只验证状态判断，最终仍需real样本。

```python
def test_diagnostics_requires_developer_and_owner(api_client, developer_job, owner_headers):
    response = api_client.get(f'/api/jobs/{developer_job.id}/diagnostics', headers=owner_headers)
    assert response.status_code == 404

def test_runner_does_not_count_missing_core_checks_as_delivery(evaluation_runner):
    output = evaluation_runner.evaluate_record({
        'status': 'SUCCEEDED', 'result': {'url': 'https://fixture.test'},
        'report': {'overall': 'NOT_RUN', 'checks': []}, 'source_mode': 'fixture'
    })
    assert output['real_delivery_passed'] is False
```

- [ ] **Step 2: 红测。** pytest上述文件；Playwright evaluation.spec.ts验证普通用户无法进评测，开发者可以创建/查看本人任务；fixture标记不能进入真实指标。
- [ ] **Step 3: 实现只读诊断与评测入口。** developer字段默认false，只能由平台管理命令授予，register/me更新不能提升权限。未开启或无权限返回404；拥有者报告与开发者内部diagnostics分开。评测页只调用已有apps/jobs API；页面默认自动选路，目标下拉来自管理员登记列表；读取内部事件仅给授权开发者，输出脱敏来源、排名、模型及费用版本、URL/报告/截图，不返回Key/云凭据/私人日志。

CLI读取--cases/--output、环境token/API地址；用httpx认证。每case分配幂等键，创建/调整任务、轮询到终态；WAITING_USER只按case中的明确业务answers回答，无答案NOT_RUN；额度暂停记录并停止，不无限充值。请求超时、job墙钟超时和max polls显式设置并保存状态，禁止调用旧RAG入口。CLI固定内部评测部署目标时保存target_override=true，只覆盖资源选择，不覆盖检索；产品默认目标自动选择。POST /api/apps 可选 evaluation_target_id 仅在后端开发者权限及 ENABLE_EVALUATION_UI 检查通过时接受，值必须属于已登记可用目标；普通用户传此字段返回403，不改变默认自动路由。Schema导出包含该可选字段，cli/page记录target_override，客户端不能提交任意云凭据。

```python
terminal = {'SUCCEEDED', 'FAILED', 'CANCELLED'}
def real_delivery_passed(record):
    return (record['source_mode'] == 'real'
            and record['status'] == 'SUCCEEDED'
            and bool((record.get('result') or {}).get('url'))
            and record['report']['overall'] == 'PASS')
```

该判断只用于汇总；runner须自行核对报告所有核心ID、实际URL可访问与业务动作证据，不能只相信字符串PASS。real.json中每case含id/prompt/expected_route/core_checks/target和可选answers；C列两个来源业务贯通，D验证真实搜索来源，A/B固定已知合适仓库作召回参考，但不注入默认路由。样本selection_mode automatic；独立强制路线诊断需管理员配置并标forced，另表统计。缺模型/云条件记录NOT_RUN并退出非0；summary包含全部case及不通过原因，错误不丢case。按运行ID保存JSON、截图与报告，Git忽略输出。

- [ ] **Step 4: 绿测与真实基线。** API权限、runner边界、页面E2E通过；使用实际DeepSeek、公开仓库和Linux/Sealos分别运行，保存四条路线与重复执行成本。检索样本检查已知合适项目的召回与优先复用；forced成功不能代替automatic覆盖。继续调整和跨端测试指向同一真实app。把首轮成功/失败/NOT_RUN和费用如实落盘；06-F4总验收合入支付/中断/副本/多用户，并要求所有必需项PASS。
- [ ] **Step 5: 提交。** `feat: evaluate real app delivery through shared APIs`。

## 完成条件

手机、Web、API共用协议；保留现有Expo；启动命令有可复制运行指南；开发者能在页面或CLI发起并评估真实生成。新代码单元绿测、Expo export、Web build均不能替代真实模型/云及iOS/Android验收。没有证据的能力标未执行，禁止用文档检查结果宣称产品已完成。

### Task 07-E4: 代表性需求集、独立需求核对与交付质量门槛（P6）

**Files:** Create tests/phase1/cases/{quality,flow,faults}.json；Modify tests/phase1/cases/retrieval.json、scripts/summarize_phase1_evaluations.py、tests/phase1/test_quality_metrics.py、docs/一期真实验收记录.md。Modify scripts/run_phase1_acceptance.py、backend/app/evaluation/schemas.py、web/components/EvaluationResult.tsx、web/e2e/evaluation.spec.ts。retrieval.json由02-G7首次建立，本任务扩充；不复制第二份检索答案索引。

**Interfaces:** summarize(records: list[dict], reviews: list[dict]) -> dict；review记录case_id/job_id/reviewer/requirement_coverage/usability/blockers/evidence；生成记录来自07-E3/03-D6及06-F4。CLI增加--suite smoke|quality|faults，--cases沿用明确文件；默认automatic。真实记录中source_mode=real仅由runner根据实际环境/部署证据设置，客户端不能传real绕过验证。

- [ ] **Step 1: 写指标不能被漏项或强制路线抬高的检查。** 夹具records在test文件定义，统计函数不执行任何真实收费。

```python
def test_forced_and_not_run_are_separate(metric_context):
    report = summarize(metric_context.records(), metric_context.reviews())
    assert report['automatic']['attempted'] == 3
    assert report['automatic']['passed'] == 1
    assert report['required_not_run'] == 1
    assert report['forced']['attempted'] == 1
    assert report['release_ready'] is False

def test_model_report_cannot_override_missing_user_feature(metric_context):
    records, reviews = metric_context.model_pass_but_missing_upload()
    assert summarize(records, reviews)['release_ready'] is False
```

- [ ] **Step 2: 红测。** pytest test_quality_metrics.py；夹具不计真实生成成功率。
- [ ] **Step 3: 建立固定样本与计算标准。** smoke至少4个真实A/B/C/D需求（原笔记/梦境/记录检索/实时信息），并完成一次Web发起、Expo读取续接和API发起。quality至少12个独立业务需求，每路线至少3个，合计包含：个人笔记/个人任务/静态展示；现成日记加AI/现成文件库加权限/现成看板加筛选；记录与检索/上传与分析/目录与多人收藏整合；从脚手架生成实时信息/多人活动报名/私有图片分析工具。每条明确个人或多人、外部能力、数据保存、界面可观察动作、预期路线和已知候选参考。不能通过只改配色凑三个不同需求，且不得人为限定用户检索到预设仓库。

case定义固定id/prompt/expected_route/core_checks/known_repositories/answers/target；core_checks来自人工逐句核对用户需求，不只采用模型生成清单。每路线至少一例不提供仓库名，验证自动检索；其他已给定仓库的要求另标source_hint=true，不混算无提示检索指标。C样本记录两个关键来源commit及业务连接，不把“装了两个npm包”算跨组件交付。每例首次生成/部署执行一次，挑选各路线一例重复3次观察波动，重复运行预算由测试负责人明确配置，runner不得自动无限重试。

faults单独包含检索429/资料缺失、模型超时、预算暂停恢复、构建错误自愈、候选数据不持久、跨用户拒绝、迁移失败回滚、部署切换崩溃、平台重启、实例欠费恢复、孤儿清理保护、共享/副本独立、两类目标及三支付重复回调。故障注入仅测试目标，fixture故障证据与真实业务样本分别标注；两种云至少用同一持久化业务样本实测。iOS和Android原生操作记录依07-E2，不能将Expo网页预览当两平台原生通过。

人工review读取原prompt、生成Requirement、实际应用及证据，标requirement_coverage=PASS/FAIL、usability=PASS/FAIL、blockers列表；检查中文可理解、主要动作可找到、加载/空/错误状态有反馈、电脑和手机浏览器无阻断布局、无固定演示内容冒充结果。可接受简单UI风格，不要求每例专业设计，但核心操作不可用则FAIL。首次真实回归至少人工复核12例，不能用模型自己写PASS作为用户需求完整的证据。

统计attempted为实际开始执行的automatic real任务（含失败和预算暂停）；delivered必须job成功、真实URL检查、全部核心ID及需求人工核对PASS；usability另列。NOT_RUN未发起不混入交付分母，但required_not_run阻止release_ready。输出各路线成功/失败/暂停数、召回Recall@10（只对已知相关项目集）、选路符合率、功能项通过率、p50/p90到首次可用耗时、实际用量/已知费用、unknown_cost_count、调整结果、失败分类；source_hint、forced、fixture单独表。费用未知不填0。没有执行的统计值为null，不生成虚构成功率。

```python
release_ready = (required_not_run == 0 and required_failures == 0
                 and all(row['requirement_coverage'] == 'PASS' for row in required_reviews)
                 and all(row['usability'] == 'PASS' for row in required_reviews)
                 and covered_routes == {'DEPLOY_EXISTING', 'MODIFY_EXISTING',
                                        'COMPOSE_COMPONENTS', 'GENERATE_APP'})
```

required_reviews必须覆盖全部必需样本，空列表不能因all([])而通过；summarize先校验expected_case_ids集合与records/reviews一致。首版发布门槛：12例必需质量样本全部交付/人工复核PASS，四条路线、多人隐私、真实AI/搜索、调整保留数据、共享/副本、Linux/Sealos、三支付、两客户端均有必需证据；失败先修复再重跑相关样本并保留旧失败记录。该门槛是固定套件通过，不等于任意需求95%成功率，宣传数字只引用标明样本数/时间/环境的统计。

- [ ] **Step 4: 绿测和真实报告。** 模型PASS但漏功能、review缺案例、强制路线混算、未知费用、缺原生/支付/云证据都阻止上线门槛；运行CLI的smoke→quality→faults，将脱敏JSON/截图存artifacts/evaluations，docs/一期真实验收记录仅写索引、环境、提交版本、PASS/FAIL/NOT_RUN及限制，不提交私人内容/Key。开发者评测页展示相同指标和未执行原因。
- [ ] **Step 5: 提交。** `test: establish representative phase one delivery acceptance`。尚未真实执行时记录“未执行”，不得将本计划已写标为样本已通过。

#### 两客户端操作与评测的同步

07-E1请求包新增getInstance/startInstance/stopInstance/deleteInstance/getInstanceOperation，消费03-D7公开Schema；07-E2和05-W1按操作id轮询直到SUCCEEDED/FAILED，结束后GET instance及app，不把202当已启动。启动/停止与job共用互斥；运行中新增输入保留草稿并提示已有任务，不默默覆盖执行需求。令牌过期401保留app_id/job_id/草稿，重新登录后回读同一任务；只有明确新提交才生成新幂等键，避免重新登录重发生成。

CLI统一case字段expected_route/core_checks/known_repositories/answers/target，旧route/checks仅在读取旧历史报告时做一次转换并标legacy，不允许两个子计划维护不同测试输入。故障套件faults.json与生产演练不混算普通需求交付率。原07-E3 real.json为smoke集，07-E4 quality/flow/faults扩展；verify必须核对所有必需case是否有记录/review。运行输出保留每次旧失败而非覆盖最新PASS。

#### 路线预期不能反向控制产品

expected_route仅是评测参考，路由不读取它。检索发现比预期D更适合的A/B/C时优先复用，人工核对可标ROUTE_EXPECTATION_STALE，不将合法复用当核心业务失败，不为凑D强制生成。覆盖数按实际route统计，原预计D实际A不能算D；须补充真正无合理复用的D需求，或显式用户要求脚手架的样本（标user_requested_generation=true，单独统计检索跳过原因）。每条路线至少一例无路线提示的自动检索真实需求，最终覆盖仍以实际行为满足。case版本变更保存原因，不抹掉旧失败/旧预期。07-E4增加“参考D但合适A优先”的统计回归，确保优化检索不会导致评测驱动倒退。
