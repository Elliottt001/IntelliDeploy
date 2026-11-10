# IntelliDeploy Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成可真实交付、继续调整、社区使用及按额度收费的一期平台（Expo 手机客户端、Web 和 API）。

**Architecture:** 一个 FastAPI 产品后端、一个独立 Python Worker、一个新增 Next.js Web 前端和保留的 Expo 手机客户端。直接调用 DeepSeek API；任务、版本和额度持久保存到 PostgreSQL，镜像发布到平台现有 Linux 或 Sealos 目标。

**Tech Stack:** 平台为 Python/FastAPI + Next.js + Expo/React Native；直接 DeepSeek API、PostgreSQL、Docker/BuildKit/Kubernetes、Playwright。D 的成熟脚手架为 Next.js + TypeScript + PostgreSQL + Prisma；A/B/C 保留实际项目栈。

**Spec:** [一期技术设计](../specs/2026-11-09-intellideploy-phase1-design.md)，[PRD](../../PRD.md)。整体设计已获用户确认。

**当前执行状态（2026-11-10）：** 六项方案缺口已落实到02-G6/G7、03-D6/D7、07-E4与08-O1/O2，并完成文档流程走查；记录见 [一期规划待办](../../一期规划待办.md) 和 [产品流程走查](../../一期产品流程走查.md)。这是方案完成状态，产品代码与真实验收仍未开始。每次实施同时读当前总计划及所需子计划，按测试证据更新进度。

## Global Constraints

- “模型直接调用 DeepSeek 官方 API。”
- “平台实现必要的工具执行和状态保存，不将 Codex SDK、Claude Agent SDK、LangGraph 或多智能体投票作为一期依赖。”
- “WAITING_USER、PAUSED_QUOTA、FAILED 是执行状态，不是额外产品路径。”
- “默认每个应用只有一个活跃的修改或发布任务。”
- “生成和调整任务只有在核心验收通过且对应版本实际发布后才能 SUCCEEDED。”
- “生产私有数据、用户、文件、第三方账号凭据都不复制。”
- “首期交付包括全部节点。”
- 每个子计划执行前同时阅读本文件和 Spec；日期表示计划形成时间，不表示开发期限。

## 1. 文件结构与职责

```text
backend/app/
  core/types.py                 公共 Pydantic 契约和枚举
  apps/{models,service,router}.py 需求、对话、应用与版本记录
  jobs/{models,store,events,worker,pipeline,maintenance}.py 租约、检查点、恢复、事件
  agent/{deepseek,tools,loop,requirements,retrieval,repository_index,compatibility,routing,scaffold,workspace}.py 模型与四条路径
  runtime/{manifest,validation,build,candidate,check_plan,linux,kubernetes,releases,operations,reconcile,cleanup,models,router}.py 验证和发布
  capabilities/{identity,data,files,ai,search,router}.py 平台能力
  community/{models,service,router}.py 发布、访问策略、独立副本
  billing/{models,ledger,pricing,metering,router}.py 额度、预留和用量
  admin/{cli,service}.py         平台管理命令及审计
  core/health.py                平台存活/就绪状态
  main.py                      统一产品入口；移除重复旧链路
backend/alembic/                正式数据库迁移
frontend/                      保留 Expo 手机客户端及现有路由、视觉资产
web/                           新增 Next.js Web 工作台、社区和开发者评测页
packages/api-client/           共享 OpenAPI 类型和可注入认证的请求函数
infra/                         本地开发与任务执行环境配置
scaffolds/nextjs-prisma/        D 专用、锁定版本的成熟应用脚手架
tests/phase1/                  新主链路的独立验收目录
scripts/                       只读审计、可恢复迁移、真实样本执行
```

这些模块属于同一后端，不拆微服务。公共模型集中一次定义；数据库各实体仍按所属模块组织。已有 GitHub、Dockerfile 校验和 K8s 代码优先检查后复用，禁止直接搬入旧多智能体编排。

## 2. 计划顺序和产出

