from __future__ import annotations

from datetime import datetime

from pydantic import Field

from .common import CONTRACT_VERSION, AgentRole, ContractBaseModel, Decision, Severity, StageName


class AgentContext(ContractBaseModel):
    contract_version: str = Field(default=CONTRACT_VERSION)
    flow_id: str = Field(description="Unique execution flow id")
    stage: StageName
    user_intent: str = Field(description="Normalized user intent")
    repo_profile: dict = Field(default_factory=dict, description="Structured repository context")


class AgentAction(ContractBaseModel):
    agent: AgentRole
    action: str = Field(description="Action summary")
    output: dict = Field(default_factory=dict)
    confidence: float = Field(ge=0.0, le=1.0)


class ReviewFinding(ContractBaseModel):
    title: str
    severity: Severity
    detail: str
    suggestion: str


class ConsensusVote(ContractBaseModel):
    agent: AgentRole
    decision: Decision
    reason: str


class ConsensusState(ContractBaseModel):
    contract_version: str = Field(default=CONTRACT_VERSION)
    flow_id: str
    stage: StageName
    votes: list[ConsensusVote] = Field(default_factory=list)
    final_decision: Decision | None = None
    rationale: str = ""
    updated_at: datetime


class BuilderOutput(ContractBaseModel):
    contract_version: str = Field(default=CONTRACT_VERSION)
    context: AgentContext
    action: AgentAction
    proposed_files: list[str] = Field(default_factory=list)


class ReviewerOutput(ContractBaseModel):
    contract_version: str = Field(default=CONTRACT_VERSION)
    context: AgentContext
    action: AgentAction
    findings: list[ReviewFinding] = Field(default_factory=list)


class SecurityOutput(ContractBaseModel):
    contract_version: str = Field(default=CONTRACT_VERSION)
    context: AgentContext
    action: AgentAction
    blocked: bool = False
    vulnerabilities: list[ReviewFinding] = Field(default_factory=list)
