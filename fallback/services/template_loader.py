from __future__ import annotations

from pathlib import Path

from .config import get_config


def _apply_variables(template: str, variables: dict[str, object] | None = None) -> str:
    rendered = template
    for key, value in (variables or {}).items():
        rendered = rendered.replace(f"{{{{{key}}}}}", "" if value is None else str(value))
    return rendered


def load_template(template_family: str, template_name: str, *, base_dir: Path | None = None) -> str:
    config = get_config()
    template_path = (base_dir or config.templates_dir) / template_family / template_name
    return template_path.read_text(encoding="utf-8")


def render_template(
    template_family: str,
    template_name: str,
    variables: dict[str, object] | None = None,
) -> str:
    return _apply_variables(load_template(template_family, template_name), variables)

