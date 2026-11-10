# Phase 1 Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 直接调用 DeepSeek，在受限工作区内完成四条实现路径，保存可恢复的工具执行与来源记录。

**Architecture:** 复用现有 GitHub 客户端和模板，增加明确的工具注册表及模型调用循环。模型只操作任务环境，发布和最终成功判定由交付模块完成。

**Tech Stack:** OpenAI Python SDK、httpx、Pydantic、Python 3.13、Docker 执行环境、Git。

**Spec:** [技术设计](../specs/2026-11-09-intellideploy-phase1-design.md)，[公共接口](2026-11-09-phase1-00-roadmap.md)。依赖 01 全部任务；真实调用前接入 06-F1 用量账本。

## Global Constraints

- “模型直接调用 DeepSeek 官方 API。”
- “默认每个应用只有一个活跃的修改或发布任务。”
- “完整交付需要核心验收项全部 PASS。”
- 遵守总计划；mock 只验证编排，最终四条路径需要真实样本；检索服务故障不能作为进入 D 的依据。

### Task 02-G1: DeepSeek 协议、用量与有界重试

**Files:** Create backend/app/agent/{__init__,deepseek}.py、tests/phase1/test_deepseek.py。Modify backend/app/config.py。

**Interfaces:** DeepSeekClient.complete(messages: list[dict], tools: list[dict], model: str) -> ModelTurn，async；配置 DEEPSEEK_API_KEY、DEEPSEEK_BASE_URL=https://api.deepseek.com、DEEPSEEK_MODEL=deepseek-flash。最多重试三次，429/408/5xx 退避，401/402/参数错误立即返回明确错误。

- [ ] **Step 1: 写协议检查。** 用 httpx.MockTransport 返回实际 Chat Completions 格式；返回 assistant reasoning_content、tool_calls、usage。测试不调用真实模型。

```python
@pytest.mark.asyncio
async def test_preserves_reasoning_and_tool_ids():
    payload = {'choices': [{'message': {'role': 'assistant', 'content': None,
      'reasoning_content': '检查依赖', 'tool_calls': [{'id': 'c1', 'type': 'function',
      'function': {'name': 'read_file', 'arguments': '{"path":"package.json"}'}}]}}],
      'usage': {'prompt_tokens': 20, 'completion_tokens': 5, 'prompt_cache_hit_tokens': 10}}
    transport = httpx.MockTransport(lambda request: httpx.Response(200, json=payload))
    client = DeepSeekClient(api_key='test-only', transport=transport)
    turn = await client.complete([{'role': 'user', 'content': '运行'}], [], 'deepseek-flash')
    assert turn.assistant_message['reasoning_content'] == '检查依赖'
    assert turn.calls[0].id == 'c1'
    assert (turn.input_tokens, turn.cached_input_tokens, turn.output_tokens) == (20, 10, 5)
```

- [ ] **Step 2: 红测。** `.venv/bin/python -m pytest tests/phase1/test_deepseek.py -q`。
- [ ] **Step 3: 实现客户端。** 使用 AsyncOpenAI 与独立 AsyncClient；SDK 内置 max_retries=0，由本模块统一重试；工具 arguments 必须解析为字典。保留 assistant_message 中模型需要的字段，工具请求错误抛出可记录的协议异常，不当成“生成完成”。

```python
response = await client.chat.completions.create(
    model=model, messages=messages, tools=tools or None,
    extra_body={'thinking': {'type': 'enabled'}},
)
raw = response.choices[0].message.model_dump(exclude_none=False)
calls = [ToolCall(id=c.id, name=c.function.name,
                 arguments=json.loads(c.function.arguments))
         for c in response.choices[0].message.tool_calls or []]
usage = response.usage
turn = ModelTurn(assistant_message=raw, calls=calls,
    input_tokens=usage.prompt_tokens,
    cached_input_tokens=getattr(usage, 'prompt_cache_hit_tokens', 0) or 0,
    output_tokens=usage.completion_tokens)
```

usage 缺失时保存待核对事件，不能用 0 宣称免费；对此增加 ModelTurn.usage_known: bool=True，由响应缺失设为 False。服务日志不得输出 Key、完整思考内容。测试覆盖流式/非流式使用方式：初期生成采用非流式每轮结果，用户进度来自持久事件，无需先实现复杂 token 流拼装。

