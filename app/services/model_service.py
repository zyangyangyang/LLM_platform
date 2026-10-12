import asyncio
import os
import re
import time
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse, urlunparse

import httpx
import openai
from openai import AsyncOpenAI
from redis import asyncio as redis_asyncio

from app.core.config import get_settings
from app.core.crypto import CredentialCryptoError, decrypt_secret, is_encrypted
from app.core.providers import openai_compatible_provider_ids
from app.repositories.platform_preset_repo import PlatformPresetRepository
from app.schemas.model_config import ModelConfigInternal
from app.utils.logger import get_logger

logger = get_logger(__name__)

# 历史上走 OpenAI 兼容分支的 provider 值。这些值有些并不在厂商注册表里
# （openai / azure / vllm 是自建或中转场景，用户手填的），但库里已有数据，
# 必须继续按兼容协议调用 —— 否则升级会把既有配置打到通用 HTTP 兜底分支上。
_LEGACY_OPENAI_PROVIDERS = frozenset({"openai", "azure", "deepseek", "vllm", "dashscope"})


def _is_openai_compatible(provider: str) -> bool:
    """是否可按 OpenAI 兼容协议调用：历史白名单 ∪ 注册表里的兼容厂商。"""
    return (
        provider in _LEGACY_OPENAI_PROVIDERS
        or provider in openai_compatible_provider_ids()
    )


# 厂商异常文案里可能夹着密钥片段。实测过的三种形状：
#   OpenAI   : "Incorrect API key provided: sk-proj-abc***xyz"
#   DeepSeek : "Your api key: ****6789 is invalid"   <- 只回显末四位
#   千帆     : "Invalid token bce-v3/ALTAK-..."
# 最后一种最容易被漏掉：它既不长得像 key，也不够长，但依然是密钥的一部分。
# 凡是要把厂商报错写进日志、数据库或响应的地方，都得先过这道。
_SECRET_LIKE = re.compile(
    r"("
    r"sk-[A-Za-z0-9_\-]{6,}"          # OpenAI 风格
    r"|bce-v3/[A-Za-z0-9_\-/]{6,}"    # 百度千帆
    r"|\*{2,}[A-Za-z0-9]{2,}"         # 厂商自打的掩码，如 ****6789
    r"|[A-Za-z0-9]{32,}"              # 无法归类但足够长的串
    r")"
)


