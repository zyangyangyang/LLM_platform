from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class PlatformModelPresetCreate(BaseModel):
    id: Optional[str] = Field(None, min_length=1, max_length=100)
    name: str = Field(..., min_length=1, max_length=100)
    provider: str = Field(..., min_length=1, max_length=50)
    endpoint: str = Field(..., max_length=255)
    auth_type: str = Field("bearer", max_length=20)
    # 上限 512 = 列宽：启用自带密钥后这里可能是 enc:v1:... 密文（约 319 字符）
    auth_secret_ref: Optional[str] = Field(None, max_length=512)
    params_json: Optional[Dict[str, Any]] = None
    description: Optional[str] = None


class PlatformModelPresetResponse(BaseModel):
    id: str
    name: str
    provider: str
    endpoint: str
    auth_type: str
    params_json: Optional[Dict[str, Any]] = None
    description: Optional[str] = None
    has_auth_secret: bool = False
    created_by: str
    created_at: datetime

    class Config:
        from_attributes = True


class PlatformDatasetPresetCreate(BaseModel):
    id: Optional[str] = Field(None, min_length=1, max_length=100)
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    source_type: str = Field(..., max_length=30)
    storage_uri: str = Field(..., max_length=255)
    schema_json: Optional[Dict[str, Any]] = None


class PlatformDatasetPresetResponse(PlatformDatasetPresetCreate):
    id: str
    created_by: str
    created_at: datetime

    class Config:
        from_attributes = True


class PlatformModelKeyCreate(BaseModel):
    secret_ref: str = Field(..., min_length=1, max_length=512)
    label: Optional[str] = Field(None, max_length=100)
    status: str = Field("active", max_length=20)
    weight: int = Field(1, ge=1, le=100)
    rpm_limit: Optional[int] = Field(None, ge=1)
    rps_limit: Optional[int] = Field(None, ge=1)


class PlatformModelKeyResponse(BaseModel):
    id: str
    model_preset_id: str
    # 环境变量名照原样返回；自带密钥的密文只回一个固定掩码（enc:v1:***），
    # 密文本身对调用方没有用处，给出去只会扩大暴露面。
    secret_ref: str
    has_secret: bool = False
    label: Optional[str] = None
    status: str
    weight: int
    rpm_limit: Optional[int] = None
    rps_limit: Optional[int] = None
    created_by: str
    created_at: datetime

    class Config:
        from_attributes = True
