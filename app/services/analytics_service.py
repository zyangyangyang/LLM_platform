from collections import Counter, defaultdict
from datetime import datetime
from typing import Any, Dict, List, Optional

from app.repositories.analytics_repo import AnalyticsRepository
from app.schemas.analytics import (
    BenchmarkScoreItem,
    BenchmarkSummary,
    HistoryPoint,
    LeaderboardEntry,
)


class AnalyticsService:
    """排行榜、Benchmark 库与历史对比的业务逻辑。

    数据来源是已完成的评测运行（跨用户聚合）。核心假设：
    - 得分（exact_match）越高越好：幻觉任务=抽取正确，攻击任务=输出被判安全。
    - 基准（Benchmark）= 数据集（datasets 表）。
    """

    @staticmethod
    def _load() -> List[Dict[str, Any]]:
        rows = AnalyticsRepository.list_completed_runs()
        cleaned: List[Dict[str, Any]] = []
        for r in rows:
            if int(r.get("sample_count") or 0) <= 0:
                continue
            r["score"] = float(r["score"]) if r.get("score") is not None else 0.0
            r["sample_count"] = int(r.get("sample_count") or 0)
            r["model_name"] = (r.get("model_name") or "").strip()
            r["dataset_name"] = (r.get("dataset_name") or "").strip()
            cleaned.append(r)
        return cleaned

    @staticmethod
    def _most_common(values: List[Any]) -> str:
        vals = [str(v).strip() for v in values if v]
        if not vals:
            return ""
        return Counter(vals).most_common(1)[0][0]

    @staticmethod
    def _sorted_by_time(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        return sorted(items, key=lambda x: x.get("finished_at") or datetime.min)

    # ------------------------------------------------------------------ #
    # Benchmark 库
    # ------------------------------------------------------------------ #
    @staticmethod
    def list_benchmarks() -> List[BenchmarkSummary]:
        grouped: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        for r in AnalyticsService._load():
            if r["dataset_name"]:
                grouped[r["dataset_name"]].append(r)

        out: List[BenchmarkSummary] = []
        for name, items in grouped.items():
            models = {i["model_name"] for i in items if i["model_name"]}
            scores = [i["score"] for i in items]
            task_types = {i.get("task_type") or "" for i in items}
            description = next(
                (i.get("dataset_description") for i in items if i.get("dataset_description")),
                None,
            )
            last = AnalyticsService._sorted_by_time(items)[-1]
            out.append(
                BenchmarkSummary(
                    name=name,
                    description=description,
                    task_type=min(task_types) if task_types else "",
                    model_count=len(models),
                    run_count=len(items),
                    best_score=round(max(scores), 4) if scores else 0.0,
                    latest_score=round(last["score"], 4),
                    last_run_at=last.get("finished_at"),
                    sample_count=last["sample_count"],
                )
            )
        out.sort(key=lambda b: b.last_run_at or datetime.min, reverse=True)
        return out

    # ------------------------------------------------------------------ #
    # 排行榜
    # ------------------------------------------------------------------ #
    @staticmethod
    def get_leaderboard(benchmark: Optional[str] = None) -> List[LeaderboardEntry]:
        by_model: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        for r in AnalyticsService._load():
            if r["model_name"]:
                by_model[r["model_name"]].append(r)

        entries: List[Dict[str, Any]] = []
        for model_name, items in by_model.items():
            provider = AnalyticsService._most_common([i.get("model_provider") for i in items])

            # 每个基准上的最新得分
            per_bench: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
            for i in items:
                if i["dataset_name"]:
                    per_bench[i["dataset_name"]].append(i)

            benchmark_scores: List[BenchmarkScoreItem] = []
            for bname, bits in per_bench.items():
                ordered = AnalyticsService._sorted_by_time(bits)
                latest = ordered[-1]
                benchmark_scores.append(
                    BenchmarkScoreItem(
                        benchmark_name=bname,
                        task_type=latest.get("task_type") or "",
                        score=round(latest["score"], 4),
                        num_runs=len(bits),
                        last_run_at=latest.get("finished_at"),
                    )
                )
            benchmark_scores.sort(key=lambda b: b.benchmark_name)

            last_run_at = max(
                (i["finished_at"] for i in items if i.get("finished_at")),
                default=None,
            )

            if benchmark:
                target = next(
                    (b for b in benchmark_scores if b.benchmark_name == benchmark),
                    None,
                )
                if target is None:
                    continue
                score = target.score
                change = AnalyticsService._benchmark_change(items, benchmark)
            else:
                score = (
                    round(sum(b.score for b in benchmark_scores) / len(benchmark_scores), 4)
                    if benchmark_scores
                    else 0.0
                )
                change = AnalyticsService._overall_change(items)

            entries.append(
                {
                    "model_name": model_name,
                    "provider": provider,
                    "score": score,
                    "num_runs": len(items),
                    "last_run_at": last_run_at,
                    "change": change,
                    "benchmark_scores": benchmark_scores,
                }
            )

        entries.sort(key=lambda e: e["score"], reverse=True)
        result: List[LeaderboardEntry] = []
        for idx, e in enumerate(entries, start=1):
            result.append(
                LeaderboardEntry(
                    rank=idx,
                    model_name=e["model_name"],
                    provider=e["provider"],
                    score=e["score"],
                    num_runs=e["num_runs"],
                    last_run_at=e["last_run_at"],
                    change=e["change"],
                    benchmark_scores=e["benchmark_scores"],
                )
            )
        return result

    # ------------------------------------------------------------------ #
    # 历史对比
    # ------------------------------------------------------------------ #
    @staticmethod
    def get_history(
        benchmark: Optional[str] = None,
        model: Optional[str] = None,
    ) -> List[HistoryPoint]:
        rows = AnalyticsService._load()
        if benchmark:
            rows = [r for r in rows if r["dataset_name"] == benchmark]
        if model:
            rows = [r for r in rows if r["model_name"] == model]

        out: List[HistoryPoint] = []
        for r in AnalyticsService._sorted_by_time(rows):
            out.append(
                HistoryPoint(
                    model_name=r["model_name"],
                    benchmark_name=r["dataset_name"],
                    task_type=r.get("task_type") or "",
                    run_no=int(r.get("run_no") or 0),
                    score=round(r["score"], 4),
                    sample_count=r["sample_count"],
                    finished_at=r.get("finished_at"),
                )
            )
        return out

    # ------------------------------------------------------------------ #
    # 涨跌计算
    # ------------------------------------------------------------------ #
    @staticmethod
    def _benchmark_change(items: List[Dict[str, Any]], benchmark: str) -> Optional[float]:
        bits = AnalyticsService._sorted_by_time(
            [i for i in items if i["dataset_name"] == benchmark]
        )
        if len(bits) >= 2:
            return round(bits[-1]["score"] - bits[-2]["score"], 4)
        return None

    @staticmethod
    def _overall_change(items: List[Dict[str, Any]]) -> Optional[float]:
        """按时间推进，逐步构建每个基准的最新得分并计算整体平均分变化。"""
        latest: Dict[str, float] = {}
        series: List[float] = []
        for i in AnalyticsService._sorted_by_time(items):
            if i["dataset_name"]:
                latest[i["dataset_name"]] = i["score"]
            if latest:
                series.append(sum(latest.values()) / len(latest))
        if len(series) >= 2:
            return round(series[-1] - series[-2], 4)
        return None
