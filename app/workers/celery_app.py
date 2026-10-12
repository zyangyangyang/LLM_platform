from celery import Celery
from celery.signals import after_setup_logger, after_setup_task_logger

from app.core.config import get_settings
from app.utils.logger import attach_file_handler


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
    # 显式声明「启动时连不上 broker 要重试」。
    #
    # 不写的话 Celery 会退回用旧的 broker_connection_retry 去推断，并打一条
    # CPendingDeprecationWarning；6.0 起那个推断分支会被删掉，届时不设置就等于
    # 关闭启动重试，worker 会直接退出。本项目的 Redis 跑在 WSL2 里、不一定每次都
    # 先于 worker 起来，正是最吃这个重试的场景（见 logs/worker.log 里出现过的
    # "Trying again in 2.00 seconds... (1/100)"）。
    #
    # 值与 broker_connection_retry 的默认值一致，所以不改变任何现有行为，
    # 只是把它从「推断」变成「写明」。
    broker_connection_retry_on_startup=True,
)


# Celery 启动时会用自己的 dictConfig 配日志，那份配置带 'root' 条目，会把 import
# 阶段挂在 root 上的文件 handler 整个替换掉。这两个 signal 在它配完之后触发，
# 在这里重挂一次，worker 的日志才会落到 logs/worker.log。
@after_setup_logger.connect
@after_setup_task_logger.connect
def _reattach_file_handler(**_kwargs) -> None:
    attach_file_handler()
