import json
from typing import Optional, Dict, Any, List
from uuid import uuid4
from app.core.database import execute, fetch_one, fetch_all

class DatasetRepository:
    @staticmethod
    def create(data: Dict[str, Any]) -> str:
        dataset_id = str(uuid4())
        schema_json = json.dumps(data.get('schema_json', {}))
        execute(
            """
            INSERT INTO datasets 
            (id, user_id, name, description, source_type, storage_uri, schema_json)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                dataset_id,
                data['user_id'],
                data['name'],
                data.get('description'),
                data['source_type'],
                data['storage_uri'],
                schema_json
            )
        )
        return dataset_id

    @staticmethod
    def get_by_id(dataset_id: str) -> Optional[Dict[str, Any]]:
        row = fetch_one("SELECT * FROM datasets WHERE id = %s", (dataset_id,))
        if row and isinstance(row.get('schema_json'), str):
            try:
                row['schema_json'] = json.loads(row['schema_json'])
            except json.JSONDecodeError:
                row['schema_json'] = {}
        return row

    @staticmethod
    def list_by_user(user_id: str) -> List[Dict[str, Any]]:
        rows = fetch_all(
            "SELECT * FROM datasets WHERE user_id = %s ORDER BY created_at DESC",
            (user_id,)
        )
        for row in rows:
            if isinstance(row.get('schema_json'), str):
                try:
                    row['schema_json'] = json.loads(row['schema_json'])
                except json.JSONDecodeError:
                    row['schema_json'] = {}
        return rows
