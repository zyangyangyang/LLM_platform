import pymysql
from app.core.config import get_settings

def add_column():
    settings = get_settings()
    conn = pymysql.connect(
        host=settings.db_host,
        port=settings.db_port,
        user=settings.db_user,
        password=settings.db_password,
        database=settings.db_name,
        charset=settings.db_charset,
        autocommit=True
    )
    try:
        with conn.cursor() as cursor:
            # Check if column exists
            cursor.execute("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = %s AND TABLE_NAME = 'eval_tasks' AND COLUMN_NAME = 'task_type'", (settings.db_name,))
            if not cursor.fetchone():
                print("Adding task_type column...")
                cursor.execute("ALTER TABLE eval_tasks ADD COLUMN task_type VARCHAR(50) DEFAULT 'hallucination'")
                print("Column added.")
            else:
                print("Column already exists.")
    finally:
        conn.close()

if __name__ == "__main__":
    add_column()
