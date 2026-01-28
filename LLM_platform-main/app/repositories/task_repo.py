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
            (id, project_id, name, model_config_id, dataset_id, attack_strategy_id, metric_set_id, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, 'pending')
            """,
            (
                task_id,
                data['project_id'],
                data['name'],
                data['model_config_id'],
                data['dataset_id'],
                data.get('attack_strategy_id'),
                data.get('metric_set_id')
            )
        )
        return task_id

    @staticmethod
    def get_task(task_id: str) -> Optional[Dict[str, Any]]:
        return fetch_one("SELECT * FROM eval_tasks WHERE id = %s", (task_id,))

    @staticmethod
    def list_tasks(project_id: str) -> List[Dict[str, Any]]:
        return fetch_all(
            "SELECT * FROM eval_tasks WHERE project_id = %s ORDER BY created_at DESC",
            (project_id,)
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
    def create_run(task_id: str) -> str:
        run_id = str(uuid4())
        # Determine run number
        last_run = fetch_one(
            "SELECT MAX(run_no) as max_run FROM eval_task_runs WHERE task_id = %s",
            (task_id,)
        )
        run_no = (last_run['max_run'] or 0) + 1 if last_run else 1
        
        execute(
            """
            INSERT INTO eval_task_runs (id, task_id, run_no, status, started_at)
            VALUES (%s, %s, %s, 'running', %s)
            """,
            (run_id, task_id, run_no, datetime.now())
        )
        return run_id
    
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
    def mark_running_as_failed(reason: str):
        execute(
            "UPDATE eval_task_runs SET status = 'failed', finished_at = %s, error_message = %s WHERE status = 'running'",
            (datetime.now(), reason)
        )
        execute(
            "UPDATE eval_tasks SET status = 'failed', finished_at = %s WHERE status = 'running'",
            (datetime.now(),)
        )