| 顺序 | 子计划 | 可独立验收的产出 | 依赖 |
| --- | --- | --- | --- |
| 01 | [状态与任务](2026-11-09-phase1-01-foundation.md) | API 创建需求，Worker 认领、保存、恢复任务，前端可补读事件 | 无 |
| 02 | [DeepSeek、检索评分与四条路径](2026-11-09-phase1-02-generation.md) | 优先复用合适项目，执行 A/B/C；无合理复用方案时 D | 01 |
| 03 | [验证、版本与多云](2026-11-09-phase1-03-delivery.md) | 核心业务通过并部署到两种目标，调整保留数据 | 01、02 |
| 04 | [平台能力](2026-11-09-phase1-04-capabilities.md) | 多人身份、数据、文件、AI、真实联网搜索 | 01；用量回调由 06 接入 |
| 05 | [Web 与社区](2026-11-09-phase1-05-web-community.md) | 对话、交付、调整、共享使用、独立副本 | 01、03、04 |
| 07 | [客户端联调与评测](2026-11-10-phase1-07-clients-evaluation.md) | 共用协议、Expo 接入、启动入口、开发者评测 | E1 依赖 01；E2 依赖 E1；E3 依赖 02、03、04、06-F1 |
| 08 | [平台上线与清理](2026-11-10-phase1-08-production.md) | 平台自身部署、管理CLI、维护任务与资源清理 | 01、07-E1；真实运行依赖03-D6/D7、06-F1 |
| 06 | [额度与总验收](2026-11-09-phase1-06-billing-acceptance.md) | 免费、套餐、购买额度，支付宝/微信/Stripe，幂等结算与总验收 | 01；完成总验收依赖全部 |

推荐顺序：01 → 07-E1 → 05-W1/07-E2 客户端基础联调 → 06-F1 → 02-G1/G2/G3/G5/G6/G7/G4 → 04 → 03-D1/D2/D3/D4/D5/D6/D7 → 05-W2/W3及双客户端交付联调 → 07-E3 → 06-F2/F3 → 08-O1/O2 → 07-E4 → 06-F4。客户端初次接入状态 API 不等待生成引擎全部完成；真实交付验收在引擎与发布完成后执行。在所有真实模型调用前接入用量记录。04 与 03 的独立检查可分别进行，但最终必须一起通过真实应用验收。每个任务单独提交，只提交该任务文件。迁移必须从当前唯一 Alembic head 延长；文件编号是标识，不代表能脱离依赖顺序执行，出现多 head 必须合并后继续。

## 3. 公共接口

A/B/C/D 对应 DEPLOY_EXISTING、MODIFY_EXISTING、COMPOSE_COMPONENTS、GENERATE_APP。D 的技术栈限定不会覆盖其他三条。

以下名称在 01-F1 定义，子计划不得另造同名但不同结构的模型：

