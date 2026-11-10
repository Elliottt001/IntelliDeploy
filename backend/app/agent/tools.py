import subprocess
from pathlib import Path
from typing import Protocol

from pydantic import BaseModel, Field, TypeAdapter

from app.agent.workspace import safe_path
from app.core.types import ToolCall, ToolResult

MAX_PUBLIC_BYTES = 64 * 1024


class CommandExecutor(Protocol):
    def run(self, workspace: str, argv: list[str], timeout: int) -> tuple[bool, str]: ...


class PathArgs(BaseModel):
    path: str = "."


class WriteArgs(BaseModel):
    path: str
    content: str


class PatchArgs(BaseModel):
    path: str
    old_text: str
    new_text: str


class CommandArgs(BaseModel):
    argv: list[str] = Field(min_length=1)
    timeout: int = Field(default=60, ge=1, le=600)


ARGUMENTS = {
    "list_files": PathArgs,
    "read_file": PathArgs,
    "write_file": WriteArgs,
    "apply_patch": PatchArgs,
    "run_command": CommandArgs,
}


class DockerExecutor:
    def __init__(self, image: str):
        if "@sha256:" not in image:
            raise ValueError("executor image must be pinned by digest")
        self.image = image

    def run(self, workspace: str, argv: list[str], timeout: int) -> tuple[bool, str]:
        command = [
            "docker", "run", "--rm", "--network", "none", "--read-only",
            "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
            "--pids-limit", "128", "--memory", "1g", "--cpus", "1",
            "--user", "10001:10001", "--tmpfs", "/tmp:rw,noexec,nosuid,size=128m",
            "-v", f"{Path(workspace).resolve()}:/workspace:rw", "-w", "/workspace",
            self.image, *argv,
        ]
        try:
            result = subprocess.run(command, text=True, stdout=subprocess.PIPE,
                                    stderr=subprocess.STDOUT, timeout=timeout, env={"PATH": "/usr/bin:/bin"})
            return result.returncode == 0, result.stdout
        except subprocess.TimeoutExpired as exc:
            output = exc.stdout or ""
            return False, f"{output}\ncommand timed out after {timeout}s"


def _public_output(content: str) -> str:
    raw = content.encode("utf-8")
    if len(raw) <= MAX_PUBLIC_BYTES:
        return content
    suffix = b"\n[truncated]"
    return (raw[: MAX_PUBLIC_BYTES - len(suffix)] + suffix).decode("utf-8", errors="ignore")


def execute_tool(workspace_id: str, call: ToolCall, executor: CommandExecutor | None = None) -> ToolResult:
    model = ARGUMENTS.get(call.name)
    if model is None:
        raise ValueError("unknown tool")
    args = TypeAdapter(model).validate_python(call.arguments)
    root = Path(workspace_id).resolve()
    if not root.is_dir():
        raise ValueError("workspace does not exist")
    if call.name == "list_files":
        base = safe_path(root, args.path)
        content = "\n".join(str(path.relative_to(root)) for path in sorted(base.rglob("*"))
                            if path.is_file() and ".tool-results" not in path.parts)
        return ToolResult(call_id=call.id, ok=True, content=content)
    if call.name == "read_file":
        return ToolResult(call_id=call.id, ok=True, content=_public_output(safe_path(root, args.path).read_text()))
    if call.name == "write_file":
        path = safe_path(root, args.path)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(args.content)
        return ToolResult(call_id=call.id, ok=True, content="written")
    if call.name == "apply_patch":
        path = safe_path(root, args.path)
        original = path.read_text()
        if not args.old_text or original.count(args.old_text) != 1:
            return ToolResult(call_id=call.id, ok=False, content="patch context must match exactly once")
        path.write_text(original.replace(args.old_text, args.new_text, 1))
        return ToolResult(call_id=call.id, ok=True, content="patched")
    if executor is None:
        return ToolResult(call_id=call.id, ok=False, content="隔离执行器尚未配置")
    ok, content = executor.run(str(root), args.argv, args.timeout)
    result_path = root / ".tool-results" / f"{call.id}.log"
    result_path.write_text(content)
    return ToolResult(call_id=call.id, ok=ok, content=_public_output(content))

