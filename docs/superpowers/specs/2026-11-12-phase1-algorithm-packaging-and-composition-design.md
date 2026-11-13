# IntelliDeploy Phase 1 Packaging, Gap Repair, and Component Composition Design

日期：2026-11-12

状态：设计已在对话中分三部分确认；本文等待用户最终复核后进入实施计划。

关联文档：

- [Phase 1 算法融合设计](2026-11-12-phase1-algorithm-fusion-design.md)
- [Phase 1 算法融合实施计划](../plans/2026-11-12-phase1-algorithm-fusion.md)
- [产品需求](../../PRD.md)
- [一期实施进度](../../一期实施进度.md)
- [旧评估生成设计](../../algorithm/评估生成.md)

## 1. 背景与结论

F0—F5 已把查询规划、混合检索、仓库画像、候选排序、A/B/C/D 路由、动态 Review/Security 和有界修复接入 Phase 1 的持久任务、预算、Runner、候选验证和原子发布骨架。但四类旧算法价值仍没有形成完整的新主链行为：

1. 已有 Dockerfile 的生产化检查和安全归一化仍停留在旧 `fallback` Solver。
2. 新 Builder 收到失败证据，却没有收到按验收项拆分的结构化缺口计划。
3. C 路线虽已生成 `IntegrationContract`，源码布局、Builder 输入和 Review 尚未完整消费该契约。
4. 旧 `classify_fallback_request` 包含有价值规则，也包含与新版产品路线冲突的语义，缺少逐条审计。

本设计继续坚持“迁移算法行为，不迁移旧运行系统”：

- 不重新挂载旧 fallback API、Celery/Redis、LangGraph 或旧 Solver。
- 不让新运行时依赖 `fallback.schemas`、`FallbackPlan` 或旧 Decision 枚举。
- 允许继续复用已验证的纯探测器，但生产决策和副作用只通过新版 typed contracts、AlgorithmCheckpoint、Worker、Runner 和 Pipeline。
- 只自动修改能够由仓库硬证据确定的 Dockerfile 内容；其余问题进入 Builder 或阻塞。

## 2. 目标与非目标

### 2.1 目标

- 在昂贵构建前形成可审计、幂等的生产打包计划。
- 复用安全的 Dockerfile，并规范端口、启动命令、工作目录和安装命令。
- 把业务缺口绑定到 Requirement acceptance ID，而不是只保存自由文本。
- 已满足能力不重复实现；B 路线只修局部缺口。
- 在证据完整时允许 B 路线升级为 C 路线，复用另一个固定来源的组件。
- 让 C 路线的 IntegrationContract 真正控制源码布局、Builder 输入和 Review。
- 对旧分类规则给出 `COVERED / MIGRATE / REJECTED / LEGACY_ONLY` 的可追踪结论。
- 保持任务恢复、预算、租约、数据保护、候选隔离和发布门槛不变。

### 2.2 非目标

- 不恢复旧 `classify_fallback_request` 为运行时入口。
- 不恢复旧脚手架生成器；D 路线继续使用当前固定 Next.js/TypeScript/PostgreSQL/Prisma 脚手架。
- 不实现任意语言、任意框架的自动 Dockerfile 重写器。
- 不让模型修改基础镜像、系统依赖、网络策略、凭据或平台预算。
- 上述限制针对模型的计划批准权和确定性自动改写；基础镜像或系统依赖问题可进入明确的 Builder 修复任务，并须经现有 Security/Review 和构建验证，不能凭模型建议直接批准。
- 不把文件存在、镜像构建成功或服务启动当作业务验收成功。
- 不在本设计中把 Hybrid 切为普通用户默认。

## 3. 总体流程

```text
Requirement
  -> QueryPlan / Retrieval / RepositoryProfile
  -> GapPlan
  -> strict A/B/C/D RoutePlan
  -> fixed source commits
  -> source materialization
  -> PackagingPlan
  -> deterministic safe edits
  -> Builder with GapPlan + PackagingPlan + IntegrationContract
  -> deterministic Review / conditional model Review / Security
  -> build / candidate validation / healing / release
```

职责边界：

