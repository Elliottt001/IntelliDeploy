from datetime import timedelta

from sqlalchemy import and_, func, or_, select, update

from app.core.types import Checkpoint, ValidationReport
from app.jobs.models import Job


class LeaseLost(RuntimeError):
    pass


def claim_job(session, worker_id, lease_seconds=60):
    if not worker_id or lease_seconds <= 0:
        raise ValueError('worker and positive lease duration required')
    from app.admin.service import claims_paused
    if claims_paused(session):
        session.commit()
        return None
    job = session.scalar(select(Job).where(or_(
        Job.status == 'QUEUED',
        and_(Job.status == 'RUNNING', Job.lease_until < func.now()),
    )).order_by(Job.created_at, Job.id).with_for_update(skip_locked=True).limit(1))
    if job is None:
        session.commit()
        return None
    now = session.scalar(select(func.now()))
    job.status = 'RUNNING'
    job.lease_owner = worker_id
    job.lease_until = now + timedelta(seconds=lease_seconds)
    job.lease_generation += 1
    job.updated_at = now
    session.commit()
    session.refresh(job)
    return job


def leased_job(session, job_id, worker_id, generation):
    job = session.scalar(select(Job).where(
        Job.id == job_id, Job.status == 'RUNNING', Job.lease_owner == worker_id,
        Job.lease_generation == generation, Job.lease_until > func.now(),
    ).with_for_update())
    if job is None:
        raise LeaseLost('job lease expired or was replaced')
    return job


def heartbeat(session, job_id, worker_id, *, generation, lease_seconds=60):
    job = leased_job(session, job_id, worker_id, generation)
    job.lease_until = session.scalar(select(func.now())) + timedelta(seconds=lease_seconds)
    session.commit()


def save_checkpoint(session, job_id, worker_id, checkpoint: Checkpoint, *, generation):
    job = leased_job(session, job_id, worker_id, generation)
    job.checkpoint = checkpoint.model_dump(mode='json')
    job.updated_at = func.now()
    session.commit()


def finish_job(session, job_id, worker_id, status, *, generation, result=None, error=None, question=None):
    if status not in {'WAITING_USER', 'PAUSED_QUOTA', 'SUCCEEDED', 'FAILED', 'CANCELLED'}:
        raise ValueError('invalid terminal or waiting state')
    job = leased_job(session, job_id, worker_id, generation)
    if status == 'SUCCEEDED':
        from app.apps.models import App, AppVersion, Instance
        from app.core.types import DeliveryResult
        delivery = DeliveryResult.model_validate(result) if result else None
        version = session.get(AppVersion, delivery.version_id) if delivery else None
        instance = session.get(Instance, delivery.instance_id) if delivery else None
        app = session.get(App, job.app_id)
        if not (delivery and version and instance and version.app_id == job.app_id == delivery.app_id
                and app.active_version_id == version.id == instance.version_id
                and instance.status == 'RUNNING' and instance.url == delivery.url
                and version.requirement_revision == job.requirement_revision
                and ValidationReport.model_validate(version.validation).passed):
            raise ValueError('success requires a verified active release')
        job.result = delivery.model_dump(mode='json')
        job.phase = 'completed'
    else:
        job.result = None
    job.status = status
    job.error = error
    job.question = question
    job.lease_owner = None
    job.lease_until = None
    job.updated_at = func.now()
    session.commit()


def expire_lease(session, job_id, worker_id, *, generation):
    session.execute(update(Job).where(Job.id == job_id, Job.lease_owner == worker_id,
        Job.lease_generation == generation, Job.status == 'RUNNING').values(lease_until=func.now()))
    session.commit()
