import json
from typing import List, Dict, Any
from fastapi import HTTPException, status
from app.core.config import get_settings
from app.repositories.dataset_repo import DatasetRepository
from app.repositories.project_repo import ProjectRepository
from app.schemas.dataset import DatasetCreate, DatasetResponse

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
