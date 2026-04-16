import asyncio
import os
import time
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse, urlunparse

import httpx
from openai import AsyncOpenAI
from redis import asyncio as redis_asyncio

from app.core.config import get_settings
from app.schemas.model_config import ModelConfigResponse
from app.utils.logger import get_logger

logger = get_logger(__name__)


class ModelRateLimitExceeded(RuntimeError):
    """模型调用触发限流且在等待超时内未获取到令牌。"""


class ModelService:
    """
    统一模型调用服务。

    职责：
    1. 根据 provider 分发到不同调用通道（OpenAI 兼容 / HuggingFace / 通用 HTTP）。
    2. 合并运行时参数与模型配置中的默认参数。
    3. 在发起外部模型请求前执行基于 Redis 的限流。
    """

    # 限流使用的 Redis 异步客户端（进程内复用）。
    _redis_client: Optional[redis_asyncio.Redis] = None

    @staticmethod
    async def call_model(
        config: ModelConfigResponse,
        messages: List[Dict[str, Any]],
        **kwargs,
    ) -> str:
        """
        模型调用统一入口。

        参数：
        - config：数据库中的模型配置。
        - messages：对话消息列表。
        - kwargs：运行时覆盖参数（如 temperature、max_tokens、model）。
        """
        provider = config.provider.lower()

        # 运行时参数优先级高于配置中的 params_json。
        params = dict(config.params_json or {})
        params.update(kwargs)

        # 按 provider+model 的秒级窗口限流，先拿到“调用许可”再发请求。
        await ModelService._acquire_rate_limit(config, params)

        logger.info(f"Calling model {config.name} ({provider}) at {config.endpoint}")

        if provider in ["openai", "azure", "deepseek", "vllm", "dashscope"]:
            return await ModelService._call_openai_compatible(config, messages, params)
        if provider == "huggingface":
            return await ModelService._call_huggingface(config, messages, params)
        return await ModelService._call_generic_http(config, messages, params)

    @staticmethod
    def _rate_limit_key(config: ModelConfigResponse, params: Dict[str, Any]) -> str:
        """
        生成固定窗口（1 秒）限流 Key。
        粒度：provider + 解析后的 model 名称。
        """
        provider = (config.provider or "unknown").lower()
        model_name = str(params.get("model") or config.name or "unknown")
        current_second = int(time.time())
        return f"rate_limit:model:{provider}:{model_name}:{current_second}"

    @staticmethod
    async def _get_rate_limit_redis() -> Optional[redis_asyncio.Redis]:
        """
        初始化限流 Redis 客户端（仅初始化一次）。

        连接来源：
        - 主机/端口/鉴权复用 celery_broker_url
        - DB 切换到 model_rate_limit_redis_db
        """
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
            # Fail-open：限流基础设施不可用时，不阻断模型调用。
            logger.warning(f"Init model rate limit redis failed, fallback to no-limit: {e}")
            return None

    @staticmethod
    async def _acquire_rate_limit(config: ModelConfigResponse, params: Dict[str, Any]):
        """
        Redis 固定窗口限流实现。

        行为：
        - 对当前秒窗口 Key 执行 INCR。
        - 首次命中时设置 TTL=1 秒。
        - 当 count <= limit 时立即放行。
        - 当 count > limit 时短暂 sleep 轮询，直到超时抛错。
        - Redis 异常时 fail-open（不阻断调用）。
        """
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
                raise ModelRateLimitExceeded(
                    f"Model rate limit exceeded: provider={config.provider}, model={params.get('model', config.name)}"
                )
            await asyncio.sleep(0.1)

    @staticmethod
    async def _call_openai_compatible(
        config: ModelConfigResponse,
        messages: List[Dict[str, Any]],
        params: Dict[str, Any],
    ) -> str:
        """
        调用 OpenAI 兼容 Chat Completions API。

        说明：
        - auth_secret_ref 优先按环境变量名解析，找不到则当作明文 key 使用。
        - endpoint 若以 '/chat/completions' 结尾，会规范化到 '/v1'。
        - 请求模型名优先使用 params['model']，否则使用 config.name。
        """
        api_key_ref = config.auth_secret_ref or "dummy"
        api_key = os.getenv(api_key_ref, api_key_ref)
        base_url = config.endpoint

        if base_url.endswith("/chat/completions"):
            base_url = base_url.replace("/chat/completions", "/v1")
        elif not base_url.endswith("/v1") and not base_url.endswith("/"):
            # 自定义兼容网关可能不是 /v1 形式，这里保持原样。
            pass

        client = AsyncOpenAI(api_key=api_key, base_url=base_url)

        try:
            model_name = params.get("model", config.name)
            request_params = dict(params)
            request_params.pop("model", None)

            response = await client.chat.completions.create(
                model=model_name,
                messages=messages,
                **request_params,
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"OpenAI compatible API call failed: {str(e)}")
            raise e

    @staticmethod
    async def _call_huggingface(
        config: ModelConfigResponse,
        messages: List[Dict[str, str]],
        params: Dict[str, Any],
    ) -> str:
        """
        调用 HuggingFace Inference API。
        """
        headers = {}
        if config.auth_secret_ref:
            headers["Authorization"] = f"Bearer {config.auth_secret_ref}"

        prompt = messages[-1]["content"] if messages else ""
        payload = {"inputs": prompt, "parameters": params}

        async with httpx.AsyncClient() as client:
            try:
                resp = await client.post(config.endpoint, json=payload, headers=headers, timeout=30.0)
                resp.raise_for_status()
                data = resp.json()
                if isinstance(data, list) and data and "generated_text" in data[0]:
                    return data[0]["generated_text"]
                return str(data)
            except Exception as e:
                logger.error(f"HuggingFace API call failed: {str(e)}")
                raise e

    @staticmethod
    async def _call_generic_http(
        config: ModelConfigResponse,
        messages: List[Dict[str, str]],
        params: Dict[str, Any],
    ) -> str:
        """
        通用 HTTP POST 兜底通道（用于自定义模型网关）。
        """
        headers = {"Content-Type": "application/json"}
        if config.auth_type == "bearer" and config.auth_secret_ref:
            headers["Authorization"] = f"Bearer {config.auth_secret_ref}"
        elif config.auth_type == "api_key" and config.auth_secret_ref:
            headers["x-api-key"] = config.auth_secret_ref

        payload = {"messages": messages, "params": params}

        async with httpx.AsyncClient() as client:
            try:
                resp = await client.post(config.endpoint, json=payload, headers=headers, timeout=30.0)
                resp.raise_for_status()
                return resp.text
            except Exception as e:
                logger.error(f"Generic HTTP call failed: {str(e)}")
                raise e
