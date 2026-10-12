from typing import Any, Dict, List

from app.core.database import fetch_all


class AnalyticsRepository:
    """排行榜 / Benchmark / 历史对比所需的数据聚合查询。

    这里只读取已完成运行（eval_task_runs.status = 'completed'），
    并把每个样本结果的 exact_match 分数在 SQL 层聚合为「单次运行的得分」，
    避免在 Python 层拉取全部样本明细。
    """

    @staticmethod
    def list_completed_runs() -> List[Dict[str, Any]]:
        rows = fetch_all(
            """
            SELECT
                r.id                    AS run_id,
                r.task_id               AS task_id,
                r.run_no                AS run_no,
                r.finished_at           AS finished_at,
                t.name                  AS task_name,
                t.task_type             AS task_type,
                m.id                    AS model_id,
                m.name                  AS model_name,
                m.provider              AS model_provider,
                d.id                    AS dataset_id,
                d.name                  AS dataset_name,
                d.description           AS dataset_description,
                COUNT(esr.id)           AS sample_count,
                COALESCE(
                    AVG(COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(esr.score_json, '$.exact_match')) AS DECIMAL(10,4)), 0.0)),
                    0.0
                )                       AS score
            FROM eval_task_runs r
            JOIN eval_tasks t   ON r.task_id = t.id
            JOIN model_configs m ON t.model_config_id = m.id
            JOIN datasets d     ON t.dataset_id = d.id
            LEFT JOIN eval_sample_results esr ON esr.task_run_id = r.id
            WHERE r.status = 'completed'
            GROUP BY
                r.id, r.task_id, r.run_no, r.finished_at,
                t.name, t.task_type,
                m.id, m.name, m.provider,
                d.id, d.name, d.description
            ORDER BY r.finished_at ASC
            """
        )
        return rows
