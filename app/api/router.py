from fastapi import APIRouter
from app.api import (
    admin,
    analytics,
    attack_strategies,
    auth,
    datasets,
    defense_strategies,
    eval_tasks,
    model_configs,
    providers,
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(providers.router, prefix="/providers", tags=["providers"])
api_router.include_router(model_configs.router, tags=["model_configs"])
api_router.include_router(datasets.router, tags=["datasets"])
api_router.include_router(eval_tasks.router, prefix="/eval-tasks", tags=["eval_tasks"])
api_router.include_router(attack_strategies.router, prefix="/attack-strategies", tags=["attack_strategies"])
api_router.include_router(defense_strategies.router, prefix="/defense-strategies", tags=["defense_strategies"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
