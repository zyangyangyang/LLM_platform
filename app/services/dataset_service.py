import json
import os
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import unquote

from fastapi import HTTPException, UploadFile

from app.core.config import get_settings
from app.repositories.dataset_repo import DatasetRepository
from app.schemas.dataset import DatasetCreate, DatasetResponse, DatasetSampleItem, DatasetSamplesResponse


class DatasetService:
    @staticmethod
    def list_presets() -> List[Dict[str, Any]]:
        settings = get_settings()
        try:
            return json.loads(settings.dataset_presets_json)
        except json.JSONDecodeError:
            return []

    @staticmethod
    def create_from_preset(preset_id: str, user_id: str) -> DatasetResponse:
        settings = get_settings()
        try:
            presets = json.loads(settings.dataset_presets_json)
            preset = next((p for p in presets if p["id"] == preset_id), None)
            if not preset:
                raise HTTPException(status_code=404, detail="Preset dataset not found")
        except json.JSONDecodeError:
            raise HTTPException(status_code=500, detail="Invalid system configuration")

        dataset_in = DatasetCreate(
            user_id=user_id,
            name=preset["name"],
            description=preset.get("description"),
            source_type=preset["source_type"],
            storage_uri=preset["storage_uri"],
            schema_json=preset.get("schema_json", {}),
        )
        dataset_id = DatasetRepository.create(dataset_in.model_dump())
        created = DatasetRepository.get_by_id(dataset_id)
        return DatasetResponse(**created)

    @staticmethod
    def _check_user_access(resource_user_id: str, user_id: str):
        if resource_user_id != user_id:
            raise HTTPException(status_code=403, detail="Not authorized")

    @staticmethod
    def create_dataset(data: DatasetCreate, user_id: str) -> DatasetResponse:
        DatasetService._check_user_access(data.user_id, user_id)
        dataset_id = DatasetRepository.create(data.model_dump())
        created = DatasetRepository.get_by_id(dataset_id)
        return DatasetResponse(**created)

    @staticmethod
    def create_from_upload(
        file: UploadFile,
        user_id: str,
        name: str,
        description: Optional[str] = None,
        schema_json_str: Optional[str] = None,
        prompt_field: Optional[str] = None,
        label_field: Optional[str] = None,
        options_field: Optional[str] = None,
        image_field: Optional[str] = None,
        image_url_field: Optional[str] = None,
        system_prompt: Optional[str] = None,
    ) -> DatasetResponse:
        storage_path = DatasetService._save_uploaded_file(user_id, file)
        schema_obj: Dict[str, Any] = {}
        if schema_json_str:
            try:
                schema_obj = json.loads(schema_json_str)
            except Exception:
                raise HTTPException(status_code=400, detail="Invalid schema_json")
        if prompt_field:
            schema_obj["prompt_field"] = prompt_field
        if label_field:
            schema_obj["label_field"] = label_field
        if options_field:
            schema_obj["options_field"] = options_field
        if image_field:
            schema_obj["image_field"] = image_field
        if image_url_field:
            schema_obj["image_url_field"] = image_url_field
        if system_prompt:
            schema_obj["system_prompt"] = system_prompt

        DatasetService._validate_required_schema_fields(schema_obj)

        dataset_in = DatasetCreate(
            user_id=user_id,
            name=name,
            description=description,
            source_type="file_upload",
            storage_uri=storage_path,
            schema_json=schema_obj,
        )
        dataset_id = DatasetRepository.create(dataset_in.model_dump())
        created = DatasetRepository.get_by_id(dataset_id)
        return DatasetResponse(**created)

    @staticmethod
    def _validate_required_schema_fields(schema_obj: Dict[str, Any]):
        prompt_field = schema_obj.get("prompt_field")
        label_field = schema_obj.get("label_field")
        if not isinstance(prompt_field, str) or not prompt_field.strip():
            raise HTTPException(status_code=400, detail="prompt_field is required")
        if not isinstance(label_field, str) or not label_field.strip():
            raise HTTPException(status_code=400, detail="label_field is required")

    @staticmethod
    def list_user_datasets(user_id: str) -> List[DatasetResponse]:
        datasets = DatasetRepository.list_by_user(user_id)
        return [DatasetResponse(**d) for d in datasets]

    @staticmethod
    def get_dataset(dataset_id: str, user_id: str) -> DatasetResponse:
        dataset = DatasetRepository.get_by_id(dataset_id)
        if not dataset:
            raise HTTPException(status_code=404, detail="Dataset not found")
        DatasetService._check_user_access(dataset["user_id"], user_id)
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
        DatasetService._check_user_access(dataset["user_id"], user_id)

        items, total = DatasetService._read_samples(dataset, page, size)
        normalized = DatasetService._normalize_samples(items, dataset.get("schema_json") or {})
        return DatasetSamplesResponse(items=[DatasetSampleItem(**item) for item in normalized], total=total)

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
    def _save_uploaded_file(user_id: str, file: UploadFile) -> str:
        filename = os.path.basename(file.filename or "")
        if not filename:
            raise HTTPException(status_code=400, detail="Empty filename")
        ext = os.path.splitext(filename)[1].lower()
        if ext not in [".json", ".jsonl"]:
            raise HTTPException(status_code=400, detail="Only .json or .jsonl allowed")

        base_dir = os.path.join(os.getcwd(), "uploads", "datasets", user_id)
        os.makedirs(base_dir, exist_ok=True)
        target_path = os.path.join(base_dir, filename)
        idx = 1
        while os.path.exists(target_path):
            name_no_ext = os.path.splitext(filename)[0]
            target_path = os.path.join(base_dir, f"{name_no_ext}_{idx}{ext}")
            idx += 1

        try:
            with open(target_path, "wb") as out:
                while True:
                    chunk = file.file.read(1024 * 1024)
                    if not chunk:
                        break
                    out.write(chunk)
        except Exception:
            raise HTTPException(status_code=500, detail="Failed to save uploaded file")
        return target_path

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
        for idx, raw_item in enumerate(items):
            item = DatasetService._prepare_sample(raw_item)
            prompt = DatasetService._extract_prompt(item, schema_json)
            has_media = DatasetService._has_multimodal_content(item)
            if not prompt and not has_media:
                continue

            sample_id = None
            if isinstance(item, dict):
                sample_id = item.get("id") or item.get("sample_id")
            normalized.append(
                {
                    "id": sample_id if sample_id is not None else idx + 1,
                    "prompt": str(prompt) if prompt is not None else "",
                    "data": item,
                }
            )
        return normalized

    @staticmethod
    def _extract_prompt(sample: Any, schema_json: Dict[str, Any]) -> Any:
        if isinstance(schema_json, dict):
            prompt_field = schema_json.get("prompt_field")
            if prompt_field and isinstance(sample, dict):
                nested_value = DatasetService._get_nested_value(sample, str(prompt_field))
                if nested_value is not None:
                    return nested_value
                if prompt_field in sample:
                    return sample.get(prompt_field)

        if isinstance(sample, dict):
            containers: List[Dict[str, Any]] = [sample]
            if isinstance(sample.get("adversarial"), dict):
                containers.insert(0, sample["adversarial"])
            if isinstance(sample.get("original"), dict):
                containers.append(sample["original"])

            for container in containers:
                for key in ["prompt", "malicious_prompt", "jailbreak_prompt", "question", "input", "text", "content", "query", "instruction"]:
                    value = container.get(key)
                    if value is None:
                        continue
                    if key == "question":
                        options = None
                        if isinstance(schema_json, dict):
                            options_field = schema_json.get("options_field")
                            if isinstance(options_field, str) and options_field.strip():
                                options = DatasetService._get_nested_value(sample, options_field.strip())
                        if options is None:
                            options = container.get("options") or sample.get("options")
                        if isinstance(options, dict) and options:
                            return DatasetService._build_mcq_prompt(str(value), options)
                    return value
            return None

        if isinstance(sample, str):
            return sample
        return None

    @staticmethod
    def _prepare_sample(sample: Any) -> Any:
        if not isinstance(sample, dict):
            return sample

        original = sample.get("original")
        adversarial = sample.get("adversarial")
        if not isinstance(original, dict) and not isinstance(adversarial, dict):
            return sample

        merged: Dict[str, Any] = {}
        if isinstance(original, dict):
            merged.update(original)
        if isinstance(adversarial, dict):
            merged.update(adversarial)
        merged["original"] = original if isinstance(original, dict) else {}
        merged["adversarial"] = adversarial if isinstance(adversarial, dict) else {}
        return merged

    @staticmethod
    def _has_multimodal_content(sample: Any) -> bool:
        if not isinstance(sample, dict):
            return False
        media_keys = ["image", "image_url", "video", "video_url"]
        if any(sample.get(k) for k in media_keys):
            return True
        for nested_key in ["adversarial", "original"]:
            nested_obj = sample.get(nested_key)
            if isinstance(nested_obj, dict) and any(nested_obj.get(k) for k in media_keys):
                return True
        return False

    @staticmethod
    def _get_nested_value(data: Dict[str, Any], field_path: str) -> Any:
        if not field_path:
            return None
        current: Any = data
        for part in field_path.split("."):
            if not isinstance(current, dict) or part not in current:
                return None
            current = current.get(part)
        return current

    @staticmethod
    def _build_mcq_prompt(question: str, options: Dict[str, Any]) -> str:
        lines = [question.strip(), "", "Options:"]
        for key, value in options.items():
            lines.append(f"{key}. {value}")
        return "\n".join(lines).strip()
