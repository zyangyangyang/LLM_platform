from typing import Any, Dict

from app.services.attack.base import AttackRegistry, BaseAttack


@AttackRegistry.register
class NoiseInjectionAttack(BaseAttack):
    """
    字符级噪声注入攻击：按固定间隔向 prompt 中插入噪声字符，
    诱导模型在带噪文本上出错。对任意样本内容通用。

    参数：
    - noise: 注入的噪声字符（默认 "#"）
    - every: 每隔 N 个字符注入一次（默认 4）
    """

    algorithm = "noise_injection"

    async def apply(self, seed: Dict[str, Any]) -> Dict[str, Any]:
        prompt = seed.get("prompt") or ""
        noise = self.params.get("noise", "#")
        every = int(self.params.get("every", 4) or 4)
        if every <= 0:
            every = 4

        chars: list[str] = []
        for idx, ch in enumerate(prompt):
            chars.append(ch)
            if (idx + 1) % every == 0:
                chars.append(noise)

        result = dict(seed)
        result["prompt"] = "".join(chars)
        return result
