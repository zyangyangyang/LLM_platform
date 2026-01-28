from typing import List, Dict, Any
from fastapi import APIRouter, Depends, status
from app.api.auth import get_current_user
from app.schemas.dataset import DatasetCreate, DatasetResponse, DatasetSamplesResponse
from app.services.dataset_service import DatasetService

router = APIRouter()

@router.get("/datasets/presets", response_model=List[Dict[str, Any]])
def list_dataset_presets(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    获取平台预置数据集列表
    """
    return DatasetService.list_presets()

@router.post("/projects/{project_id}/datasets/from-preset", response_model=DatasetResponse)
def create_dataset_from_preset(
    project_id: str,
    preset_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    从预置数据集创建
    """
    return DatasetService.create_from_preset(project_id, preset_id, current_user["id"])

@router.post("/datasets/", response_model=DatasetResponse)
def create_dataset(
    dataset_in: DatasetCreate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    注册新数据集
    """
    return DatasetService.create_dataset(dataset_in, current_user["id"])

@router.get("/datasets/", response_model=List[DatasetResponse])
def list_datasets(
    project_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    获取项目下的所有数据集
    """
    return DatasetService.list_project_datasets(project_id, current_user["id"])

@router.get("/datasets/{dataset_id}", response_model=DatasetResponse)
def get_dataset(
    dataset_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    获取单个数据集详情
    """
    return DatasetService.get_dataset(dataset_id, current_user["id"])

@router.get("/datasets/{dataset_id}/samples", response_model=DatasetSamplesResponse)
def get_dataset_samples(
    dataset_id: str,
    page: int = 1,
    size: int = 50,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    return DatasetService.get_dataset_samples(dataset_id, current_user["id"], page, size)
