import json
import os
from typing import List, Dict, Any, Optional
import httpx
from openai import AsyncOpenAI
from app.schemas.model_config import ModelConfigResponse
from app.utils.logger import get_logger

logger = get_logger(__name__)

class ModelService:
    """
    模型服务类
    处理与各类大模型 API 的交互逻辑，支持多厂商适配
    """

    @staticmethod
    async def call_model(
        config: ModelConfigResponse,
        messages: List[Dict[str, Any]],
        **kwargs
    ) -> str:
        """
        统一的模型调用入口，根据配置分发到不同的 Provider 处理
        
        :param config: 模型配置对象（包含 Endpoint, Key, Provider 等）
        :param messages: 对话消息列表 (role, content)
        :param kwargs: 额外的生成参数 (temp, max_tokens, etc.)
        :return: 生成的文本响应
        """
        provider = config.provider.lower()
        
        # 合并参数：优先使用运行时参数，其次使用配置中的默认参数
        params = dict(config.params_json or {})
        params.update(kwargs)
        
        logger.info(f"Calling model {config.name} ({provider}) at {config.endpoint}")

        if provider in ["openai", "azure", "deepseek", "vllm", "dashscope"]:
            # 处理 OpenAI 兼容接口 (包括 DeepSeek, vLLM 等)
            return await ModelService._call_openai_compatible(config, messages, params)
        elif provider == "huggingface":
            # 处理 HuggingFace Inference API
            return await ModelService._call_huggingface(config, messages, params)
        else:
            # 默认回退到通用 HTTP 请求
            return await ModelService._call_generic_http(config, messages, params)

    @staticmethod
    async def _call_openai_compatible(
        config: ModelConfigResponse,
        messages: List[Dict[str, Any]],
        params: Dict[str, Any]
    ) -> str:
        """
        调用 OpenAI 兼容格式的 API
        """
        api_key_ref = config.auth_secret_ref or "dummy"
        api_key = os.getenv(api_key_ref, api_key_ref)
        base_url = config.endpoint
        
        # 智能调整 base_url，适配用户可能输入的完整路径
        if base_url.endswith("/chat/completions"):
            base_url = base_url.replace("/chat/completions", "/v1")
        elif not base_url.endswith("/v1") and not base_url.endswith("/"):
             # 简单的启发式规则：如果没有 /v1 且不是根路径，可能需要调整
             pass 

        client = AsyncOpenAI(api_key=api_key, base_url=base_url)
        
        try:
            # 优先使用参数中的 model，否则使用配置名称
            model_name = params.get("model", config.name)
            request_params = dict(params)
            request_params.pop("model", None)
            
            response = await client.chat.completions.create(
                model=model_name,
                messages=messages,
                **request_params
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"OpenAI compatible API call failed: {str(e)}")
            raise e

    @staticmethod
    async def _call_huggingface(
        config: ModelConfigResponse,
        messages: List[Dict[str, str]],
        params: Dict[str, Any]
    ) -> str:
        """
        调用 HuggingFace Inference API
        """
        headers = {}
        if config.auth_secret_ref:
            headers["Authorization"] = f"Bearer {config.auth_secret_ref}"
            
        # HF 通常期望单个 prompt 字符串
        prompt = messages[-1]["content"] if messages else ""
        
        payload = {
            "inputs": prompt,
            "parameters": params
        }
        
        async with httpx.AsyncClient() as client:
            try:
                resp = await client.post(config.endpoint, json=payload, headers=headers, timeout=30.0)
                resp.raise_for_status()
                data = resp.json()
                # 解析 HF 返回格式
                if isinstance(data, list) and "generated_text" in data[0]:
                    return data[0]["generated_text"]
                return str(data)
            except Exception as e:
                logger.error(f"HuggingFace API call failed: {str(e)}")
                raise e

    @staticmethod
    async def _call_generic_http(
        config: ModelConfigResponse,
        messages: List[Dict[str, str]],
        params: Dict[str, Any]
    ) -> str:
        """
        通用的 HTTP POST 调用
        """
        headers = {"Content-Type": "application/json"}
        # 设置认证头
        if config.auth_type == "bearer" and config.auth_secret_ref:
            headers["Authorization"] = f"Bearer {config.auth_secret_ref}"
        elif config.auth_type == "api_key" and config.auth_secret_ref:
            headers["x-api-key"] = config.auth_secret_ref
            
        payload = {
            "messages": messages,
            "params": params
        }
        
        async with httpx.AsyncClient() as client:
            try:
                resp = await client.post(config.endpoint, json=payload, headers=headers, timeout=30.0)
                resp.raise_for_status()
                return resp.text
            except Exception as e:
                logger.error(f"Generic HTTP call failed: {str(e)}")
                raise e
