import json
import re
import shutil
import subprocess
from pathlib import Path
from typing import Protocol

from pydantic import BaseModel, Field, TypeAdapter

from app.agent.workspace import safe_path
from app.core.types import BrowserCheck, ToolCall, ToolResult

MAX_PUBLIC_BYTES = 64 * 1024


class CommandExecutor(Protocol):
    def run(self, workspace: str, argv: list[str], timeout: int) -> tuple[bool, str]: ...


class RepositoryExecutor(Protocol):
    def search(self, query: str, limit: int) -> list[dict]: ...
    def fetch(self, url: str, commit: str, destination: str) -> dict: ...


class CapabilityExecutor(Protocol):
    def web_search(self, query: str, count: int, operation_id: str) -> list[dict]: ...
    def fetch_page(self, url: str, operation_id: str) -> dict: ...


class BrowserExecutor(Protocol):
    def run_browser_check(
        self, base_url: str, check: BrowserCheck, operation_id: str
    ) -> dict: ...


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
    timeout: int = Field(default=60, ge=1, le=600, description="Timeout in seconds, not milliseconds")


class SearchArgs(BaseModel):
    query: str = Field(min_length=1, max_length=500)
    limit: int = Field(default=10, ge=1, le=20)


class FetchArgs(BaseModel):
    url: str
    commit: str
    destination: str


class WebSearchArgs(BaseModel):
    query: str = Field(min_length=1, max_length=128)
    count: int = Field(default=5, ge=1, le=50)


class FetchPageArgs(BaseModel):
    url: str = Field(min_length=1, max_length=2048)


class BrowserCheckArgs(BrowserCheck):
    base_url: str = Field(min_length=1, max_length=2048)


ARGUMENTS = {
    "list_files": PathArgs,
    "read_file": PathArgs,
    "write_file": WriteArgs,
    "apply_patch": PatchArgs,
    "run_command": CommandArgs,
    "search_repositories": SearchArgs,
    "fetch_repository": FetchArgs,
    "web_search": WebSearchArgs,
    "fetch_page": FetchPageArgs,
    "run_browser_check": BrowserCheckArgs,
}


class DockerExecutor:
    def __init__(self, image: str):
        if "@sha256:" not in image and not re.fullmatch(r"sha256:[0-9a-f]{64}", image):
            raise ValueError("executor image must be pinned by digest")
        self.image = image
        self.docker = shutil.which("docker")
        if not self.docker:
            raise ValueError("docker CLI is unavailable")

    def run(self, workspace: str, argv: list[str], timeout: int) -> tuple[bool, str]:
        command = [
            self.docker, "run", "--rm", "--network", "none", "--read-only",
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


def execute_tool(workspace_id: str, call: ToolCall, executor: CommandExecutor | None = None,
                 repository_executor: RepositoryExecutor | None = None,
                 capability_executor: CapabilityExecutor | None = None,
                 browser_executor: BrowserExecutor | None = None) -> ToolResult:
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
    if call.name == "search_repositories":
        if repository_executor is None:
            return ToolResult(call_id=call.id, ok=False, content="受控仓库代理尚未配置")
        return ToolResult(call_id=call.id, ok=True, content=_public_output(json.dumps(repository_executor.search(args.query, args.limit), ensure_ascii=False)))
    if call.name == "fetch_repository":
        if (not re.fullmatch(r"https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+(?:\.git)?", args.url)
                or not re.fullmatch(r"[0-9a-f]{40}", args.commit)):
            raise ValueError("repository URL or commit is not allowed")
        destination = safe_path(root, args.destination)
        if repository_executor is None:
            return ToolResult(call_id=call.id, ok=False, content="受控仓库代理尚未配置")
        return ToolResult(call_id=call.id, ok=True, content=_public_output(json.dumps(repository_executor.fetch(args.url, args.commit, str(destination)), ensure_ascii=False)))
    if call.name in {"web_search", "fetch_page"}:
        if capability_executor is None:
            return ToolResult(call_id=call.id, ok=False, content="受控能力执行器尚未配置")
        value = (
            capability_executor.web_search(args.query, args.count, call.id)
            if call.name == "web_search"
            else capability_executor.fetch_page(args.url, call.id)
        )
        return ToolResult(
            call_id=call.id,
            ok=True,
            content=_public_output(json.dumps(value, ensure_ascii=False)),
        )
    if call.name == "run_browser_check":
        if browser_executor is None:
            return ToolResult(call_id=call.id, ok=False, content="受控浏览器执行器尚未配置")
        check = BrowserCheck(
            item_id=args.item_id,
            actor=args.actor,
            actions=args.actions,
            expected=args.expected,
        )
        value = browser_executor.run_browser_check(args.base_url, check, call.id)
        return ToolResult(
            call_id=call.id,
            ok=value.get("status") == "PASS",
            content=_public_output(json.dumps(value, ensure_ascii=False)),
        )
    if executor is None:
        return ToolResult(call_id=call.id, ok=False, content="隔离执行器尚未配置")
    ok, content = executor.run(str(root), args.argv, args.timeout)
    result_path = root / ".tool-results" / f"{call.id}.log"
    result_path.write_text(content)
    return ToolResult(call_id=call.id, ok=ok, content=_public_output(content))

