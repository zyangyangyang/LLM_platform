from typing import List, Dict, Any
from fastapi import APIRouter, Depends, status
from app.api.auth import get_current_user
from app.schemas.dataset import DatasetCreate, DatasetResponse
from app.services.dataset_service import DatasetService

router = APIRouter()

@router.post("/", response_model=DatasetResponse)
def create_dataset(
    dataset_in: DatasetCreate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    注册新数据集
    """
    return DatasetService.create_dataset(dataset_in, current_user["id"])

@router.get("/", response_model=List[DatasetResponse])
def list_datasets(
    project_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    获取项目下的所有数据集
    """
    return DatasetService.list_project_datasets(project_id, current_user["id"])

@router.get("/{dataset_id}", response_model=DatasetResponse)
def get_dataset(
    dataset_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    获取单个数据集详情
    """
    return DatasetService.get_dataset(dataset_id, current_user["id"])
