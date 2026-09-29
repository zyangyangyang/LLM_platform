from typing import Any, Dict

from fastapi import APIRouter, Depends, status

from app.api.deps import get_current_admin_user
from app.schemas.platform_preset import (
    PlatformDatasetPresetCreate,
    PlatformDatasetPresetResponse,
    PlatformModelKeyCreate,
    PlatformModelKeyResponse,
    PlatformModelPresetCreate,
    PlatformModelPresetResponse,
)
from app.services.dataset_service import DatasetService
from app.services.model_config_service import ModelConfigService
from app.services.system_service import SystemService
from app.schemas.system import SystemStatusResponse, TaskSummaryResponse

router = APIRouter()


@router.post("/model-presets", response_model=PlatformModelPresetResponse)
def create_platform_model_preset(
    preset_in: PlatformModelPresetCreate,
    current_user: Dict[str, Any] = Depends(get_current_admin_user),
):
    return ModelConfigService.create_platform_preset(preset_in, current_user["id"])


@router.post("/model-presets/{preset_id}/keys", response_model=PlatformModelKeyResponse)
def create_platform_model_key(
    preset_id: str,
    key_in: PlatformModelKeyCreate,
    current_user: Dict[str, Any] = Depends(get_current_admin_user),
):
    return ModelConfigService.create_platform_model_key(preset_id, key_in, current_user["id"])


@router.get("/model-presets/{preset_id}/keys", response_model=list[PlatformModelKeyResponse])
def list_platform_model_keys(
    preset_id: str,
    current_user: Dict[str, Any] = Depends(get_current_admin_user),
):
    return ModelConfigService.list_platform_model_keys(preset_id)


@router.delete("/model-presets/{preset_id}/keys/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_platform_model_key(
    preset_id: str,
    key_id: str,
    current_user: Dict[str, Any] = Depends(get_current_admin_user),
):
    return ModelConfigService.delete_platform_model_key(preset_id, key_id)


@router.post("/dataset-presets", response_model=PlatformDatasetPresetResponse)
def create_platform_dataset_preset(
    preset_in: PlatformDatasetPresetCreate,
    current_user: Dict[str, Any] = Depends(get_current_admin_user),
):
    return DatasetService.create_platform_preset(preset_in, current_user["id"])


@router.get("/system/status", response_model=SystemStatusResponse)
def get_system_status(
    current_user: Dict[str, Any] = Depends(get_current_admin_user),
):
    return SystemService.get_status()


@router.get("/system/task-summary", response_model=TaskSummaryResponse)
def get_task_summary(
    current_user: Dict[str, Any] = Depends(get_current_admin_user),
):
    return SystemService.get_task_summary()
