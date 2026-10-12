import json
from typing import Any, Dict, List, Optional

from fastapi import HTTPException, status

from app.core.config import get_settings
from app.core.crypto import (
    ENC_PREFIX,
    CredentialCryptoError,
    encrypt_secret,
    fingerprint,
    is_encrypted,
)
from app.repositories.audit_repo import AuditRepository
from app.repositories.model_config_repo import ModelConfigRepository
from app.repositories.platform_preset_repo import PlatformPresetRepository
from app.schemas.model_config import (
    ModelConfigCreate,
    ModelConfigInternal,
    ModelConfigResponse,
    ModelConfigUpdate,
)
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
    def _audit_meta(
        model: Dict[str, Any],
        api_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        """构造审计用的 meta：只放定位信息与密钥**指纹**，绝不放密钥本身。

        凭证那一项按三种情形分别标注：
        - 本次提交了自带密钥 -> 记 "byok" + 指纹（能判断是不是换了把新钥匙）
        - 库里存的是密文     -> 记 "encrypted"，密文本身不外泄
        - 其余（环境变量名） -> 记 "env_var"，名字不是秘密，可直接留

        None/空值一律剔除，免得审计里全是 null 噪音。
        """
        meta: Dict[str, Any] = {
            "name": model.get("name"),
            "provider": model.get("provider"),
            "endpoint": model.get("endpoint"),
        }
        params = model.get("params_json")
        if isinstance(params, dict):
            meta["model"] = params.get("model")

        if api_key:
            meta["credential"] = "byok"
            # 指纹不可逆：够用来判断「还是原来那把钥匙吗」，但还原不出密钥
            meta["key_fingerprint"] = fingerprint(api_key)
        elif model.get("auth_secret_ref"):
            meta["credential"] = (
                "encrypted" if is_encrypted(model["auth_secret_ref"]) else "env_var"
            )

        return {k: v for k, v in meta.items() if v not in (None, "")}

    @staticmethod
    def _resolve_credential(
        auth_secret_ref: Optional[str],
        api_key: Optional[str],
        allow_encrypted_ref: bool = False,
    ) -> Optional[str]:
        """把两种凭证形态统一成要落库的那个值。

        - 只给 `api_key`：加密成 `enc:v1:...` 落库（自带密钥）
        - 只给 `auth_secret_ref`：原样存（约定是环境变量名，由运维预先配好）
        - 两个都给：400 —— 否则无法判断该用哪把钥匙，静默取其一早晚出事故
        - 都不给：存 NULL（例如不需要鉴权的自建服务）

        `allow_encrypted_ref` 供「从平台预置物化」这条路径使用：平台预置可能
        自带密文密钥，复制到用户配置时必须放行。用户直接 POST 时则不放行 ——
        密文只能由本平台生成，允许外部写入等于给了一条绕过加密逻辑的口子。
        """
        has_api_key = bool((api_key or "").strip())
        has_ref = bool((auth_secret_ref or "").strip())

        if has_api_key and has_ref:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Provide either api_key or auth_secret_ref, not both",
            )

        if not has_api_key:
            if has_ref and is_encrypted(auth_secret_ref) and not allow_encrypted_ref:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "auth_secret_ref must be an environment variable name; "
                        "use api_key to supply your own credential"
                    ),
                )
            return auth_secret_ref or None

        if not get_settings().byok_enabled:
            # 部署方没配主密钥。说清楚原因，别让用户以为是自己的 key 有问题。
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="BYOK is not enabled on this server",
            )

        try:
            return encrypt_secret(api_key)
        except CredentialCryptoError as exc:
            # 该异常的文案已保证不含明文与密文，可直接外传
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
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
    def _to_platform_preset_response(row: Dict[str, Any]) -> PlatformModelPresetResponse:
        """平台预置对外不返回 auth_secret_ref，只暴露是否已配置密钥。"""
        data = dict(row)
        data["has_auth_secret"] = bool(data.get("auth_secret_ref"))
        data.pop("auth_secret_ref", None)
        return PlatformModelPresetResponse(**data)

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
        AuditRepository.record(
            admin_user_id,
            "create_platform_preset",
            "platform_model_preset",
            resource_id=preset_id,
            meta=ModelConfigService._audit_meta(created or preset_in.model_dump()),
        )
        return ModelConfigService._to_platform_preset_response(created)

    @staticmethod
    def list_platform_presets() -> List[PlatformModelPresetResponse]:
        """列出 DB 中的平台预置模型（区别于配置文件里的内置预置）。"""
        return [
            ModelConfigService._to_platform_preset_response(row)
            for row in PlatformPresetRepository.list_model_presets()
        ]

    @staticmethod
    def _to_platform_key_response(row: Dict[str, Any]) -> PlatformModelKeyResponse:
        """平台密钥的对外形态：不回密文，只让管理员认出「这是自带密钥」。"""
        data = dict(row)
        raw = data.get("secret_ref")
        data["has_secret"] = bool(raw)
        if is_encrypted(raw):
            data["secret_ref"] = f"{ENC_PREFIX}***"
        return PlatformModelKeyResponse(**data)

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
        # 平台 Key 池是共享凭证，动它必须留痕。这里同样只记形态与标签，
        # secret_ref 本身（环境变量名或密文）都不进审计表。
        AuditRepository.record(
            admin_user_id,
            "create_platform_model_key",
            "platform_model_key",
            resource_id=key_id,
            meta={
                "preset_id": preset_id,
                "label": key_in.label,
                "credential": "encrypted" if is_encrypted(key_in.secret_ref) else "env_var",
            },
        )
        return ModelConfigService._to_platform_key_response(created)

    @staticmethod
    def list_platform_model_keys(preset_id: str) -> List[PlatformModelKeyResponse]:
        preset = PlatformPresetRepository.get_model_preset(preset_id)
        if not preset:
            raise HTTPException(status_code=404, detail="Preset model not found")
        keys = PlatformPresetRepository.list_model_keys(preset_id)
        return [ModelConfigService._to_platform_key_response(item) for item in keys]

    # admin_user_id 不给默认值：删凭证是必须留痕的操作，默认值会让调用方
    # 漏传时静默退化成「无主体」记录
    @staticmethod
    def delete_platform_model_key(preset_id: str, key_id: str, admin_user_id: str):
        preset = PlatformPresetRepository.get_model_preset(preset_id)
        if not preset:
            raise HTTPException(status_code=404, detail="Preset model not found")
        key = PlatformPresetRepository.get_model_key(key_id)
        if not key or key.get("model_preset_id") != preset_id:
            raise HTTPException(status_code=404, detail="Model key not found")
        PlatformPresetRepository.delete_model_key(key_id)
        # 删凭证是最需要留痕的操作：事后要能回答「这把钥匙是谁、什么时候撤的」
        AuditRepository.record(
            admin_user_id,
            "delete_platform_model_key",
            "platform_model_key",
            resource_id=key_id,
            meta={
                "preset_id": preset_id,
                "label": key.get("label"),
                "credential": "encrypted" if is_encrypted(key.get("secret_ref")) else "env_var",
            },
        )

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

        return ModelConfigService.create_model_config(
            model_in,
            user_id,
            allow_preset_name=True,
            # 平台预置里可能就是密文，复制过来要放行
            allow_encrypted_ref=True,
        )

    @staticmethod
    def create_model_config(
        model_in: ModelConfigCreate,
        user_id: str,
        allow_preset_name: bool = False,
        allow_encrypted_ref: bool = False,
    ) -> ModelConfigResponse:
        ModelConfigService._check_user_access(model_in.user_id, user_id)
        ModelConfigService._check_name_unique(model_in.name, user_id, allow_preset_name=allow_preset_name)

        payload = model_in.model_dump()
        # api_key 是纯入参，既不入库也不进任何响应
        api_key = payload.pop("api_key", None)
        payload["auth_secret_ref"] = ModelConfigService._resolve_credential(
            payload.get("auth_secret_ref"),
            api_key,
            allow_encrypted_ref=allow_encrypted_ref,
        )

        model_id = ModelConfigRepository.create(payload)
        created_model = ModelConfigRepository.get_by_id(model_id)
        if not created_model:
            raise HTTPException(status_code=500, detail="Failed to create model config")
        # 传 api_key 是为了拿到指纹：库里存的已是密文，从它算不出指纹
        AuditRepository.record(
            user_id,
            "create_model_config",
            "model_config",
            resource_id=model_id,
            meta=ModelConfigService._audit_meta(created_model, api_key),
        )
        return ModelConfigService._to_response(created_model)

    @staticmethod
    def update_model_config(
        model_id: str,
        model_in: ModelConfigUpdate,
        user_id: str,
    ) -> ModelConfigResponse:
        """部分更新模型配置。只有显式传入的字段会被改动。"""
        model = ModelConfigRepository.get_by_id(model_id)
        if not model:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Model config not found",
            )
        ModelConfigService._check_user_access(model["user_id"], user_id)

        # exclude_unset：PATCH 语义 —— 没传的字段保持原值，而不是被 None 覆盖
        payload = model_in.model_dump(exclude_unset=True)
        clear_key = payload.pop("clear_key", False)
        api_key = payload.pop("api_key", None)
        has_new_ref = "auth_secret_ref" in payload
        new_ref = payload.get("auth_secret_ref")

        if clear_key and (bool((api_key or "").strip()) or bool((new_ref or "").strip())):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="clear_key cannot be combined with api_key or auth_secret_ref",
            )

        if clear_key:
            payload["auth_secret_ref"] = None
        elif api_key is not None or has_new_ref:
            payload["auth_secret_ref"] = ModelConfigService._resolve_credential(
                new_ref, api_key
            )

        new_name = payload.get("name")
        if new_name and new_name != model["name"]:
            ModelConfigService._check_name_unique(
                new_name,
                user_id,
                # 由平台预置物化出来的配置允许重名，与创建路径保持一致
                allow_preset_name=bool(model.get("platform_preset_id")),
            )

        # 空 payload 不报错：PATCH 什么都没改是合法请求，返回当前值即可。
        # 注意 execute() 返回的是**实际改变**的行数，所以不能拿它判断存在性。
        ModelConfigRepository.update(model_id, payload)
        updated = ModelConfigRepository.get_by_id(model_id)
        if not updated:
            raise HTTPException(status_code=500, detail="Failed to update model config")

        meta = ModelConfigService._audit_meta(updated, api_key)
        # 记「改了哪些字段」而不是值：审计要的是可追溯，不是把配置再抄一份
        changed = sorted(set(payload) - {"auth_secret_ref"})
        if clear_key:
            meta["credential"] = "cleared"
        if clear_key or api_key is not None or has_new_ref:
            changed.append("credential")
        meta["changed_fields"] = sorted(set(changed))

        AuditRepository.record(
            user_id,
            "update_model_config",
            "model_config",
            resource_id=model_id,
            meta=meta,
        )
        return ModelConfigService._to_response(updated)

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
        # model 是删除前读出来的，删完就读不到了
        AuditRepository.record(
            user_id,
            "delete_model_config",
            "model_config",
            resource_id=model_id,
            meta=ModelConfigService._audit_meta(model),
        )

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
