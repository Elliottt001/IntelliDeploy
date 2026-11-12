from __future__ import annotations

import pytest

from test_candidate_pipeline import pipeline_context, pipeline_dependencies


@pytest.mark.asyncio
async def test_live_failure_keeps_old_release_and_data(
    session_factory, pipeline_context
):
    from sqlalchemy import select

    from app.apps.models import App, Instance
    from app.capabilities.models import InstanceDataSpace
    from app.jobs.models import Job
    from app.jobs.pipeline import PipelinePolicy, run_pipeline
    from app.runtime.models import ResourceRecord
    dependencies = pipeline_dependencies(
        pipeline_context, candidate_results=[True, True], live_results=[False, False]
    )
    await run_pipeline(
        pipeline_context.job_id,
        session_factory=session_factory,
        dependencies=dependencies,
        policy=PipelinePolicy(max_attempts=2),
    )

    with session_factory() as session:
        job = session.get(Job, pipeline_context.job_id)
        app = session.get(App, pipeline_context.app_id)
        instance = session.get(Instance, pipeline_context.instance_id)
        data = session.get(InstanceDataSpace, pipeline_context.instance_id)
        releases = list(
            session.scalars(
                select(ResourceRecord).where(
                    ResourceRecord.job_id == job.id,
                    ResourceRecord.type == "RELEASE_ATTEMPT",
                )
            )
        )
        assert job.status == "FAILED"
        assert app.active_version_id == pipeline_context.old_version_id
        assert instance.version_id == pipeline_context.old_version_id
        assert instance.url == "https://old.apps.test.invalid"
        assert data.destroyed_at is None
        assert len(releases) == 2
        assert all(item.state == "FAILED" for item in releases)


@pytest.mark.asyncio
async def test_missing_core_check_never_reaches_live_deployer(
    session_factory, pipeline_context
):
    from app.jobs.models import Job
    from app.jobs.pipeline import PipelinePolicy, run_pipeline
    dependencies = pipeline_dependencies(
        pipeline_context, candidate_results=[False, False], live_results=[]
    )
    await run_pipeline(
        pipeline_context.job_id,
        session_factory=session_factory,
        dependencies=dependencies,
        policy=PipelinePolicy(max_attempts=2),
    )

    with session_factory() as session:
        job = session.get(Job, pipeline_context.job_id)
        assert job.status == "FAILED"
        assert job.result is None
        assert job.error["code"] == "CORE_CHECKS_FAILED"


@pytest.mark.asyncio
async def test_target_failure_does_not_enter_model_repair_loop(
    session_factory, pipeline_context
):
    from sqlalchemy import select

    from app.jobs.models import Job
    from app.jobs.pipeline import PipelinePolicy, run_pipeline
    from app.runtime.linux import TargetUnavailable
    from app.runtime.models import ResourceRecord

    dependencies = pipeline_dependencies(
        pipeline_context, candidate_results=[True, True], live_results=[]
    )
    calls = 0

    async def unavailable(**kwargs):
        nonlocal calls
        del kwargs
        calls += 1
        raise TargetUnavailable("target credentials are unavailable")

    dependencies.deployer = unavailable
    await run_pipeline(
        pipeline_context.job_id,
        session_factory=session_factory,
        dependencies=dependencies,
        policy=PipelinePolicy(max_attempts=2),
    )

    with session_factory() as session:
        job = session.get(Job, pipeline_context.job_id)
        attempts = list(
            session.scalars(
                select(ResourceRecord).where(
                    ResourceRecord.job_id == job.id,
                    ResourceRecord.type == "CANDIDATE_ATTEMPT",
                )
            )
        )
        assert job.status == "FAILED"
        assert job.error["code"] == "TARGET_UNAVAILABLE"
        assert len(attempts) == 1
        assert job.checkpoint["algorithm"]["healing"][-1]["failure_class"] == "TARGET"
        assert job.checkpoint["algorithm"]["healing"][-1]["strategy"] == "STOP"
    assert calls == 1
