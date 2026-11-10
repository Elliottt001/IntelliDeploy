# Phase 1 Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 直接调用 DeepSeek，在受限工作区内基于固定成熟脚手架生成业务，并保存可恢复的工具执行记录。

**Architecture:** 使用一套锁定依赖的 Next.js/TypeScript/PostgreSQL/Prisma 脚手架，模型在此基础上实现业务。工具表不包含 GitHub 仓库获取和自动选路，发布与最终成功判定由交付模块完成。

**Tech Stack:** Python Worker、OpenAI SDK、Node.js 24 执行环境、Next.js、TypeScript、PostgreSQL、Prisma、Git 本地版本操作。

**Spec:** [技术设计](../specs/2026-11-09-intellideploy-phase1-design.md)，[公共接口](2026-11-09-phase1-00-roadmap.md)。依赖 01 全部任务；真实调用前接入 06-F1 用量账本。

## Global Constraints

- “模型直接调用 DeepSeek 官方 API。”
- “默认每个应用只有一个活跃的修改或发布任务。”
- “完整交付需要核心验收项全部 PASS。”
- 遵守总计划；mock 只验证编排，最终脚手架生成需要不同业务的真实样本。

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
        arguments={'argv': ['node', '-e', 'setTimeout(() => {}, 10000)'], 'timeout': 1}))
    assert not result.ok
    again = execute_tool(sandbox_workspace, ToolCall(id='next', name='run_command',
        arguments={'argv': ['node', '-e', 'console.log(42)'], 'timeout': 5}))
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

执行镜像提供 Node 24、Git 本地操作和 npm/Prisma 工具，Python 留在平台 Worker 与验证器；固定实际镜像 digest。每个 job 使用独立目录和非 root 容器；限制内存、CPU、磁盘、PID，移除 capabilities、禁止提权，不挂宿主 Docker socket或平台配置目录。网络仅允许 npm 依赖、官方文档和平台工具代理访问及限定的平台工具代理，不允许访问控制面私网。控制端创建环境和构建镜像；模型不能创建带宿主挂载的容器。工作区路径写入 Checkpoint，进程重启后仍可找到。

- [ ] **Step 4: 绿测。** 增加 ../、绝对路径、超大输出、非法工具名、容器内缺少平台管理 Key 的检查；固定镜像后实测重启 Worker 不丢工作区。
- [ ] **Step 5: 提交。** `feat: add isolated generation workspace tools`。

### Task 02-G3: 固定成熟脚手架与业务实现计划

**Files:** Create backend/app/agent/scaffold.py、prompts/generation/generate_app.md、tests/phase1/test_scaffold.py。创建 scaffolds/nextjs-prisma/ 下的 package.json、package-lock.json、tsconfig.json、next.config.ts、Dockerfile、app/layout.tsx、app/page.tsx、app/api/health/route.ts、prisma/schema.prisma、prisma/migrations/、lib/platform/client.ts、lib/platform/identity.ts、lib/platform/files.ts、lib/platform/ai.ts、lib/platform/search.ts。Modify backend/app/agent/tools.py，仅保留一期工具。

**Interfaces:** prepare_scaffold(workspace_id: str, template_root: Path, app_name: str) -> str，返回真实模板版本哈希；make_implementation_plan(requirement: Requirement, template_version: str, model_client) -> ImplementationPlan，async；validate_plan(plan: ImplementationPlan, expected_version: str) -> None。首次创建复制脚手架，继续调整复制当前 AppVersion 的源码快照。

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
        validate_plan(ImplementationPlan(template_version='other',
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

generate_app Prompt 携带需求、验收、固定栈和平台接口，要求实现页面、业务接口、Prisma 模型及迁移；允许兼容 npm 依赖，禁止换框架/数据库、克隆现成应用或拼接多个仓库。一期不注册仓库搜索/获取工具。继续调整保留已有业务及数据，不能重新复制空模板替代修改。

- [ ] **Step 4: 绿测与真实底座验证。** 运行 npm ci、npm run typecheck、npm run build；验证 Prisma Client、健康接口、两用户权限、数据保存/读取及真实平台 AI/搜索。模型实际生成再验收笔记、梦境分析和实时信息工具，空模板主页通过不能代表业务完成。

- [ ] **Step 5: 提交。** feat: add verified Next.js Prisma generation scaffold。仅提交脚手架、单一生成 Prompt 和对应检查。

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

ask_user 保存业务问题并转 WAITING_USER；finish_implementation 校验候选 AppManifest 并进入验证阶段。无工具的普通结束文本不能触发成功。保存真实用量，扣除缓存命中后分别记录输入/缓存输入/输出，不重复计量。预算不足转 PAUSED_QUOTA；总费用和墙钟由配置限制。连续三次同一错误且无变化停止；上下文摘要保留需求、验收、失败和工具对应关系。遇到升级到 Pro 也继续同一账本预算。

Worker 将 GenerationOutput 交给 03-D5 发布流程；开发阶段输出“候选产物已就绪”，绝不能标记交付成功。同步工具通过 async 回调包装 await asyncio.to_thread(execute_tool, checkpoint.workspace, call)，不能 await 同步返回值。ask_user 和 finish_implementation 由循环拦截，不作为容器命令。

- [ ] **Step 4: 绿测。** 覆盖普通最终文本不算成功、业务问题恢复、额度暂停、未知工具结果停止重放、无进展停止及上下文中保留 reasoning_content。06 总验收中以真实 DeepSeek 在同一脚手架上生成不同业务，并验证 Prisma 数据保留。
- [ ] **Step 5: 提交。** `feat: persist and resume DeepSeek generation loop`。