- [ ] **Step 4: 绿测。** 增加 429 后成功、401 只请求一次、非法 arguments 失败及 usage 缺失检查，运行同文件。真实 Key 就绪后用一个读写临时文件的工具调用验证协议，不改业务仓库。
- [ ] **Step 5: 提交。** `feat: connect DeepSeek tool calls and usage`。

### Task 02-G2: 独立工作区与工具执行

**Files:** Create backend/app/agent/workspace.py、backend/app/agent/tools.py、infra/agent/Dockerfile、tests/phase1/test_workspace_tools.py、tests/phase1/test_sandbox_real.py。

**Interfaces:** create_workspace(job_id: str) -> str；execute_tool(workspace_id: str, call: ToolCall) -> ToolResult；snapshot_workspace(workspace_id: str, destination: Path) -> Path。纯文件助手 safe_path(root: Path, relative: str) -> Path 只供控制端管理有限工作区，不访问任意宿主路径。

- [ ] **Step 1: 写路径与执行隔离检查。** 临时 root 是 pytest tmp_path；真实环境测试标记 sandbox，连接专用执行节点。

```python
def test_rejects_symlink_escape(tmp_path):
    (tmp_path / 'escape').symlink_to('/etc')
    with pytest.raises(ValueError):
        safe_path(tmp_path, 'escape/passwd')

@pytest.mark.sandbox
def test_command_timeout_keeps_environment_usable(sandbox_workspace):
    result = execute_tool(sandbox_workspace, ToolCall(id='slow', name='run_command',
        arguments={'argv': ['python', '-c', 'import time; time.sleep(10)'], 'timeout': 1}))
    assert not result.ok
    again = execute_tool(sandbox_workspace, ToolCall(id='next', name='run_command',
        arguments={'argv': ['python', '-c', 'print(42)'], 'timeout': 5}))
    assert again.ok and '42' in again.content
```

- [ ] **Step 2: 红测。** 运行 test_workspace_tools.py；真实隔离测试在专用节点运行 test_sandbox_real.py -m sandbox，不能跳过后声称隔离通过。
- [ ] **Step 3: 实现最小工具注册表。** 所有参数用 Pydantic 验证，read/write/list/apply_patch 都限定在 /workspace，run_command 只在该容器内执行。工具结果上限 64 KiB，命令默认 60 秒、最大 600 秒；完整输出存为内部任务材料。

```python
def safe_path(root, relative):
    base = root.resolve()
    target = (base / relative).resolve()
    if not target.is_relative_to(base):
        raise ValueError('path outside workspace')
    return target

TOOLS = {'list_files': list_files, 'read_file': read_file,
         'write_file': write_file, 'apply_patch': apply_patch,
         'run_command': run_command}
```

执行镜像提供 Python 3.13、Node 24、Git 和依赖安装工具；固定实际镜像 digest。每个 job 使用独立目录和非 root 容器；限制内存、CPU、磁盘、PID，移除 capabilities、禁止提权，不挂宿主 Docker socket或平台配置目录。网络仅允许公开依赖/检索访问及限定的平台工具代理，不允许访问控制面私网。控制端创建环境和构建镜像；模型不能创建带宿主挂载的容器。工作区路径写入 Checkpoint，进程重启后仍可找到。

- [ ] **Step 4: 绿测。** 增加 ../、绝对路径、超大输出、非法工具名、容器内缺少平台管理 Key 的检查；固定镜像后实测重启 Worker 不丢工作区。
- [ ] **Step 5: 提交。** `feat: add isolated generation workspace tools`。

### Task 02-G3: 检索、四条路径与源码准备

**Files:** Create backend/app/agent/retrieval.py、backend/app/agent/routing.py、prompts/generation/{route,deploy_existing,modify_existing,compose_components,generate_app}.md、tests/phase1/test_routes.py。Modify backend/app/agent_core/memory/vector_store.py、backend/app/agent/tools.py；复用 backend/app/agent_core/brains/github_retriever.py 和 fallback/templates/。

**Interfaces:** retrieve_sources(requirement: Requirement) -> RetrievalResult，async；plan_route(requirement, candidates, model_client) -> RoutePlan，async；prepare_sources(workspace_id, plan: RoutePlan) -> list[RepoSource]。路线 Prompt 不是来源事实，实际下载必须固定 commit。

- [ ] **Step 1: 写四条决策和真实源码准备检查。** 测试候选为自建小仓库，模型返回固定 JSON 仅用于验证路由约束；代码下载用本地 fixture Git 仓库，最终公开 GitHub 样本在总验收执行。

