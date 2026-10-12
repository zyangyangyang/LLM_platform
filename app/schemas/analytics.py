from typing import List, Optional
from datetime import datetime

from pydantic import BaseModel


class BenchmarkScoreItem(BaseModel):
    """某个模型在某个基准（数据集）上的得分。"""
    benchmark_name: str
    task_type: str
    score: float
    num_runs: int
    last_run_at: Optional[datetime] = None


class LeaderboardEntry(BaseModel):
    """排行榜单条记录。"""
    rank: int
    model_name: str
    provider: str
    score: float
    num_runs: int
    last_run_at: Optional[datetime] = None
    # 相对上一次评测得分的涨跌（提升为正、下降为负、首次或持平为 None）
    change: Optional[float] = None
    benchmark_scores: List[BenchmarkScoreItem] = []


class BenchmarkSummary(BaseModel):
    """基准（数据集）概览，用于 Benchmark 库列表。"""
    name: str
    description: Optional[str] = None
    task_type: str
    model_count: int
    run_count: int
    best_score: float
    latest_score: float
    last_run_at: Optional[datetime] = None
    sample_count: int


class HistoryPoint(BaseModel):
    """一次已完成评测运行的得分快照，用于历史数据对比。"""
    model_name: str
    benchmark_name: str
    task_type: str
    run_no: int
    score: float
    sample_count: int
    finished_at: Optional[datetime] = None
