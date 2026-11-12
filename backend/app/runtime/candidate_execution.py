import json
from pathlib import Path
import secrets
from uuid import uuid4
from sqlalchemy import select

from app.apps.models import App, Instance
from app.capabilities.identity import issue_app_identity, revoke_instance_credential
from app.config import settings
from app.core.types import CandidateRuntime, AppManifest, ServiceSpec
from app.models.user import User
from app.runtime.manifest import manifest_hash
from app.runtime.models import DeploymentTarget, ResourceRecord
from app.runtime.configuration import InstanceConfiguration


class CandidateExecution:
    def __init__(self, execution):
        self.execution = execution
        self.controllers = {}
        data_manager = None
        if settings.INSTANCE_DATABASE_ADMIN_URL:
            from app.capabilities.data import DataSpaceManager

            data_manager = DataSpaceManager(
                session_factory=execution.sessions,
                admin_database_url=settings.INSTANCE_DATABASE_ADMIN_URL,
                secrets_root=Path(settings.INSTANCE_SECRETS_ROOT) / "databases",
            )
        self.configuration = InstanceConfiguration(
            execution.sessions,
            settings.INSTANCE_SECRETS_ROOT,
            platform_url=settings.PLATFORM_CAPABILITY_URL,
            data_manager=data_manager,
        )

    def prepare_manifest(self, manifest):
        manifest = manifest.model_copy(deep=True)
        web = next(
            service
            for service in manifest.services
            if service.name == manifest.web_service
        )
        for name in [
            "PLATFORM_INSTANCE_ID",
            "PLATFORM_INSTANCE_TOKEN",
            "PLATFORM_CAPABILITY_URL",
            "PLATFORM_LOGIN_CALLBACK",
        ]:
            web.env_refs.setdefault(name, name.lower())
        checkpoint = self.execution.checkpoint()
        with self.execution.sessions() as session:
            job = self.execution.job(session)
            app = session.get(App, job.app_id)
            from app.apps.models import AppVersion

            source = (
                session.get(AppVersion, app.source_version_id)
                if app.source_version_id
                else None
            )
        if checkpoint.get("template_version") or (source and source.template_version):
            web.env_refs.setdefault("DATABASE_URL", "database-url")
        if (
            "DATABASE_URL" in web.env_refs
            and not self.configuration.data_manager
            and not any(
                "postgres" in service.image.lower() for service in manifest.services
            )
        ):
            if not settings.INSTANCE_POSTGRES_IMAGE:
                from app.jobs.pipeline import TargetUnavailable

                raise TargetUnavailable("实例PostgreSQL镜像或独立数据库连接尚未配置")
            database = ServiceSpec(
                name="platform-db",
                image=settings.INSTANCE_POSTGRES_IMAGE,
                port=5432,
                env_refs={
                    "POSTGRES_PASSWORD": "postgres-password",
                    "POSTGRES_USER": "postgres-user",
                    "POSTGRES_DB": "postgres-db",
                },
                volumes={"postgres-data": "/var/lib/postgresql/data"},
            )
            manifest.services.append(database)
            web.depends_on.append(database.name)
        return AppManifest.model_validate(manifest.model_dump())

    def production_instance(self, manifest):
        from app.agent.compatibility import select_deploy_target

        with self.execution.sessions() as session:
            job = self.execution.job(session)
            app = session.scalar(
                select(App).where(App.id == job.app_id).with_for_update()
            )
            instance = session.scalar(
                select(Instance).where(
                    Instance.app_id == app.id,
                    Instance.kind == "PRODUCTION",
                    Instance.status != "DELETED",
                )
            )
            targets = list(session.scalars(select(DeploymentTarget)))
            target_id = (
                instance.target_id
                if instance and instance.target_id
                else job.checkpoint.get("evaluation_target_id")
            )
            selected = [
                target
                for target in targets
                if target_id is None or target.id == target_id
            ]
            target_id = select_deploy_target(
                manifest,
                [
                    {
                        "id": t.id,
                        "enabled": t.enabled,
                        "health": t.health,
                        "architecture": t.architecture,
                        "capacity": t.capacity,
                    }
                    for t in selected
                ],
            )
            if instance is None:
                instance = Instance(
                    app_id=app.id,
                    owner_id=app.owner_id,
                    kind="PRODUCTION",
                    target_id=target_id,
                )
                session.add(instance)
                session.flush()
            else:
                instance.target_id = target_id
            session.commit()
            return instance.id

    async def start(self, job_id, attempt_id, manifest, requirement):
        import asyncio

        production = self.production_instance(manifest)
        id = str(uuid4())
        with self.execution.sessions() as session:
            job = self.execution.job(session)
            app = session.get(App, job.app_id)
            from app.utils.security import get_password_hash

            other = User(
                username="candidate-" + uuid4().hex,
                email=uuid4().hex + "@candidate.invalid",
                hashed_password=get_password_hash(secrets.token_urlsafe(32)),
                is_active=True,
            )
            session.add(other)
            session.flush()
            instance = Instance(
                id=id,
                owner_id=app.owner_id,
                app_id=app.id,
                kind="CANDIDATE",
                status="PENDING",
                data_namespace="candidate_" + id.replace("-", ""),
            )
            session.add(instance)
            parent = self.execution.reservation(session, job)
            record = ResourceRecord(
                type="CANDIDATE_RUNTIME",
                job_id=job.id,
                app_id=app.id,
                operation_id=f"candidate-runtime:{job.id}:{attempt_id}:{self.execution.generation}",
                reference=id,
                state="PREPARING",
                metadata_json={
                    'managed':True,
                    "instance_id": id,
                    "owner_id": app.owner_id,
                    "other_id": other.id,
                    "worker_id": self.execution.worker_id,
                    "generation": self.execution.generation,
                    "reservation_operation_id": parent.operation_id,
                    "anonymous_allowed": not any(
                        item.private_data for item in requirement.acceptance
                    ),
                },
            )
            session.add(record)
            session.commit()
            owner_id = app.owner_id
            other_id = other.id
            app_id = app.id
        health = await self.execution.runner.health()
        domain = health.get("candidate_domain_suffix")
        if not domain:
            raise ValueError("candidate gateway domain is not registered")
        url = f"https://{id}.{domain}"
        with self.execution.sessions() as session:
            self.execution.job(session)
            session.get(Instance, id).url = url
            session.commit()
        values = await asyncio.to_thread(self.configuration.bundle, id, manifest, url)
        with self.execution.sessions() as session:
            adjustment = self.execution.job(session).kind == "ADJUST"
        if adjustment and self.configuration.data_manager:
            await asyncio.to_thread(
                self.configuration.data_manager.clone,
                production,
                id,
                f"candidate-data:{job_id}:{attempt_id}",
            )
        config = json.loads(self.configuration.path(id).read_text())
        token = config["credentials"]["instance_token"]
        identity_refs = {
            "owner": issue_app_identity(owner_id, app_id, id),
            "other": issue_app_identity(other_id, app_id, id),
        }
        try:
            response = await self.execution.runner.start(
                operation_id=f'candidate-runtime:{job.id}:{attempt_id}:{self.execution.generation}',
                job_id=job_id,
                attempt_id=attempt_id,
                instance_id=id,
                generation=self.execution.generation,
                manifest=manifest.model_dump(mode="json"),
                requirement=requirement.model_dump(mode="json"),
                values=values,
                instance_token=token,
                platform_url=settings.PLATFORM_CAPABILITY_URL,
                data_namespace="candidate_" + id.replace("-", ""),
                isolated_network=True,
                empty_data=True,
                health_timeout_seconds=180,
            )
            self.execution.job_check()
            if response["base_url"] != url:
                raise ValueError("candidate gateway address changed")
            with self.execution.sessions() as session:
                self.execution.job(session)
                session.get(Instance, id).status = "RUNNING"
                record = session.scalar(
                    select(ResourceRecord).where(
                        ResourceRecord.reference == id,
                        ResourceRecord.type == "CANDIDATE_RUNTIME",
                    )
                )
                record.state = "RUNNING"
                session.commit()
            runtime = CandidateRuntime(
                id=id,
                base_url=url,
                manifest_hash=manifest_hash(manifest),
                data_namespace="candidate_" + id.replace("-", ""),
                identity_refs=identity_refs,
            )
            self.controllers[id] = CandidateController(self.execution.runner, runtime)
            return runtime
        except Exception:
            await self.stop(id, True)
            raise

    def controller(self, id):
        return self.controllers[id]

    async def stop(self, id, preserve_evidence=True):
        try:
            await self.execution.runner.stop(id, preserve_evidence)
        except Exception:
            with self.execution.sessions() as session:
                instance=session.get(Instance,id)
                if instance and instance.kind=='CANDIDATE':
                    instance.status='UNKNOWN'
                    record=session.scalar(select(ResourceRecord).where(ResourceRecord.type=='CANDIDATE_RUNTIME',ResourceRecord.reference==id))
                    if record: record.state='UNKNOWN'
                    session.commit()
            raise
        with self.execution.sessions() as session:
            instance = session.get(Instance, id)
            if instance and instance.kind == "CANDIDATE":
                instance.status = "DELETED"
                revoke_instance_credential(session, id)
                record = session.scalar(
                    select(ResourceRecord).where(
                        ResourceRecord.reference == id,
                        ResourceRecord.type == "CANDIDATE_RUNTIME",
                    )
                )
                if record:
                    record.state = "STOPPED"
                    from datetime import datetime,timezone
                    record.last_seen_at=datetime.now(timezone.utc)
                    other = session.get(User, record.metadata_json["other_id"])
                    other.is_active = False
                session.commit()
        if self.configuration.data_manager:
            self.configuration.data_manager.destroy(id, confirmed=True)
        self.controllers.pop(id, None)


class CandidateController:
    def __init__(self, runner, runtime):
        self.runner = runner
        self.runtime = runtime

    async def restart_service(self, name):
        await self.runner.restart_service(self.runtime.id, name)

    def browser_options(self, actor):
        from urllib.parse import urlsplit

        if actor == "anonymous":
            return {}
        return {
            "storage_state": {
                "cookies": [
                    {
                        "name": "intellideploy_app_identity",
                        "value": self.runtime.identity_refs[actor],
                        "domain": urlsplit(self.runtime.base_url).hostname,
                        "path": "/",
                        "httpOnly": True,
                        "secure": True,
                        "sameSite": "Lax",
                        "expires": -1,
                    }
                ],
                "origins": [],
            }
        }
