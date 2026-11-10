from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.core.types import Checkpoint
from app.jobs.models import Job
from app.jobs.store import claim_job, heartbeat, save_checkpoint, finish_job, LeaseLost
from app.jobs.events import append_event, events_after, encode_event


def test_concurrent_workers_claim_job_only_once(job_factory, session_factory):
    job = job_factory()
    def claim(owner):
        with session_factory() as session:
            found = claim_job(session, owner)
            return found.id if found else None
    with ThreadPoolExecutor(2) as pool:
        ids = list(pool.map(claim, ['one', 'two']))
    assert sorted(ids, key=lambda v: v or '') == [None, job.id]


def test_recovery_preserves_checkpoint_and_fences_same_worker_name(job_factory, session_factory):
    job = job_factory(checkpoint={'messages': [{'role': 'user', 'content': '继续'}]}, expired=True)
    with session_factory() as session:
        claimed = claim_job(session, 'same')
        first_generation = claimed.lease_generation
        claimed.lease_until = datetime.now(timezone.utc) - timedelta(seconds=1)
        session.commit()
        second = claim_job(session, 'same')
        assert second.lease_generation > first_generation
        assert second.checkpoint['messages'][0]['content'] == '继续'
        with pytest.raises(LeaseLost):
            save_checkpoint(session, job.id, 'same', Checkpoint(), generation=first_generation)
        session.rollback()
        heartbeat(session, job.id, 'same', generation=second.lease_generation)


@pytest.mark.parametrize('status', ['WAITING_USER', 'PAUSED_QUOTA', 'SUCCEEDED', 'FAILED', 'CANCELLED'])
def test_paused_or_terminal_jobs_are_not_claimed(job_factory, session_factory, status):
    job_factory(status=status)
    with session_factory() as session:
        assert claim_job(session, 'worker') is None


def test_events_are_public_and_replay_after_cursor(job_factory, session_factory):
    job = job_factory()
    with session_factory() as session:
        first = append_event(session, job.id, 'phase', {'message': '准备应用'})
        second = append_event(session, job.id, 'phase', {'message': '验证功能'})
        events = events_after(session, job.id, first)
        assert [e.id for e in events] == [second]
        session.expire_all()
        assert events_after(session, job.id, first)[0].public_payload['id'] == second
        assert 'event: job\n' in encode_event(events[0])
        with pytest.raises(ValueError):
            append_event(session, job.id, 'tool', {'message': 'bad', 'reasoning_content': 'secret'})


def test_unverified_generation_cannot_be_finished_successfully(job_factory, session_factory):
    job = job_factory()
    with session_factory() as session:
        claimed = claim_job(session, 'worker')
        with pytest.raises(ValueError):
            finish_job(session, job.id, 'worker', 'SUCCEEDED', generation=claimed.lease_generation)
        session.rollback()
        assert session.get(Job, job.id).status == 'RUNNING'


@pytest.mark.asyncio
async def test_worker_runs_executor_and_expires_lease_on_shutdown(job_factory, session_factory):
    import asyncio
    from app.jobs.worker import run_worker
    job = job_factory()
    stop = asyncio.Event()
    seen = []
    async def execute(job_id, *, worker_id, generation):
        seen.append(job_id)
        with session_factory() as session:
            save_checkpoint(session, job_id, worker_id, Checkpoint(messages=[{'role': 'user', 'content': 'saved'}]), generation=generation)
        stop.set()
    await asyncio.wait_for(run_worker(execute, stop, session_factory), timeout=5)
    assert seen == [job.id]
    with session_factory() as session:
        recovered = claim_job(session, 'new')
        assert recovered.checkpoint['messages'][0]['content'] == 'saved'
