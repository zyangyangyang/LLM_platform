from fastapi import FastAPI
from app.core.config import get_settings
from app.api.router import api_router

# 获取全局配置
settings = get_settings()

# 初始化 FastAPI 应用，设置应用标题
app = FastAPI(title=settings.app_name)

# 注册 API 路由，设置统一前缀（如 /api）
app.include_router(api_router, prefix=settings.api_prefix)

# 健康检查接口，用于确认服务是否运行正常
@app.get("/health")
def health():
    return {"status": "ok"}
