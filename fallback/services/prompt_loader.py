from __future__ import annotations

from pathlib import Path

from .config import get_config


def _apply_variables(template: str, variables: dict[str, object] | None = None) -> str:
    rendered = template
    for key, value in (variables or {}).items():
        rendered = rendered.replace(f"{{{{{key}}}}}", "" if value is None else str(value))
    return rendered


def load_prompt(prompt_name: str, *, base_dir: Path | None = None) -> str:
    config = get_config()
    prompt_path = (base_dir or config.prompts_dir) / prompt_name
    return prompt_path.read_text(encoding="utf-8")


def render_prompt(prompt_name: str, variables: dict[str, object] | None = None) -> str:
    return _apply_variables(load_prompt(prompt_name), variables)