```python
def test_compose_and_generate_are_distinct():
    compose = RoutePlan(route='COMPOSE_COMPONENTS', steps=['整合'], reason='分工清楚',
      sources=[RepoSource(url='https://github.com/a/notes', commit='a'*40, role='记录'),
               RepoSource(url='https://github.com/b/search', commit='b'*40, role='检索')])
    generated = RoutePlan(route='GENERATE_APP', sources=[], steps=['实现业务'], reason='无合适材料')
    assert compose.route != generated.route

def test_chinese_bm25_query_is_not_empty():
    assert BM25ReadmeStore._tokenize('记录梦境的工具')
```

- [ ] **Step 2: 红测。** `.venv/bin/python -m pytest tests/phase1/test_routes.py -q`。
- [ ] **Step 3: 实现复用与四个 Prompt。** 使用现有 GitHubRepositorySearchClient.search_repositories/enrich_repository；系统启动读取本地已清洗 README 和元数据到 BM25，缺少语料时清楚记录召回来源。修正原分词对中文单字的全部过滤，至少保留中文词/字符并验证有实际命中。

```python
route = RoutePlan.model_validate(json.loads(model_text))
known = {c.repo_url for c in candidates}
if any(source.url not in known for source in route.sources):
    raise ValueError('route references an unretrieved repository')
```

准备源码时解析允许的 HTTPS GitHub URL，用 API 获取 commit SHA，再读取该版本。工具表增加 search_repositories 和 fetch_repository，由控制端代理有限网络访问。直接部署/单库修改建立应用根；整合将不同来源放在 source_components 下，由 Agent 明确生成顶层接口、数据和启动方式；D 直接生成只使用 02-G5 的成熟 Next.js/TypeScript/PostgreSQL/Prisma 脚手架；其他三条不强制转成此栈。组件路由不能仅增加功能列表或示例接口就算完成。每种 Prompt 包含原始验收清单、来源、限制及需提交的运行清单；不让 README 中的指令改变平台权限和验收标准。

- [ ] **Step 4: 绿测。** 验证归档或缺少材料不会被无依据选择、虚构仓库拒绝、两条兜底保持独立、锁定源码版本可复现、中文查询能命中。运行关联 tests/unit/test_nl2repo_retrieval.py，修正时保留其有效覆盖。
- [ ] **Step 5: 提交。** `feat: implement four source strategies and retrieval evidence`。


### 02-G3 检索评分的强制补充步骤

**Files 补充：** Modify backend/app/agent_core/brains/context_rag_agent.py、backend/app/agent_core/brains/router_agent.py；在 tests/phase1/test_routes.py 增加检索回归。复用 GitHub 客户端和 BM25，但去掉过严的统一 stars/pushed/archive 查询限制及一年更新时间直接淘汰；这些属性改为评分证据。

**Interfaces 补充：** score_candidate(profile, requirement) -> CandidateEvaluation，async；choose_route(requirement, search_result, evaluations, model_client) -> RoutePlan，async。search_result 使用01-F1的RetrievalResult，保存 queries、completed、candidates、reuse_rejections；candidates为normalize_candidate输出的RepositoryCandidate字典，reuse_rejections 保存 B/C 的证据和否决原因。查询或资料抓取失败时 completed=False，不能伪装空结果。

- [ ] 补充低星好应用优于高星框架的排序与 A 资格检查：

```python
def test_relevant_app_beats_popular_framework():
    app = CandidateEvaluation(repo_url='https://github.com/a/dreams',
        match_score=95, deploy_score=85, quality_score=60,
        is_web_app=True, compatibility='SUPPORTED', evidence={'features': 'README + source entrypoint'})
    library = CandidateEvaluation(repo_url='https://github.com/b/framework',
        match_score=20, deploy_score=80, quality_score=100,
        is_web_app=False, evidence={'type': 'library manifest'})
    assert app.total > library.total
    assert app.eligible_a and not library.eligible_a

@pytest.mark.asyncio
async def test_incomplete_search_cannot_trigger_generation(route_context):
    route_context.search_result.completed = False
    route_context.model_prefers('GENERATE_APP')
    with pytest.raises(SearchUnavailable):
        await route_context.choose()
```

