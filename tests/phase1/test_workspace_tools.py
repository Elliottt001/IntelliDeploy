from pathlib import Path

import pytest

from app.agent.tools import execute_tool
from app.agent.workspace import WorkspaceManager, safe_path
from app.core.types import ToolCall


class FakeExecutor:
    def __init__(self):
        self.calls = []

    def run(self, workspace, argv, timeout):
        self.calls.append((workspace, argv, timeout))
        return True, ("x" * 70000) if argv == ["large"] else "42\n"


def test_paths_and_symlinks_cannot_escape_workspace(tmp_path):
    root = tmp_path / "workspace"
    root.mkdir()
    (root / "escape").symlink_to("/etc")
    for value in ("../secret", "/etc/passwd", "escape/passwd"):
        with pytest.raises(ValueError):
            safe_path(root, value)


def test_file_tools_validate_arguments_patch_and_snapshot(tmp_path):
    manager = WorkspaceManager(tmp_path / "jobs")
    workspace = manager.create_workspace("job-1")
    assert execute_tool(workspace, ToolCall(id="w", name="write_file", arguments={"path": "src/a.txt", "content": "old"})).ok
    assert execute_tool(workspace, ToolCall(id="p", name="apply_patch", arguments={"path": "src/a.txt", "old_text": "old", "new_text": "new"})).ok
    assert execute_tool(workspace, ToolCall(id="r", name="read_file", arguments={"path": "src/a.txt"})).content == "new"
    listing = execute_tool(workspace, ToolCall(id="l", name="list_files", arguments={"path": "."}))
    assert listing.ok and "src/a.txt" in listing.content
    with pytest.raises(ValueError):
        execute_tool(workspace, ToolCall(id="bad", name="write_file", arguments={"path": "a"}))
    archive = manager.snapshot_workspace(workspace, tmp_path / "snapshots" / "job-1.tar.gz")
    assert archive.is_file()


def test_commands_require_isolated_executor_and_cap_public_output(tmp_path):
    manager = WorkspaceManager(tmp_path / "jobs")
    workspace = manager.create_workspace("job-2")
    unavailable = execute_tool(workspace, ToolCall(id="none", name="run_command", arguments={"argv": ["python", "-V"]}))
    assert not unavailable.ok and "隔离执行器" in unavailable.content
    executor = FakeExecutor()
    result = execute_tool(workspace, ToolCall(id="large", name="run_command", arguments={"argv": ["large"], "timeout": 5}), executor=executor)
    assert result.ok and len(result.content.encode()) <= 65536 and "truncated" in result.content
    assert (Path(workspace) / ".tool-results" / "large.log").stat().st_size == 70000
    assert executor.calls[0][1:] == (["large"], 5)


def test_illegal_tool_timeout_and_platform_secrets_are_rejected(tmp_path):
    manager = WorkspaceManager(tmp_path / "jobs")
    workspace = manager.create_workspace("job-3")
    with pytest.raises(ValueError):
        execute_tool(workspace, ToolCall(id="x", name="unknown", arguments={}))
    for timeout in (0, 601):
        with pytest.raises(ValueError):
            execute_tool(workspace, ToolCall(id="x", name="run_command", arguments={"argv": ["true"], "timeout": timeout}), executor=FakeExecutor())
    assert not any(name in {"DEEPSEEK_API_KEY", "GITHUB_TOKEN", "SEALOS_API_TOKEN"} for name in FakeExecutor().__dict__)
