from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, HttpUrl
from datetime import datetime

# 自带密钥的明文长度上限。密文比明文长约 1.4 倍，而落库列宽上限 512
# （见 app/core/crypto.py 的 MAX_ENCRYPTED_LENGTH）。300 已远超各厂商实际
# 签发的密钥长度 —— 最长的一类（OpenAI 风格）也只有 164 字符。真正的兜底
# 是 encrypt_secret() 里的长度断言，它会给出中文且可操作的报错。
MAX_API_KEY_LENGTH = 300

class ModelConfigBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    provider: str = Field(..., min_length=1, max_length=50)
    endpoint: str = Field(..., max_length=255)  # Can be a URL or a model identifier
    auth_type: str = Field(..., max_length=20)  # e.g., "api_key", "none", "bearer"
    # 这里既可能是「环境变量名」，也可能是自带密钥的密文（enc:v1:...，约 319 字符）。
    # 上限必须 ≥ 列宽 512：ModelConfigInternal 继承本类，而 BYOK 模型在调用时正是
    # 用它去装载数据库行 —— 卡在 255 会让自带密钥的模型一调用就校验失败。
    auth_secret_ref: Optional[str] = Field(None, max_length=512)
    # 自带密钥（BYOK）的明文入参，**仅写不读**：任何响应模型都不含本字段。
    api_key: Optional[str] = Field(None, max_length=MAX_API_KEY_LENGTH)
    params_json: Optional[Dict[str, Any]] = None

class ModelConfigCreate(ModelConfigBase):
    user_id: str
    platform_preset_id: Optional[str] = None

class ModelConfigUpdate(BaseModel):
    # 全部可选 = 部分更新。未出现的字段保持原值，出现且为 None 的字段也保持
    # 原值（Pydantic 无法区分「没传」和「传了 null」以外还需 exclude_unset）。
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    provider: Optional[str] = Field(None, min_length=1, max_length=50)
    endpoint: Optional[str] = Field(None, max_length=255)
    auth_type: Optional[str] = Field(None, max_length=20)
    auth_secret_ref: Optional[str] = Field(None, max_length=512)
    api_key: Optional[str] = Field(None, max_length=MAX_API_KEY_LENGTH)
    # 清空凭证：把 auth_secret_ref 置为 NULL（例如换成不需要鉴权的自建服务）
    clear_key: bool = False
    params_json: Optional[Dict[str, Any]] = None

class ModelConfigResponse(BaseModel):
    id: str
    user_id: str
    name: str
    provider: str
    endpoint: str
    auth_type: str
    params_json: Optional[Dict[str, Any]] = None
    has_auth_secret: bool = False
    platform_preset_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ModelConfigInternal(ModelConfigBase):
    id: str
    user_id: str
    platform_preset_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
