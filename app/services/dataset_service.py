from typing import List, Dict, Any
from fastapi import HTTPException, status
from app.repositories.dataset_repo import DatasetRepository
from app.repositories.project_repo import ProjectRepository
from app.schemas.dataset import DatasetCreate, DatasetResponse

class DatasetService:
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