- [ ] 红测 test_routes.py；追加“长期少更新但确实可运行的应用能进入候选”“有合适 A 不选择 D”“未读关键材料不假装高置信”“B/C 与 D 的评估记录可查”四个回归。
- [ ] 实现至少原始业务表达、英文关键词、同义词/应用类别查询。使用本地已验证仓库/README 补充；获取文件树、关键配置、入口和必要代码之后才完整评分。评分维度为需求 60%、部署 25%、质量 15%，初始 A 门槛匹配>=80、部署>=70、综合>=75且核心缺失/未知为空；这些是可配置起始规则，不是成功率承诺。
- [ ] 先检查合格 A，再评估 B/C。选择 D 必须 completed=True 且有 B/C 的复用评估理由；存在完整证据的合格 A 时拒绝模型直接 D。超时/限流重试后仍不可用抛出 SearchUnavailable，记录可重试故障，不调用生成器。
- [ ] 绿测、人工复核已知相关项目的实际召回和 Top N；记录查询、候选、证据、评分版本和路线。未经真实验收不能报告检索成功率。

### Task 02-G4: 可恢复工具循环、业务追问与预算

**Files:** Create backend/app/agent/loop.py、tests/phase1/test_agent_loop.py。Modify backend/app/jobs/worker.py、backend/app/core/types.py。

**Interfaces:** run_generation(job_id, checkpoint: Checkpoint, model: DeepSeekClient, execute_tool, persist, record_usage) -> GenerationOutput，async。GenerationOutput 定义在 core/types.py：checkpoint、manifest: AppManifest|None、question: str|None、exhausted: bool=False。模型提交 finish_implementation 只产生候选清单，不改变 Job 成功状态。

- [ ] **Step 1: 写崩溃恢复与追问检查。** FixedModel 在同文件实现 async complete，依次返回 read_file 工具调用及 finish_implementation；CounterTool 记录调用次数。

```python
@pytest.mark.asyncio
async def test_completed_call_is_not_executed_twice():
    checkpoint = Checkpoint(completed_calls={'c1': ToolResult(call_id='c1', ok=True, content='saved')})
    model = FixedModel([ModelTurn(assistant_message={'role': 'assistant'},
        calls=[ToolCall(id='c1', name='read_file', arguments={'path': 'README.md'})])])
    tool = CounterTool()
    await run_generation('job', checkpoint, model, tool, persist_memory, record_usage_memory)
    assert tool.calls == 0
```

persist_memory 保存每个检查点副本供断言；record_usage_memory 按 operation_id 拒绝重复。FixedModel 输出结束后返回明确 ask_user 或 finish_implementation，不能让测试无限循环。

- [ ] **Step 2: 红测。** `.venv/bin/python -m pytest tests/phase1/test_agent_loop.py -q`。
- [ ] **Step 3: 实现 checkpoint-before-effect。** 模型响应先保存 assistant 和 pending_calls；每次工具执行先记录 STARTED，再保存 COMPLETED 和结果，最后回传匹配的 tool_call_id。UNKNOWN 工具调用需重新检查效果，不能直接重放非幂等命令。

```python
checkpoint.messages.append(turn.assistant_message)
checkpoint.pending_calls = turn.calls
await persist(checkpoint)
for call in turn.calls:
    result = checkpoint.completed_calls.get(call.id)
    if result is None:
        result = await execute_tool(call)
        checkpoint.completed_calls[call.id] = result
        await persist(checkpoint)
    checkpoint.messages.append({'role': 'tool', 'tool_call_id': call.id,
                                'content': result.content})
```

ask_user 保存业务问题并转 WAITING_USER；finish_implementation 校验候选 AppManifest 并进入验证阶段。无工具的普通结束文本不能触发成功。保存真实用量，扣除缓存命中后分别记录输入/缓存输入/输出，不重复计量。预算不足转 PAUSED_QUOTA；总费用和墙钟由配置限制。最多两次路线切换，连续三次同一错误且无变化停止；上下文摘要保留需求、验收、失败和工具对应关系。遇到升级到 Pro 也继续同一账本预算。

Worker process_job交03-D6 run_pipeline，后者调用run_generation得到GenerationOutput，再通过候选验证及03-D5发布流程；开发阶段输出“候选产物已就绪”，绝不能标记交付成功。同步工具通过 async 回调包装 await asyncio.to_thread(execute_tool, checkpoint.workspace, call)，不能 await 同步返回值。ask_user 和 finish_implementation 由循环拦截，不作为容器命令。

