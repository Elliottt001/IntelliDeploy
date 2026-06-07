from __future__ import annotations

import asyncio
from pathlib import Path
import sys
from types import SimpleNamespace


ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from app.services.image_builder import BuildMethod, BuildStatus, ImageBuilder  # noqa: E402


class ResponseStub:
    def __init__(self, payload, status_code=200, text=""):
        self._payload = payload
        self.status_code = status_code
        self.text = text

    def json(self):
        return self._payload


class AsyncClientStub:
    instances = []

    def __init__(self, *args, **kwargs):
        self.posts = []
        self.gets = []
        self.poll_count = 0
        AsyncClientStub.instances.append(self)

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def post(self, url, json=None, headers=None):
        self.posts.append({"url": url, "json": json, "headers": headers})
        return ResponseStub({"build_id": "build-1", "status": "running"})

    async def get(self, url, headers=None):
        self.gets.append({"url": url, "headers": headers})
        self.poll_count += 1
        return ResponseStub(
            {
                "status": "succeeded",
                "image": "registry/app:latest",
                "digest": "sha256:abc",
                "logs": "done",
            }
        )


def test_sealos_build_submits_context_and_polls(monkeypatch):
    async def run():
        AsyncClientStub.instances.clear()
        monkeypatch.setattr("app.services.image_builder.httpx.AsyncClient", AsyncClientStub)
        monkeypatch.setattr("app.services.image_builder.settings.SEALOS_API_TOKEN", "token")
        monkeypatch.setattr("app.services.image_builder.settings.SEALOS_API_URL", "https://sealos.example/api")
        monkeypatch.setattr("app.services.image_builder.settings.SEALOS_BUILD_POLL_INTERVAL_SECONDS", 0)

        builder = ImageBuilder(BuildMethod.SEALOS_BUILD)
        result = await builder.build_image(
            dockerfile_content="FROM node:20",
            context_files={"package.json": "{}", "../escape": "bad", "Dockerfile": "bad"},
            image_name="registry/app",
            image_tag="latest",
            build_args={"NODE_ENV": "production"},
        )

        client = AsyncClientStub.instances[0]
        posted = client.posts[0]["json"]
        assert result["status"] == BuildStatus.SUCCESS.value
        assert result["image"] == "registry/app:latest"
        assert "package.json" in posted["files"]
        assert "../escape" not in posted["files"]
        assert posted["build_args"] == {"NODE_ENV": "production"}
        assert client.gets[0]["url"] == "https://sealos.example/api/build/build-1"

    asyncio.run(run())


class ApiExceptionStub(Exception):
    def __init__(self, status=500):
        self.status = status


class CoreApiStub:
    def __init__(self):
        self.config_maps = []
        self.deleted_config_maps = []

    def create_namespaced_config_map(self, namespace, body):
        self.config_maps.append((namespace, body))

    def list_namespaced_pod(self, namespace, label_selector):
        return SimpleNamespace(items=[SimpleNamespace(metadata=SimpleNamespace(name="kaniko-pod"))])

    def read_namespaced_pod_log(self, name, namespace, container=None, tail_lines=200):
        return "kaniko pushed image"

    def delete_namespaced_config_map(self, name, namespace):
        self.deleted_config_maps.append((name, namespace))


class BatchApiStub:
    def __init__(self):
        self.jobs = []
        self.deleted_jobs = []
        self.read_count = 0

    def create_namespaced_job(self, namespace, body):
        self.jobs.append((namespace, body))

    def read_namespaced_job(self, name, namespace):
        self.read_count += 1
        return SimpleNamespace(status=SimpleNamespace(succeeded=1, failed=0))

    def delete_namespaced_job(self, name, namespace):
        self.deleted_jobs.append((name, namespace))