- `RepositoryProfile` 陈述仓库事实。
- `GapPlan` 陈述每个验收项的覆盖与修复来源。
- `RoutePlan` 决定 A/B/C/D。
- `PackagingPlan` 决定可验证的打包和生产启动规则。
- `IntegrationContract` 约束 C 路线的组件所有权和连接方式。
- Builder 只能实现计划，不能自行扩大来源、预算或权限。
- Review 和真实验证决定候选能否继续，Builder 不能批准自己。

## 4. 新版契约

契约定义放在 `backend/app/agent/contracts.py`，使用 Pydantic 严格类型，不使用无结构 dict 作为阶段接口。

### 4.1 PackagingPlan

```python
class PackagingFinding(BaseModel):
    code: str
    severity: Literal["BLOCKING", "WARNING", "INFO"]
    message: str
    evidence_ref: str

class SafeDockerEdit(BaseModel):
    kind: Literal[
        "INSERT_WORKDIR",
        "SET_EXPOSE",
        "SET_START_COMMAND",
        "SET_INSTALL_COMMAND",
    ]
    old_value: str | None
    new_value: str
    evidence_refs: list[str]

class PackagingPlan(BaseModel):
    source_url: str | None
    source_commit: str | None
    dockerfile_path: str
    action: Literal["REUSE", "NORMALIZE", "GENERATE", "BLOCKED"]
    package_manager: str | None
    install_command: list[str] | None
    start_command: list[str] | None
    container_port: int | None
    health_path: str | None
    safe_edits: list[SafeDockerEdit]
    findings: list[PackagingFinding]
    input_digest: str
    output_digest: str | None
```

`PackagingPlan` 必须绑定来源 commit、Dockerfile 输入 hash 和 profiler 版本。对同一输入重复执行必须产生相同计划和相同输出。

阶段、路径和已有命令必须先得到确认。多阶段 Dockerfile 只分析最终运行阶段；不能盲目插入 WORKDIR 改变既有相对 COPY/RUN 语义，不能丢弃 ENTRYPOINT wrapper。将开发命令替换成生产命令前，必须证明对应生产构建、实际 start script 和运行依赖存在；没有这些证据时生成 Builder Finding。

命令使用 argv 语义，不保存未经解析的 shell 拼接字符串。无法安全转换为 argv 的命令进入 `BLOCKED` 或 Builder 任务。

`action="GENERATE"` 只表示 Builder 需要在受控工具和 Review 下创建 Dockerfile；确定性 Packaging 阶段本身不从零生成 Dockerfile。

### 4.2 GapPlan

```python
class AcceptanceGap(BaseModel):
    acceptance_id: str
    status: Literal[
        "SATISFIED",
        "LOCAL_REPAIR",
        "COMPONENT_SOURCE",
        "BLOCKED",
    ]
    principal_source: RepoSource | None
    provider_source: RepoSource | None
    capability: str
    required_changes: list[str]
    preserve: list[str]
    evidence_refs: list[str]
    reason: str

class GapPlan(BaseModel):
    requirement_revision: int
    principal_source: RepoSource | None
    gaps: list[AcceptanceGap]
    complete: bool
    input_digest: str
```

不变量：

- 每个 Requirement acceptance ID 恰好出现一次。
- `SATISFIED` 必须有仓库或验证证据。
- `LOCAL_REPAIR` 必须有明确修改范围和保留项。
- `COMPONENT_SOURCE` 必须绑定已检索、固定 commit、许可证允许的来源。
- `BLOCKED` 不能进入自动 Builder 修改。
- `complete=false` 时不能发布，也不能用 D 路线绕过未知缺口。

`complete` 表示规划完整，而非功能验证通过。`SATISFIED` 只表示来源材料支持现成能力，仍须完成候选业务验证；关键词匹配和模型断言不能独立成为正向覆盖证据。`LOCAL_REPAIR` 必须在候选验收中通过后才能交付。

