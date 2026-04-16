import json
from typing import List, Dict, Any, Tuple, Set
from uuid import uuid4
from app.core.database import execute, fetch_all, fetch_one

class EvalResultRepository:
    @staticmethod
    def insert_sample_result(data: Dict[str, Any]) -> str:
        rid = str(uuid4())
        execute(
            """
            INSERT INTO eval_sample_results (id, task_run_id, sample_id, input_text, model_output, labels_json, score_json)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                rid,
                data["task_run_id"],
                str(data["sample_id"]),
                data["input_text"],
                data["model_output"],
                json.dumps(data.get("labels_json") or {}),
                json.dumps(data.get("score_json") or {}),
            ),
        )
        return rid

    @staticmethod
    def list_by_task(task_id: str, page: int, size: int) -> Tuple[List[Dict[str, Any]], int]:
        offset = (page - 1) * size
        items = fetch_all(
            """
            SELECT esr.*
            FROM eval_sample_results esr
            JOIN eval_task_runs r ON esr.task_run_id = r.id
            WHERE r.task_id = %s
              AND r.run_no = (
                  SELECT MAX(run_no) FROM eval_task_runs WHERE task_id = %s
              )
            ORDER BY esr.id
            LIMIT %s OFFSET %s
            """,
            (task_id, task_id, size, offset),
        )
        total_row = fetch_one(
            """
            SELECT COUNT(*) AS cnt
            FROM eval_sample_results esr
            JOIN eval_task_runs r ON esr.task_run_id = r.id
            WHERE r.task_id = %s
              AND r.run_no = (
                  SELECT MAX(run_no) FROM eval_task_runs WHERE task_id = %s
              )
            """,
            (task_id, task_id),
        )
        total = total_row["cnt"] if total_row else 0
        for item in items:
            if isinstance(item.get("labels_json"), str):
                try:
                    item["labels_json"] = json.loads(item["labels_json"])
                except Exception:
                    item["labels_json"] = {}
            if isinstance(item.get("score_json"), str):
                try:
                    item["score_json"] = json.loads(item["score_json"])
                except Exception:
                    item["score_json"] = {}
        return items, total

    @staticmethod
    def list_all_by_task(task_id: str) -> List[Dict[str, Any]]:
        items = fetch_all(
            """
            SELECT esr.*
            FROM eval_sample_results esr
            JOIN eval_task_runs r ON esr.task_run_id = r.id
            WHERE r.task_id = %s
              AND r.run_no = (
                  SELECT MAX(run_no) FROM eval_task_runs WHERE task_id = %s
              )
            """,
            (task_id, task_id),
        )
        for item in items:
            if isinstance(item.get("labels_json"), str):
                try:
                    item["labels_json"] = json.loads(item["labels_json"])
                except Exception:
                    item["labels_json"] = {}
            if isinstance(item.get("score_json"), str):
                try:
                    item["score_json"] = json.loads(item["score_json"])
                except Exception:
                    item["score_json"] = {}
        return items

    @staticmethod
    def list_sample_ids_by_run(task_run_id: str) -> Set[str]:
        rows = fetch_all(
            "SELECT sample_id FROM eval_sample_results WHERE task_run_id = %s",
            (task_run_id,),
        )
        return {str(row["sample_id"]) for row in rows if row.get("sample_id") is not None}
