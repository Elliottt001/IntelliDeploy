from __future__ import annotations

import json
from pathlib import Path

import pytest

from prompting.manager import PromptManager


@pytest.fixture(scope="module")
def manager() -> PromptManager:
    return PromptManager(templates_root=Path("prompts/templates"))


def test_all_prompts_have_valid_metadata_and_schema_binding(manager: PromptManager) -> None:
    prompts = manager.list_prompts()
    assert prompts, "No prompt templates discovered"
    for spec in prompts:
        assert spec.prompt_id
        assert spec.version
        assert spec.agent in {"BUILDER", "REVIEWER", "SECURITY"}
        assert spec.output_schema in {"BuilderOutput", "ReviewerOutput", "SecurityOutput"}
        assert len(spec.input_fields) > 0


def test_builder_main_flow_render_requires_declared_fields(manager: PromptManager) -> None:
    with pytest.raises(ValueError):
        manager.render("builder.main_flow", "1.0.0", data={"flow_id": "x"})


def test_golden_case_main_flow_output_shape_stable(manager: PromptManager) -> None:
    case_file = Path("prompts/golden_cases/main_flow_cases.json")
    cases = json.loads(case_file.read_text(encoding="utf-8"))

    for case in cases:
        # 1) Prompt render contract check (input field completeness)
        rendered = manager.render(case["prompt_id"], case["version"], case["input"])
        assert "Return only a JSON object" in rendered

        # 2) Output contract check (format drift prevention)
        # In real pipeline, replace golden_output with real LLM output.
        validated = manager.validate_output(case["prompt_id"], case["version"], case["golden_output"])
        assert validated.contract_version == "1.0.0"
