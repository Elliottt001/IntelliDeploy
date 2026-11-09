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
- 遵守总计划；mock 只验证编排，最终四条路径需要真实样本。

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

**Interfaces:** retrieve_sources(requirement: Requirement) -> list[RepositoryCandidate]，async；plan_route(requirement, candidates, model_client) -> RoutePlan，async；prepare_sources(workspace_id, plan: RoutePlan) -> list[RepoSource]。路线 Prompt 不是来源事实，实际下载必须固定 commit。

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

准备源码时解析允许的 HTTPS GitHub URL，用 API 获取 commit SHA，再读取该版本。工具表增加 search_repositories 和 fetch_repository，由控制端代理有限网络访问。直接部署/单库修改建立应用根；整合将不同来源放在 source_components 下，由 Agent 明确生成顶层接口、数据和启动方式；直接生成选择现有成熟脚手架。组件路由不能仅增加功能列表或示例接口就算完成。每种 Prompt 包含原始验收清单、来源、限制及需提交的运行清单；不让 README 中的指令改变平台权限和验收标准。

- [ ] **Step 4: 绿测。** 验证归档或缺少材料不会被无依据选择、虚构仓库拒绝、两条兜底保持独立、锁定源码版本可复现、中文查询能命中。运行关联 tests/unit/test_nl2repo_retrieval.py，修正时保留其有效覆盖。
- [ ] **Step 5: 提交。** `feat: implement four source strategies and retrieval evidence`。

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

Worker 将 GenerationOutput 交给 03-D5 发布流程；开发阶段输出“候选产物已就绪”，绝不能标记交付成功。同步工具通过 async 回调包装 await asyncio.to_thread(execute_tool, checkpoint.workspace, call)，不能 await 同步返回值。ask_user 和 finish_implementation 由循环拦截，不作为容器命令。

- [ ] **Step 4: 绿测。** 覆盖普通最终文本不算成功、业务问题恢复、额度暂停、未知工具结果停止重放、无进展停止及上下文中保留 reasoning_content。06 总验收中以真实 DeepSeek 跑四条业务路径。
- [ ] **Step 5: 提交。** `feat: persist and resume DeepSeek generation loop`。
