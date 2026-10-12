from typing import Optional, Dict, Any, List, Literal
from pydantic import BaseModel, Field
from datetime import datetime

class EvalTaskBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    model_config_id: str
    dataset_id: str
    attack_strategy_id: Optional[str] = None
    defense_strategy_id: Optional[str] = None
    metric_set_id: Optional[str] = None
    task_type: Optional[Literal["hallucination", "prompt_attack", "multimodal", "safety"]] = "hallucination"

class EvalTaskCreate(EvalTaskBase):
    user_id: str

class EvalTaskResponse(EvalTaskBase):
    id: str
    user_id: str
    status: str
    created_at: datetime
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None

    # 以下四项不入库，由 TaskService.get_task(with_names=True) 现查填充，
    # 供结果报告展示「数据集 / 被测模型 / 攻击策略 / 防御策略」。
    # 列表接口为省掉 N+1 查询不填充，保持为 None；资源已删除时也为 None。
    dataset_name: Optional[str] = None
    model_name: Optional[str] = None
    attack_strategy_name: Optional[str] = None
    defense_strategy_name: Optional[str] = None

    # 最近一次运行实际使用的生成参数快照（被测模型 + 裁判），同样只在
    # get_task(with_names=True) 时填充。取不到时为 None：
    # 迁移前建的老任务是空的，界面上别把它显示成「用了默认值」。
    # 结构见 scripts/add_gen_params_to_task_runs.py，不含任何密钥。
    gen_params_json: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True

class DimensionPreviewResponse(BaseModel):
    """建任务前的「维度 × 数据集」预检结果。

    分三种状态，前端据此决定置灰还是只提醒：
    - blocked=True           该组合会必然失效，create_task 也会 400，置灰。
    - warning 非空           能跑，但结果会被误读，提醒即可。
    - 两者都空               正常组合，不提示。
    """

    # 抽样条数。0 表示读不出样本（如文件缺失），此时 blocked / warning 都不可信
    probed: int = 0
    # 样本里是否有可比对的标准答案，决定幻觉维度能不能选
    has_comparable_target: bool = False
    blocked: bool = False
    block_reason: Optional[str] = None
    warning: Optional[str] = None

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


class EvalTaskProgressResponse(BaseModel):
    task_id: str
    run_id: Optional[str] = None
    status: str
    progress_done: int = 0
    progress_total: int = 0
    percent: float = 0.0