- [ ] **Step 4: 绿测。** 覆盖检索故障不转 D、合适现成项目优先 A、普通最终文本不算成功、业务问题恢复、额度暂停、未知工具结果停止重放、无进展停止及上下文中保留 reasoning_content。06 总验收中以真实 DeepSeek 跑四条业务路径。
- [ ] **Step 5: 提交。** `feat: persist and resume DeepSeek generation loop`。

### Task 02-G5: 固定成熟脚手架与业务实现计划

**Files:** Create backend/app/agent/scaffold.py、prompts/generation/generate_app.md、tests/phase1/test_scaffold.py。创建 scaffolds/nextjs-prisma/ 下的 package.json、package-lock.json、tsconfig.json、next.config.ts、Dockerfile、app/layout.tsx、app/page.tsx、app/api/health/route.ts、prisma/schema.prisma、prisma/migrations/、lib/platform/client.ts、lib/platform/identity.ts、lib/platform/files.ts、lib/platform/ai.ts、lib/platform/search.ts。Modify backend/app/agent/tools.py，仅保留一期工具。

**Interfaces:** prepare_scaffold(workspace_id: str, template_root: Path, app_name: str) -> str，返回真实模板版本哈希；make_generation_plan(requirement: Requirement, template_version: str, model_client) -> RoutePlan，async；validate_plan(plan: RoutePlan, expected_version: str) -> None。D 首次创建复制脚手架，继续调整复制当前 AppVersion 的源码快照；A/B/C 由已评分候选准备源码。

- [ ] **Step 1: 写脚手架完整性与版本检查。** template_root 指向任务创建的 Next.js/Prisma 代码；workspace 为受限临时环境。

```python
def test_scaffold_contains_platform_and_database_baseline(template_root):
    required = ['package.json', 'package-lock.json', 'Dockerfile',
                'prisma/schema.prisma', 'lib/platform/identity.ts',
                'lib/platform/ai.ts', 'lib/platform/search.ts']
    assert all((template_root / p).is_file() for p in required)
    schema = (template_root / 'prisma/schema.prisma').read_text()
    assert 'provider = "postgresql"' in schema

def test_wrong_template_version_is_rejected():
    with pytest.raises(ValueError):
        validate_plan(RoutePlan(route='GENERATE_APP', template_version='other',
                      steps=['实现'], reason='业务需求'), expected_version='locked-v1')
```

- [ ] **Step 2: 红测。** 运行 .venv/bin/python -m pytest tests/phase1/test_scaffold.py -q。缺底座文件或版本校验应失败。

- [ ] **Step 3: 建立并验证一套脚手架。** 使用兼容的稳定 Next.js、React、TypeScript、Prisma 版本，提交 package-lock.json。Next.js 承载页面和服务端接口，Prisma 连接平台提供的 PostgreSQL；Tailwind 和成熟 UI 组件提供基础界面。平台客户端只在服务端读取实例访问凭据，模型 Key 不进入应用。

```json
{"scripts":{"dev":"next dev","build":"prisma generate && next build",
"start":"node .next/standalone/server.js","typecheck":"tsc --noEmit",
"db:migrate":"prisma migrate deploy"}}
```

平台身份、文件、AI、搜索模块与 04-C1/C2/C3 的接口接通；没有配置时明确失败，不能用 demo-token 或 echo 回答。模板元信息和文件哈希形成 template_version，由后端控制，validate_plan 拒绝不匹配版本。为验证准备独立临时 PostgreSQL 数据空间；正式实例的数据不放进生成工作区。

D 的 generate_app Prompt 携带需求、验收、固定栈和平台接口，要求实现页面、业务接口、Prisma 模型及迁移；D 内允许兼容 npm 依赖，不改选框架或数据库。仓库搜索/获取工具为 A/B/C 保留，不能在本任务中移除；D 不用它们绕回现成源码。继续调整保留已有业务及数据，不能重新复制空模板替代修改。

- [ ] **Step 4: 绿测与真实底座验证。** 运行 npm ci、npm run typecheck、npm run build；验证 Prisma Client、健康接口、两用户权限、数据保存/读取及真实平台 AI/搜索。模型实际生成再验收笔记、梦境分析和实时信息工具，空模板主页通过不能代表业务完成。

- [ ] **Step 5: 提交。** feat: add verified Next.js Prisma generation scaffold。仅提交脚手架、单一生成 Prompt 和对应检查。

### Task 02-G6: 对话整理需求、覆盖检查与变更版本（P1）

