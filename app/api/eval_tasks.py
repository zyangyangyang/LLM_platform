from typing import List, Dict, Any
from fastapi import APIRouter, Depends, status
from app.api.auth import get_current_user
from app.schemas.task import EvalTaskCreate, EvalTaskResponse, EvalTaskRunResponse
from app.services.task_service import TaskService

router = APIRouter()

@router.post("/", response_model=EvalTaskResponse)
def create_task(
    task_in: EvalTaskCreate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    创建评测任务
    需指定项目、模型和数据集
    """
    return TaskService.create_task(task_in, current_user["id"])

@router.get("/", response_model=List[EvalTaskResponse])
def list_tasks(
    project_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    获取项目下的评测任务列表
    """
    return TaskService.list_tasks(project_id, current_user["id"])

@router.get("/{task_id}", response_model=EvalTaskResponse)
def get_task(
    task_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    获取任务详情
    """
    return TaskService.get_task(task_id, current_user["id"])

@router.post("/{task_id}/run", response_model=EvalTaskRunResponse)
def run_task(
    task_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    执行评测任务
    触发后台异步执行
    """
    return TaskService.run_task(task_id, current_user["id"])
