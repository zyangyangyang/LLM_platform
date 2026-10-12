from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import get_settings
from app.core.database import execute, fetch_one
from app.api.router import api_router
from app.repositories.task_repo import TaskRepository

# 获取全局配置
settings = get_settings()

# 初始化 FastAPI 应用，设置应用标题
app = FastAPI(title=settings.app_name)

# Pydantic 默认会把校验失败的**原值**放进 errors[].input 回显给客户端。对模型
# 密钥、密码这类字段来说，这等于把明文写进响应体 —— 而响应体会进浏览器
# Network 面板、前端错误上报、以及任何记录响应的中间件。实测确认过：提交一个
# 超长的 api_key 时，422 响应里能原样读到密钥。
#
# 这里统一剥掉携带请求值的字段，只留 type / loc / msg：定位问题够用，且不含输入。
# 注意 msg 本身也可能由自定义校验器拼出内容，所以自定义校验器一律不许把字段值
# 写进异常文案。
_SENSITIVE_ERROR_KEYS = ("input", "ctx", "url")


@app.exception_handler(RequestValidationError)
async def _validation_error_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "detail": [
                {k: v for k, v in error.items() if k not in _SENSITIVE_ERROR_KEYS}
                for error in exc.errors()
            ]
        },
    )

# 配置跨域，允许本地前端开发服务器访问后端接口
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册 API 路由，设置统一前缀（如 /api）
app.include_router(api_router, prefix=settings.api_prefix)

@app.on_event("startup")
def _startup_cleanup():
    # 确保数据库运行进度字段存在（用于前端显示测评进度）
    try:
        db_name = get_settings().db_name
        col_total = fetch_one(
            """
            SELECT COUNT(*) AS cnt
            FROM information_schema.columns
            WHERE table_schema = %s
              AND table_name = 'eval_task_runs'
              AND column_name = 'progress_total'
            """,
            (db_name,),
        )
        col_done = fetch_one(
            """
            SELECT COUNT(*) AS cnt
            FROM information_schema.columns
            WHERE table_schema = %s
              AND table_name = 'eval_task_runs'
              AND column_name = 'progress_done'
            """,
            (db_name,),
        )

        if col_total and int(col_total.get("cnt") or 0) == 0:
            execute(
                "ALTER TABLE eval_task_runs ADD COLUMN progress_total INT NOT NULL DEFAULT 0"
            )
        if col_done and int(col_done.get("cnt") or 0) == 0:
            execute(
                "ALTER TABLE eval_task_runs ADD COLUMN progress_done INT NOT NULL DEFAULT 0"
            )
    except Exception:
        # 启动阶段尽量不中断：如果数据库权限不足，进度条可能不可用
        pass

    TaskRepository.mark_running_as_failed("server_restarted")

# 健康检查接口，用于确认服务是否运行正常
@app.get("/health")
def health():
    return {"status": "ok"}
 