**Files:** Create backend/app/agent/requirements.py、prompts/generation/requirements.md、tests/phase1/test_requirement_revision.py。Modify backend/app/agent/loop.py、backend/app/apps/service.py、backend/app/apps/models.py、backend/app/core/types.py。依赖01、02-G1；先于检索和源码实现接入。

**Interfaces:** compile_requirement(messages: list[dict], previous: Requirement | None, model_client: DeepSeekClient) -> RequirementDraft，async；validate_revision(previous, draft, messages) -> Requirement；persist_requirement(session, job_id, requirement) -> int。RequirementDraft、DemandFact、Requirement在总计划统一定义；Job.requirement_revision固定本次需求版本，AppVersion记录相同revision。messages至少有id/sequence/role/content，不把业务消息与工具日志混在一起。

- [ ] **Step 1: 写漏项、追问和回归检查。** tests内定义消息fixture和假的模型transport，真实DeepSeek需求理解在07-E4人工复核。

```python
def test_adding_search_preserves_existing_acceptance(requirement_context):
    previous = requirement_context.notes_requirement()
    draft = requirement_context.draft_adding('联网搜索')
    revised = validate_revision(previous, draft, requirement_context.messages)
    assert {x.id for x in previous.acceptance} <= {x.id for x in revised.acceptance}
    assert revised.revision == previous.revision + 1

def test_unmapped_user_fact_cannot_be_frozen(requirement_context):
    draft = requirement_context.draft_with_unmapped_fact('上传图片')
    with pytest.raises(RequirementCoverageError):
        validate_revision(None, draft, requirement_context.messages)
```

- [ ] **Step 2: 红测。** `PYTHONPATH=backend .venv/bin/python -m pytest tests/phase1/test_requirement_revision.py -q`。初次因requirements模块缺失失败。
- [ ] **Step 3: 实现结构化整理和版本冻结。** requirements Prompt要求按用户原消息提取业务事实（source_message_id、原文quote、功能/数据/权限/外部依赖分类）、按可观察结果拆验收项，每条事实映射至少一个验收ID，或给出明确的追问/不支持原因。另一次同模型审阅只读原消息和draft，检查漏项；确定性校验引用的消息/原文确实存在、ID唯一、事实都有映射。不把同模型审阅当成功率证明；07-E4独立人工核对。模型JSON无效或覆盖未完成最多纠正两轮，仍无效FAILED/REQUIREMENT_INVALID，不能跳过需求阶段。

```python
old = {item.id for item in previous.acceptance} if previous else set()
new = {item.id for item in draft.acceptance}
removed = old - new
if removed - set(draft.explicit_removals):
    raise RequirementCoverageError('previous acceptance was silently removed')
```

explicit_removals必须能对应本次用户明确删除/替换功能的消息，validate_revision复核quote与消息；变更验收内容也按删除旧ID+新增ID处理，不能改写旧expected降低门槛。旧数据保留、其他用户拒绝访问、真实AI/搜索及文件保存按需求生成独立核心项。初始业务名称、颜色等可合理推断，默认私有；影响数据公开、权限或关键业务缺少信息时一次合并最多两个业务问题，保存draft后WAITING_USER，不询问技术栈或要求用户选择A/B/C/D。用户回复恢复同一job、重新整理；仍缺关键资料可以继续等待，不因追问轮数耗尽擅自开放数据。明确要求原生/桌面生成时解释一期支持Web并WAITING_USER询问是否接受Web，不冒充原生交付。

RequirementRecord保存revision、原消息引用、事实映射、验收和review结果；在事务锁下冻结，写入Job.requirement_revision。已有线上应用调整从当前已发布版本的需求和源码开始，保留旧项为回归检查。失败任务的继续对话建立新job并沿用未完成目标；WAITING_USER仅恢复旧job。运行中新增需求返回409并保留输入，避免改变当前测试门槛。冻结后模型不能自行删验收；业务新答复需要新的冻结记录，旧执行材料不再当该revision的验证证据。

- [ ] **Step 4: 绿测。** 漏事实、虚构quote、重复ID、隐式删功能、显式删功能、私有默认、少量追问/恢复、并发消息、已有应用回归、原生请求范围反馈全部检查；用真实模型试“私有笔记+图片+分析历史”，人工核对每个要求都有验收，不做固定演示。
- [ ] **Step 5: 提交。** `feat: compile versioned requirements and preserve regressions`。

### Task 02-G7: 可更新检索索引、实时证据与运行兼容评估（P4）

