"""厂商注册表对外暴露的响应模型。

**刻意不含任何密钥字段**：厂商信息是公开目录，与用户凭证无关。前端需要的
「服务端是否支持自带密钥」由 `ProviderListResponse.byok_enabled` 单独给出，
它是个布尔值，不泄露主密钥本身。
"""

from typing import List, Optional

from pydantic import BaseModel


class ProviderModelResponse(BaseModel):
    """厂商下的一个可选模型。前端把它渲染成下拉项，末项接「自定义…」。"""

    id: str
    label: str


class ProviderResponse(BaseModel):
    id: str
    label: str
    protocol: str
    endpoint: str
    auth_type: str
    docs_url: str
    # 是否允许填清单外的模型名。豆包用 ep- 接入点 ID，这里恒为 True
    allow_custom_model: bool
    # 非标准 chat 路径；None 表示走标准 /chat/completions
    chat_path_override: Optional[str] = None
    # 给用户看的注意事项（如千帆只能用 v2 API Key）
    notes: Optional[str] = None
    models: List[ProviderModelResponse]


class ProviderListResponse(BaseModel):
    """`GET /api/providers` 的响应。

    包一层而不是直接返回数组，是为了顺带带上 `byok_enabled` —— 前端渲染
    「自带密钥」表单时需要它来决定输入框是否可用。否则要么多发一个请求，
    要么在前端硬编码一个后端才知道的事实。
    """

    providers: List[ProviderResponse]
    byok_enabled: bool
