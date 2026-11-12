"""Persistent single-job worker; pipeline is loaded before any job is claimed."""
import asyncio
import logging
import signal
import time
from datetime import datetime,timezone
from sqlalchemy.dialects.postgresql import insert
from uuid import uuid4

from app.database import SessionLocal
from app.config import settings
from app.jobs.store import claim_job, heartbeat, expire_lease, LeaseLost
from app.runtime.models import PlatformControl

logger = logging.getLogger(__name__)


async def run_worker(process_job, stop=None, session_factory=SessionLocal):
    if not settings.DATABASE_URL.startswith('postgresql+psycopg://'):
        raise RuntimeError('Worker requires PostgreSQL')
    stop = stop or asyncio.Event()
    worker_id = str(uuid4())
    def db_action(fn, *args, **kwargs):
        with session_factory() as session:
            return fn(session, *args, **kwargs)
    def presence(session):
        now=datetime.now(timezone.utc)
        session.execute(insert(PlatformControl).values(name='worker:'+worker_id,value={'process':'worker'},updated_at=now)
            .on_conflict_do_update(index_elements=['name'],set_={'updated_at':now}))
        session.commit()
    last_presence=0
    while not stop.is_set():
        if time.monotonic()-last_presence>30:
            await asyncio.to_thread(db_action,presence)
            last_presence=time.monotonic()
        job = await asyncio.to_thread(db_action, claim_job, worker_id)
        if job is None:
            try:
                await asyncio.wait_for(stop.wait(), timeout=1)
            except TimeoutError:
                pass
            continue
        # The pipeline receives a fenced lease identity; HTTP never runs it.
        task = asyncio.create_task(process_job(job.id, worker_id=worker_id, generation=job.lease_generation))
        logger.info('job started',extra={'event':'job_started','job_id':job.id,'phase':job.phase})
        async def renew():
            while True:
                await asyncio.sleep(10)
                await asyncio.to_thread(db_action, heartbeat, job.id, worker_id, generation=job.lease_generation)
                await asyncio.to_thread(db_action,presence)
        renewal = asyncio.create_task(renew())
        shutdown = asyncio.create_task(stop.wait())
        try:
            done, _ = await asyncio.wait([task, renewal, shutdown], return_when=asyncio.FIRST_COMPLETED)
            if renewal in done:
                await renewal  # A replaced worker must stop producing effects.
            if task in done:
                await task
            else:
                task.cancel()
                await asyncio.gather(task, return_exceptions=True)
        except LeaseLost:
            logger.warning('job lease lost', extra={'job_id': job.id})
        except Exception:
            # Keep the checkpoint and let recovery reconcile uncertain effects.
            logger.error('job processing interrupted', extra={'job_id': job.id})
        finally:
            for pending in (task, renewal, shutdown):
                pending.cancel()
            await asyncio.gather(task, renewal, shutdown, return_exceptions=True)
            await asyncio.to_thread(db_action, expire_lease, job.id, worker_id, generation=job.lease_generation)
            logger.info('job checkpoint retained',extra={'event':'job_finished','job_id':job.id})


async def main():
    from app.core.logging import configure_logging
    configure_logging('worker')
    from app.jobs.maintenance import run_maintenance_loop
    from app.jobs.pipeline import run_pipeline
    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, stop.set)
    await asyncio.gather(
        run_worker(run_pipeline, stop),
        run_maintenance_loop(stop),
    )


if __name__ == '__main__':
    asyncio.run(main())