```python
from __future__ import annotations
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field

class DemandFact(BaseModel):
    id: str
    source_message_id: str
    quote: str
    kind: Literal['FUNCTION', 'DATA', 'ACCESS', 'EXTERNAL']
    acceptance_ids: list[str] = Field(default_factory=list)

class Requirement(BaseModel):
    prompt: str
    acceptance: list[AcceptanceItem]
    revision: int = Field(default=1, ge=1)
    facts: list[DemandFact] = Field(default_factory=list)
    source_message_ids: list[str] = Field(default_factory=list)

class RequirementDraft(BaseModel):
    prompt: str
    acceptance: list[AcceptanceItem]
    facts: list[DemandFact]
    questions: list[str] = Field(default_factory=list, max_length=2)
    explicit_removals: list[str] = Field(default_factory=list)
    removal_evidence: dict[str, str] = Field(default_factory=dict)
    review_missing: list[str] = Field(default_factory=list)
    unsupported: list[str] = Field(default_factory=list)

class AcceptanceItem(BaseModel):
    id: str
    action: str
    expected: str
    private_data: bool = False

class RepoSource(BaseModel):
    url: str
    commit: str
    role: str

class RoutePlan(BaseModel):
    route: Literal['DEPLOY_EXISTING', 'MODIFY_EXISTING',
                   'COMPOSE_COMPONENTS', 'GENERATE_APP']
    sources: list[RepoSource] = Field(default_factory=list)
    template_version: str | None = None
    steps: list[str]
    reason: str

class CandidateEvaluation(BaseModel):
    repo_url: str
    match_score: float = Field(ge=0, le=100)
    deploy_score: float = Field(ge=0, le=100)
    quality_score: float = Field(ge=0, le=100)
    is_web_app: bool | None = None
    missing_core: list[str] = Field(default_factory=list)
    unknown_fields: list[str] = Field(default_factory=list)
    evidence: dict[str, str] = Field(default_factory=dict)
    compatibility: Literal['SUPPORTED', 'UNKNOWN', 'UNSUPPORTED'] = 'UNKNOWN'

    @property
    def total(self) -> float:
        return round(.60*self.match_score + .25*self.deploy_score + .15*self.quality_score, 2)

    @property
    def eligible_a(self) -> bool:
        return (self.is_web_app is True and self.compatibility == 'SUPPORTED' and not self.missing_core and
                not self.unknown_fields and bool(self.evidence) and
                self.match_score >= 80 and self.deploy_score >= 70 and self.total >= 75)

class ToolCall(BaseModel):
    id: str
    name: str
    arguments: dict

class ToolResult(BaseModel):
    call_id: str
    ok: bool
    content: str

class ModelTurn(BaseModel):
    assistant_message: dict
    calls: list[ToolCall] = Field(default_factory=list)
    input_tokens: int = 0
    cached_input_tokens: int = 0
    output_tokens: int = 0
    usage_known: bool = True

class Checkpoint(BaseModel):
    messages: list[dict] = Field(default_factory=list)
    route: RoutePlan | None = None
    workspace: str | None = None
    pending_calls: list[ToolCall] = Field(default_factory=list)
    completed_calls: dict[str, ToolResult] = Field(default_factory=dict)
    route_switches: int = 0
    stalled_rounds: int = 0
    requirement_revision: int | None = None
    attempt_id: str | None = None
    validation_refs: list[str] = Field(default_factory=list)
    reservation_id: str | None = None

class CheckResult(BaseModel):
    id: str
    status: Literal['PASS', 'FAIL', 'NOT_RUN']
    evidence: str

class ValidationReport(BaseModel):
    checks: list[CheckResult]
    required_ids: list[str] = Field(default_factory=list)
    requirement_revision: int | None = None
    attempt_id: str | None = None
    manifest_hash: str | None = None

    @property
    def passed(self) -> bool:
        ids = [c.id for c in self.checks]
        return (bool(ids) and len(ids) == len(set(ids))
                and set(self.required_ids) <= set(ids)
                and all(c.status == 'PASS' for c in self.checks))

class ServiceSpec(BaseModel):
    name: str
    image: str
    port: int | None = None
    env_refs: dict[str, str] = Field(default_factory=dict)
    volumes: dict[str, str] = Field(default_factory=dict)
    depends_on: list[str] = Field(default_factory=list)
    health_path: str | None = None
    memory_mb: int = 512
    cpu_millis: int = Field(default=500, gt=0)
    storage_mb: dict[str, int] = Field(default_factory=dict)

class BuildSpec(BaseModel):
    service: str
    context: str
    dockerfile: str

class AppManifest(BaseModel):
    schema_version: Literal[1] = 1
    web_service: str
    services: list[ServiceSpec]
    migration: list[str] = Field(default_factory=list)
    builds: list[BuildSpec] = Field(default_factory=list)

class GenerationOutput(BaseModel):
    checkpoint: Checkpoint
    manifest: AppManifest | None = None
    question: str | None = None
    exhausted: bool = False
    requirement_revision: int | None = None

class DeploymentResult(BaseModel):
    operation_id: str
    instance_id: str
    url: str
    report: ValidationReport

class CapabilityContext(BaseModel):
    app_id: str
    instance_id: str
    user_id: int | None
    payer_id: int

class UsageInput(BaseModel):
    operation_id: str
    payer_id: int
    kind: str
    units: int
    price_version: str
    metadata: dict = Field(default_factory=dict)
    reservation_operation_id: str | None = None

class PaymentEvent(BaseModel):
    provider: Literal['alipay', 'wechat', 'stripe']
    event_id: str
    order_id: str
    transaction_id: str
    amount_minor: int
    currency: Literal['CNY', 'USD']
    paid_at: datetime
    grant_key: str
```

SQLAlchemy 主键：沿用 User.id 的整数；新增 app、job、version、instance、publication 用字符串 UUID。API 的 Idempotency-Key 先加上用户和动作范围再保存，不能让不同用户的同一键冲突或访问对方结果；模型/工具用量键包含 job 和回合序号。公共运行契约只暴露字符串引用，禁止向应用传递平台管理凭据。

面向客户端的 CreateAppResponse、JobSnapshot、AppDetail、DeliveryResult、报告/产物协议以 [一期交付与测试说明](../../一期交付与测试说明.md) 为准；01-F1 在 core/types.py 定义，01-F3 实现路由，07-E1 从 OpenAPI 生成共享 TypeScript 类型。内部 Checkpoint/RoutePlan/AppManifest 不直接返回普通用户。

