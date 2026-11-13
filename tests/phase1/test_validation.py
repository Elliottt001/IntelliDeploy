from __future__ import annotations

import os
import socket
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path

import httpx
import pytest

from app.agent.tools import execute_tool
from app.core.types import AcceptanceItem, Requirement
from app.core.types import ToolCall
from app.runtime.validation import validate_application
from tests.phase1.fixtures.notes.checks import persistence_checks


FIXTURE_APP = Path(__file__).parent / "fixtures" / "notes" / "app.py"


@dataclass
class NotesServer:
    url: str
    process: subprocess.Popen


@dataclass
class NotesRuntimeController:
    url: str

    async def restart_service(self, name: str) -> None:
        assert name == "web"
        async with httpx.AsyncClient() as client:
            response = await client.post(f"{self.url}/__test__/restart")
            response.raise_for_status()


def unused_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


@pytest.fixture
def notes_server_factory(tmp_path):
    servers: list[NotesServer] = []

    def start(mode: str) -> NotesServer:
        port = unused_port()
        env = os.environ.copy()
        env["NOTES_MODE"] = mode
        env["NOTES_DATA_FILE"] = str(tmp_path / f"{mode}-{port}.json")
        process = subprocess.Popen(
            [sys.executable, str(FIXTURE_APP), "--port", str(port)],
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        server = NotesServer(url=f"http://127.0.0.1:{port}", process=process)
        servers.append(server)
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            if process.poll() is not None:
                output = process.stdout.read() if process.stdout else ""
                raise RuntimeError(f"notes fixture exited early: {output}")
            try:
                if httpx.get(f"{server.url}/health", timeout=0.2).status_code == 200:
                    return server
            except httpx.HTTPError:
                time.sleep(0.05)
        raise RuntimeError("notes fixture did not become ready")

    yield start

    for server in servers:
        server.process.terminate()
        try:
            server.process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server.process.kill()
            server.process.wait(timeout=5)


def requirement() -> Requirement:
    return Requirement(
        prompt="保存笔记",
        revision=3,
        acceptance=[
            AcceptanceItem(
                id="persist",
                action="新增笔记后刷新并重启服务",
                expected="笔记仍存在",
            )
        ],
    )


@pytest.mark.asyncio
async def test_http_200_does_not_prove_persistence(notes_server_factory, tmp_path):
    server = notes_server_factory("volatile")

    report = await validate_application(
        server.url,
        requirement(),
        persistence_checks(),
        evidence_root=tmp_path / "evidence",
        attempt_id="volatile-attempt",
        manifest_hash="manifest-1",
        runtime_controller=NotesRuntimeController(server.url),
    )

    check = next(item for item in report.checks if item.id == "persist")
    assert not report.passed
    assert check.status == "FAIL"
    assert "persist" in check.evidence
    assert Path(check.evidence).exists()


@pytest.mark.asyncio
async def test_persistent_note_passes_refresh_and_restart(notes_server_factory, tmp_path):
    server = notes_server_factory("persistent")

    report = await validate_application(
        server.url,
        requirement(),
        persistence_checks(),
        evidence_root=tmp_path / "evidence",
        attempt_id="persistent-attempt",
        manifest_hash="manifest-2",
        runtime_controller=NotesRuntimeController(server.url),
    )

    assert report.passed
    assert report.required_ids == ["persist"]
    assert report.requirement_revision == 3
    assert report.attempt_id == "persistent-attempt"
    assert report.manifest_hash == "manifest-2"


@pytest.mark.asyncio
async def test_missing_core_check_is_not_run(notes_server_factory, tmp_path):
    server = notes_server_factory("persistent")

    report = await validate_application(
        server.url,
        requirement(),
        [],
        evidence_root=tmp_path / "evidence",
    )

    assert not report.passed
    assert report.checks[0].status == "NOT_RUN"
    assert report.checks[0].id == "persist"


@pytest.mark.asyncio
async def test_cross_origin_browser_action_is_rejected(notes_server_factory, tmp_path):
    server = notes_server_factory("persistent")
    checks = persistence_checks()
    checks[0]["actions"] = [{"type": "goto", "path": "https://example.com"}]

    report = await validate_application(
        server.url,
        requirement(),
        checks,
        evidence_root=tmp_path / "evidence",
    )

    assert report.checks[0].status == "FAIL"
    assert "origin" in (Path(report.checks[0].evidence) / "error.txt").read_text().lower()


@pytest.mark.asyncio
async def test_placeholder_saved_message_does_not_prove_feature(notes_server_factory, tmp_path):
    server = notes_server_factory("placeholder")

    report = await validate_application(
        server.url,
        requirement(),
        persistence_checks("not-a-placeholder"),
        evidence_root=tmp_path / "evidence",
        runtime_controller=NotesRuntimeController(server.url),
    )

    assert report.checks[0].status == "FAIL"


@pytest.mark.asyncio
async def test_restart_check_without_runtime_controller_is_not_run(notes_server_factory, tmp_path):
    server = notes_server_factory("persistent")

    report = await validate_application(
        server.url,
        requirement(),
        persistence_checks(),
        evidence_root=tmp_path / "evidence",
    )

    assert report.checks[0].status == "NOT_RUN"


@pytest.mark.asyncio
async def test_wrong_login_expectation_fails_instead_of_passing_open_page(notes_server_factory, tmp_path):
    server = notes_server_factory("persistent")
    checks = [
        {
            "item_id": "persist",
            "actor": "owner",
            "expected": "authenticated notes page",
            "actions": [
                {"type": "goto", "path": "/"},
                {"type": "expect_text", "selector": "#app", "text": "Welcome owner"},
            ],
        }
    ]

    report = await validate_application(
        server.url,
        requirement(),
        checks,
        evidence_root=tmp_path / "evidence",
    )

    assert report.checks[0].status == "FAIL"


def test_browser_tool_delegates_structured_check_without_browser_access(tmp_path):
    class BrowserExecutor:
        def run_browser_check(self, base_url, check, operation_id):
            assert base_url == "http://candidate.test"
            assert check.item_id == "persist"
            assert check.actor == "owner"
            assert operation_id == "browser-1"
            return {"status": "PASS", "evidence": "evidence/persist"}

    result = execute_tool(
        str(tmp_path),
        ToolCall(
            id="browser-1",
            name="run_browser_check",
            arguments={
                "base_url": "http://candidate.test",
                "item_id": "persist",
                "actor": "owner",
                "actions": [{"type": "goto", "path": "/"}],
                "expected": "page opens",
            },
        ),
        browser_executor=BrowserExecutor(),
    )

    assert result.ok
    assert '"status": "PASS"' in result.content


@pytest.mark.asyncio
async def test_check_planner_receives_actual_schema_and_action_arguments():
    import json
    from pydantic import TypeAdapter
    from app.core.types import BrowserCheck, ModelTurn
    from app.runtime.check_plan import compile_browser_checks
    req=Requirement(prompt='保存笔记',acceptance=[AcceptanceItem(id='save',action='保存',expected='可见')])
    class Model:
        async def complete(self,messages,tools,model):
            payload=json.loads(messages[1]['content'])
            assert payload['schema']==TypeAdapter(list[BrowserCheck]).json_schema()
            assert payload['action_arguments']['fill']==['selector','value']
            assert payload['action_arguments']['restart_service']==['service']
            value=[{'item_id':'save','actor':'owner','actions':[{'type':'request','path':'/api/notes','expected_status':200}],'expected':'可见'}]
            return ModelTurn(assistant_message={'content':json.dumps(value)})
    result=await compile_browser_checks(req,['app/api/notes/route.ts'],Model())
    assert result[0].item_id=='save'
