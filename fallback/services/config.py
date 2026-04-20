from __future__ import annotations

import os
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]


@dataclass(frozen=True, slots=True)
class FallbackConfig:
    root_dir: Path = ROOT_DIR
    prompts_dir: Path = ROOT_DIR / "prompts"
    templates_dir: Path = ROOT_DIR / "templates"
    workspaces_dir: Path = field(
        default_factory=lambda: Path(
            os.getenv("FALLBACK_WORKSPACES_DIR", str(ROOT_DIR / "workspaces"))
        )
    )
    artifacts_dir: Path = field(
        default_factory=lambda: Path(
            os.getenv("FALLBACK_ARTIFACTS_DIR", str(ROOT_DIR / "artifacts"))
        )
    )
    max_repair_retries: int = int(os.getenv("FALLBACK_MAX_REPAIR_RETRIES", "3"))
    llm_timeout_seconds: int = int(os.getenv("FALLBACK_LLM_TIMEOUT_SECONDS", "30"))
    state_ttl_seconds: int = int(os.getenv("FALLBACK_STATE_TTL_SECONDS", "86400"))
    default_ports: dict[str, int] = field(
        default_factory=lambda: {
            "backend_api": 8000,
            "frontend_web": 80,
            "dashboard": 80,
            "static_site": 80,
            "chatbot": 8000,
            "automation_tool": 8000,
            "unknown": 8080,
        }
    )

    def ensure_directories(self) -> None:
        self.workspaces_dir.mkdir(parents=True, exist_ok=True)
        self.artifacts_dir.mkdir(parents=True, exist_ok=True)


@lru_cache(maxsize=1)
def get_config() -> FallbackConfig:
    config = FallbackConfig()
    config.ensure_directories()
    return config

