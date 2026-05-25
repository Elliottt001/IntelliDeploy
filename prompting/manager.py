from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from pydantic import BaseModel, ValidationError

from contracts.models import BuilderOutput, ReviewerOutput, SecurityOutput


SCHEMA_REGISTRY: dict[str, type[BaseModel]] = {
    "BuilderOutput": BuilderOutput,
    "ReviewerOutput": ReviewerOutput,
    "SecurityOutput": SecurityOutput,
}


_PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_TEMPLATES_ROOT = _PROJECT_ROOT / "prompts" / "templates"


@dataclass(frozen=True)
class PromptSpec:
    prompt_id: str
    version: str
    agent: str
    scenario: str
    input_fields: tuple[str, ...]
    output_schema: str
    template_text: str
    path: Path


class PromptManager:
    """Loads prompt templates and validates prompt input/output contracts."""

    def __init__(self, templates_root: str | Path | None = None):
        self.templates_root = Path(templates_root) if templates_root is not None else DEFAULT_TEMPLATES_ROOT
        if not self.templates_root.is_absolute():
            self.templates_root = (_PROJECT_ROOT / self.templates_root).resolve()
        if not self.templates_root.exists():
            raise FileNotFoundError(
                f"Prompt templates directory not found: {self.templates_root}. "
                f"Expected absolute or repo-relative path with .md prompt files."
            )
        self._registry: dict[tuple[str, str], PromptSpec] = {}
        self._load_all()
        if not self._registry:
            raise RuntimeError(
                f"No prompts loaded from {self.templates_root}. "
                f"Check that prompt .md files with JSON front-matter exist."
            )

    def _load_all(self) -> None:
        for path in self.templates_root.rglob("*.md"):
            spec = self._parse_prompt_file(path)
            key = (spec.prompt_id, spec.version)
            if key in self._registry:
                raise ValueError(f"Duplicate prompt definition: {key}")
            self._registry[key] = spec

    def _parse_prompt_file(self, path: Path) -> PromptSpec:
        raw = path.read_text(encoding="utf-8")
        if not raw.startswith("---\n"):
            raise ValueError(f"Prompt missing JSON front-matter: {path}")
        second = raw.find("\n---\n", 4)
        if second == -1:
            raise ValueError(f"Prompt front-matter not closed: {path}")

        meta_text = raw[4:second].strip()
        body = raw[second + 5 :].lstrip()
        metadata = json.loads(meta_text)

        required = {"prompt_id", "version", "agent", "scenario", "input_fields", "output_schema"}
        missing = required - set(metadata)
        if missing:
            raise ValueError(f"Prompt metadata missing keys {sorted(missing)}: {path}")

        if metadata["output_schema"] not in SCHEMA_REGISTRY:
            raise ValueError(
                f"Unknown output_schema={metadata['output_schema']} in {path}. "
                f"Allowed={sorted(SCHEMA_REGISTRY)}"
            )

        return PromptSpec(
            prompt_id=metadata["prompt_id"],
            version=metadata["version"],
            agent=metadata["agent"],
            scenario=metadata["scenario"],
            input_fields=tuple(metadata["input_fields"]),
            output_schema=metadata["output_schema"],
            template_text=body,
            path=path,
        )

    def get(self, prompt_id: str, version: str) -> PromptSpec:
        key = (prompt_id, version)
        if key not in self._registry:
            raise KeyError(f"Prompt not found: {key}")
        return self._registry[key]

    def render(self, prompt_id: str, version: str, data: dict[str, Any]) -> str:
        spec = self.get(prompt_id, version)
        missing = [field for field in spec.input_fields if field not in data]
        if missing:
            raise ValueError(f"Missing prompt input fields for {prompt_id}@{version}: {missing}")
        scoped = {k: data[k] for k in spec.input_fields}
        return spec.template_text.format(**scoped)

    def output_model(self, prompt_id: str, version: str) -> type[BaseModel]:
        spec = self.get(prompt_id, version)
        return SCHEMA_REGISTRY[spec.output_schema]

    def validate_output(self, prompt_id: str, version: str, output_payload: dict[str, Any]) -> BaseModel:
        model = self.output_model(prompt_id, version)
        try:
            return model.model_validate(output_payload)
        except ValidationError as exc:
            raise ValueError(f"Invalid output for {prompt_id}@{version}: {exc}") from exc

    def list_prompts(self) -> list[PromptSpec]:
        return sorted(self._registry.values(), key=lambda s: (s.prompt_id, s.version))
