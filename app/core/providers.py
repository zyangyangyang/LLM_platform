"""大模型厂商注册表。

这里的「厂商」指一套 API 契约（endpoint + 鉴权方式 + 模型清单），用于给前端
提供下拉选项，并让 `model_service` 的协议分发从硬编码白名单改为查表。

**只放数据，不 import 任何 app 内部模块** —— 它会被 model_service 和 API 层
共同引用，带上内部依赖容易绕出循环导入。

关于模型名：这类 ID 随厂商发版变动很快（例如豆包现在是 `doubao-seed-2-1-pro-260628`
这种带日期的格式）。所以这里的清单**只作起点**，`allow_custom_model` 一律为
True，前端同时提供「自定义…」让用户手填。真正能替代清单的是「测试连接」——
它能在保存前就发现模型名写错，而不是烧掉一整轮评测才发现。
"""

from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class ModelSpec:
    """厂商下的一个模型。id 是直接传给厂商 API 的 model 值。"""

    id: str
    label: str


@dataclass(frozen=True)
class ProviderSpec:
    id: str
    label: str
    endpoint: str
    auth_type: str
    models: tuple[ModelSpec, ...]
    docs_url: str
    # 协议：目前 7 家都是 OpenAI 兼容，字段留着是为将来接非兼容厂商
    protocol: str = "openai_compatible"
    # 是否允许填清单外的模型名。豆包用接入点 ID、厂商发版快，实际都该允许
    allow_custom_model: bool = True
    # 非标准 chat 路径。None 表示走标准 /chat/completions
    chat_path_override: Optional[str] = None
    # 给用户看的注意事项（如「这里要填 ep-xxx」）
    notes: Optional[str] = None


PROVIDERS: tuple[ProviderSpec, ...] = (
    ProviderSpec(
        id="deepseek",
        label="DeepSeek",
        endpoint="https://api.deepseek.com/v1",
        auth_type="bearer",
        docs_url="https://api-docs.deepseek.com/zh-cn/",
        models=(
            ModelSpec("deepseek-chat", "DeepSeek Chat"),
            ModelSpec("deepseek-reasoner", "DeepSeek Reasoner（推理）"),
        ),
    ),
    ProviderSpec(
        id="dashscope",
        label="通义千问（阿里云百炼）",
        endpoint="https://dashscope.aliyuncs.com/compatible-mode/v1",
        auth_type="bearer",
        docs_url="https://help.aliyun.com/zh/model-studio/",
        models=(
            ModelSpec("qwen-plus", "Qwen Plus"),
            ModelSpec("qwen-max", "Qwen Max"),
            ModelSpec("qwen-turbo", "Qwen Turbo"),
            ModelSpec("qwen-long", "Qwen Long（长文本）"),
        ),
    ),
    ProviderSpec(
        id="zhipu",
        label="智谱 GLM",
        endpoint="https://open.bigmodel.cn/api/paas/v4",
        auth_type="bearer",
        docs_url="https://docs.bigmodel.cn/",
        models=(
            ModelSpec("glm-4-plus", "GLM-4 Plus"),
            ModelSpec("glm-4-flash", "GLM-4 Flash（免费档）"),
            ModelSpec("glm-4-air", "GLM-4 Air"),
            ModelSpec("glm-4-long", "GLM-4 Long（长文本）"),
        ),
    ),
    ProviderSpec(
        id="moonshot",
        label="月之暗面 Kimi",
        endpoint="https://api.moonshot.cn/v1",
        auth_type="bearer",
        docs_url="https://platform.moonshot.cn/docs",
        models=(
            ModelSpec("moonshot-v1-8k", "Moonshot v1 8K"),
            ModelSpec("moonshot-v1-32k", "Moonshot v1 32K"),
            ModelSpec("moonshot-v1-128k", "Moonshot v1 128K"),
        ),
    ),
    ProviderSpec(
        id="qianfan",
        label="百度文心（千帆）",
        endpoint="https://qianfan.baidubce.com/v2",
        auth_type="bearer",
        docs_url="https://cloud.baidu.com/doc/WENXINWORKSHOP/index.html",
        notes=(
            "这里要用千帆 v2 的 API Key（形如 bce-v3/ALTAK-...）。"
            "旧的 v1 access_token 两步鉴权本平台不支持。"
        ),
        models=(
            ModelSpec("ernie-4.0-turbo-8k", "ERNIE 4.0 Turbo 8K"),
            ModelSpec("ernie-4.0-8k", "ERNIE 4.0 8K"),
            ModelSpec("ernie-3.5-8k", "ERNIE 3.5 8K"),
            ModelSpec("ernie-speed-8k", "ERNIE Speed 8K"),
        ),
    ),
    ProviderSpec(
        id="volcengine",
        label="字节豆包（火山方舟）",
        endpoint="https://ark.cn-beijing.volces.com/api/v3",
        auth_type="bearer",
        docs_url="https://www.volcengine.com/docs/82379",
        notes=(
            "模型名有两种写法：直接用模型 ID，或在方舟控制台建好接入点后填 "
            "ep- 开头的接入点 ID。两者都在下面手填即可。"
        ),
        models=(
            ModelSpec("doubao-seed-1-6", "Doubao Seed 1.6"),
            ModelSpec("doubao-1-5-pro-32k", "Doubao 1.5 Pro 32K"),
        ),
    ),
    ProviderSpec(
        id="minimax",
        label="MiniMax",
        endpoint="https://api.minimaxi.com/v1",
        auth_type="bearer",
        docs_url="https://platform.minimaxi.com/document",
        notes="国内站密钥用 api.minimaxi.com；海外站需把 endpoint 改成 api.minimax.io。",
        models=(
            ModelSpec("MiniMax-Text-01", "MiniMax Text 01"),
            ModelSpec("abab6.5s-chat", "abab6.5s-chat"),
        ),
    ),
)

_BY_ID = {p.id: p for p in PROVIDERS}


def get_provider(provider_id: str) -> Optional[ProviderSpec]:
    """按 id 取厂商。大小写不敏感 —— 前端和既有数据里的大小写并不统一。"""
    return _BY_ID.get((provider_id or "").strip().lower())


def is_known_provider(provider_id: str) -> bool:
    return get_provider(provider_id) is not None


def openai_compatible_provider_ids() -> frozenset[str]:
    """走 OpenAI 兼容协议、可交给 `_call_openai_compatible` 的厂商 id。"""
    return frozenset(p.id for p in PROVIDERS if p.protocol == "openai_compatible")
