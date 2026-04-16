import asyncio
from app.services.task_service import TaskService
from app.workers.celery_app import celery_app


@celery_app.task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_jitter=True,
    retry_kwargs={"max_retries": 2},
)
def run_eval_task(self, task_id: str, run_id: str):
    """
    Celery entrypoint for executing one evaluation run.
    """
    asyncio.run(TaskService.execute_run_logic(task_id, run_id))

