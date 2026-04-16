from celery import Celery
from app.core.config import get_settings


settings = get_settings()

celery_app = Celery(
    "safety_platform",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["app.workers.task_runner"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    worker_prefetch_multiplier=settings.celery_worker_prefetch_multiplier,
)
