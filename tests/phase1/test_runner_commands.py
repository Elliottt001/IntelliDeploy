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
