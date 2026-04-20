from __future__ import annotations

import pytest


@pytest.fixture(autouse=True)
def isolate_fallback_runtime_dirs(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path_factory: pytest.TempPathFactory,
):
    runtime_root = tmp_path_factory.mktemp("fallback-runtime")
    monkeypatch.setenv("FALLBACK_WORKSPACES_DIR", str(runtime_root / "workspaces"))
    monkeypatch.setenv("FALLBACK_ARTIFACTS_DIR", str(runtime_root / "artifacts"))

    from fallback.async_tasks import redis_state
    from fallback.services import config

    redis_state._STATE_STORE = None
    config.get_config.cache_clear()
    yield
    redis_state._STATE_STORE = None
    config.get_config.cache_clear()
