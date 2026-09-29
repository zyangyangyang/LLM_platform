from typing import Any, Dict, List

from fastapi import HTTPException, status

from app.repositories.attack_strategy_repo import AttackStrategyRepository
from app.schemas.attack_strategy import AttackStrategyCreate, AttackStrategyResponse
from app.services.attack import AttackRegistry


class AttackService:
    @staticmethod
    def _validate_config(config_json: Dict[str, Any]):
        algorithm = (config_json or {}).get("algorithm")
        if not algorithm or not isinstance(algorithm, str):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="config_json.algorithm is required",
            )
        if algorithm not in AttackRegistry.available():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown attack algorithm '{algorithm}'. Available: {AttackRegistry.available()}",
            )

    @staticmethod
    def list_algorithms() -> List[str]:
        return AttackRegistry.available()

    @staticmethod
    def create(data: AttackStrategyCreate) -> AttackStrategyResponse:
        AttackService._validate_config(data.config_json)
        if AttackStrategyRepository.exists_by_name(data.name):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Attack strategy '{data.name}' already exists",
            )
        strategy_id = AttackStrategyRepository.create(data.model_dump())
        created = AttackStrategyRepository.get(strategy_id)
        return AttackStrategyResponse(**created)

    @staticmethod
    def list() -> List[AttackStrategyResponse]:
        return [AttackStrategyResponse(**item) for item in AttackStrategyRepository.list()]

    @staticmethod
    def get(strategy_id: str) -> AttackStrategyResponse:
        strategy = AttackStrategyRepository.get(strategy_id)
        if not strategy:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attack strategy not found")
        return AttackStrategyResponse(**strategy)

    @staticmethod
    def update(strategy_id: str, data: AttackStrategyCreate) -> AttackStrategyResponse:
        strategy = AttackStrategyRepository.get(strategy_id)
        if not strategy:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attack strategy not found")
        AttackService._validate_config(data.config_json)
        AttackStrategyRepository.update(strategy_id, data.model_dump())
        updated = AttackStrategyRepository.get(strategy_id)
        return AttackStrategyResponse(**updated)

    @staticmethod
    def delete(strategy_id: str):
        strategy = AttackStrategyRepository.get(strategy_id)
        if not strategy:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attack strategy not found")
        if AttackStrategyRepository.count_referencing_tasks(strategy_id) > 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Attack strategy is in use by evaluation tasks; delete those tasks first",
            )
        AttackStrategyRepository.delete(strategy_id)
