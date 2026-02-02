from fastapi import APIRouter, Depends, Query
from app.services.leaderboard_service import LeaderboardService
from typing import List, Dict, Any

router = APIRouter()

@router.get("/leaderboard/models", response_model=List[Dict[str, Any]])
def get_model_leaderboard(
    metric_name: str = Query(..., description="指标名称，例如 accuracy"),
    limit: int = Query(10, ge=1, le=100, description="返回的记录数"),
    project_id: str = Query(None, description="项目ID，可选，不指定则返回所有项目的模型排行")
):
    """
    获取模型排行榜
    根据指定的指标对模型进行排序
    """
    return LeaderboardService.get_model_leaderboard(metric_name, limit, project_id)

@router.get("/leaderboard/datasets", response_model=List[Dict[str, Any]])
def get_dataset_leaderboard(
    metric_name: str = Query(..., description="指标名称，例如 accuracy"),
    limit: int = Query(10, ge=1, le=100, description="返回的记录数"),
    project_id: str = Query(None, description="项目ID，可选，不指定则返回所有项目的数据集排行")
):
    """
    获取数据集排行榜
    根据指定的指标对数据集进行排序
    """
    return LeaderboardService.get_dataset_leaderboard(metric_name, limit, project_id)
