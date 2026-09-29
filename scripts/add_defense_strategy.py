import pymysql
from app.core.config import get_settings


def migrate():
    settings = get_settings()
    conn = pymysql.connect(
        host=settings.db_host,
        port=settings.db_port,
        user=settings.db_user,
        password=settings.db_password,
        database=settings.db_name,
        charset=settings.db_charset,
        autocommit=True,
    )
    try:
        with conn.cursor() as cursor:
            # 1. 创建 defense_strategies 表（若不存在）
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS defense_strategies (
                  id VARCHAR(36) NOT NULL PRIMARY KEY,
                  name VARCHAR(100) NOT NULL UNIQUE,
                  description TEXT,
                  config_json JSON
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """
            )
            print("defense_strategies table ensured.")

            # 2. eval_tasks 增加 defense_strategy_id 列（若不存在）
            cursor.execute(
                "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS "
                "WHERE TABLE_SCHEMA = %s AND TABLE_NAME = 'eval_tasks' "
                "AND COLUMN_NAME = 'defense_strategy_id'",
                (settings.db_name,),
            )
            if not cursor.fetchone():
                print("Adding defense_strategy_id column...")
                cursor.execute(
                    "ALTER TABLE eval_tasks ADD COLUMN defense_strategy_id VARCHAR(36), "
                    "ADD CONSTRAINT fk_eval_tasks_defense "
                    "FOREIGN KEY (defense_strategy_id) REFERENCES defense_strategies(id)"
                )
                print("Column added.")
            else:
                print("defense_strategy_id column already exists.")
    finally:
        conn.close()


if __name__ == "__main__":
    migrate()
