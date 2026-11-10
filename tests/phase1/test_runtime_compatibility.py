from app.agent.compatibility import assess_compatibility, select_deploy_target
from app.core.types import AcceptanceItem, AppManifest, Requirement, ServiceSpec


REQ = Requirement(prompt="Web工具", acceptance=[AcceptanceItem(id="open", action="打开页面", expected="可使用")])


def test_supported_web_stacks_keep_original_database():
    report = assess_compatibility({"file_tree": ["requirements.txt", "Dockerfile"], "key_files": {"requirements.txt": "fastapi\npsycopg", "Dockerfile": "FROM python:3.13"}}, REQ)
    assert report.status == "SUPPORTED" and report.runtime == "python" and "postgresql" in report.databases


def test_gpu_native_and_missing_evidence_are_not_eligible():
    gpu = assess_compatibility({"description": "CUDA GPU desktop application", "file_tree": ["main.py"]}, REQ)
    assert gpu.status == "UNSUPPORTED" and any("gpu" in reason for reason in gpu.reasons)
    unknown = assess_compatibility({"description": "maybe web"}, REQ)
    assert unknown.status == "UNKNOWN"


def test_target_selection_requires_health_architecture_and_capacity():
    manifest = AppManifest(web_service="web", services=[ServiceSpec(name="web", image="app@sha256:" + "a" * 64, memory_mb=512, cpu_millis=500)])
    targets = [
        {"id": "bad", "enabled": True, "health": "HEALTHY", "architecture": "arm64", "capacity": {"memory_mb": 4096, "cpu_millis": 4000}},
        {"id": "small", "enabled": True, "health": "HEALTHY", "architecture": "amd64", "capacity": {"memory_mb": 128, "cpu_millis": 4000}},
        {"id": "good", "enabled": True, "health": "HEALTHY", "architecture": "amd64", "capacity": {"memory_mb": 4096, "cpu_millis": 4000}},
    ]
    assert select_deploy_target(manifest, targets) == "good"
