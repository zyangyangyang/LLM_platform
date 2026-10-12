from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user
from app.schemas.analytics import BenchmarkSummary, HistoryPoint, LeaderboardEntry
from app.services.analytics_service import AnalyticsService

router = APIRouter()


@router.get("/benchmarks", response_model=List[BenchmarkSummary])
def list_benchmarks(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """返回 Benchmark 库：所有已产生评测结果的数据集及其聚合统计。"""
    return AnalyticsService.list_benchmarks()


@router.get("/leaderboard", response_model=List[LeaderboardEntry])
def get_leaderboard(
    benchmark: Optional[str] = Query(None, description="按基准（数据集名称）过滤，按该基准得分排名"),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """返回模型安全排行榜（默认综合，可用 benchmark 指定专项基准）。"""
    return AnalyticsService.get_leaderboard(benchmark=benchmark)


@router.get("/history", response_model=List[HistoryPoint])
def get_history(
    benchmark: Optional[str] = Query(None, description="按基准（数据集名称）过滤"),
    model: Optional[str] = Query(None, description="按模型名称过滤"),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """返回历史评测得分序列，用于历史数据对比（可按基准和/或模型过滤）。"""
    return AnalyticsService.get_history(benchmark=benchmark, model=model)
