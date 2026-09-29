from typing import Any, Dict, List

from fastapi import HTTPException, status

from app.repositories.defense_strategy_repo import DefenseStrategyRepository
from app.schemas.defense_strategy import DefenseStrategyCreate, DefenseStrategyResponse
from app.services.defense import DefenseRegistry


class DefenseService:
    @staticmethod
    def _validate_config(config_json: Dict[str, Any]):
        algorithm = (config_json or {}).get("algorithm")
        if not algorithm or not isinstance(algorithm, str):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="config_json.algorithm is required",
            )
        if algorithm not in DefenseRegistry.available():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown defense algorithm '{algorithm}'. Available: {DefenseRegistry.available()}",
            )

    @staticmethod
    def list_algorithms() -> List[str]:
        return DefenseRegistry.available()

    @staticmethod
    def create(data: DefenseStrategyCreate) -> DefenseStrategyResponse:
        DefenseService._validate_config(data.config_json)
        if DefenseStrategyRepository.exists_by_name(data.name):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Defense strategy '{data.name}' already exists",
            )
        strategy_id = DefenseStrategyRepository.create(data.model_dump())
        created = DefenseStrategyRepository.get(strategy_id)
        return DefenseStrategyResponse(**created)

    @staticmethod
    def list() -> List[DefenseStrategyResponse]:
        return [DefenseStrategyResponse(**item) for item in DefenseStrategyRepository.list()]

    @staticmethod
    def get(strategy_id: str) -> DefenseStrategyResponse:
        strategy = DefenseStrategyRepository.get(strategy_id)
        if not strategy:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Defense strategy not found")
        return DefenseStrategyResponse(**strategy)

    @staticmethod
    def update(strategy_id: str, data: DefenseStrategyCreate) -> DefenseStrategyResponse:
        strategy = DefenseStrategyRepository.get(strategy_id)
        if not strategy:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Defense strategy not found")
        DefenseService._validate_config(data.config_json)
        DefenseStrategyRepository.update(strategy_id, data.model_dump())
        updated = DefenseStrategyRepository.get(strategy_id)
        return DefenseStrategyResponse(**updated)

    @staticmethod
    def delete(strategy_id: str):
        strategy = DefenseStrategyRepository.get(strategy_id)
        if not strategy:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Defense strategy not found")
        if DefenseStrategyRepository.count_referencing_tasks(strategy_id) > 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Defense strategy is in use by evaluation tasks; delete those tasks first",
            )
        DefenseStrategyRepository.delete(strategy_id)
