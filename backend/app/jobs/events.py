import json

from sqlalchemy import select

from app.core.types import JobEvent as PublicJobEvent
from app.jobs.models import Job, JobEvent


def append_event(session, job_id, kind, public_payload):
    allowed = {'message', 'status', 'phase', 'usage_units'}
    if set(public_payload) - allowed:
        raise ValueError('internal fields are not allowed in public events')
    job = session.get(Job, job_id)
    if job is None:
        raise ValueError('job not found')
    payload = PublicJobEvent(id=0, kind=kind, message=public_payload.get('message', ''),
        status=public_payload.get('status', job.status), phase=public_payload.get('phase', job.phase),
        usage_units=public_payload.get('usage_units', job.used_units)).model_dump(mode='json')
    event = JobEvent(job_id=job_id, kind=kind, public_payload=payload)
    session.add(event)
    session.flush()
    event.public_payload = {**payload, 'id': event.id}
    session.commit()
    return event.id


def events_after(session, job_id, after_id):
    return list(session.scalars(select(JobEvent).where(JobEvent.job_id == job_id,
        JobEvent.id > after_id).order_by(JobEvent.id).limit(100)))


def encode_event(event):
    return f'id: {event.id}\nevent: job\ndata: {json.dumps(event.public_payload, ensure_ascii=False)}\n\n'
