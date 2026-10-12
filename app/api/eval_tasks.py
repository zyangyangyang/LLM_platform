from typing import List, Dict, Any
from fastapi import APIRouter, Depends, status
from app.api.auth import get_current_user
from app.schemas.task import (
    EvalTaskBase,
    EvalTaskCreate,
    EvalTaskResponse,
    EvalTaskRunResponse,
    EvalSampleResultsResponse,
    EvalMetricItem,
    EvalTaskProgressResponse,
    DimensionPreviewResponse,
)
from app.services.task_service import TaskService
from app.repositories.task_repo import TaskRepository

router = APIRouter()

@router.post("/", response_model=EvalTaskResponse)
def create_task(
    task_in: EvalTaskBase,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    创建评测任务
    需指定模型和数据集
    """
    full_task_in = EvalTaskCreate(user_id=current_user["id"], **task_in.model_dump())
    return TaskService.create_task(full_task_in, current_user["id"])

@router.get("/", response_model=List[EvalTaskResponse])
def list_tasks(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    获取用户下的评测任务列表
    """
    return TaskService.list_tasks(current_user["id"])

@router.get("/dimension-preview", response_model=DimensionPreviewResponse)
def preview_dimension(
    dataset_id: str,
    task_type: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    提交前预检「评测维度 × 数据集」

    让用户点选维度时就拿到反馈，而不是填完整张表单点提交才被 400 拦下。
    硬拦截逻辑仍在 create_task 里，这里只是提前把同一份结论说出来。

    注意这条必须声明在 GET /{task_id} **之前**：FastAPI 按声明顺序匹配，
    放在后面的话 "dimension-preview" 会被当成 task_id 吃掉。
    """
    return TaskService.preview_task_dimension(
        dataset_id, task_type, current_user["id"]
    )


@router.get("/{task_id}", response_model=EvalTaskResponse)
def get_task(
    task_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    获取任务详情

    结果报告要展示数据集/模型/策略名称，这里带上名称解析；
    进度接口不用，它每秒轮询一次，只需要权限校验。
    """
    return TaskService.get_task(task_id, current_user["id"], with_names=True)

@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    删除任务及其运行记录
    """
    TaskService.delete_task(task_id, current_user["id"])

@router.post("/{task_id}/run", response_model=EvalTaskRunResponse)
async def run_task(
    task_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    执行评测任务
    触发后台异步执行
    """
    return await TaskService.run_task(task_id, current_user["id"])

@router.get("/{task_id}/samples", response_model=EvalSampleResultsResponse)
def get_task_samples(
    task_id: str,
    page: int = 1,
    size: int = 50,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    return TaskService.get_task_samples(task_id, current_user["id"], page, size)

@router.get("/{task_id}/metrics", response_model=List[EvalMetricItem])
def get_task_metrics(
    task_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    return TaskService.get_task_metrics(task_id, current_user["id"])


@router.get("/{task_id}/progress", response_model=EvalTaskProgressResponse)
def get_task_progress(
    task_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    获取任务运行进度（用于前端进度条）
    """
    # 复用任务读取逻辑，确保校验任务归属
    TaskService.get_task(task_id, current_user["id"])

    runs = TaskRepository.get_runs(task_id)
    latest = runs[0] if runs else None  # get_runs 已按 run_no desc 排序

    progress_total = int(latest.get("progress_total") or 0) if latest else 0
    progress_done = int(latest.get("progress_done") or 0) if latest else 0
    percent = (progress_done / progress_total * 100.0) if progress_total > 0 else 0.0

    return EvalTaskProgressResponse(
        task_id=task_id,
        run_id=(latest.get("id") if latest else None),
        status=(latest.get("status") if latest else "pending"),
        progress_done=progress_done,
        progress_total=progress_total,
        percent=percent,
    )
