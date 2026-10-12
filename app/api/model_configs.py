from typing import List, Dict, Any
from fastapi import APIRouter, Depends, status
from app.api.auth import get_current_user
from app.schemas.model_config import (
    ModelConfigBase,
    ModelConfigCreate,
    ModelConfigResponse,
    ModelConfigUpdate,
)
from app.services.model_config_service import ModelConfigService
from app.services.model_service import ModelService

router = APIRouter()

@router.get("/presets", response_model=List[Dict[str, Any]])
def list_model_presets(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    获取平台预置模型列表
    返回可用的模型预设（ID, 名称, 描述等）
    """
    return ModelConfigService.list_presets()

@router.post("/models/from-preset", response_model=ModelConfigResponse)
def create_model_from_preset(
    preset_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    使用预置模型创建配置
    无需用户输入 API Key，系统自动注入
    """
    return ModelConfigService.create_from_preset(preset_id, current_user["id"])

@router.post("/models", response_model=ModelConfigResponse)
def create_model_config(
    model_in: ModelConfigBase,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    创建模型配置 (自定义)
    将模型关联到指定项目，并设置相关参数
    """
    # Combine path param and body to create the full input object
    full_model_in = ModelConfigCreate(user_id=current_user["id"], **model_in.model_dump())
    return ModelConfigService.create_model_config(full_model_in, current_user["id"])

@router.get("/models", response_model=List[ModelConfigResponse])
def list_user_models(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    获取用户下的所有模型配置
    """
    return ModelConfigService.list_user_models(current_user["id"])

@router.get("/models/{model_id}", response_model=ModelConfigResponse)
def get_model_config(
    model_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    获取单个模型配置详情
    """
    return ModelConfigService.get_model_config(model_id, current_user["id"])

@router.patch("/models/{model_id}", response_model=ModelConfigResponse)
def update_model_config(
    model_id: str,
    model_in: ModelConfigUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    部分更新模型配置（仅本人）

    - 传 `api_key` = 轮换为自带的密钥（服务端加密后落库）
    - 传 `clear_key: true` = 清空凭证
    - 两者都不传则凭证保持不变
    """
    return ModelConfigService.update_model_config(model_id, model_in, current_user["id"])


@router.post("/models/{model_id}/test")
async def test_model_config(
    model_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    用已保存的配置做一次极小的真实调用，验证是否可用。

    连不通也返回 200，用 `ok: false` + `error_code` 表达失败原因，这样前端
    能把「测试不通过」与「接口本身出错」区分开。

    error_code 取值：unauthorized / rate_limited / not_found / timeout /
    network / bad_response
    """
    config = ModelConfigService.get_model_config_internal(model_id)
    ModelConfigService._check_user_access(config.user_id, current_user["id"])
    return await ModelService.test_connection(config)


@router.delete("/models/{model_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_model_config(
    model_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    删除模型配置
    需要项目访问权限
    """
    ModelConfigService.delete_model_config(model_id, current_user["id"])