**Files:** Create backend/app/agent/repository_index.py、backend/app/agent/compatibility.py、scripts/update_repository_index.py、tests/phase1/test_repository_index.py、tests/phase1/test_runtime_compatibility.py、tests/phase1/cases/retrieval.json。Modify scripts/build_vector_db.py、backend/app/agent/retrieval.py、backend/app/agent/routing.py、backend/app/agent_core/memory/vector_store.py、backend/app/config.py。依赖02-G3；不引入向量数据库服务。

**Interfaces:** update_index(seeds: list[str], destination: Path, github_client) -> IndexUpdateReport，async；load_index(path: Path) -> RepositoryIndex；assess_compatibility(profile: dict, requirement: Requirement) -> CompatibilityReport；select_deploy_target(manifest: AppManifest, targets: list[dict]) -> str。RepositoryIndex/IndexUpdateReport在repository_index.py定义（schema_version、generated_at、items及失败列表）；CompatibilityReport在core/types.py定义。旧retrieve_sources返回candidates的接口改为RetrievalResult，所有调用同步，不同时维护两种返回结构。

- [ ] **Step 1: 写冷启动、更新中断和高匹配兼容性检查。** tmp_path存本地索引，GitHub transport可返回404/429/改动SHA；不执行真实删除。

```python
def test_interrupted_update_keeps_last_good_snapshot(index_context):
    before = index_context.snapshot_hash()
    index_context.interrupt_update()
    assert index_context.snapshot_hash() == before

def test_high_match_is_not_eligible_when_runtime_is_unsupported(compatibility_context):
    report = assess_compatibility(compatibility_context.gpu_only_desktop(),
                                  compatibility_context.web_requirement())
    assert report.status == 'UNSUPPORTED'
    assert 'gpu' in report.reasons
```

- [ ] **Step 2: 红测。** pytest test_repository_index.py/test_runtime_compatibility.py；额外运行02-G3检索评分回归。
- [ ] **Step 3: 实现原子索引与兼容规则。** 第一版索引是平台登记的真实仓库README/元数据JSON快照+现有BM25。首次没快照仍做实时GitHub检索；缺本地语料不可伪造召回。管理命令`PYTHONPATH=backend .venv/bin/python scripts/update_repository_index.py --seeds tests/phase1/cases/retrieval.json --output artifacts/repository-index/current.json`从样本中的known_repositories去重取种子，增量刷新记录repo_url/default_branch/commit/license/README哈希/fetched_at/status，另保存评分证据来源；不要把评测答案写进用户查询或强制路由。

先写临时快照并验证schema，再os.replace切换；文件锁/维护任务租约防止两个更新覆盖。失败仓库留原条目并标STALE/DELETED/UNAVAILABLE，历史来源不被改写。维护任务每日刷新，启动读最后完整快照并报告快照年龄；本地资料超过7天仅用于召回，完整评分前实时读取选中commit的必要代码。实时404候选剔除、429/超时有界重试；候选关键文件失败记录UNKNOWN。实时检索不可用时缓存仅用于保留候选和诊断，重试后仍不完整则SearchUnavailable可重试失败；不执行D，也不暗中省略完整检索来执行A/B/C。下一次用户重试继续已有证据但重新核对实时资料。D必须RetrievalResult.completed=True且B/C复用否决理由完整；completed表示所有计划查询成功、候选评估覆盖完成，不代表遍历了全部GitHub。

首批自动执行环境：Linux amd64 CPU；Node.js LTS的React/Vue/Next/Express等Web项目、Python ASGI/WSGI项目、静态Web项目，以及有可核对Dockerfile/Compose的其他语言Web项目。支持项目原有PostgreSQL/MySQL/Redis/SQLite等依赖；依赖必须固定版本、独立持久资源并能映射AppManifest。A/B/C不强制改成Next/PostgreSQL；非容器项目的受支持语言由Agent生成Dockerfile并真实构建。需要GPU、Windows GUI、原生客户端、不可无人值守购买的第三方服务或平台没有的专用硬件时标UNSUPPORTED；缺依赖证据为UNKNOWN，继续读文件/启动验证，不用热度抵消。CompatibilityReport输出status/reasons/runtime/databases/architecture/evidence，eligible_a还要求SUPPORTED。B可有明确改造方案，C逐来源核对并验证顶层业务；合理复用不可行再D，向普通用户反馈功能边界而非技术选择题。

