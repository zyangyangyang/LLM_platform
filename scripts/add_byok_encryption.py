"""扩宽密钥列，为「用户自带密钥（BYOK）」腾出空间。

背景：启用 BYOK 后，`auth_secret_ref` 这一列除了存环境变量名，还要能存
Fernet 密文（形如 `enc:v1:<token>`）。密文比明文长：
    64 字符的密钥  -> 约 191 字符
    164 字符的密钥 -> 约 319 字符（OpenAI 那类长 key）
原来的 VARCHAR(255) 装不下后者，而 MySQL 写入超长值会直接报错（本库
sql_mode 含 STRICT_TRANS_TABLES），表现为「保存模型时报一个看不懂的错」。

为什么是 512 而不是更大：
`platform_model_keys` 上有唯一索引 uk_platform_model_key_ref
(model_preset_id, secret_ref)。InnoDB 的 DYNAMIC 行格式下单条索引键上限
3072 字节，utf8mb4 每字符最多 4 字节：
    model_preset_id VARCHAR(100) -> 400 字节
    secret_ref 剩余可用           -> 2672 字节 = 668 字符
所以 1024 会让这条唯一索引直接超限、ALTER 失败。512 字符对应约 385 字符长的
原始密钥，远超各厂商实际签发的长度，留足了余量。

幂等：重复执行不会报错，已经在 512（或更宽）的列会被跳过。

用法：python scripts/add_byok_encryption.py
"""

import sys
from pathlib import Path

# `python scripts/xxx.py` 只会把 scripts/ 放进 sys.path，项目根不在其中，
# 于是 `import app` 必然失败（DEPLOY.md 里那几条同类命令就是这么坏的）。
# 这里自己补上项目根，让脚本按文档写的命令也能直接跑。
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.database import execute, fetch_one  # noqa: E402

TARGET_WIDTH = 512

# (表名, 列名, 是否 NOT NULL)
COLUMNS = (
    ("model_configs", "auth_secret_ref", False),
    ("platform_model_presets", "auth_secret_ref", False),
    ("platform_model_keys", "secret_ref", True),
)


def _current_width(table: str, column: str) -> int | None:
    row = fetch_one(
        """
        SELECT CHARACTER_MAXIMUM_LENGTH AS width
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = %s
          AND COLUMN_NAME = %s
        """,
        (table, column),
    )
    return int(row["width"]) if row and row.get("width") is not None else None


def migrate() -> None:
    for table, column, not_null in COLUMNS:
        width = _current_width(table, column)
        if width is None:
            print(f"  [跳过] {table}.{column} 不存在（该表可能尚未建）")
            continue
        if width >= TARGET_WIDTH:
            print(f"  [跳过] {table}.{column} 已是 VARCHAR({width})")
            continue

        null_clause = "NOT NULL" if not_null else "NULL"
        print(f"  [执行] {table}.{column}: VARCHAR({width}) -> VARCHAR({TARGET_WIDTH})")
        execute(
            f"ALTER TABLE {table} MODIFY {column} "
            f"VARCHAR({TARGET_WIDTH}) {null_clause}"
        )

    print("\n  完成。当前列宽：")
    for table, column, _ in COLUMNS:
        width = _current_width(table, column)
        print(f"    {table}.{column} = {width}")


if __name__ == "__main__":
    migrate()
