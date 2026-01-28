from contextlib import contextmanager
import pymysql
from app.core.config import get_settings

@contextmanager
def db_connection():
    """
    数据库连接上下文管理器
    处理连接创建、提交、回滚和关闭
    """
    settings = get_settings()
    conn = pymysql.connect(
        host=settings.db_host,
        port=settings.db_port,
        user=settings.db_user,
        password=settings.db_password,
        database=settings.db_name,
        charset=settings.db_charset,
        cursorclass=pymysql.cursors.DictCursor, # 返回字典格式的查询结果
    )
    try:
        yield conn
        conn.commit() # 成功执行后自动提交事务
    except Exception:
        conn.rollback() # 发生异常时回滚事务
        raise
    finally:
        conn.close() # 确保连接关闭

def execute(query: str, params: tuple = ()) -> int:
    """
    执行写操作（INSERT, UPDATE, DELETE）
    返回受影响的行数
    """
    with db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(query, params)
            return cursor.rowcount

def fetch_one(query: str, params: tuple = ()):
    """
    查询单条记录
    返回字典或 None
    """
    with db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(query, params)
            return cursor.fetchone()

def fetch_all(query: str, params: tuple = ()):
    """
    查询多条记录
    返回字典列表
    """
    with db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(query, params)
            return list(cursor.fetchall())
