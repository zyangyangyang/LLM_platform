from typing import Any, Dict, List

from fastapi import APIRouter, Depends, status

from app.api.deps import get_current_admin_user, get_current_user
from app.schemas.attack_strategy import AttackStrategyCreate, AttackStrategyResponse
from app.services.attack_service import AttackService

router = APIRouter()


@router.get("/algorithms", response_model=List[str])
def list_algorithms(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    列出已注册的可用攻击算法类型
    """
    return AttackService.list_algorithms()


@router.get("/", response_model=List[AttackStrategyResponse])
def list_strategies(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    获取攻击策略列表
    """
    return AttackService.list()


@router.post("/", response_model=AttackStrategyResponse)
def create_strategy(
    strategy_in: AttackStrategyCreate,
    current_user: Dict[str, Any] = Depends(get_current_admin_user),
):
    """
    创建攻击策略（管理员）
    """
    return AttackService.create(strategy_in)


@router.get("/{strategy_id}", response_model=AttackStrategyResponse)
def get_strategy(
    strategy_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    获取单个攻击策略详情
    """
    return AttackService.get(strategy_id)


@router.patch("/{strategy_id}", response_model=AttackStrategyResponse)
def update_strategy(
    strategy_id: str,
    strategy_in: AttackStrategyCreate,
    current_user: Dict[str, Any] = Depends(get_current_admin_user),
):
    """
    更新攻击策略（管理员）
    """
    return AttackService.update(strategy_id, strategy_in)


@router.delete("/{strategy_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_strategy(
    strategy_id: str,
    current_user: Dict[str, Any] = Depends(get_current_admin_user),
):
    """
    删除攻击策略（管理员）
    """
    AttackService.delete(strategy_id)
