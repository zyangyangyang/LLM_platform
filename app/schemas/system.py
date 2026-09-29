from typing import Dict

from pydantic import BaseModel


class SystemStatusResponse(BaseModel):
    status: str
    database: str
    redis: str
    celery_broker: str
    model_presets: int
    dataset_presets: int


class TaskSummaryResponse(BaseModel):
    total: int
    by_status: Dict[str, int]
