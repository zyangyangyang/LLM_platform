from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class AttackStrategyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    config_json: Dict[str, Any] = Field(..., description="算法配置，含 algorithm 与 params")


class AttackStrategyResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    config_json: Dict[str, Any]

    class Config:
        from_attributes = True
