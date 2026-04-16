import json
import os
import time
import asyncio
from urllib.parse import urlparse, urlunparse
from typing import List, Dict, Any, Optional
import httpx
from openai import AsyncOpenAI
from redis import asyncio as redis_asyncio
from app.schemas.model_config import ModelConfigResponse
from app.utils.logger import get_logger
from app.core.config import get_settings

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

        await ModelService._acquire_rate_limit(config, params)
        
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

    _redis_client: Optional[redis_asyncio.Redis] = None

    @staticmethod
    def _rate_limit_key(config: ModelConfigResponse, params: Dict[str, Any]) -> str:
        provider = (config.provider or "unknown").lower()
        model_name = str(params.get("model") or config.name or "unknown")
        current_second = int(time.time())
        return f"rate_limit:model:{provider}:{model_name}:{current_second}"

    @staticmethod
    async def _get_rate_limit_redis() -> Optional[redis_asyncio.Redis]:
        settings = get_settings()
        if ModelService._redis_client is not None:
            return ModelService._redis_client
        try:
            parsed = urlparse(settings.celery_broker_url)
            target_path = f"/{int(settings.model_rate_limit_redis_db)}"
            redis_url = urlunparse((parsed.scheme, parsed.netloc, target_path, "", "", ""))
            ModelService._redis_client = redis_asyncio.from_url(redis_url, decode_responses=True)
            return ModelService._redis_client
        except Exception as e:
            logger.warning(f"Init model rate limit redis failed, fallback to no-limit: {e}")
            return None

    @staticmethod
    async def _acquire_rate_limit(config: ModelConfigResponse, params: Dict[str, Any]):
        settings = get_settings()
        if not settings.model_rate_limit_enabled:
            return

        limit = max(1, int(settings.model_rate_limit_rps))
        timeout_seconds = max(1, int(settings.model_rate_limit_wait_timeout_seconds))
        deadline = time.monotonic() + timeout_seconds

        redis_client = await ModelService._get_rate_limit_redis()
        if redis_client is None:
            return

        while True:
            key = ModelService._rate_limit_key(config, params)
            try:
                count = await redis_client.incr(key)
                if count == 1:
                    await redis_client.expire(key, 1)
                if count <= limit:
                    return
            except Exception as e:
                logger.warning(f"Rate limit redis unavailable during acquire, fallback to no-limit: {e}")
                return

            if time.monotonic() >= deadline:
                raise RuntimeError(
                    f"Model rate limit exceeded: provider={config.provider}, model={params.get('model', config.name)}"
                )
            await asyncio.sleep(0.1)

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
