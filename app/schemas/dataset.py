from typing import Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime

class DatasetBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    source_type: str = Field(..., description="file_upload, s3, url")
    storage_uri: str = Field(..., max_length=255)
    schema_json: Optional[Dict[str, Any]] = None

class DatasetCreate(DatasetBase):
    project_id: str

class DatasetResponse(DatasetBase):
    id: str
    project_id: str
    created_at: datetime

    class Config:
        from_attributes = True
