from __future__ import annotations

from datetime import datetime
from operator import add
from typing import Any, Literal
from typing_extensions import Annotated, TypedDict

from pydantic import BaseModel, ConfigDict, Field


StageName = Literal[
    "THINKING",
    "BUILDING",
    "REVIEWING",
    "SECURITY_CHECK",
    "HEALING",
    "APPROVED",
    "FAILED",
]


class BuildResult(BaseModel):
    """Builder Agent 单轮生成结果。"""

    builder_id: str = Field(..., description="执行生成的智能体或模型标识。")
    round_index: int = Field(..., ge=1, description="当前生成属于第几轮迭代，从 1 开始计数。")
    artifact_version: str | None = Field(
        default=None,
        description="当前产物版本号或哈希，用于跨轮对齐审查结果。",
    )
    current_dockerfile: str = Field(..., description="当前轮生成的 Dockerfile 文本。")
    current_configs: dict[str, Any] = Field(
        default_factory=dict,
        description="当前轮生成的配置集合，如 sealos、compose、workflow、env 模板等。",
    )
    build_summary: str = Field(..., description="当前轮生成结果摘要。")
    build_warnings: list[str] = Field(
        default_factory=list,
        description="当前轮生成中的不确定点或风险提示列表。",
    )

    model_config = ConfigDict(extra="forbid")


class ReviewResult(BaseModel):
    """Reviewer Agent 单轮审计结果。"""

    reviewer_id: str = Field(..., description="执行审计的智能体或模型标识。")
    round_index: int = Field(..., ge=1, description="当前审计属于第几轮迭代，从 1 开始计数。")
    score: float = Field(..., ge=0, le=100, description="审计评分，范围 0-100。")
    passed: bool = Field(..., description="该轮审计是否通过。")
    summary: str = Field(..., description="该轮审计的总体结论摘要。")
    improvement_suggestions: list[str] = Field(
        default_factory=list,
        description="针对 Builder 下一轮修复的明确改进建议列表。",
    )
    risk_findings: list[str] = Field(
        default_factory=list,
        description="发现的实现风险或潜在缺陷列表。",
    )
    artifact_version: str | None = Field(
        default=None,
        description="被审查产物版本号或哈希，便于跨轮追踪。",
    )

    model_config = ConfigDict(extra="forbid")


class SecurityIssue(BaseModel):
    """Security Agent 识别出的单个安全问题。"""

    issue_id: str = Field(..., description="问题唯一标识，可用于去重和追踪。")
    severity: Literal["low", "medium", "high", "critical"] = Field(
        ...,
        description="漏洞严重级别。",
    )
    category: str = Field(..., description="问题分类，例如 secrets、base_image、network、dependency。")
    title: str = Field(..., description="安全问题标题。")
    description: str = Field(..., description="问题详情描述。")
    remediation: str = Field(..., description="修复建议或安全加固方案。")

    model_config = ConfigDict(extra="forbid")


class SecurityResult(BaseModel):
    """Security Agent 单轮扫描结果。"""

    scanner_id: str = Field(..., description="执行扫描的安全智能体或规则集标识。")
    round_index: int = Field(..., ge=1, description="当前扫描属于第几轮迭代，从 1 开始计数。")
    passed: bool = Field(..., description="该轮安全检查是否通过。")
    summary: str = Field(..., description="该轮安全扫描结论摘要。")
    risk_score: float = Field(..., ge=0, le=100, description="安全风险评分，分数越高表示风险越高。")
    issues: list[SecurityIssue] = Field(
        default_factory=list,
        description="识别出的安全问题清单。",
    )

    model_config = ConfigDict(extra="forbid")


class AgentEvent(BaseModel):
    """多智能体统一事件结构。"""

    session_id: str | None = Field(default=None, description="当前会话 ID。")
    agent_name: Literal["graph", "router", "builder", "reviewer", "security"] = Field(
        ...,
        description="事件来源智能体。",
    )
    stage: StageName = Field(..., description="事件发生时所属阶段。")
    event_type: str = Field(..., description="事件类型，例如 stage_changed、agent_started。")
    message: str = Field(..., description="事件摘要。")
    iteration_count: int = Field(..., ge=0, description="当前迭代次数，从 0 开始。")
    is_terminal: bool = Field(default=False, description="该事件是否标识终态。")
    timestamp: str = Field(
        default_factory=lambda: datetime.now().isoformat(),
        description="事件产生时间。",
    )
    payload: dict[str, Any] = Field(default_factory=dict, description="扩展字段。")

    model_config = ConfigDict(extra="forbid")


class AgentState(TypedDict, total=False):
    """IntelliDeploy 全局状态机接口。"""

    project_id: str
    session_id: str
    user_prompt: str
    trigger_source: str
    repo_context: dict[str, Any]

    build_result: BuildResult
    current_dockerfile: str
    current_configs: dict[str, Any]

    review_history: Annotated[list[ReviewResult], add]
    security_reports: Annotated[list[SecurityResult], add]
    latest_review_result: ReviewResult | None
    latest_security_result: SecurityResult | None

    stage: StageName
    iteration_count: int
    max_iteration_limit: int
    is_approved: bool
    failure_reason: str | None
    last_error: str | None
    status_message: str | None
    event_stream: Annotated[list[AgentEvent], add]

    deployment_url: str | None
    deployment_logs: Annotated[list[str], add]


def build_result_json_schema() -> dict[str, Any]:
    """返回 BuildResult 的 JSON Schema。"""

    return BuildResult.model_json_schema()


def review_result_json_schema() -> dict[str, Any]:
    """返回 ReviewResult 的 JSON Schema。"""

    return ReviewResult.model_json_schema()


def security_result_json_schema() -> dict[str, Any]:
    """返回 SecurityResult 的 JSON Schema。"""

    return SecurityResult.model_json_schema()


def agent_event_json_schema() -> dict[str, Any]:
    """返回 AgentEvent 的 JSON Schema。"""

    return AgentEvent.model_json_schema()


__all__ = [
    "AgentEvent",
    "AgentState",
    "BuildResult",
    "ReviewResult",
    "SecurityIssue",
    "SecurityResult",
    "StageName",
    "agent_event_json_schema",
    "build_result_json_schema",
    "review_result_json_schema",
    "security_result_json_schema",
]