def test_kaniko_build_creates_job_and_cleans_up(monkeypatch):
    batch_api = BatchApiStub()
    core_api = CoreApiStub()

    class ClientModule:
        BatchV1Api = staticmethod(lambda: batch_api)
        CoreV1Api = staticmethod(lambda: core_api)
        ApiException = ApiExceptionStub
        V1ConfigMap = staticmethod(lambda **kwargs: SimpleNamespace(**kwargs))
        V1ObjectMeta = staticmethod(lambda **kwargs: SimpleNamespace(**kwargs))
        V1Job = staticmethod(lambda metadata=None, spec=None: SimpleNamespace(metadata=metadata, spec=spec))
        V1JobSpec = staticmethod(lambda **kwargs: SimpleNamespace(**kwargs))
        V1PodTemplateSpec = staticmethod(lambda metadata=None, spec=None: SimpleNamespace(metadata=metadata, spec=spec))
        V1PodSpec = staticmethod(lambda **kwargs: SimpleNamespace(**kwargs))
        V1Container = staticmethod(lambda **kwargs: SimpleNamespace(**kwargs))
        V1Volume = staticmethod(lambda **kwargs: SimpleNamespace(**kwargs))
        V1ConfigMapVolumeSource = staticmethod(lambda name=None: SimpleNamespace(name=name))
        V1SecretVolumeSource = staticmethod(lambda secret_name=None: SimpleNamespace(secret_name=secret_name))
        V1VolumeMount = staticmethod(lambda **kwargs: SimpleNamespace(**kwargs))
        # image_builder 给容器加了 resources / security context / emptyDir 等，
        # stub 必须同步覆盖这些 V1* 工厂，否则 client.V1X 访问会 AttributeError，
        # build 走进异常分支返回 'failed'（这正是之前回归的根因）。
        V1ResourceRequirements = staticmethod(lambda **kwargs: SimpleNamespace(**kwargs))
        V1SecurityContext = staticmethod(lambda **kwargs: SimpleNamespace(**kwargs))
        V1Capabilities = staticmethod(lambda **kwargs: SimpleNamespace(**kwargs))
        V1SeccompProfile = staticmethod(lambda **kwargs: SimpleNamespace(**kwargs))
        V1EmptyDirVolumeSource = staticmethod(lambda **kwargs: SimpleNamespace(**kwargs))
        V1EnvVar = staticmethod(lambda **kwargs: SimpleNamespace(**kwargs))
        V1KeyToPath = staticmethod(lambda **kwargs: SimpleNamespace(**kwargs))
        V1Secret = staticmethod(lambda **kwargs: SimpleNamespace(**kwargs))

    class ConfigModule:
        @staticmethod
        def load_kube_config_from_dict(cfg):
            return None

    monkeypatch.setitem(sys.modules, "kubernetes", SimpleNamespace(client=ClientModule(), config=ConfigModule()))
    monkeypatch.setitem(sys.modules, "kubernetes.client", ClientModule())
    monkeypatch.setattr("app.services.image_builder.settings.KANIKO_KUBECONFIG", "apiVersion: v1")
    monkeypatch.setattr("app.services.image_builder.settings.KANIKO_NAMESPACE", "build-ns")
    monkeypatch.setattr("app.services.image_builder.settings.KANIKO_DOCKER_CONFIG_SECRET", "docker-secret")

    async def run():
        builder = ImageBuilder(BuildMethod.KANIKO)
        result = await builder.build_image(
            dockerfile_content="FROM python:3.12-slim",
            context_files={"app.py": "print('hi')"},
            image_name="registry/app",
            image_tag="v1",
            build_args={"A": "B"},
        )

        assert result["status"] == BuildStatus.SUCCESS.value
        assert result["image"] == "registry/app:v1"
        assert core_api.config_maps[0][0] == "build-ns"
        # 生产代码现在把 context 打成 tar.gz 后 base64 塞进 binary_data，
        # 字段名变了但只要证明 ConfigMap 里挂上了一个 tarball 条目即可。
        cm_body = core_api.config_maps[0][1]
        assert cm_body.binary_data and any(k.endswith(".tar.gz") for k in cm_body.binary_data)
        assert batch_api.jobs[0][0] == "build-ns"
        assert batch_api.deleted_jobs
        assert core_api.deleted_config_maps

    asyncio.run(run())


def test_safe_context_files_filters_unsafe_paths():
    files = ImageBuilder._safe_context_files(
        "FROM alpine",
        {
            "src/app.py": "print(1)",
            "/abs/path": "bad",
            "../escape": "bad",
            "Dockerfile": "bad",
        },
    )

    assert files == {"src/app.py": "print(1)", "Dockerfile": "FROM alpine"}
