"""给 eval_task_runs 加一列 gen_params_json，留档「这次运行实际用了什么参数」。

背景：模型调用时的生成参数来自 `model_configs.params_json`，而那个字段是**可变的**
——用户随时能在「我的模型」里改。评测结果本身（`eval_sample_results`）只存了模型的
输入输出，没存当时用的 temperature / max_tokens / 模型名。于是「上次那 62% 是怎么
跑出来的」这个问题无法回答：模型配置改了之后，历史报告就失去了可追溯性。

更隐蔽的是 `model` 这个键：调用时取的是 `params_json["model"]`，取不到才回落到
`model_configs.name`。也就是说**配置名和实际调用的模型名可以不相等**（库里就有
一条名叫 deepseek-chat、实际调 `deepseek-flash` 的配置）。只记配置名等于记了个假值。

本列在每次运行开始时写入一次快照：

    {
      "model":  {"model": "qwen-plus", "temperature": 0.2, "max_tokens": 512},
      "judge":  {"model": "qwen3.8-flash", "temperature": 0, "max_tokens": 8}
    }

裁判模型一并记：它是判定的来源，换了裁判等于换了判据，不记下来同样说不清。
快照里**不含任何密钥**——只有模型名与采样参数。

幂等：列已存在则跳过。

用法：python -m scripts.add_gen_params_to_task_runs
"""

import sys
from pathlib import Path

# `python scripts/xxx.py` 只会把 scripts/ 放进 sys.path，项目根不在其中，
# 于是 `import app` 必然失败。这里自己补上项目根。
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.database import execute, fetch_one  # noqa: E402

TABLE = "eval_task_runs"
COLUMN = "gen_params_json"


def _column_exists() -> bool:
    row = fetch_one(
        """
        SELECT 1 AS present
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = %s
          AND COLUMN_NAME = %s
        """,
        (TABLE, COLUMN),
    )
    return bool(row)


def migrate() -> None:
    if _column_exists():
        print(f"  [跳过] {TABLE}.{COLUMN} 已存在")
        return

    print(f"  [执行] ALTER TABLE {TABLE} ADD COLUMN {COLUMN} JSON NULL")
    execute(f"ALTER TABLE {TABLE} ADD COLUMN {COLUMN} JSON NULL")

    if _column_exists():
        print(f"\n  完成：{TABLE}.{COLUMN} 已添加")
    else:
        print(f"\n  异常：执行后仍未检测到 {TABLE}.{COLUMN}")


if __name__ == "__main__":
    migrate()