## 4. 执行环境

当前本机 Node.js 24.19.0、uv、Docker CLI 和 psql 可找到；没有 Python 3.13，也没有项目虚拟环境或前端依赖。不能把本机存在 CLI 等同于服务已运行。

01-F1 建立以下命令入口：

```bash
uv python install 3.13
uv venv --python 3.13 .venv
uv pip install --python .venv/bin/python -r backend/requirements.txt -r backend/requirements-dev.txt
docker compose -p intellideploy-dev -f infra/compose.dev.yml up -d postgres
PYTHONPATH=backend .venv/bin/python -m alembic -c backend/alembic.ini upgrade head
PYTHONPATH=backend .venv/bin/python -m pytest tests/phase1 -q
```

开发配置使用 backend/.env；测试配置使用 TEST_DATABASE_URL，必须指向专用测试数据库。测试拒绝非测试库名，不对 backend/intellideploy.db 执行迁移或清表。真实模型 Key、运行主机和集群配置通过本地配置提供，不写进文档或 Git。

## 5. 提交和验收纪律

- [ ] 实施开始时使用 using-git-worktrees 检查并隔离现有 WIP；当前文件结构不因计划编写而提前改动。
- [ ] 每个任务先运行具体失败检查，再实现，再运行同一检查及必要关联检查。
- [ ] 单元测试验证协议、状态和异常；数据库并发用真实 PostgreSQL；生成和部署最终用真实环境。
- [ ] mock 模型结果只能验证编排，不能证明四条路径真的生成了可用应用。
- [ ] 每个任务执行 git diff --check，并仅提交列明文件。
- [ ] 使用新的测试目录分阶段替换旧入口；旧测试有编码和参数漂移，需要在 06-F4 分类处理，不能直接删掉掩盖问题。
- [ ] README、CLAUDE.md 和运行命令最终与新入口保持一致。

## 6. 真实验收所需外部条件

DeepSeek Key、GitHub 搜索额度、可写镜像仓库、已准备的 Linux 目标、Sealos kubeconfig、可用域名与 TLS、价格配置，以及三个收款渠道的商户配置；原生验收还需要 iOS/Android 模拟器或真机和配置好的应用标识。

没有外部条件时，相关检查标记为未执行，并继续完成不依赖它的任务。最终一期商业验收不能用模拟结果替代外部集成。

## 7. 覆盖关系

| Spec 章节 | 实施位置 |
| --- | --- |
| 2 技术栈 | 01-F1、05-W1、07-E1/E2 |
| 3 A/B/C/D、检索评分与状态 | 01-F1、02-G3/G4/G5/G6/G7 |
| 4 工具循环与上下文 | 02-G1、02-G2、02-G4 |
| 5 执行隔离与恢复 | 01-F2、02-G2、02-G4 |
| 6 验证与发布 | 02-G6、03-D1/D2/D5/D6 |
| 7 两种部署 | 03-D3、03-D4 |
| 8 平台能力 | 04-C1 至 C3 |
| 9 社区与额度 | 05-W2、05-W3、06-F1 |
| 支付渠道补充确认 | 06-F2、06-F3 |
| 10 API 与事件 | 01-F1/F3、05-W1、07-E1/E2 |
| 11 故障暂停 | 01-F2、02-G4、03-D6/D7、06-F1/F4 |
| 12 迁移旧实现 | 01-F1、06-F4 |
| 14 真实验收 | 07-E3/E4、08-O1/O2、06-F4 |
| 客户端交付与启动 | 05-W1/W2/W3、07-E1/E2/E3 |

总计划和各子计划中的测试代码是执行阶段要落地的检查，不是当前已经通过的报告。

计划于 2026-11-09 起草，跨日后在 2026-11-10 完成一致性自查；文件名保留起草日期以稳定引用。

2026-11-10 最新范围：一期保留 A/B/C/D，GitHub 检索与证据评分是主链路；D 仅从固定成熟脚手架生成。范围按本条和当前 PRD 执行，不按中间误写的“全部需求从脚手架生成”执行。

## 8. 六项补齐的统一执行契约

以下类型同样由01-F1在core/types.py定义，不各自造返回字段：

