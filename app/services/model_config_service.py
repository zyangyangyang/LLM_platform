import json
from typing import Any, Dict, List

from fastapi import HTTPException, status

from app.core.config import get_settings
from app.repositories.model_config_repo import ModelConfigRepository
from app.repositories.platform_preset_repo import PlatformPresetRepository
from app.schemas.model_config import ModelConfigCreate, ModelConfigInternal, ModelConfigResponse
from app.schemas.platform_preset import PlatformModelPresetCreate, PlatformModelPresetResponse
from app.schemas.platform_preset import PlatformModelKeyCreate, PlatformModelKeyResponse


class ModelConfigService:
    @staticmethod
    def _check_user_access(resource_user_id: str, user_id: str):
        if resource_user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access this resource",
            )

    @staticmethod
    def _load_settings_presets() -> List[Dict[str, Any]]:
        settings = get_settings()
        try:
            presets = json.loads(settings.model_presets_json)
            return presets if isinstance(presets, list) else []
        except json.JSONDecodeError:
            return []

    @staticmethod
    def _check_name_unique(name: str, user_id: str, allow_preset_name: bool = False):
        if not allow_preset_name and any(p.get("name") == name for p in ModelConfigService._load_settings_presets()):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Model name '{name}' conflicts with a preset model",
            )
        if ModelConfigRepository.exists_by_user_and_name(user_id, name):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Model name '{name}' already exists",
            )

    @staticmethod
    def list_presets() -> List[Dict[str, Any]]:
        safe_presets: List[Dict[str, Any]] = []
        for preset in ModelConfigService._load_settings_presets():
            safe_presets.append(
                {
                    "id": preset.get("id"),
                    "name": preset.get("name"),
                    "provider": preset.get("provider"),
                    "description": preset.get("description", "Platform preset model"),
                }
            )
        for preset in PlatformPresetRepository.list_model_presets():
            safe_presets.append(
                {
                    "id": preset.get("id"),
                    "name": preset.get("name"),
                    "provider": preset.get("provider"),
                    "description": preset.get("description", "Platform preset model"),
                }
            )
        return safe_presets

    @staticmethod
    def create_platform_preset(
        preset_in: PlatformModelPresetCreate,
        admin_user_id: str,
    ) -> PlatformModelPresetResponse:
        preset_id = PlatformPresetRepository.create_model_preset(
            preset_in.model_dump(),
            admin_user_id,
        )
        created = PlatformPresetRepository.get_model_preset(preset_id)
        data = dict(created)
        data["has_auth_secret"] = bool(data.get("auth_secret_ref"))
        data.pop("auth_secret_ref", None)
        return PlatformModelPresetResponse(**data)

    @staticmethod
    def create_platform_model_key(
        preset_id: str,
        key_in: PlatformModelKeyCreate,
        admin_user_id: str,
    ) -> PlatformModelKeyResponse:
        preset = PlatformPresetRepository.get_model_preset(preset_id)
        if not preset:
            raise HTTPException(status_code=404, detail="Preset model not found")
        key_id = PlatformPresetRepository.create_model_key(
            preset_id,
            key_in.model_dump(),
            admin_user_id,
        )
        created = PlatformPresetRepository.get_model_key(key_id)
        return PlatformModelKeyResponse(**created)

    @staticmethod
    def list_platform_model_keys(preset_id: str) -> List[PlatformModelKeyResponse]:
        preset = PlatformPresetRepository.get_model_preset(preset_id)
        if not preset:
            raise HTTPException(status_code=404, detail="Preset model not found")
        keys = PlatformPresetRepository.list_model_keys(preset_id)
        return [PlatformModelKeyResponse(**item) for item in keys]

    @staticmethod
    def delete_platform_model_key(preset_id: str, key_id: str):
        preset = PlatformPresetRepository.get_model_preset(preset_id)
        if not preset:
            raise HTTPException(status_code=404, detail="Preset model not found")
        key = PlatformPresetRepository.get_model_key(key_id)
        if not key or key.get("model_preset_id") != preset_id:
            raise HTTPException(status_code=404, detail="Model key not found")
        PlatformPresetRepository.delete_model_key(key_id)

    @staticmethod
    def create_from_preset(preset_id: str, user_id: str) -> ModelConfigResponse:
        platform_preset_id = None
        preset = next(
            (p for p in ModelConfigService._load_settings_presets() if p.get("id") == preset_id),
            None,
        )
        if not preset:
            preset = PlatformPresetRepository.get_model_preset(preset_id)
            if preset:
                platform_preset_id = preset_id
        if not preset:
            raise HTTPException(status_code=404, detail="Preset model not found")

        model_in = ModelConfigCreate(
            user_id=user_id,
            name=preset["name"],
            provider=preset["provider"],
            endpoint=preset["endpoint"],
            auth_type=preset.get("auth_type", "bearer"),
            auth_secret_ref=preset.get("auth_secret_ref"),
            params_json=preset.get("params_json", {}),
            platform_preset_id=platform_preset_id,
        )

        return ModelConfigService.create_model_config(model_in, user_id, allow_preset_name=True)

    @staticmethod
    def create_model_config(model_in: ModelConfigCreate, user_id: str, allow_preset_name: bool = False) -> ModelConfigResponse:
        ModelConfigService._check_user_access(model_in.user_id, user_id)
        ModelConfigService._check_name_unique(model_in.name, user_id, allow_preset_name=allow_preset_name)
        model_id = ModelConfigRepository.create(model_in.model_dump())
        created_model = ModelConfigRepository.get_by_id(model_id)
        if not created_model:
            raise HTTPException(status_code=500, detail="Failed to create model config")
        return ModelConfigService._to_response(created_model)

    @staticmethod
    def list_user_models(user_id: str) -> List[ModelConfigResponse]:
        models = ModelConfigRepository.list_by_user(user_id)
        return [ModelConfigService._to_response(m) for m in models]

    @staticmethod
    def get_model_config(model_id: str, user_id: str) -> ModelConfigResponse:
        model = ModelConfigRepository.get_by_id(model_id)
        if not model:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Model config not found",
            )

        ModelConfigService._check_user_access(model["user_id"], user_id)
        return ModelConfigService._to_response(model)

    @staticmethod
    def delete_model_config(model_id: str, user_id: str):
        model = ModelConfigRepository.get_by_id(model_id)
        if not model:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Model config not found",
            )

        ModelConfigService._check_user_access(model["user_id"], user_id)
        if ModelConfigRepository.count_referencing_tasks(model_id) > 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Model config is in use by evaluation tasks; delete those tasks first",
            )
        ModelConfigRepository.delete(model_id)

    @staticmethod
    def get_model_config_internal(model_id: str) -> ModelConfigInternal:
        model = ModelConfigRepository.get_by_id(model_id)
        if not model:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Model config not found",
            )
        return ModelConfigInternal(**model)

    @staticmethod
    def _to_response(model: Dict[str, Any]) -> ModelConfigResponse:
        data = dict(model)
        data["has_auth_secret"] = bool(data.get("auth_secret_ref"))
        data.pop("auth_secret_ref", None)
        return ModelConfigResponse(**data)
