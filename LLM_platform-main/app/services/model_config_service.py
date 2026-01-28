import json
import os
from typing import List, Optional, Dict, Any
from fastapi import HTTPException, status
from app.core.config import get_settings
from app.repositories.model_config_repo import ModelConfigRepository
from app.repositories.project_repo import ProjectRepository
from app.schemas.model_config import ModelConfigCreate, ModelConfigResponse

class ModelConfigService:
    """
    模型配置服务层
    处理模型配置的 CRUD 操作及权限控制
    """
    
    @staticmethod
    def _check_project_access(project_id: str, user_id: str):
        """
        内部辅助方法：检查用户是否有权访问项目
        """
        project = ProjectRepository.get_by_id(project_id)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )
        
        is_owner = project["owner_id"] == user_id
        is_member = ProjectRepository.is_member(project_id, user_id)
        
        if not (is_owner or is_member):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access this project"
            )
        return project

    @staticmethod
    def list_presets() -> List[Dict[str, Any]]:
        """
        获取平台预置模型列表
        """
        settings = get_settings()
        try:
            presets = json.loads(settings.model_presets_json)
            # 过滤敏感信息，不直接返回 endpoint 或 环境变量名
            safe_presets = []
            for p in presets:
                safe_presets.append({
                    "id": p.get("id"),
                    "name": p.get("name"),
                    "provider": p.get("provider"),
                    "description": p.get("description", "Platform preset model")
                })
            return safe_presets
        except json.JSONDecodeError:
            return []

    @staticmethod
    def create_from_preset(project_id: str, preset_id: str, user_id: str) -> ModelConfigResponse:
        """
        根据预置模型创建用户配置
        """
        # 1. 检查项目权限
        ModelConfigService._check_project_access(project_id, user_id)

        # 2. 查找预置模型配置
        settings = get_settings()
        try:
            presets = json.loads(settings.model_presets_json)
            preset = next((p for p in presets if p["id"] == preset_id), None)
            if not preset:
                raise HTTPException(status_code=404, detail="Preset model not found")
        except json.JSONDecodeError:
            raise HTTPException(status_code=500, detail="Invalid system configuration")

        # 3. 解析预置模型的鉴权信息 (从环境变量读取 Key)
        auth_secret_ref = None
        if preset.get("auth_secret_ref"):
            env_var = preset["auth_secret_ref"]
            auth_secret_ref = os.getenv(env_var) # 这里直接把环境变量的值取出来存入库 (简单做法)
            # 更安全的做法是存 env_var 的引用，然后在 ModelService 里解析，但目前架构是存值的。
            # 为了安全，这里我们暂时假设 auth_secret_ref 存的是实际 Key，
            # 或者我们约定：如果 auth_type='env'，则 auth_secret_ref 存变量名。
            # 为了兼容现有逻辑，我们先把环境变量的值读出来存进去。
            if not auth_secret_ref:
                 # 如果环境变量没配，可能导致调用失败
                 pass 

        # 4. 创建配置
        model_in = ModelConfigCreate(
            project_id=project_id,
            name=preset["name"],
            provider=preset["provider"],
            endpoint=preset["endpoint"],
            auth_type=preset.get("auth_type", "bearer"),
            auth_secret_ref=auth_secret_ref,
            params_json=preset.get("params_json", {})
        )
        
        return ModelConfigService.create_model_config(model_in, user_id)

    @staticmethod
    def create_model_config(model_in: ModelConfigCreate, user_id: str) -> ModelConfigResponse:
        """
        创建模型配置
        先验证项目权限，再写入数据库
        """
        ModelConfigService._check_project_access(model_in.project_id, user_id)
        
        model_data = model_in.dict()
        model_id = ModelConfigRepository.create(model_data)
        
        # Fetch the created record to return full response
        created_model = ModelConfigRepository.get_by_id(model_id)
        if not created_model:
             raise HTTPException(status_code=500, detail="Failed to create model config")
             
        return ModelConfigResponse(**created_model)

    @staticmethod
    def list_project_models(project_id: str, user_id: str) -> List[ModelConfigResponse]:
        """
        列出指定项目下的所有模型配置
        """
        ModelConfigService._check_project_access(project_id, user_id)
        
        models = ModelConfigRepository.list_by_project(project_id)
        return [ModelConfigResponse(**m) for m in models]

    @staticmethod
    def get_model_config(model_id: str, user_id: str) -> ModelConfigResponse:
        """
        获取单个模型配置详情
        会自动检查该配置所属项目的访问权限
        """
        model = ModelConfigRepository.get_by_id(model_id)
        if not model:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Model config not found"
            )
        
        # Check access to the project this model belongs to
        ModelConfigService._check_project_access(model["project_id"], user_id)
        
        return ModelConfigResponse(**model)

    @staticmethod
    def delete_model_config(model_id: str, user_id: str):
        """
        删除模型配置
        """
        model = ModelConfigRepository.get_by_id(model_id)
        if not model:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Model config not found"
            )
            
        ModelConfigService._check_project_access(model["project_id"], user_id)
        
        ModelConfigRepository.delete(model_id)
