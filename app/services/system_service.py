from typing import Dict
from urllib.parse import urlparse, urlunparse

import redis

from app.core.config import get_settings
from app.core.database import fetch_one
from app.repositories.platform_preset_repo import PlatformPresetRepository
from app.repositories.task_repo import TaskRepository
from app.schemas.system import SystemStatusResponse, TaskSummaryResponse


class SystemService:
    @staticmethod
    def get_status() -> SystemStatusResponse:
        database_status = SystemService._check_database()
        redis_status = SystemService._check_redis(get_settings().celery_broker_url)
        celery_broker_status = redis_status
        status = "ok" if database_status == "ok" and celery_broker_status == "ok" else "degraded"

        return SystemStatusResponse(
            status=status,
            database=database_status,
            redis=redis_status,
            celery_broker=celery_broker_status,
            model_presets=SystemService._safe_count_model_presets(),
            dataset_presets=SystemService._safe_count_dataset_presets(),
        )

    @staticmethod
    def get_task_summary() -> TaskSummaryResponse:
        by_status = TaskRepository.count_by_status()
        normalized: Dict[str, int] = {
            "pending": by_status.get("pending", 0),
            "queued": by_status.get("queued", 0),
            "running": by_status.get("running", 0),
            "finished": by_status.get("finished", 0),
            "completed": by_status.get("completed", 0),
            "failed": by_status.get("failed", 0),
        }
        for status, count in by_status.items():
            if status not in normalized:
                normalized[status] = count
        return TaskSummaryResponse(total=sum(by_status.values()), by_status=normalized)

    @staticmethod
    def _check_database() -> str:
        try:
            fetch_one("SELECT 1 AS ok")
            return "ok"
        except Exception:
            return "error"

    @staticmethod
    def _check_redis(redis_url: str) -> str:
        try:
            client = redis.Redis.from_url(SystemService._normalize_redis_url(redis_url), socket_timeout=2)
            return "ok" if client.ping() else "error"
        except Exception:
            return "error"

    @staticmethod
    def _normalize_redis_url(redis_url: str) -> str:
        parsed = urlparse(redis_url)
        return urlunparse((parsed.scheme, parsed.netloc, parsed.path or "/0", "", "", ""))

    @staticmethod
    def _safe_count_model_presets() -> int:
        try:
            return PlatformPresetRepository.count_model_presets()
        except Exception:
            return 0

    @staticmethod
    def _safe_count_dataset_presets() -> int:
        try:
            return PlatformPresetRepository.count_dataset_presets()
        except Exception:
            return 0