B→C 的成本条件以可空的 typed `CompositionCost` 保存：`local_units`、`composition_units` 为非负整数，`evidence_refs` 为受保护证据引用，均在同一冻结价格/预算口径下计算；这只是规划估计，不是实际扣费。未知成本保持空值并拒绝自动升级。完整合同及成本比较须在提交最终 C 路线前验证，失败时保留可行的 B 局部修复方案。

### 4.3 ComponentWorkspace

```python
class ComponentWorkspace(BaseModel):
    role: str
    source: RepoSource
    relative_path: str
    read_only_source_path: str
    tree_digest: str
```

C 路线的来源必须分别落在稳定命名空间，例如：

```text
workspace/
  app/                  最终集成应用
  components/records/   固定来源快照
  components/search/    固定来源快照
```

Builder 只在 `app/` 写最终实现；`components/<role>/` 作为只读证据和复用来源，不允许不同仓库直接覆盖同一路径。

## 5. Dockerfile 生产化规则

实现位于 `backend/app/agent/packaging.py`。它读取已准备工作区、`RepositoryProfile` 和 `RoutePlan`，不执行仓库代码。

### 5.1 证据优先级

端口和启动命令按以下顺序决定：

1. 仓库已有 Dockerfile、生产脚本或明确配置中的硬证据。
2. 唯一且无冲突的源码入口、package script、框架生产命令。
3. 已批准脚手架的固定约定。
4. 无法唯一决定时生成阻塞 Finding，不猜测。

模型建议不能覆盖仓库硬证据。

### 5.2 允许自动执行的修改

- Dockerfile 缺少 `WORKDIR` 时插入固定工作目录。
- `EXPOSE` 与唯一可信端口不一致时修正。
- 将明确的开发命令替换为同框架、同入口的生产命令，例如 `next dev -> next start`、`uvicorn --reload -> uvicorn --host 0.0.0.0`。
- 在不存在命令且生产入口唯一时补 `CMD`。
- 根据实际 lockfile 选择安装命令，例如有 `package-lock.json` 才使用 `npm ci`。
- 规范服务监听 `0.0.0.0`，前提是框架和入口已确定。

### 5.3 禁止自动执行的修改

- 更换 `FROM` 基础镜像或版本。
- 增删 apt/apk/brew/system package。
- 猜测凭据或环境变量。
- 删除或合并多阶段构建。
- 改写业务源码、迁移命令或数据路径。
- 把多个冲突 lockfile 任意选成一个。
- 把 worker、CLI、库项目伪装成 Web 服务。

上述问题进入 `PackagingFinding`，由 Builder 在受控工具和 Review 下处理，或标记 `BLOCKED`。

### 5.4 安全与幂等

- 修改前后均计算 SHA-256。
- 修改通过原子临时文件替换，不跟随符号链接。
- 只允许修改工作区内已登记的 Dockerfile。
- 第二次执行不得产生新 diff。
- 完整 Dockerfile 内容不进入公共事件；检查点只保存摘要、hash 和受保护证据引用。

## 6. 缺失组件局部修复

实现位于 `backend/app/agent/gaps.py`。

Gap Planner 使用 Requirement、RepositoryProfile、CandidateEvaluation、RoutePlan 和受保护证据。模型可以提出验收覆盖，但确定性验证器必须拒绝未知 acceptance ID、未知来源、无 commit 或无证据的 `SATISFIED`。

### 6.1 B 路线

- 一个主体仓库保持源码、数据和身份主权。
- Builder 只收到 `LOCAL_REPAIR` 项及其 `preserve` 列表。
- 已满足验收项必须继续进入回归检查，但不能被重新实现或删除。
- 连续两次修复没有新增通过证据时，重新评估来源或路线。

### 6.2 B 升级 C

只有同时满足以下条件才能升级：

- 另一候选已由检索召回并固定完整 commit。
- 许可证为 `ALLOWED`。
- RepositoryProfile 完整度足以确定其组件角色。
- 缺失 acceptance 能映射到该来源的能力证据。
- 身份 owner、数据 owner、API 边界和迁移责任可明确。
- 预计复用成本低于主体仓库内局部实现，且没有安全阻塞项。

任一条件不满足则保持 B；如果 B 也无法安全修复，则进入 `BLOCKED`，不得假装升级 C。

