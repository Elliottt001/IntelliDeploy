"""Evidence-bound, model-free Docker packaging; ambiguous rewrites stay Builder-owned."""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
import shlex
import tempfile

from app.agent.checkpoint import stage_input_hash
from app.agent.contracts import PackagingFinding, PackagingPlan, SafeDockerEdit
from app.agent.workspace import safe_path
from app.runtime.build import _sensitive


LOCK_COMMANDS = {
    "package-lock.json": ["npm", "ci"],
    "pnpm-lock.yaml": ["pnpm", "install", "--frozen-lockfile"],
    "yarn.lock": ["yarn", "install", "--frozen-lockfile"],
    "uv.lock": ["uv", "sync", "--frozen"],
}


def checked_path(root, relative):
    root = Path(root).absolute()
    path = root / relative
    for parent in [path, *path.parents]:
        if parent.is_symlink():
            raise ValueError("symbolic link is not a packaging source")
        if parent == root:
            break
    return safe_path(root, relative)


def tree_digest(root: Path) -> str:
    values = {}
    for path in sorted(Path(root).rglob("*")):
        relative = path.relative_to(root)
        if path.is_symlink():
            raise ValueError("symbolic link is not a component source")
        if path.is_file() and not _sensitive(relative):
            values[relative.as_posix()] = hashlib.sha256(path.read_bytes()).hexdigest()
    return stage_input_hash(values)


def _inputs(root, dockerfile):
    names = [dockerfile, "package.json", *LOCK_COMMANDS]
    return {name: checked_path(root, name).read_text() for name in names if checked_path(root, name).is_file()}


def _argv(body):
    if body.startswith("["):
        result = json.loads(body)
        if not isinstance(result, list) or not all(isinstance(x, str) and x for x in result):
            raise ValueError("invalid command")
        return result
    if any(marker in body for marker in ("&&", "|", ";", "$", "`", "\\")):
        raise ValueError("complex shell command")
    return shlex.split(body)


