from fastapi import APIRouter
from app.api import auth, model_configs, datasets, eval_tasks

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(model_configs.router, tags=["model_configs"])
api_router.include_router(datasets.router, tags=["datasets"])
api_router.include_router(eval_tasks.router, prefix="/eval-tasks", tags=["eval_tasks"])
