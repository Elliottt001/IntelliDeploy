"""Decision B 缺失组件分类 & deploy_ready 判定的单元测试。

锁住的核心不变量:
1. docker_compose / healthcheck / build_script / entry_file / dependency_file
   等 OPTIONAL_OR_INFORMATIONAL 缺失不应阻塞 deploy_ready。
2. 未知 missing 名字降级为 warning,不阻塞。
3. Dockerfile 这种 REPAIR_REQUIRED 缺失且未修补成功,必须阻塞。
4. 已修补的组件应进入 patch_items / warnings 之一,不与新分类冲突。
"""
from __future__ import annotations

from fallback.solvers.b_patch_repo.missing_component import (
    OPTIONAL_OR_INFORMATIONAL,
    REPAIR_REQUIRED,
    REPAIR_SUPPORTED,
    classify_missing_component,
)


def test_classify_known_buckets() -> None:
    assert classify_missing_component("Dockerfile") == "REPAIR_REQUIRED"
    assert classify_missing_component(".env.example") == "REPAIR_SUPPORTED"
    assert classify_missing_component("env_example") == "REPAIR_SUPPORTED"
    assert classify_missing_component("start_script") == "REPAIR_SUPPORTED"
    for name in ("docker_compose", "healthcheck", "build_script", "entry_file", "dependency_file"):
        assert classify_missing_component(name) == "OPTIONAL_OR_INFORMATIONAL"


def test_classify_unknown_returns_unknown() -> None:
    assert classify_missing_component("some_future_signal") == "UNKNOWN"
    assert classify_missing_component("") == "UNKNOWN"


def test_buckets_have_no_overlap_except_required_supported() -> None:
    # Dockerfile 既 REQUIRED 又 SUPPORTED 是合法重叠(必修 + 能修),
    # 但 REPAIR_REQUIRED ∩ OPTIONAL 与 REPAIR_SUPPORTED ∩ OPTIONAL 必须空。
    assert REPAIR_REQUIRED & OPTIONAL_OR_INFORMATIONAL == frozenset()
    assert REPAIR_SUPPORTED & OPTIONAL_OR_INFORMATIONAL == frozenset()
    assert REPAIR_REQUIRED <= REPAIR_SUPPORTED  # 必修项必须也能修
