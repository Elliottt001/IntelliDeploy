# IntelliDeploy Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从固定成熟脚手架生成完整 Web 应用，支持真实交付、继续调整、社区使用与按额度收费。

**Architecture:** 一个 FastAPI 产品后端、一个独立 Python Worker、一个 Next.js Web 前端。直接调用 DeepSeek API；任务、版本和额度持久保存到 PostgreSQL，镜像发布到平台现有 Linux 或 Sealos 目标。

**Tech Stack:** Python 3.13、Node.js 24、PostgreSQL 17、FastAPI、SQLAlchemy、Alembic、OpenAI Python SDK、Next.js、TypeScript、Prisma、Playwright、Docker/BuildKit、Kubernetes。

**Spec:** [一期技术设计](../specs/2026-11-09-intellideploy-phase1-design.md)，[PRD](../../PRD.md)。整体设计已获用户确认。

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
  jobs/{models,store,events,worker}.py 租约、检查点、恢复、事件
  agent/{deepseek,tools,loop,scaffold,workspace}.py 模型与单一脚手架生成
  runtime/{manifest,validation,build,linux,kubernetes,releases,router}.py 验证和发布
  capabilities/{identity,data,files,ai,search,router}.py 平台能力
  community/{models,service,router}.py 发布、访问策略、独立副本
  billing/{models,ledger,pricing,router}.py 额度、预留和用量
  main.py                      统一产品入口；移除重复旧链路
backend/alembic/                正式数据库迁移
frontend/                      改造为 Next.js Web；复用现有素材
infra/                         本地开发与任务执行环境配置
scaffolds/nextjs-prisma/        一套经过验证、锁定版本的应用脚手架
tests/phase1/                  新主链路的独立验收目录
scripts/                       只读审计、可恢复迁移、真实样本执行
```

这些模块属于同一后端，不拆微服务。公共模型集中一次定义；数据库各实体仍按所属模块组织。已有 Dockerfile 校验和 K8s 代码优先检查后复用。一期不接 GitHub 检索、任意仓库改造或多项目拼接，不为后续路径预建抽象框架。

## 2. 计划顺序和产出

| 顺序 | 子计划 | 可独立验收的产出 | 依赖 |
| --- | --- | --- | --- |
| 01 | [状态与任务](2026-11-09-phase1-01-foundation.md) | API 创建需求，Worker 认领、保存、恢复任务，前端可补读事件 | 无 |
| 02 | [DeepSeek 与成熟脚手架](2026-11-09-phase1-02-generation.md) | 固定 Next.js/TypeScript/PostgreSQL/Prisma 底座，实现业务并验证 | 01 |
| 03 | [验证、版本与多云](2026-11-09-phase1-03-delivery.md) | 核心业务通过并部署到两种目标，调整保留数据 | 01、02 |
| 04 | [平台能力](2026-11-09-phase1-04-capabilities.md) | 多人身份、数据、文件、AI、真实联网搜索 | 01；用量回调由 06 接入 |
| 05 | [Web 与社区](2026-11-09-phase1-05-web-community.md) | 对话、交付、调整、共享使用、独立副本 | 01、03、04 |
| 06 | [额度与总验收](2026-11-09-phase1-06-billing-acceptance.md) | 免费、套餐、购买额度，支付宝/微信/Stripe，幂等结算与总验收 | 01；完成总验收依赖全部 |

推荐顺序：01 → 06-F1 → 02 → 04 → 03 → 05 → 06-F2/F3/F4。在所有真实模型调用前接入用量记录。04 与 03 的独立检查可分别进行，但最终必须一起通过真实应用验收。每个任务单独提交，只提交该任务文件。迁移必须从当前唯一 Alembic head 延长；文件编号是标识，不代表能脱离依赖顺序执行，出现多 head 必须合并后继续。

## 3. 公共接口

以下名称在 01-F1 定义，子计划不得另造同名但不同结构的模型：

```python
from __future__ import annotations
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field

class Requirement(BaseModel):
    prompt: str
    acceptance: list[AcceptanceItem]

class AcceptanceItem(BaseModel):
    id: str
    action: str
    expected: str
    private_data: bool = False

class ImplementationPlan(BaseModel):
    template_version: str
    steps: list[str]
    reason: str

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
    plan: ImplementationPlan | None = None
    workspace: str | None = None
    pending_calls: list[ToolCall] = Field(default_factory=list)
    completed_calls: dict[str, ToolResult] = Field(default_factory=dict)
    stalled_rounds: int = 0

class CheckResult(BaseModel):
    id: str
    status: Literal['PASS', 'FAIL', 'NOT_RUN']
    evidence: str

class ValidationReport(BaseModel):
    checks: list[CheckResult]

    @property
    def passed(self) -> bool:
        return bool(self.checks) and all(c.status == 'PASS' for c in self.checks)

class ServiceSpec(BaseModel):
    name: str
    image: str
    port: int | None = None
    env_refs: dict[str, str] = Field(default_factory=dict)
    volumes: dict[str, str] = Field(default_factory=dict)
    health_path: str | None = None
    memory_mb: int = 512

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
- [ ] mock 模型结果只能验证编排，不能证明同一脚手架已完成真实业务应用。
- [ ] 每个任务执行 git diff --check，并仅提交列明文件。
- [ ] 使用新的测试目录分阶段替换旧入口；旧测试有编码和参数漂移，需要在 06-F4 分类处理，不能直接删掉掩盖问题。
- [ ] README、CLAUDE.md 和运行命令最终与新入口保持一致。

## 6. 真实验收所需外部条件

DeepSeek Key、可写镜像仓库、已准备的 Linux 目标、Sealos kubeconfig、可用域名与 TLS、价格配置，以及所选收款渠道的商户配置。

没有外部条件时，相关检查标记为未执行，并继续完成不依赖它的任务。最终一期商业验收不能用模拟结果替代外部集成。

## 7. 覆盖关系

| Spec 章节 | 实施位置 |
| --- | --- |
| 2 技术栈 | 01-F1、05-W1 |
| 3 固定脚手架与状态 | 01-F1、02-G3、02-G4 |
| 4 工具循环与上下文 | 02-G1、02-G2、02-G4 |
| 5 执行隔离与恢复 | 01-F2、02-G2、02-G4 |
| 6 验证与发布 | 03-D1、03-D2、03-D5 |
| 7 两种部署 | 03-D3、03-D4 |
| 8 平台能力 | 04-C1 至 C3 |
| 9 社区与额度 | 05-W2、05-W3、06-F1 |
| 支付渠道补充确认 | 06-F2、06-F3 |
| 10 API 与事件 | 01-F3、05-W1 |
| 11 故障暂停 | 01-F2、02-G4、06-F1、06-F4 |
| 12 迁移旧实现 | 01-F1、06-F4 |
| 14 真实验收 | 06-F4 |

总计划和各子计划中的测试代码是执行阶段要落地的检查，不是当前已经通过的报告。

计划于 2026-11-09 起草，跨日后在 2026-11-10 完成一致性自查；文件名保留起草日期以稳定引用。

2026-11-10 范围修订：一期仅支持成熟脚手架生成，默认 Next.js + TypeScript + PostgreSQL + Prisma；现成仓库部署、外部仓库改造和多项目整合后置。AppManifest 一期只接受一个 Web 服务，数据库与文件通过平台能力提供。
