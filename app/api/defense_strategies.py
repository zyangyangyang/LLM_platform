from typing import Any, Dict, List

from fastapi import APIRouter, Depends, status

from app.api.deps import get_current_admin_user, get_current_user
from app.schemas.defense_strategy import DefenseStrategyCreate, DefenseStrategyResponse
from app.services.defense_service import DefenseService

router = APIRouter()


@router.get("/algorithms", response_model=List[str])
def list_algorithms(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    列出已注册的可用防御算法类型
    """
    return DefenseService.list_algorithms()


@router.get("/", response_model=List[DefenseStrategyResponse])
def list_strategies(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    获取防御策略列表
    """
    return DefenseService.list()


@router.post("/", response_model=DefenseStrategyResponse)
def create_strategy(
    strategy_in: DefenseStrategyCreate,
    current_user: Dict[str, Any] = Depends(get_current_admin_user),
):
    """
    创建防御策略（管理员）
    """
    return DefenseService.create(strategy_in)


@router.get("/{strategy_id}", response_model=DefenseStrategyResponse)
def get_strategy(
    strategy_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    获取单个防御策略详情
    """
    return DefenseService.get(strategy_id)


@router.patch("/{strategy_id}", response_model=DefenseStrategyResponse)
def update_strategy(
    strategy_id: str,
    strategy_in: DefenseStrategyCreate,
    current_user: Dict[str, Any] = Depends(get_current_admin_user),
):
    """
    更新防御策略（管理员）
    """
    return DefenseService.update(strategy_id, strategy_in)


@router.delete("/{strategy_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_strategy(
    strategy_id: str,
    current_user: Dict[str, Any] = Depends(get_current_admin_user),
):
    """
    删除防御策略（管理员）
    """
    DefenseService.delete(strategy_id)