所有来源保存commit和LICENSE/NOTICE，整合保留归因及已知许可证要求；不明使用条件记录UNKNOWN由管理员核对，不能冒充可发布来源。此检查合并在来源准备，不建设额外合规服务。select_deploy_target选择已登记、HEALTHY、架构/持久存储/容量满足清单的目标，先按平台默认目标，容量不足选兼容目标；无兼容资源FAILED/TARGET_UNAVAILABLE可重试，不自动购云服务器。

- [ ] **Step 4: 绿测和实际召回。** 无本地索引仍实时命中、更新中断不损坏、长期少更新可运行项目保留、关键代码缺失不高置信、实时故障不转D、跨栈项目保留原库、缺GPU不假成功；人工查看已知适配样本Top10和score/evidence，不把种子召回当自动搜索成功。
- [ ] **Step 5: 提交。** `feat: refresh repository evidence and assess runtime compatibility`。

#### 衔接类型的定义责任

RequirementCoverageError、RequirementInvalid在agent/requirements.py定义为ValueError子类；compile_requirement的两轮纠正与validate_revision复核使用这两个错误。RepositoryIndex与IndexUpdateReport在agent/repository_index.py为Pydantic模型，items至少含repo_url/default_branch/commit/license/readme_hash/fetched_at/status/readme，IndexUpdateReport含updated/unchanged/failed/snapshot_version。SearchUnavailable在agent/retrieval.py定义，可重试且不会产空completed=True结果。plan_route作为choose_route的兼容封装消费同一个RetrievalResult，不绕过完整度/兼容评分。

## 实施进度（2026-11-10）

02-G1：直接AsyncOpenAI/DeepSeek客户端，保留reasoning_content/tool_call_id，解析实际输入/缓存/输出用量；429/408/5xx最多三次，401/402立即报供应商故障，断连结果未知不盲目重放。7项MockTransport协议检查通过；真实Key调用未执行。客户端不设置任务成功，真实调用记账由02-G4/03-D6统一接入。

02-G6需求基础：原文/事实/验收映射、保留旧验收与事实、显式移除证据、两轮JSON纠正和独立审阅、租约隔离及冻结revision不可覆写共10项检查通过。编译与冻结模块尚未接入03-D6完整pipeline，真实模型理解与人工质量复核未执行。persist_requirement必须传worker_id/generation，review_metadata可保存移除/审阅证据。

02-G2：受限工作区及list/read/write/apply_patch/run_command/search/fetch工具已实现。宿主不配置隔离执行器时run_command明确失败；仓库工具要求受控代理、HTTPS GitHub及40位commit。固定digest镜像包含Python3.13.18、Node24.22.2和Git，以非root、无网络、只读根、cap-drop、no-new-privileges、CPU/内存/PID限制运行。本机固定镜像真实sandbox超时/恢复/无DeepSeek Key检查PASS；生产专用节点、磁盘配额和受控依赖网络仍NOT_RUN。

02-G3：多查询检索、中文BM25、候选归一化、60/25/15证据评分、A优先、检索不完整禁止D、虚构来源拒绝、B/C/D区分及固定commit源码展开已实现。新路线8项与旧检索10项通过；真实GitHub Top N人工复核未执行。

02-G5：固定Next.js16.4.6/React19.2/Prisma7.10.1/PostgreSQL脚手架及内容哈希版本、平台identity/files/AI/search服务端客户端已实现。4项Python检查及npm ci/typecheck/build、0高危audit通过；04能力与真实数据库/AI/search业务验证未执行。

02-G7：原子JSON/BM25索引、更新中断保留旧快照、刷新失败标STALE、运行兼容性及健康目标选择已实现。索引/兼容7项与G3回归通过；真实Token增量刷新、每日维护和生产目标核对未执行。

02-G4：持久工具循环保存assistant/reasoning/pending/completed/tool_call_id；effect前后保存检查点，旧pending未知效果停止自动重放，普通文本不算成功，ask_user与finish_implementation分别返回等待/候选，三轮无进展停止。模型输入/缓存输入/输出以唯一子operation从job父预留结算；7项循环/真实PG账本检查通过。02模块只产生GenerationOutput，03-D6尚未接入Worker、候选验证和发布，不能宣称生成应用交付。

本轮phase1累计95项通过、1项sandbox默认跳过；该sandbox另以本机固定镜像显式运行PASS。真实DeepSeek Key、GitHub Token、生产隔离节点及四路线业务样本未交接，对应检查保持NOT_RUN。
