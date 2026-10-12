"""扩宽 audit_logs.resource_id，使它装得下所有资源 id。

背景：`audit_logs` 表建表时 `resource_id` 定的是 VARCHAR(36)（正好是 uuid4 的
长度），但**平台预置的 id 是 VARCHAR(100)** —— 管理员可以在创建预置时自定义 id
（见 PlatformModelPresetCreate.id），长度上限 100。

本库 sql_mode 含 STRICT_TRANS_TABLES，写入超长值是**直接报错**而非静默截断。
于是给一个长 id 的预置记审计时，INSERT 会失败 —— 如果审计写入是 fail-open 的
（本项目的选择，见 app/repositories/audit_repo.py），这条记录就无声无息地没了。
对审计日志来说这是最糟的失败方式：不报错、但也没留下痕迹。

100 覆盖了当前 schema 里最宽的资源 id：

    model_configs / datasets / eval_tasks / attack_strategies   VARCHAR(36)
    platform_model_presets / platform_dataset_presets           VARCHAR(100)

幂等：已经是 100（或更宽）的列会被跳过。

用法：python scripts/add_audit_log_resource_id.py
"""

import sys
from pathlib import Path

# `python scripts/xxx.py` 只会把 scripts/ 放进 sys.path，项目根不在其中，
# 于是 `import app` 必然失败。这里自己补上项目根。
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.database import execute, fetch_one  # noqa: E402

TABLE = "audit_logs"
COLUMN = "resource_id"
TARGET_WIDTH = 100


def _current_width() -> int | None:
    row = fetch_one(
        """
        SELECT CHARACTER_MAXIMUM_LENGTH AS width
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = %s
          AND COLUMN_NAME = %s
        """,
        (TABLE, COLUMN),
    )
    return int(row["width"]) if row and row.get("width") is not None else None


def migrate() -> None:
    width = _current_width()
    if width is None:
        print(f"  [跳过] {TABLE}.{COLUMN} 不存在（该表可能尚未建）")
        return

    if width >= TARGET_WIDTH:
        print(f"  [跳过] {TABLE}.{COLUMN} 已是 VARCHAR({width})")
    else:
        print(f"  [执行] {TABLE}.{COLUMN}: VARCHAR({width}) -> VARCHAR({TARGET_WIDTH})")
        execute(
            f"ALTER TABLE {TABLE} MODIFY {COLUMN} VARCHAR({TARGET_WIDTH}) NULL"
        )

    print(f"\n  完成。{TABLE}.{COLUMN} = VARCHAR({_current_width()})")


if __name__ == "__main__":
    migrate()
