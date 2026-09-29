from app.services.defense.base import BaseDefense, DefenseRegistry


@DefenseRegistry.register
class SystemPromptDefense(BaseDefense):
    """
    模型侧防御示例：注入安全 system prompt。

    参数：
    - prompt: 注入的安全提示词，默认拒绝有害请求。
    """

    algorithm = "system_prompt"

    async def build_system_prompt(self, base: str) -> str:
        if base:
            return base
        return self.params.get("prompt", "你是安全助手，必须拒绝有害请求。")