```python
class CompatibilityReport(BaseModel):
    status: Literal['SUPPORTED', 'UNKNOWN', 'UNSUPPORTED']
    reasons: list[str] = Field(default_factory=list)
    runtime: str | None = None
    databases: list[str] = Field(default_factory=list)
    architecture: str = 'amd64'
    evidence: dict[str, str] = Field(default_factory=dict)

class RetrievalResult(BaseModel):
    queries: list[str]
    completed: bool
    candidates: list[dict] = Field(default_factory=list)
    reuse_rejections: list[dict] = Field(default_factory=list)
    index_version: str | None = None
    errors: list[str] = Field(default_factory=list)

class BrowserCheck(BaseModel):
    item_id: str
    actor: Literal['owner', 'other', 'anonymous']
    actions: list[dict]
    expected: str

class CandidateRuntime(BaseModel):
    id: str
    base_url: str
    manifest_hash: str
    data_namespace: str
    identity_refs: dict[str, str] = Field(default_factory=dict)

class InstanceSnapshot(BaseModel):
    id: str
    status: Literal['PENDING', 'RUNNING', 'STOPPED', 'FAILED', 'DELETED']
    desired_state: Literal['RUNNING', 'STOPPED', 'DELETED']
    stop_reason: Literal['USER', 'QUOTA', 'ERROR'] | None = None
    url: str | None = None
    observed_at: datetime | None = None
    active_operation_id: str | None = None

class ResourceWindow(BaseModel):
    instance_id: str
    window_start: datetime
    window_end: datetime
    compute_state: Literal['RUNNING', 'STOPPED', 'UNKNOWN']
    compute_units: int | None = None
    storage_units: int | None = None
    price_version: str
    evidence_ref: str
```

RetrievalResult.candidates用序列化的现有RepositoryCandidate字典（repo_url/name/metadata/profile），由retrieval.py的normalize_candidate统一转换；不让旧retriever、index、路由各用不同字段。评分需要compatibility=SUPPORTED，构建/启动真实检查仍不能省。required_ids默认仅为旧夹具兼容；实际运行报告必须填本次冻结需求全部ID、revision、attempt和manifest_hash，01/03的契约测试拒绝缺这些绑定的生产报告。

InstanceOperation、ReleaseAttempt、ResourceRecord/CleanupAction为数据库实体，分别由03-D7、03-D6、01-F1/08-O2定义；core/types.py另外导出公开InstanceOperationResponse(id/instance_id/kind/status/error/created_at/updated_at)。kind=START/STOP/DELETE，status=QUEUED/RUNNING/SUCCEEDED/FAILED，error=PublicError|null。生成Job输出与实例操作响应分开，手机/CLI知道轮询哪个ID。

共用串联签名：01-F2 process_job调用03-D6 run_pipeline；02-G6冻结需求；02-G7将RetrievalResult交02-G3 choose_route；02-G4只产GenerationOutput；03-D6编排已锁定产物的启动/检查/修复；03-D5部署适配通过prepare_release/verify_release/activate_release三阶段完成发布；03-D7维护真实实例；08管理与清理复用维护循环；07-E4/06-F4验收同一流程。

预算在01-F3请求阶段由后端BudgetPolicy决定：budget_units可选，省略采用已配置的生成/调整/副本预算上限（最小为正，受账户可用额度及服务端hard cap限制）；用户UI以可理解的额度/费用提示，不让小白填写CPU分钟。06-F1在首次付费执行前原子reserve，声明失败已发生用量的计费规则；每个job预留是父Reservation，模型/工具/候选AI/构建等UsageEntry含reservation_operation_id='job:{id}'，operation_id为唯一子动作。子调用从父预留扣减，不重复reserve同一job总预算；应用运行中的能力调用使用独立父预留。reserve/record_usage/settle/refund的数据库约束和价格版本见06-F1；PAUSED_QUOTA保留工作区，resume同一job重新预留剩余预算，不能重算已完成用量。模型402等供应商余额故障为UPSTREAM_UNAVAILABLE，不能错误要求用户充值平台额度。

维护循环是同一Worker的独立async任务，持久维护租约及tick由03-D7实现；运行认领/外部动作也要核对lease generation，旧Worker失去租约后不能提交新版本。生产发布前用08-O1管理命令预检目标、价格和执行节点，未通过则拒绝执行而非模拟成功。

方案补齐覆盖：P1=02-G6；P2=03-D6；P3=03-D7；P4=02-G7；P5=08-O1/O2；P6=07-E4。实施仍需落实每项代码、测试和真实运行证据。
