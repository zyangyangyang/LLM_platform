import json
from typing import Any, Dict, List, Optional
from uuid import uuid4

from app.core.database import execute, fetch_all, fetch_one


class PlatformPresetRepository:
    @staticmethod
    def _decode_json(row: Optional[Dict[str, Any]], field: str) -> Optional[Dict[str, Any]]:
        if row and isinstance(row.get(field), str):
            try:
                row[field] = json.loads(row[field])
            except json.JSONDecodeError:
                row[field] = {}
        return row

    @staticmethod
    def create_model_preset(data: Dict[str, Any], created_by: str) -> str:
        preset_id = data.get("id") or str(uuid4())
        execute(
            """
            INSERT INTO platform_model_presets
            (id, name, provider, endpoint, auth_type, auth_secret_ref, params_json, description, created_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                preset_id,
                data["name"],
                data["provider"],
                data["endpoint"],
                data.get("auth_type", "bearer"),
                data.get("auth_secret_ref"),
                json.dumps(data.get("params_json") or {}),
                data.get("description"),
                created_by,
            ),
        )
        return preset_id

    @staticmethod
    def list_model_presets() -> List[Dict[str, Any]]:
        rows = fetch_all("SELECT * FROM platform_model_presets ORDER BY created_at DESC")
        for row in rows:
            PlatformPresetRepository._decode_json(row, "params_json")
        return rows

    @staticmethod
    def get_model_preset(preset_id: str) -> Optional[Dict[str, Any]]:
        row = fetch_one("SELECT * FROM platform_model_presets WHERE id = %s", (preset_id,))
        return PlatformPresetRepository._decode_json(row, "params_json")

    @staticmethod
    def create_dataset_preset(data: Dict[str, Any], created_by: str) -> str:
        preset_id = data.get("id") or str(uuid4())
        execute(
            """
            INSERT INTO platform_dataset_presets
            (id, name, description, source_type, storage_uri, schema_json, created_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                preset_id,
                data["name"],
                data.get("description"),
                data["source_type"],
                data["storage_uri"],
                json.dumps(data.get("schema_json") or {}),
                created_by,
            ),
        )
        return preset_id

    @staticmethod
    def list_dataset_presets() -> List[Dict[str, Any]]:
        rows = fetch_all("SELECT * FROM platform_dataset_presets ORDER BY created_at DESC")
        for row in rows:
            PlatformPresetRepository._decode_json(row, "schema_json")
        return rows

    @staticmethod
    def get_dataset_preset(preset_id: str) -> Optional[Dict[str, Any]]:
        row = fetch_one("SELECT * FROM platform_dataset_presets WHERE id = %s", (preset_id,))
        return PlatformPresetRepository._decode_json(row, "schema_json")

    @staticmethod
    def count_model_presets() -> int:
        row = fetch_one("SELECT COUNT(*) AS count FROM platform_model_presets")
        return int(row["count"]) if row else 0

    @staticmethod
    def count_dataset_presets() -> int:
        row = fetch_one("SELECT COUNT(*) AS count FROM platform_dataset_presets")
        return int(row["count"]) if row else 0

    @staticmethod
    def create_model_key(model_preset_id: str, data: Dict[str, Any], created_by: str) -> str:
        key_id = str(uuid4())
        execute(
            """
            INSERT INTO platform_model_keys
            (id, model_preset_id, secret_ref, label, status, weight, rpm_limit, rps_limit, created_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                key_id,
                model_preset_id,
                data["secret_ref"],
                data.get("label"),
                data.get("status", "active"),
                data.get("weight", 1),
                data.get("rpm_limit"),
                data.get("rps_limit"),
                created_by,
            ),
        )
        return key_id

    @staticmethod
    def list_model_keys(model_preset_id: str) -> List[Dict[str, Any]]:
        return fetch_all(
            """
            SELECT *
            FROM platform_model_keys
            WHERE model_preset_id = %s
            ORDER BY created_at DESC
            """,
            (model_preset_id,),
        )

    @staticmethod
    def list_active_model_keys(model_preset_id: str) -> List[Dict[str, Any]]:
        return fetch_all(
            """
            SELECT *
            FROM platform_model_keys
            WHERE model_preset_id = %s AND status = 'active'
            ORDER BY created_at ASC
            """,
            (model_preset_id,),
        )

    @staticmethod
    def get_model_key(key_id: str) -> Optional[Dict[str, Any]]:
        return fetch_one("SELECT * FROM platform_model_keys WHERE id = %s", (key_id,))

    @staticmethod
    def delete_model_key(key_id: str) -> int:
        return execute("DELETE FROM platform_model_keys WHERE id = %s", (key_id,))
