import json
from typing import Optional, Dict, Any, List
from uuid import uuid4
from datetime import datetime
from app.core.database import execute, fetch_one, fetch_all

class TaskRepository:
    @staticmethod
    def create_task(data: Dict[str, Any]) -> str:
        task_id = str(uuid4())
        execute(
            """
            INSERT INTO eval_tasks
            (id, user_id, name, model_config_id, dataset_id, attack_strategy_id, defense_strategy_id, metric_set_id, task_type, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'pending')
            """,
            (
                task_id,
                data['user_id'],
                data['name'],
                data['model_config_id'],
                data['dataset_id'],
                data.get('attack_strategy_id'),
                data.get('defense_strategy_id'),
                data.get('metric_set_id'),
                data.get('task_type', 'hallucination')
            )
        )
        return task_id

    @staticmethod
    def exists_by_user_and_name(user_id: str, name: str) -> bool:
        row = fetch_one(
            "SELECT 1 FROM eval_tasks WHERE user_id = %s AND name = %s LIMIT 1",
            (user_id, name)
        )
        return row is not None

    @staticmethod
    def get_task(task_id: str) -> Optional[Dict[str, Any]]:
        return fetch_one("SELECT * FROM eval_tasks WHERE id = %s", (task_id,))

    @staticmethod
    def delete(task_id: str) -> int:
        return execute("DELETE FROM eval_tasks WHERE id = %s", (task_id,))

    @staticmethod
    def exists_attack_strategy(strategy_id: str) -> bool:
        row = fetch_one(
            "SELECT 1 FROM attack_strategies WHERE id = %s LIMIT 1",
            (strategy_id,),
        )
        return row is not None

    @staticmethod
    def exists_defense_strategy(strategy_id: str) -> bool:
        row = fetch_one(
            "SELECT 1 FROM defense_strategies WHERE id = %s LIMIT 1",
            (strategy_id,),
        )
        return row is not None

    @staticmethod
    def exists_metric_set(metric_set_id: str) -> bool:
        row = fetch_one(
            "SELECT 1 FROM metric_sets WHERE id = %s LIMIT 1",
            (metric_set_id,),
        )
        return row is not None

    @staticmethod
    def list_tasks(user_id: str) -> List[Dict[str, Any]]:
        return fetch_all(
            "SELECT * FROM eval_tasks WHERE user_id = %s ORDER BY created_at DESC",
            (user_id,)
        )

    @staticmethod
    def update_status(task_id: str, status: str, started_at: datetime = None, finished_at: datetime = None):
        if started_at:
            execute(
                "UPDATE eval_tasks SET status = %s, started_at = %s WHERE id = %s",
                (status, started_at, task_id)
            )
        elif finished_at:
            execute(
                "UPDATE eval_tasks SET status = %s, finished_at = %s WHERE id = %s",
                (status, finished_at, task_id)
            )
        else:
            execute("UPDATE eval_tasks SET status = %s WHERE id = %s", (status, task_id))

    @staticmethod
    def try_mark_running(task_id: str, started_at: datetime) -> bool:
        rowcount = execute(
            "UPDATE eval_tasks SET status = 'running', started_at = %s WHERE id = %s AND status <> 'running'",
            (started_at, task_id)
        )
        return rowcount > 0

    @staticmethod
    def try_mark_queued(task_id: str) -> bool:
        rowcount = execute(
            "UPDATE eval_tasks SET status = 'queued' WHERE id = %s AND status NOT IN ('queued', 'running')",
            (task_id,)
        )
        return rowcount > 0

    @staticmethod
    def create_run(task_id: str, status: str = "queued") -> str:
        run_id = str(uuid4())
        # Determine run number
        last_run = fetch_one(
            "SELECT MAX(run_no) as max_run FROM eval_task_runs WHERE task_id = %s",
            (task_id,)
        )
        run_no = (last_run['max_run'] or 0) + 1 if last_run else 1

        if status == "running":
            execute(
                """
                INSERT INTO eval_task_runs (id, task_id, run_no, status, started_at)
                VALUES (%s, %s, %s, 'running', %s)
                """,
                (run_id, task_id, run_no, datetime.now())
            )
        else:
            execute(
                """
                INSERT INTO eval_task_runs (id, task_id, run_no, status)
                VALUES (%s, %s, %s, %s)
                """,
                (run_id, task_id, run_no, status)
            )
        return run_id

    @staticmethod
    def mark_run_running(run_id: str):
        execute(
            "UPDATE eval_task_runs SET status = 'running', started_at = %s WHERE id = %s",
            (datetime.now(), run_id)
        )
    
    @staticmethod
    def update_run_status(run_id: str, status: str, error_msg: str = None):
        if status in ['completed', 'failed']:
            execute(
                "UPDATE eval_task_runs SET status = %s, finished_at = %s, error_message = %s WHERE id = %s",
                (status, datetime.now(), error_msg, run_id)
            )
        else:
            execute("UPDATE eval_task_runs SET status = %s, error_message = %s WHERE id = %s", (status, error_msg, run_id))

    @staticmethod
    def get_runs(task_id: str) -> List[Dict[str, Any]]:
        return fetch_all("SELECT * FROM eval_task_runs WHERE task_id = %s ORDER BY run_no DESC", (task_id,))

    @staticmethod
    def get_run(run_id: str) -> Optional[Dict[str, Any]]:
        return fetch_one("SELECT * FROM eval_task_runs WHERE id = %s", (run_id,))

    @staticmethod
    def init_run_progress(run_id: str, total: int):
        """
        初始化运行进度字段。
        """
        execute(
            "UPDATE eval_task_runs SET progress_total = %s, progress_done = %s WHERE id = %s",
            (int(total), 0, run_id),
        )

    @staticmethod
    def update_run_progress(run_id: str, done: int):
        """
        更新运行进度（已完成样本数）。
        """
        execute(
            "UPDATE eval_task_runs SET progress_done = %s WHERE id = %s",
            (int(done), run_id),
        )

    @staticmethod
    def mark_running_as_failed(reason: str):
        execute(
            "UPDATE eval_task_runs SET status = 'failed', finished_at = %s, error_message = %s WHERE status = 'running'",
            (datetime.now(), reason)
        )
        execute(
            "UPDATE eval_tasks SET status = 'failed', finished_at = %s WHERE status = 'running'",
            (datetime.now(),)
        )

    @staticmethod
    def fail_stale_running(timeout_minutes: int, reason: str = "stale_running_timeout"):
        now = datetime.now()
        execute(
            """
            UPDATE eval_task_runs
            SET status = 'failed', finished_at = %s, error_message = %s
            WHERE status = 'running'
              AND started_at IS NOT NULL
              AND TIMESTAMPDIFF(MINUTE, started_at, %s) >= %s
            """,
            (now, reason, now, timeout_minutes)
        )
        execute(
            """
            UPDATE eval_tasks
            SET status = 'failed', finished_at = %s
            WHERE status = 'running'
              AND started_at IS NOT NULL
              AND TIMESTAMPDIFF(MINUTE, started_at, %s) >= %s
            """,
            (now, now, timeout_minutes)
        )

    @staticmethod
    def count_by_status() -> Dict[str, int]:
        rows = fetch_all(
            """
            SELECT status, COUNT(*) AS count
            FROM eval_tasks
            GROUP BY status
            """
        )
        return {row["status"]: int(row["count"]) for row in rows}

    @staticmethod
    def count_active_tasks() -> int:
        row = fetch_one(
            """
            SELECT COUNT(*) AS count
            FROM eval_tasks
            WHERE status IN ('queued', 'running')
            """
        )
        return int(row["count"]) if row else 0
