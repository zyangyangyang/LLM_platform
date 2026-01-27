import json
import os
from typing import List, Dict, Any, Tuple
from urllib.parse import unquote
from fastapi import HTTPException, status
from app.core.config import get_settings
from app.repositories.dataset_repo import DatasetRepository
from app.repositories.project_repo import ProjectRepository
from app.schemas.dataset import DatasetCreate, DatasetResponse, DatasetSamplesResponse, DatasetSampleItem

class DatasetService:
    @staticmethod
    def list_presets() -> List[Dict[str, Any]]:
        """
        获取平台预置数据集列表
        """
        settings = get_settings()
        try:
            presets = json.loads(settings.dataset_presets_json)
            # 返回预置数据集信息
            return presets
        except json.JSONDecodeError:
            return []

    @staticmethod
    def create_from_preset(project_id: str, preset_id: str, user_id: str) -> DatasetResponse:
        """
        从预置创建数据集
        """
        # 1. Check access
        DatasetService._check_project_access(project_id, user_id)
        
        # 2. Find preset
        settings = get_settings()
        try:
            presets = json.loads(settings.dataset_presets_json)
            preset = next((p for p in presets if p["id"] == preset_id), None)
            if not preset:
                raise HTTPException(status_code=404, detail="Preset dataset not found")
        except json.JSONDecodeError:
             raise HTTPException(status_code=500, detail="Invalid system configuration")
             
        # 3. Create dataset
        # We copy the preset info into a new dataset record linked to the project
        dataset_in = DatasetCreate(
            project_id=project_id,
            name=preset["name"],
            description=preset.get("description"),
            source_type=preset["source_type"],
            storage_uri=preset["storage_uri"],
            schema_json=preset.get("schema_json", {})
        )
        
        dataset_id = DatasetRepository.create(dataset_in.model_dump())
        created = DatasetRepository.get_by_id(dataset_id)
        return DatasetResponse(**created)

    @staticmethod
    def _check_project_access(project_id: str, user_id: str):
        project = ProjectRepository.get_by_id(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        if project['owner_id'] != user_id and not ProjectRepository.is_member(project_id, user_id):
            raise HTTPException(status_code=403, detail="Not authorized")

    @staticmethod
    def create_dataset(data: DatasetCreate, user_id: str) -> DatasetResponse:
        DatasetService._check_project_access(data.project_id, user_id)
        dataset_id = DatasetRepository.create(data.model_dump())
        created = DatasetRepository.get_by_id(dataset_id)
        return DatasetResponse(**created)

    @staticmethod
    def list_project_datasets(project_id: str, user_id: str) -> List[DatasetResponse]:
        DatasetService._check_project_access(project_id, user_id)
        datasets = DatasetRepository.list_by_project(project_id)
        return [DatasetResponse(**d) for d in datasets]

    @staticmethod
    def get_dataset(dataset_id: str, user_id: str) -> DatasetResponse:
        dataset = DatasetRepository.get_by_id(dataset_id)
        if not dataset:
            raise HTTPException(status_code=404, detail="Dataset not found")
        DatasetService._check_project_access(dataset['project_id'], user_id)
        return DatasetResponse(**dataset)

    @staticmethod
    def get_dataset_samples(dataset_id: str, user_id: str, page: int, size: int) -> DatasetSamplesResponse:
        if page < 1 or size < 1:
            raise HTTPException(status_code=400, detail="Invalid pagination params")
        if size > 500:
            size = 500
        dataset = DatasetRepository.get_by_id(dataset_id)
        if not dataset:
            raise HTTPException(status_code=404, detail="Dataset not found")
        DatasetService._check_project_access(dataset['project_id'], user_id)
        items, total = DatasetService._read_samples(dataset, page, size)
        normalized = DatasetService._normalize_samples(items, dataset.get("schema_json") or {})
        return DatasetSamplesResponse(
            items=[DatasetSampleItem(**item) for item in normalized],
            total=total
        )

    @staticmethod
    def load_samples_for_task(dataset_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        dataset = DatasetRepository.get_by_id(dataset_id)
        if not dataset:
            raise HTTPException(status_code=404, detail="Dataset not found")
        if limit < 1:
            limit = 1
        items, _ = DatasetService._read_samples(dataset, 1, limit)
        return DatasetService._normalize_samples(items, dataset.get("schema_json") or {})

    @staticmethod
    def _resolve_storage_path(storage_uri: str) -> str:
        path = storage_uri
        if storage_uri.startswith("file://"):
            path = unquote(storage_uri[7:])
            if path.startswith("/") and len(path) > 2 and path[2] == ":":
                path = path[1:]
        path = os.path.expanduser(path)
        if not os.path.isabs(path):
            path = os.path.abspath(path)
        return path

    @staticmethod
    def _read_samples(dataset: Dict[str, Any], page: int, size: int) -> Tuple[List[Any], int]:
        storage_uri = dataset.get("storage_uri")
        if not storage_uri:
            raise HTTPException(status_code=400, detail="Dataset storage_uri missing")
        if storage_uri.startswith("http://") or storage_uri.startswith("https://"):
            raise HTTPException(status_code=400, detail="Remote dataset not supported")
        path = DatasetService._resolve_storage_path(storage_uri)
        if not os.path.exists(path):
            raise HTTPException(status_code=404, detail="Dataset file not found")
        ext = os.path.splitext(path)[1].lower()
        start = (page - 1) * size
        end = start + size
        if ext == ".jsonl":
            return DatasetService._read_jsonl_samples(path, start, end)
        if ext == ".json":
            return DatasetService._read_json_samples(path, start, end)
        raise HTTPException(status_code=400, detail="Unsupported dataset format")

    @staticmethod
    def _read_json_samples(path: str, start: int, end: int) -> Tuple[List[Any], int]:
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid JSON file: {e}")
        items: List[Any]
        if isinstance(data, list):
            items = data
        elif isinstance(data, dict):
            for key in ["items", "data", "samples", "records", "rows", "questions"]:
                if key in data and isinstance(data[key], list):
                    items = data[key]
                    break
            else:
                items = [data]
        else:
            items = [data]
        total = len(items)
        return items[start:end], total

    @staticmethod
    def _read_jsonl_samples(path: str, start: int, end: int) -> Tuple[List[Any], int]:
        items: List[Any] = []
        total = 0
        try:
            with open(path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        item = json.loads(line)
                    except Exception as e:
                        raise HTTPException(status_code=400, detail=f"Invalid JSONL line: {e}")
                    if start <= total < end:
                        items.append(item)
                    total += 1
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid JSONL file: {e}")
        return items, total

    @staticmethod
    def _normalize_samples(items: List[Any], schema_json: Dict[str, Any]) -> List[Dict[str, Any]]:
        normalized: List[Dict[str, Any]] = []
        for idx, item in enumerate(items):
            prompt = DatasetService._extract_prompt(item, schema_json)
            if not prompt:
                continue
            sample_id = None
            if isinstance(item, dict):
                sample_id = item.get("id")
            normalized.append({
                "id": sample_id if sample_id is not None else idx + 1,
                "prompt": str(prompt),
                "data": item
            })
        return normalized

    @staticmethod
    def _extract_prompt(sample: Any, schema_json: Dict[str, Any]) -> Any:
        if isinstance(schema_json, dict):
            prompt_field = schema_json.get("prompt_field")
            if prompt_field and isinstance(sample, dict) and prompt_field in sample:
                return sample.get(prompt_field)
        if isinstance(sample, dict):
            for key in ["prompt", "question", "input", "text", "content", "描述", "问题", "query", "instruction"]:
                if key in sample and sample[key] is not None:
                    return sample[key]
            return None
        if isinstance(sample, str):
            return sample
        return None
