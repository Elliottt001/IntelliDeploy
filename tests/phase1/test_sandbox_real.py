import os

import pytest

from app.agent.tools import DockerExecutor, execute_tool
from app.agent.workspace import WorkspaceManager
from app.core.types import ToolCall


@pytest.mark.sandbox
def test_real_container_timeout_and_secret_isolation(tmp_path):
    image = os.environ.get("AGENT_EXECUTOR_IMAGE")
    if not image:
        pytest.skip("AGENT_EXECUTOR_IMAGE digest is not configured")
    workspace = WorkspaceManager(tmp_path / "jobs").create_workspace("sandbox")
    executor = DockerExecutor(image)
    slow = execute_tool(workspace, ToolCall(id="slow", name="run_command", arguments={"argv": ["python", "-c", "import time; time.sleep(10)"], "timeout": 1}), executor=executor)
    assert not slow.ok
    next_call = execute_tool(workspace, ToolCall(id="next", name="run_command", arguments={"argv": ["python", "-c", "import os; print(os.getenv('DEEPSEEK_API_KEY')); print(42)"], "timeout": 5}), executor=executor)
    assert next_call.ok and "None\n42" in next_call.content
