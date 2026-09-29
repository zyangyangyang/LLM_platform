from typing import Any, Dict

from app.services.attack.base import AttackRegistry, BaseAttack


@AttackRegistry.register
class TextReplaceAttack(BaseAttack):
    """
    最简文本改写攻击：把种子 prompt 中的指定子串替换为攻击者指定内容。

    参数：
    - old: 要被替换的原始子串（如实体名"深圳"）
    - new: 替换后的内容（如"上海"）
    """

    algorithm = "text_replace"

    async def apply(self, seed: Dict[str, Any]) -> Dict[str, Any]:
        prompt = seed.get("prompt") or ""
        old = self.params.get("old", "")
        new = self.params.get("new", "")
        if old:
            prompt = str(prompt).replace(old, new)
        result = dict(seed)
        result["prompt"] = prompt
        return result