### 6.3 Repair Evidence

失败后的 `repair_evidence` 增加 acceptance ID、Gap 状态、失败阶段和受保护证据引用。Builder 不再只收到“候选未通过”自由文本。

## 7. C 路线组件重组

现有 `IntegrationContract` 继续作为权威契约，并增加真正的执行消费。

### 7.1 源码准备

- 每个来源按 role 落在独立 `components/<role>/`。
- 路径由平台生成，模型不能提供绝对路径或 `..`。
- 最终应用位于 `app/`，Builder 的写权限不扩展到来源快照。
- C 路线下 `write_file` 和 `apply_patch` 必须在工具边界拒绝写入 `components/`；不能只依赖事后 Review 发现来源被修改。
- Runner 保存受租约保护、绑定上传 hash 的工作区策略。RPC 文件写入/import 只允许 `app/`；命令容器将工作区根挂为只读、`app/` 挂为可写并以 `/workspace/app` 为工作目录。不能仅依赖上传前 chmod，因为解包会重新创建文件。
- RPC 读取和快照仍使用原工作区根，构建路径必须位于 `app/`。来源 tree_digest 按实际清理并上传的字节计算；重启、恢复、调整和版本归档都保留这一策略和来源证明。
- 来源快照与 commit、hash、许可证证据绑定。

### 7.2 Builder 输入

Builder system/user messages必须包含：

- Requirement 和 acceptance IDs。
- GapPlan。
- PackagingPlan。
- IntegrationContract。
- ComponentWorkspace 路径映射。
- 平台能力和禁止复制的私有数据/凭据边界。

Builder 可以通过受控工具读取组件源码，并在 `app/` 实现适配层，但不能新增未检索来源。

### 7.3 Review

构建前确定性 Review 必须验证：

- 每个 acceptance ID 已映射到最终实现和浏览器检查。
- identity owner 唯一。
- 每类持久数据有 owner。
- API mapping 只引用选中的 component role。
- 最终 manifest 的服务与 IntegrationContract 一致。
- 合同增加 defaulted `role_services: dict[str, str]`，显式映射角色到最终 manifest 服务；允许多个角色共享一个服务，但不能缺失角色或指向不存在的服务。不能以“仓库数量”机械要求容器数量。
- 组件快照未被原地修改。
- 私有数据、密钥和原实例数据没有被复制。

任何阻塞 Finding 都不能进入构建。

Review 使用 Builder 完成后的实际文件重新核对 Packaging Finding；已经安全解决的问题保留历史记录，不再永久阻断。不可通过删除验收映射或只修改计划状态宣称解决。

## 8. 旧 classify_fallback_request 规则审计

审计结果保存到 `docs/algorithm/classify-fallback-rule-audit.md`。每条规则包含：

- 旧规则 ID 和源文件/函数。
- 旧输入和输出语义。
- 新系统对应模块和测试。
- 状态：`COVERED / MIGRATE / REJECTED / LEGACY_ONLY`。
- 决策理由和产品影响。

### 8.1 状态定义

- `COVERED`：新版已有等价或更严格行为，无需重复迁移。
- `MIGRATE`：新版缺少且仍符合产品目标，必须先写失败测试再实现。
- `REJECTED`：与新版 PRD、A/B/C/D 定义、安全或证据边界冲突。
- `LEGACY_ONLY`：仅服务旧 FallbackPlan、旧模板或旧部署系统。

### 8.2 必须重点审计的规则

- 用户意图不清与仓库材料不足的组合。
- 没有真实代码、只有文档/模板、库与完整应用混淆。
- 依赖文件、入口、启动链、端口和 lockfile 冲突。
- 有效 Dockerfile 与“仅打包缺口”的 A 路线条件。
- 有限局部修复与接近重写成本的区别。
- 未知信息是阻塞、警告还是触发 Review。
- 旧 Decision C“重新生成”与新版 C“多组件整合”的冲突。
- 旧 Decision D“人工/缺信息”与新版 D“成熟脚手架生成”的冲突。

审计不得以“旧测试通过”作为迁移完成；必须有新版主链测试和调用点。

