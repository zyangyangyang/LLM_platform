import json
from typing import Any, Dict, List, Optional
from uuid import uuid4

from app.core.database import execute, fetch_all, fetch_one


class AttackStrategyRepository:
    @staticmethod
    def _decode_json(row: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        if row and isinstance(row.get("config_json"), str):
            try:
                row["config_json"] = json.loads(row["config_json"])
            except json.JSONDecodeError:
                row["config_json"] = {}
        return row

    @staticmethod
    def create(data: Dict[str, Any]) -> str:
        strategy_id = str(uuid4())
        execute(
            """
            INSERT INTO attack_strategies (id, name, description, config_json)
            VALUES (%s, %s, %s, %s)
            """,
            (
                strategy_id,
                data["name"],
                data.get("description"),
                json.dumps(data.get("config_json") or {}),
            ),
        )
        return strategy_id

    @staticmethod
    def get(strategy_id: str) -> Optional[Dict[str, Any]]:
        return AttackStrategyRepository._decode_json(
            fetch_one("SELECT * FROM attack_strategies WHERE id = %s", (strategy_id,))
        )

    @staticmethod
    def list() -> List[Dict[str, Any]]:
        rows = fetch_all("SELECT * FROM attack_strategies ORDER BY name ASC")
        return [AttackStrategyRepository._decode_json(row) for row in rows]

    @staticmethod
    def exists_by_name(name: str) -> bool:
        row = fetch_one(
            "SELECT 1 FROM attack_strategies WHERE name = %s LIMIT 1",
            (name,),
        )
        return row is not None

    @staticmethod
    def update(strategy_id: str, data: Dict[str, Any]) -> int:
        return execute(
            """
            UPDATE attack_strategies
            SET name = %s, description = %s, config_json = %s
            WHERE id = %s
            """,
            (
                data["name"],
                data.get("description"),
                json.dumps(data.get("config_json") or {}),
                strategy_id,
            ),
        )

    @staticmethod
    def delete(strategy_id: str) -> int:
        return execute("DELETE FROM attack_strategies WHERE id = %s", (strategy_id,))

    @staticmethod
    def count_referencing_tasks(strategy_id: str) -> int:
        row = fetch_one(
            "SELECT COUNT(*) AS c FROM eval_tasks WHERE attack_strategy_id = %s",
            (strategy_id,),
        )
        return int(row["c"]) if row else 0