def redact_secret_like(text: str, limit: int = 200) -> str:
    """抹掉形似凭证的片段并截断空白，用于安全地转述厂商报错。

    这是纵深防御：即使某家厂商改了文案、开始回显密钥，也不会顺着日志、
    `score_json.error`、`eval_task_runs.error_message` 流到前端。
    """
    collapsed = " ".join((text or "").split())
    return _SECRET_LIKE.sub("***", collapsed)[:limit]


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
        config: ModelConfigInternal,
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

        if _is_openai_compatible(provider):
            return await ModelService._call_openai_compatible(config, messages, params)
        if provider == "huggingface":
            return await ModelService._call_huggingface(config, messages, params)
        return await ModelService._call_generic_http(config, messages, params)

    @staticmethod
    def _classify_probe_error(exc: Exception) -> Tuple[str, str]:
        """把调用异常翻译成前端可分支的 error_code + 中文说明。

        **鉴权失败一律用固定文案**，不回传厂商原文 —— 那是密钥最容易被回显的
        位置；其余情况保留厂商信息，因为「模型名不对」「额度用尽」这些细节
        恰恰是用户唯一能据此改对配置的线索。
        """
        if isinstance(exc, ModelRateLimitExceeded):
            return "rate_limited", "本平台对该模型的调用频率限制已触发，请稍后重试"
        if isinstance(exc, (openai.AuthenticationError, openai.PermissionDeniedError)):
            return "unauthorized", "API Key 无效，或无权访问该模型"
        if isinstance(exc, openai.RateLimitError):
            return "rate_limited", redact_secret_like(
                f"厂商侧限流或额度不足：{exc}"
            )
        if isinstance(exc, openai.NotFoundError):
            return "not_found", redact_secret_like(
                f"模型名或接口地址不存在：{exc}"
            )
        if isinstance(exc, (openai.APITimeoutError, asyncio.TimeoutError)):
            return "timeout", "请求厂商接口超时"
        if isinstance(exc, (openai.APIConnectionError, httpx.ConnectError, httpx.ConnectTimeout)):
            return "network", redact_secret_like(f"无法连接厂商接口：{exc}")
        if isinstance(exc, openai.BadRequestError):
            return "bad_response", redact_secret_like(f"厂商拒绝了该请求：{exc}")
        if isinstance(exc, openai.APIStatusError):
            return "bad_response", redact_secret_like(
                f"厂商返回异常状态 {exc.status_code}：{exc}"
            )
        # 本模块自己抛的凭据错误（环境变量没配、密文解不开）也归到这里：
        # 对用户来说都属于「这把钥匙用不了」，且这些文案已保证不含密钥。
        if isinstance(exc, ValueError):
            return "unauthorized", redact_secret_like(f"凭据不可用：{exc}")
        return "bad_response", redact_secret_like(f"调用失败：{exc}")

    @staticmethod
    async def test_connection(
        config: ModelConfigInternal,
        timeout: float = 15.0,
    ) -> Dict[str, Any]:
        """用一次极小的真实调用验证模型配置是否可用。

        结果一律作为数据返回、不抛异常 —— 调用方据此返回 200 + ok=false，
        前端才能把「测试不通过」和「接口本身出错」区分开。

        这是 BYOK 体验闭环的关键：key 写错、模型名写错、豆包漏了 `ep-` 前缀
        这几类问题，不测的话要等跑完一整轮评测才暴露，而一轮评测很贵。
        """
        started = time.monotonic()

        def elapsed() -> int:
            return int((time.monotonic() - started) * 1000)

        try:
            # 只覆盖 max_tokens（探针要便宜），不覆盖 temperature：
            # 推理模型（deepseek-reasoner 等）收到 temperature 会直接 400，探针就会
            # 报「厂商拒绝了该请求」，而配置本身没问题 —— 探针的假阴性比不测更坏，
            # 用户会照着这个错误去改一个本来正确的配置。
            # 配置里自己写死的 temperature 仍会经 params_json 透传，那种情况该报错。
            reply = await asyncio.wait_for(
                ModelService.call_model(
                    config,
                    [{"role": "user", "content": "ping"}],
                    max_tokens=8,
                ),
                timeout=timeout,
            )
        except Exception as exc:
            code, message = ModelService._classify_probe_error(exc)
            return {
                "ok": False,
                "latency_ms": elapsed(),
                "reply_preview": None,
                "error_code": code,
                "error_message": message,
            }

        preview = " ".join((reply or "").split())[:100]
        return {
            "ok": True,
            "latency_ms": elapsed(),
            "reply_preview": preview,
            "error_code": None,
            "error_message": None,
        }

    @staticmethod
    def effective_generation_params(
        config: ModelConfigInternal,
        params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """算出这次调用**实际会发出去**的生成参数。

        存在的意义是让「发出去的请求」和「留档的快照」共用同一份真相。此前
        `model` 的解析规则（取 params_json 的 model，取不到回落 config.name）只写在
        `_call_openai_compatible` 里，别处再想复述一遍就只能靠抄 —— 抄漏一处，
        运行记录里记的模型名就和实际调的不是一个，复现时被带偏。

        返回的 dict 里 `model` 一定是**真正会用的那个名字**，而不是配置名。
        """
        merged: Dict[str, Any] = dict(config.params_json or {})
        if params:
            merged.update(params)
        # 空串也当没配：发一个空 model 给厂商必然报错，回落比原样送出去有用
        merged["model"] = merged.get("model") or config.name
        return merged

    @staticmethod
    def _rate_limit_key(config: ModelConfigInternal, params: Dict[str, Any]) -> str:
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
    async def _acquire_rate_limit(config: ModelConfigInternal, params: Dict[str, Any]):
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
        config: ModelConfigInternal,
        messages: List[Dict[str, Any]],
        params: Dict[str, Any],
    ) -> str:
        """
        调用 OpenAI 兼容 Chat Completions API。

        说明：
        - 密钥有两种来源（见 `_resolve_secret_ref`）：环境变量名，或用户自带的、
          加密存储的密钥。无论哪种，明文都不会出现在日志、响应或异常里。
        - endpoint 若以 '/chat/completions' 结尾，会规范化到 '/v1'。
        - 请求模型名优先使用 params['model']，否则使用 config.name。
        """
        api_key = await ModelService._resolve_model_api_key(config)
        base_url = config.endpoint

        if base_url.endswith("/chat/completions"):
            base_url = base_url.replace("/chat/completions", "/v1")
        elif not base_url.endswith("/v1") and not base_url.endswith("/"):
            # 自定义兼容网关可能不是 /v1 形式，这里保持原样。
            pass

        client = AsyncOpenAI(api_key=api_key, base_url=base_url)

        try:
            # 走同一个解析函数：留档的 model 与实际请求的 model 不可能再分叉
            effective = ModelService.effective_generation_params(config, params)
            model_name = effective.pop("model")
            request_params = effective

            response = await client.chat.completions.create(
                model=model_name,
                messages=messages,
                **request_params,
            )
            return response.choices[0].message.content
        except Exception as e:
            # 必须脱敏后再记日志：厂商的 401 文案里常常回显被调用的 key
            # （OpenAI 就是 "Incorrect API key provided: sk-...***"），
            # 日志文件同样不该留下密钥片段。
            logger.error(
                f"OpenAI compatible API call failed: {redact_secret_like(str(e), limit=500)}"
            )
            raise e

    @staticmethod
    async def _call_huggingface(
        config: ModelConfigInternal,
        messages: List[Dict[str, str]],
        params: Dict[str, Any],
    ) -> str:
        """
        调用 HuggingFace Inference API。
        """
        headers = {}
        if config.auth_type != "none":
            headers["Authorization"] = f"Bearer {await ModelService._resolve_model_api_key(config)}"

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
                logger.error(
                    f"HuggingFace API call failed: {redact_secret_like(str(e), limit=500)}"
                )
                raise e

    @staticmethod
    async def _call_generic_http(
        config: ModelConfigInternal,
        messages: List[Dict[str, str]],
        params: Dict[str, Any],
    ) -> str:
        """
        通用 HTTP POST 兜底通道（用于自定义模型网关）。
        """
        headers = {"Content-Type": "application/json"}
        if config.auth_type == "bearer":
            headers["Authorization"] = f"Bearer {await ModelService._resolve_model_api_key(config)}"
        elif config.auth_type == "api_key":
            headers["x-api-key"] = await ModelService._resolve_model_api_key(config)

        payload = {"messages": messages, "params": params}

        async with httpx.AsyncClient() as client:
            try:
                resp = await client.post(config.endpoint, json=payload, headers=headers, timeout=30.0)
                resp.raise_for_status()
                return resp.text
            except Exception as e:
                logger.error(
                    f"Generic HTTP call failed: {redact_secret_like(str(e), limit=500)}"
                )
                raise e

    @staticmethod
    def _resolve_secret_ref(secret_ref: Optional[str]) -> str:
        """解析出真正的密钥明文。

        `auth_secret_ref` 有两种形态，靠 `enc:v1:` 前缀区分：
        - 密文：用户自带密钥（BYOK），现场解密，明文只在这一刻存在于内存
        - 其他：环境变量名，由运维预先配好
        """
        if not secret_ref:
            raise ValueError("Model auth_secret_ref is required")

        if is_encrypted(secret_ref):
            try:
                return decrypt_secret(secret_ref)
            except CredentialCryptoError as exc:
                # 异常文案已保证不含明文与密文，可以安全地进入调用栈
                raise ValueError(str(exc)) from None

        value = os.getenv(secret_ref)
        if not value:
            raise ValueError(f"Model secret env var is not configured: {secret_ref}")
        return value

    @staticmethod
    async def _resolve_model_api_key(config: ModelConfigInternal) -> str:
        secret_ref = await ModelService._select_secret_ref(config)
        return ModelService._resolve_secret_ref(secret_ref)

    @staticmethod
    async def _select_secret_ref(config: ModelConfigInternal) -> Optional[str]:
        if not config.platform_preset_id:
            return config.auth_secret_ref

        keys = PlatformPresetRepository.list_active_model_keys(config.platform_preset_id)
        if not keys:
            return config.auth_secret_ref

        redis_client = await ModelService._get_rate_limit_redis()
        if redis_client is None:
            return keys[0]["secret_ref"]

        cursor_key = f"model_key_cursor:{config.platform_preset_id}"
        try:
            cursor = await redis_client.incr(cursor_key)
            selected = keys[(int(cursor) - 1) % len(keys)]
            return selected["secret_ref"]
        except Exception as e:
            logger.warning(f"Select model key from redis failed, fallback to first key: {e}")
            return keys[0]["secret_ref"]
