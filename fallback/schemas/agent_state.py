from __future__ import annotations

from operator import add
from typing import Any, Literal
from typing_extensions import Annotated, TypedDict

from pydantic import BaseModel, ConfigDict, Field


class ReviewResult(BaseModel):
    """Reviewer Agent 单轮审计结果。

    该模型用于约束 Reviewer Agent 的结构化输出，保证 Router 能稳定读取评分、
    风险点和改进建议。
    """

    reviewer_id: str = Field(
        ...,
        description="执行审计的智能体或模型标识，例如 reviewer-gpt 或 reviewer-v2。",
    )
    round_index: int = Field(..., ge=1, description="当前审计属于第几轮迭代，从 1 开始计数。")
    score: float = Field(
        ...,
        ge=0,
        le=100,
        description="审计评分，范围 0-100，用于 Router 判定是否达标。",
    )
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
    category: str = Field(
        ...,
        description="问题分类，例如 secrets、base-image、network、dependency。",
    )
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
    risk_score: float = Field(
        ...,
        ge=0,
        le=100,
        description="安全风险评分，分数越高表示风险越高。",
    )
    issues: list[SecurityIssue] = Field(
        default_factory=list,
        description="识别出的安全问题清单。",
    )

    model_config = ConfigDict(extra="forbid")


class AgentState(TypedDict, total=False):
    """IntelliDeploy 全局状态机接口（LangGraph State）。

    Attributes:
        project_id: 项目唯一标识，用于追踪一次完整的自动部署会话。
        user_prompt: 用户原始需求，用于保障多轮修复过程中目标不漂移。
        repo_context: 仓库上下文信息（文件结构、依赖、入口、运行特征等）。
        current_dockerfile: Builder 当前产出的 Dockerfile 文本。
        current_configs: Builder 当前产出的配置集合（如 compose、env、sealos 配置）。
        review_history: Reviewer 多轮审计历史；使用 add reducer 在图状态合并时做增量累加。
        security_reports: Security 多轮报告历史；使用 add reducer 保留每一轮扫描结果。
        iteration_count: 当前修复迭代次数，用于防止死循环并实现最大轮次熔断。
        is_approved: Router 汇总 Reviewer 与 Security 结果后的最终共识标志。
        last_error: 最近一次链路异常信息，便于失败定位与观测。
        deployment_url: 部署成功后的访问地址（扩展字段，预留给 Deploy 阶段写入）。
        deployment_logs: 部署阶段日志片段（扩展字段，支持跨节点累加）。
    """

    project_id: str
    user_prompt: str
    repo_context: dict[str, Any]

    current_dockerfile: str
    current_configs: dict[str, Any]

    review_history: Annotated[list[ReviewResult], add]
    security_reports: Annotated[list[SecurityResult], add]

    iteration_count: int
    is_approved: bool
    last_error: str | None

    deployment_url: str | None
    deployment_logs: Annotated[list[str], add]


def review_result_json_schema() -> dict[str, Any]:
    """返回 ReviewResult 的 JSON Schema，便于 Agent 输出校验与提示词注入。"""

    return ReviewResult.model_json_schema()


def security_result_json_schema() -> dict[str, Any]:
    """返回 SecurityResult 的 JSON Schema，便于 Agent 输出校验与提示词注入。"""

    return SecurityResult.model_json_schema()


__all__ = [
    "AgentState",
    "ReviewResult",
    "SecurityIssue",
    "SecurityResult",
    "review_result_json_schema",
    "security_result_json_schema",
]