## 9. 检查点、预算与失败处理

AlgorithmCheckpoint 增加 `gap_plan`、`packaging_plans` 和 `component_workspaces`。所有记录绑定 requirement revision、算法版本和输入 hash。

- Gap Planner 和 IntegrationContract 的模型调用使用 DurableModel，遵守 REQUESTED/UNKNOWN 停止重放规则；Packaging 只使用确定性证据，不调用模型。
- 确定性分析不单独收费。
- Builder、工具、构建和候选仍计入现有父 Reservation。
- `BLOCKED` 不自动转 D，不降低验收，不生成假成功。
- TARGET/UPSTREAM 不触发业务代码修改。
- DATA/ACCESS 问题保持串行修复，不进入组件竞速。
- 来源、PackagingPlan 或 IntegrationContract 变化必须产生新的 attempt 和输入 hash。

## 10. 文件结构

新增：

- `backend/app/agent/packaging.py`
- `backend/app/agent/gaps.py`
- `tests/phase1/test_packaging_plan.py`
- `tests/phase1/test_gap_plan.py`
- `docs/algorithm/classify-fallback-rule-audit.md`

修改：

- `backend/app/agent/contracts.py`
- `backend/app/agent/routing.py`
- `backend/app/agent/integration.py`
- `backend/app/agent/review.py`
- `backend/app/agent/checkpoint.py`
- `backend/app/jobs/execution.py`
- `tests/phase1/test_hybrid_routing.py`
- `tests/phase1/test_integration_contract.py`
- `tests/phase1/test_candidate_review.py`
- `tests/phase1/test_default_execution.py`
- `docs/一期实施进度.md`

若实现证明已有文件足够，不创建额外 service、factory、plugin 或依赖。

## 11. 测试与验收

### 11.1 Packaging

- 开发命令安全转换为生产命令。
- 仓库硬端口证据优先。
- lockfile 决定安装命令。
- 多 lockfile、未知入口、冲突端口返回阻塞 Finding。
- 基础镜像、系统依赖和多阶段结构保持不变。
- 重复执行 byte-identical。
- 路径穿越和符号链接被拒绝。

### 11.2 Gap Repair

- 每个 acceptance ID 恰好一个 Gap。
- 已满足项不进入 Builder 修改范围。
- 缺登录、文件、搜索、持久化等能力生成局部修复项。
- 保留项进入 Builder 输入和 Review。
- 无来源证据时不能标记 `COMPONENT_SOURCE`。
- `BLOCKED` 不进入自动实现。

### 11.3 Component Composition

- 不同来源不能覆盖同一路径。
- B 只有在全部升级条件满足时成为 C。
- 所有 acceptance 均由组件覆盖。
- identity/data owner 唯一且来自选中 role。
- Builder 实际收到并遵守 IntegrationContract。
- 修改来源快照、越权 API mapping 或缺少最终服务时在构建前阻止。

### 11.4 Classification Audit

- 每条纳入范围的旧规则都有唯一审计状态。
- 每个 `MIGRATE` 条目链接至少一个新版测试。
- 新运行时不导入 `classify_fallback_request`、旧 Solver 或旧 Decision。
- 旧 C/D 语义不会映射为新版 C/D。

### 11.5 回归

- 新专项测试先 RED 后 GREEN。
- 旧 fallback 测试仅作行为对照，不作为产品主链完成证据。
- 完整已跟踪 Phase 1 测试在隔离 PostgreSQL 17 上通过。
- Ruff 未定义名称检查和 `git diff --check` 通过。
- 真实 DeepSeek、GitHub、Runner、Registry、Linux/Kubernetes paired 仍按资源情况记录 `NOT_RUN`。

## 12. Rollout

这些能力先只进入 Hybrid；Baseline 保持对照语义，Shadow 可执行无副作用的 Gap/Packaging 分析但不采用其路线或修改结果。真实 paired 证明召回、路线、首候选成功、构建次数、费用和交付率不退化后，才考虑普通任务默认启用。

任何本地 fixture、旧 fallback 回归或模拟组件项目都不能解除 Hybrid 默认门槛。
