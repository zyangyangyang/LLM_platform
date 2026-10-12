from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, status

from app.api.deps import get_current_admin_user
from app.repositories.audit_repo import AuditRepository
from app.schemas.audit import AuditLogResponse
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


@router.get("/model-presets", response_model=list[PlatformModelPresetResponse])
def list_platform_model_presets(
    current_user: Dict[str, Any] = Depends(get_current_admin_user),
):
    return ModelConfigService.list_platform_presets()


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
    return ModelConfigService.delete_platform_model_key(preset_id, key_id, current_user["id"])


@router.get("/dataset-presets", response_model=list[PlatformDatasetPresetResponse])
def list_platform_dataset_presets(
    current_user: Dict[str, Any] = Depends(get_current_admin_user),
):
    return DatasetService.list_platform_presets()


@router.post("/dataset-presets", response_model=PlatformDatasetPresetResponse)
def create_platform_dataset_preset(
    preset_in: PlatformDatasetPresetCreate,
    current_user: Dict[str, Any] = Depends(get_current_admin_user),
):
    return DatasetService.create_platform_preset(preset_in, current_user["id"])


@router.get("/audit-logs", response_model=list[AuditLogResponse])
def list_audit_logs(
    limit: int = 100,
    resource_type: Optional[str] = None,
    user_id: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_admin_user),
):
    """
    审计日志（仅管理员）。

    只读、只倒序取最近的若干条 —— 这是排查「谁动了哪把钥匙」用的，不是
    数据分析接口。`resource_type` 目前有 model_config / platform_model_preset /
    platform_model_key / platform_dataset_preset。查询上限在仓储层夹到 500。
    """
    return AuditRepository.list_recent(
        limit=limit,
        resource_type=resource_type,
        user_id=user_id,
    )


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
