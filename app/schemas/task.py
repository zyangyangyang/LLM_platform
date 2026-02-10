from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from datetime import datetime

class EvalTaskBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    model_config_id: str
    dataset_id: str
    attack_strategy_id: Optional[str] = None
    metric_set_id: Optional[str] = None
    task_type: Optional[str] = "hallucination"

class EvalTaskCreate(EvalTaskBase):
    user_id: str

class EvalTaskResponse(EvalTaskBase):
    id: str
    user_id: str
    status: str
    created_at: datetime
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class EvalTaskRunResponse(BaseModel):
    id: str
    task_id: str
    run_no: int
    status: str
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    error_message: Optional[str] = None

    class Config:
        from_attributes = True

class EvalSampleResultItem(BaseModel):
    sample_id: str
    input_text: str
    model_output: str
    labels_json: Optional[Dict[str, Any]] = None
    score_json: Optional[Dict[str, Any]] = None

class EvalSampleResultsResponse(BaseModel):
    items: List[EvalSampleResultItem]
    total: int

class EvalMetricItem(BaseModel):
    metric_name: str
    metric_value: float
    details_json: Optional[Dict[str, Any]] = None
