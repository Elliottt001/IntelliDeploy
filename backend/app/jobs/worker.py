"""Persistent single-job worker; pipeline is loaded before any job is claimed."""
import asyncio
import logging
import signal
from uuid import uuid4

from app.database import SessionLocal
from app.config import settings
from app.jobs.store import claim_job, heartbeat, expire_lease, LeaseLost

logger = logging.getLogger(__name__)


async def run_worker(process_job, stop=None, session_factory=SessionLocal):
    if not settings.DATABASE_URL.startswith('postgresql+psycopg://'):
        raise RuntimeError('Worker requires PostgreSQL')
    stop = stop or asyncio.Event()
    worker_id = str(uuid4())
    def db_action(fn, *args, **kwargs):
        with session_factory() as session:
            return fn(session, *args, **kwargs)
    while not stop.is_set():
        job = await asyncio.to_thread(db_action, claim_job, worker_id)
        if job is None:
            try:
                await asyncio.wait_for(stop.wait(), timeout=1)
            except TimeoutError:
                pass
            continue
        # The pipeline receives a fenced lease identity; HTTP never runs it.
        task = asyncio.create_task(process_job(job.id, worker_id=worker_id, generation=job.lease_generation))
        async def renew():
            while True:
                await asyncio.sleep(10)
                await asyncio.to_thread(db_action, heartbeat, job.id, worker_id, generation=job.lease_generation)
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


async def main():
    from app.jobs.pipeline import run_pipeline
    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, stop.set)
    await run_worker(run_pipeline, stop)


if __name__ == '__main__':
    asyncio.run(main())
