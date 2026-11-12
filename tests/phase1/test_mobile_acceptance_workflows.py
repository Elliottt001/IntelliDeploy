from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[2]
WORKFLOWS = ROOT / "frontend" / ".maestro"


def _commands(name: str) -> list[object]:
    metadata, commands = list(yaml.safe_load_all((WORKFLOWS / name).read_text()))
    assert metadata["appId"] == "cn.elliotttzhang.intellideploy"
    assert isinstance(metadata["onFlowStart"], list)
    assert isinstance(commands, list)
    return commands


def _tap_ids(commands: list[object]) -> set[str]:
    return {
        tap["id"]
        for command in commands
        if isinstance(command, dict)
        and isinstance((tap := command.get("tapOn")), dict)
        and "id" in tap
    }


def _wait_visible_ids(commands: list[object]) -> set[str]:
    return {
        visible["id"]
        for command in commands
        if isinstance(command, dict)
        and isinstance((wait := command.get("extendedWaitUntil")), dict)
        and isinstance((visible := wait.get("visible")), dict)
        and "id" in visible
    }


def test_mobile_acceptance_workflows_cover_generation_recovery_and_community_copy():
    generate = _commands("generate.yaml")
    recover = _commands("recover.yaml")
    community = _commands("community.yaml")

    assert _tap_ids(generate) >= {
        "create-app",
        "open-app",
    }
    assert _tap_ids(recover) >= {
        "refresh-job",
        "send-message",
    }
    assert _tap_ids(community) >= {
        "copy-publication",
    }
    assert "open-app" in _wait_visible_ids(generate)
    assert "open-app" in _wait_visible_ids(community)
