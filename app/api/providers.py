"""厂商目录接口。

只读、不落库：数据全部来自 `app/core/providers.py` 的静态注册表。登录即可读，
不需要管理员权限 —— 用户要选厂商才有意义，限制成管理员反而挡了主流程。
"""

from typing import Any, Dict

from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.providers import PROVIDERS
from app.schemas.provider import (
    ProviderListResponse,
    ProviderModelResponse,
    ProviderResponse,
)

router = APIRouter()


@router.get("", response_model=ProviderListResponse)
def list_providers(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    列出支持的大模型厂商及其内置模型清单。

    响应中**不含任何密钥字段**。`byok_enabled` 表示服务端是否启用了自带密钥
    （取决于是否配置了主密钥 SAFETY_SECRET_ENCRYPTION_KEY）；为 False 时
    前端应把密钥输入框置灰，提示用户改用平台预置。
    """
    return ProviderListResponse(
        providers=[
            ProviderResponse(
                id=p.id,
                label=p.label,
                protocol=p.protocol,
                endpoint=p.endpoint,
                auth_type=p.auth_type,
                docs_url=p.docs_url,
                allow_custom_model=p.allow_custom_model,
                chat_path_override=p.chat_path_override,
                notes=p.notes,
                models=[ProviderModelResponse(id=m.id, label=m.label) for m in p.models],
            )
            for p in PROVIDERS
        ],
        byok_enabled=get_settings().byok_enabled,
    )
