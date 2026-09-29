import json
from typing import Optional, Dict, Any, List
from uuid import uuid4
from app.core.database import execute, fetch_one, fetch_all

class ModelConfigRepository:
    @staticmethod
    def create(model_data: Dict[str, Any]) -> str:
        model_id = str(uuid4())
        params_json = json.dumps(model_data.get('params_json', {}))
        execute(
            """
            INSERT INTO model_configs 
            (id, user_id, name, provider, endpoint, auth_type, auth_secret_ref, params_json, platform_preset_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                model_id,
                model_data['user_id'],
                model_data['name'],
                model_data['provider'],
                model_data['endpoint'],
                model_data['auth_type'],
                model_data.get('auth_secret_ref'),
                params_json,
                model_data.get('platform_preset_id')
            )
        )
        return model_id

    @staticmethod
    def get_by_id(model_id: str) -> Optional[Dict[str, Any]]:
        row = fetch_one("SELECT * FROM model_configs WHERE id = %s", (model_id,))
        if row and isinstance(row.get('params_json'), str):
            try:
                row['params_json'] = json.loads(row['params_json'])
            except json.JSONDecodeError:
                row['params_json'] = {}
        return row

    @staticmethod
    def list_by_user(user_id: str) -> List[Dict[str, Any]]:
        rows = fetch_all(
            "SELECT * FROM model_configs WHERE user_id = %s ORDER BY created_at DESC",
            (user_id,)
        )
        for row in rows:
            if isinstance(row.get('params_json'), str):
                try:
                    row['params_json'] = json.loads(row['params_json'])
                except json.JSONDecodeError:
                    row['params_json'] = {}
        return rows

    @staticmethod
    def exists_by_user_and_name(user_id: str, name: str) -> bool:
        row = fetch_one(
            "SELECT 1 FROM model_configs WHERE user_id = %s AND name = %s LIMIT 1",
            (user_id, name)
        )
        return row is not None

    @staticmethod
    def delete(model_id: str) -> bool:
        count = execute("DELETE FROM model_configs WHERE id = %s", (model_id,))
        return count > 0

    @staticmethod
    def count_referencing_tasks(model_id: str) -> int:
        row = fetch_one(
            "SELECT COUNT(*) AS c FROM eval_tasks WHERE model_config_id = %s",
            (model_id,),
        )
        return int(row["c"]) if row else 0
