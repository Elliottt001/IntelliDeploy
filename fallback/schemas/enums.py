from enum import StrEnum


class Decision(StrEnum):
    A = "A"
    B = "B"
    C = "C"
    D = "D"


class CandidateDecision(StrEnum):
    A_CANDIDATE = "A_candidate"
    B_CANDIDATE = "B_candidate"
    C_CANDIDATE = "C_candidate"
    D_CANDIDATE = "D_candidate"
    UNKNOWN = "unknown"


class PackageManager(StrEnum):
    NPM = "npm"
    PNPM = "pnpm"
    YARN = "yarn"
    PIP = "pip"
    POETRY = "poetry"
    UV = "uv"
    MAVEN = "maven"
    GRADLE = "gradle"
    GO = "go"
    CARGO = "cargo"
    COMPOSER = "composer"
    BUNDLER = "bundler"
    UNKNOWN = "unknown"


class UserIntentState(StrEnum):
    CLEAR = "clear"
    PARTIALLY_CLEAR = "partially_clear"
    UNCLEAR = "unclear"


class RepoMaterialState(StrEnum):
    SUFFICIENT = "sufficient"
    PARTIAL = "partial"
    INSUFFICIENT = "insufficient"


class ProjectType(StrEnum):
    BACKEND_API = "backend_api"
    FRONTEND_WEB = "frontend_web"
    FULLSTACK = "fullstack"
    CHATBOT = "chatbot"
    DASHBOARD = "dashboard"
    STATIC_SITE = "static_site"
    AUTOMATION_TOOL = "automation_tool"
    CLI_TOOL = "cli_tool"
    LIBRARY = "library"
    ML_SERVICE = "ml_service"
    MCP = "mcp"
    UNKNOWN = "unknown"


class GenerationMode(StrEnum):
    AUTO = "AUTO"
    VIBE = "VIBE"
    COMPONENT_REASSEMBLY = "COMPONENT_REASSEMBLY"


class TriggerReason(StrEnum):
    LOW_SCORE_ALL = "LOW_SCORE_ALL"
    REPAIR_EXHAUSTED = "REPAIR_EXHAUSTED"
    FORCE_FALLBACK = "FORCE_FALLBACK"