def plan_packaging(workspace_id, profile, route) -> PackagingPlan:
    root = Path(workspace_id)
    data = _inputs(root, "Dockerfile")
    plan = PackagingPlan(
        source_url=profile.repo_url if profile else None,
        source_commit=profile.commit if profile else None,
        dockerfile_path="Dockerfile", action="REUSE", input_digest=stage_input_hash(data),
        package_manager=profile.package_manager if profile else None,
    )

    def block(code, message):
        plan.findings.append(PackagingFinding(code=code, severity="BLOCKING", message=message,
                                              evidence_ref=f"packaging:{plan.input_digest}:{code}"))
        plan.action = "BLOCKED"

    def edit(kind, old, new):
        plan.safe_edits.append(SafeDockerEdit(kind=kind, old_value=old, new_value=new,
                                             evidence_refs=[f"packaging:{plan.input_digest}"]))

    if "Dockerfile" not in data:
        block("DOCKERFILE_MISSING", "Builder must create a Dockerfile from actual runtime evidence")
        plan.action = "GENERATE"
        return plan
    lines = data["Dockerfile"].splitlines()
    starts = [i for i, line in enumerate(lines) if line.strip().upper().startswith("FROM ")]
    if not starts:
        block("FROM_MISSING", "Dockerfile has no runtime stage")
        return plan
    final = lines[starts[-1]:]
    commands = [line for line in final if line.strip().upper().startswith(("CMD ", "ENTRYPOINT "))]
    missing_command = not commands
    if missing_command:
        try:
            scripts = json.loads(data.get("package.json", "{}")).get("scripts", {})
            start = scripts.get("start", "")
            if not start or any(marker in start for marker in (" dev", "--reload", "vite")):
                raise ValueError("missing verified production command")
            if "next" in start and (scripts.get("build") != "next build" or not any("run build" in line for line in lines)):
                raise ValueError("missing verified production build")
            if len(starts) != 1 or not any(line.strip().startswith("WORKDIR ") for line in final):
                raise ValueError("missing verified runtime working directory")
            commands = ['CMD ["npm", "run", "start"]']
        except (ValueError, TypeError):
            block("START_COMMAND_AMBIGUOUS", "Builder must supply a verified production command")
            return plan
    if len(commands) != 1 or commands[0].strip().upper().startswith("ENTRYPOINT "):
        block("START_COMMAND_AMBIGUOUS", "Keep the entrypoint wrapper; Builder must verify the runtime command")
        return plan
    locks = [name for name in LOCK_COMMANDS if name in data]
    if len(locks) > 1:
        block("MULTIPLE_LOCKFILES", "Multiple package manager lockfiles require an explicit decision")
        return plan
    if locks:
        plan.install_command = LOCK_COMMANDS[locks[0]]
    try:
        command = _argv(commands[0].strip().split(maxsplit=1)[1])
        package = json.loads(data.get("package.json", "{}"))
        scripts = package.get("scripts", {})
        replacement = list(command)
        is_script_dev = command in (["npm", "run", "dev"], ["pnpm", "dev"], ["yarn", "dev"])
        is_next_dev = command[:2] == ["next", "dev"]
        if is_script_dev or is_next_dev:
            start = scripts.get("start", "")
            if not start or any(x in start for x in ("--reload", "next dev", "vite")):
                raise ValueError("No verified production start script")
            if "next" in start and (scripts.get("build") != "next build" or not any("run build" in x for x in lines)):
                raise ValueError("Production build is missing")
            replacement = ["npm", "run", "start"] if command[0] in {"npm", "next"} else [command[0], "start"]
        elif command and command[0] == "uvicorn":
            replacement = [x for x in command if x != "--reload"]
            if "--host" in replacement:
                replacement[replacement.index("--host") + 1] = "0.0.0.0"
            else:
                replacement += ["--host", "0.0.0.0"]
        plan.start_command = replacement
        if replacement != command or missing_command:
            edit("SET_START_COMMAND", None if missing_command else commands[0], "CMD " + json.dumps(replacement))
    except (ValueError, KeyError, IndexError, TypeError) as exc:
        block("START_COMMAND_AMBIGUOUS", str(exc))
        plan.safe_edits = []
        return plan
    ports = set(profile.ports if profile else [])
    exposed = [line for line in final if line.strip().upper().startswith("EXPOSE ")]
    if len(ports) > 1:
        block("PORT_CONFLICT", "Multiple source ports require runtime disambiguation")
    elif ports:
        plan.container_port = next(iter(ports))
        # Never override an explicit command port with a profile guess.
        body = " ".join(command)
        match = re.search(r"--port\s+(\d+)", body)
        if match and int(match[1]) != plan.container_port:
            block("PORT_CONFLICT", "Runtime command and source port disagree")
        elif len(exposed) == 1 and exposed[0].strip() != f"EXPOSE {plan.container_port}":
            if match and int(match[1]) == plan.container_port:
                edit("SET_EXPOSE", exposed[0], f"EXPOSE {plan.container_port}")
            else:
                block("PORT_CONFLICT", "EXPOSE and profile disagree without a verified runtime port")
        elif not exposed:
            edit("SET_EXPOSE", None, f"EXPOSE {plan.container_port}")
    if plan.install_command:
        install = [line for line in final if re.fullmatch(r"RUN (npm (ci|install)|pnpm install(?: --frozen-lockfile)?|yarn install(?: --frozen-lockfile)?)", line.strip())]
        desired = "RUN " + shlex.join(plan.install_command)
        if len(install) == 1 and install[0].strip() != desired:
            edit("SET_INSTALL_COMMAND", install[0], desired)
    if plan.action == "BLOCKED":
        plan.safe_edits = []
    elif plan.safe_edits:
        plan.action = "NORMALIZE"
    else:
        plan.output_digest = stage_input_hash(data)
    return plan


def apply_packaging_plan(workspace_id, plan):
    path = checked_path(workspace_id, plan.dockerfile_path)
    data = _inputs(workspace_id, plan.dockerfile_path)
    if stage_input_hash(data) != plan.input_digest:
        # Successful repeated application is allowed only for the same exact output.
        if plan.output_digest and stage_input_hash(data) == plan.output_digest:
            return plan
        raise ValueError("packaging input changed")
    if plan.action not in {"REUSE", "NORMALIZE"}:
        return plan
    text = path.read_text()
    for change in plan.safe_edits:
        if change.old_value is None:
            text = text.rstrip("\n") + "\n" + change.new_value + "\n"
        else:
            if text.count(change.old_value) != 1:
                raise ValueError("ambiguous packaging edit context")
            text = text.replace(change.old_value, change.new_value, 1)
    if plan.safe_edits:
        descriptor, temporary = tempfile.mkstemp(dir=path.parent)
        try:
            with os.fdopen(descriptor, "w") as file:
                file.write(text)
                file.flush()
                os.fsync(file.fileno())
            os.chmod(temporary, path.stat().st_mode & 0o777)
            os.replace(temporary, path)
        finally:
            Path(temporary).unlink(missing_ok=True)
    return plan.model_copy(update={"output_digest": stage_input_hash({**data, plan.dockerfile_path: text})})
