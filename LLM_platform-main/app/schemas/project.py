from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class ProjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None

class ProjectCreate(ProjectBase):
    pass

class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None

class ProjectResponse(ProjectBase):
    id: str
    owner_id: str
    created_at: datetime
    updated_at: datetime

class ProjectMemberCreate(BaseModel):
    user_id: str
    role: str = "member"  # member, admin

class ProjectMemberResponse(BaseModel):
    id: str
    project_id: str
    user_id: str
    role_in_project: str
    created_at: datetime
