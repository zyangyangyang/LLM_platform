from typing import Any, Dict

from app.services.attack.base import AttackRegistry, BaseAttack


@AttackRegistry.register
class PromptRewriteAttack(BaseAttack):
    """
    文本改写攻击：用参数化模板/前缀对种子 prompt 进行越狱式改写。

    参数：
    - template: 含 {prompt} 占位符的完整模板，占位符会被替换为种子 prompt。
    - prefix:   直接拼接到种子 prompt 前面的前缀（template 未提供时使用）。
    """

    algorithm = "prompt_rewrite"

    async def apply(self, seed: Dict[str, Any]) -> Dict[str, Any]:
        prompt = seed.get("prompt") or ""
        template = self.params.get("template")
        prefix = self.params.get("prefix")

        if template:
            new_prompt = str(template).replace("{prompt}", str(prompt))
        elif prefix:
            new_prompt = f"{prefix}{prompt}"
        else:
            new_prompt = prompt

        result = dict(seed)
        result["prompt"] = new_prompt
        return result
