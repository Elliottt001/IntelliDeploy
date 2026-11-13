import json
import os


def test_command_process_is_scoped_and_does_not_inherit_control_credentials(
    tmp_path, monkeypatch
):
    from app.runner.docker import ContainerCommands

    binary = tmp_path / "docker"
    record = tmp_path / "arguments.json"
    binary.write_text(
        '#!/usr/bin/env python3\nimport sys,os,json\nfrom pathlib import Path\nif sys.argv[1]=="run":\n Path('
        + repr(str(record))
        + ').write_text(json.dumps({"args":sys.argv[1:],"secret":os.getenv("DEEPSEEK_API_KEY")}))\n print("finished")\n'
    )
    binary.chmod(0o755)
    monkeypatch.setenv("PATH", str(tmp_path) + ":" + os.environ["PATH"])
    monkeypatch.setenv("DEEPSEEK_API_KEY", "control-secret")
    result = ContainerCommands("image@sha256:" + "a" * 64).run(
        str(tmp_path), ["python", "app.py"], 10, "owned-operation"
    )
    assert result["ok"] and "finished" in result["content"]
    call = json.loads(record.read_text())
    args = call["args"]
    assert call["secret"] is None
    assert args[args.index("--user") + 1] == "10001:10001"
    assert args[args.index("--network") + 1] == "none"
    assert "--read-only" in args and "--cap-drop" in args
    assert not any("docker.sock" in value for value in args)


def test_composition_command_mounts_root_readonly_and_app_writable(tmp_path, monkeypatch):
    import subprocess
    from app.runner.docker import ContainerCommands
    captured = []
    monkeypatch.setattr("shutil.which", lambda _: "docker")
    def run(args, **kwargs):
        captured.append(args)
        return subprocess.CompletedProcess(args, 0, "done", "")
    monkeypatch.setattr(subprocess, "run", run)
    policy = {"mode": "COMPOSITION", "writable_root": "app", "components": [
        {"role": role, "relative_path": "components/" + role, "tree_digest": "a" * 64}
        for role in ("records", "search")]}
    ContainerCommands("image@sha256:" + "a" * 64).run(
        str(tmp_path), ["python", "app.py"], 10, "job-operation", workspace_policy=policy)
    args = captured[0]
    assert str(tmp_path) + ":/workspace:ro" in args
    assert str(tmp_path / "app") + ":/workspace/app:rw" in args
    assert args[args.index("-w") + 1] == "/workspace/app"


def test_real_composition_command_cannot_mutate_component_snapshot(tmp_path):
    import os
    import pytest
    from app.runner.docker import ContainerCommands
    image = os.environ.get("ALGORITHM_VERIFY_IMAGE")
    if not image:
        pytest.skip("fixed local verification image is not selected")
    (tmp_path / "app").mkdir()
    (tmp_path / "app").chmod(0o777)
    (tmp_path / "components/records").mkdir(parents=True)
    (tmp_path / "components/search").mkdir()
    protected = tmp_path / "components/search/source.txt"
    protected.write_text("original")
    policy = {"mode": "COMPOSITION", "writable_root": "app", "components": [
        {"role": role, "relative_path": "components/" + role, "tree_digest": "a" * 64}
        for role in ("records", "search")]}
    script = (
        "from pathlib import Path\n"
        "try:\n Path('/workspace/components/search/source.txt').write_text('bad')\n"
        "except OSError:\n print('read-only')\n"
        "Path('result.txt').write_text('ok')\n"
    )
    result = ContainerCommands(image).run(str(tmp_path), ["python", "-c", script], 30,
        "composition-native-test", workspace_policy=policy)
    assert result["ok"], result["content"]
    assert "read-only" in result["content"]
    assert protected.read_text() == "original"
    assert (tmp_path / "app/result.txt").read_text() == "ok"
