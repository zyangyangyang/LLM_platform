from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, HttpUrl
from datetime import datetime

class ModelConfigBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    provider: str = Field(..., min_length=1, max_length=50)
    endpoint: str = Field(..., max_length=255)  # Can be a URL or a model identifier
    auth_type: str = Field(..., max_length=20)  # e.g., "api_key", "none", "bearer"
    auth_secret_ref: Optional[str] = Field(None, max_length=255)
    params_json: Optional[Dict[str, Any]] = None

class ModelConfigCreate(ModelConfigBase):
    user_id: str
    platform_preset_id: Optional[str] = None

class ModelConfigUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    provider: Optional[str] = Field(None, min_length=1, max_length=50)
    endpoint: Optional[str] = Field(None, max_length=255)
    auth_type: Optional[str] = Field(None, max_length=20)
    auth_secret_ref: Optional[str] = Field(None, max_length=255)
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
