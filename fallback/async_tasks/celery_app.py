from __future__ import annotations

import os

try:
    from celery import Celery
except ImportError:  # pragma: no cover - optional dependency
    Celery = None


class CeleryUnavailableError(RuntimeError):
    pass


def _build_celery_app() -> Celery | None:
    if Celery is None:
        return None

    broker_url = os.getenv("CELERY_BROKER_URL")
    if not broker_url:
        return None

    result_backend = os.getenv("CELERY_RESULT_BACKEND")
    queue_name = os.getenv("CELERY_TASK_DEFAULT_QUEUE", "fallback")
    timezone = os.getenv("CELERY_TIMEZONE", "UTC")

    app = Celery("fallback", broker=broker_url, backend=result_backend)
    app.conf.update(
        task_default_queue=queue_name,
        task_serializer="json",
        accept_content=["json"],
        result_serializer="json",
        timezone=timezone,
        task_track_started=True,
        task_routes={},
        task_annotations={},
    )
    return app


celery_app = _build_celery_app()


def is_async_enabled() -> bool:
    return celery_app is not None


def get_celery_app() -> Celery:
    if celery_app is None:
        if Celery is None:
            raise CeleryUnavailableError("Celery is not installed; fallback async execution is unavailable.")
        raise CeleryUnavailableError(
            "Celery async execution is not configured; set CELERY_BROKER_URL to enable background dispatch."
        )
    return celery_app

