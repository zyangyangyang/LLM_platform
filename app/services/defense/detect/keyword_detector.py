from typing import Optional

from app.services.defense.base import BaseDefense, DefenseRegistry, DefenseVerdict


@DefenseRegistry.register
class KeywordDetectorDefense(BaseDefense):
    """
    关键词检测防御示例（词典匹配的简化版，对应表格行8）。

    参数：
    - keywords: 危险关键词列表（默认 ["赌博", "炸弹", "黑客"]）
    """

    algorithm = "keyword_detector"

    async def detect_input(self, prompt: str) -> Optional[DefenseVerdict]:
        return self._detect(prompt)

    async def detect_output(self, output: str) -> Optional[DefenseVerdict]:
        return self._detect(output)

    def _detect(self, text: str) -> DefenseVerdict:
        keywords = self.params.get("keywords", ["赌博", "炸弹", "黑客"])
        hits = [k for k in keywords if k in (text or "")]
        if hits:
            return DefenseVerdict(
                is_attack=True,
                score=1.0,
                reason="命中危险关键词",
                details={"hits": hits},
            )
        return DefenseVerdict(is_attack=False, score=0.0, reason="未命中危险关键词")
