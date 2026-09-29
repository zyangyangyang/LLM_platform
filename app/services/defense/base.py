from abc import ABC
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Type


@dataclass
class DefenseVerdict:
    """
    防御检测结果。

    字段：
    - is_attack: 是否判定为攻击/危险
    - score:     风险分数（0~1）
    - reason:    判定理由 / 命中明细
    - details:   额外明细（如困惑度值、命中词列表）
    """

    is_attack: bool = False
    score: float = 0.0
    reason: str = ""
    details: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "is_attack": self.is_attack,
            "score": self.score,
            "reason": self.reason,
            "details": self.details,
        }


class BaseDefense(ABC):
    """
    防御算法抽象基类。

    两类 hook（均为异步，子类按需覆盖）：
    - 变换类（默认原样返回）：
        apply_input          输入侧，清洗进入模型的 prompt
        build_system_prompt  模型侧，加固 system prompt
        apply_output         输出侧，净化/改写模型输出
    - 检测类（默认不检测，返回 None）：
        detect_input         输入侧，判定 prompt 是否为攻击
        detect_output        输出侧，判定模型输出是否危险/异常
    """

    algorithm: str = ""

    def __init__(self, params: Optional[Dict[str, Any]] = None):
        self.params = params or {}

    async def apply_input(self, prompt: str) -> str:
        return prompt

    async def build_system_prompt(self, base: str) -> str:
        return base

    async def apply_output(self, output: str) -> str:
        return output

    async def detect_input(self, prompt: str) -> Optional[DefenseVerdict]:
        return None

    async def detect_output(self, output: str) -> Optional[DefenseVerdict]:
        return None


class DefenseRegistry:
    """
    集中存储防御算法实现：算法名字符串 -> 算法类。

    新增算法只需继承 BaseDefense、覆盖所需 hook，并用装饰器注册：

        @DefenseRegistry.register
        class MyDefense(BaseDefense):
            algorithm = "my_defense"
            async def detect_input(self, prompt): ...

    算法文件放在本包任意子目录下即会被自动发现导入，
    无需手动修改任何 __init__.py。
    """

    _registry: Dict[str, Type[BaseDefense]] = {}

    @classmethod
    def register(cls, algo_class: Type[BaseDefense]) -> Type[BaseDefense]:
        name = getattr(algo_class, "algorithm", "") or algo_class.__name__
        cls._registry[name] = algo_class
        return algo_class

    @classmethod
    def available(cls) -> List[str]:
        return sorted(cls._registry.keys())

    @classmethod
    def build(cls, config_json: Dict[str, Any]) -> BaseDefense:
        algorithm = (config_json or {}).get("algorithm")
        params = (config_json or {}).get("params") or {}
        algo_class = cls._registry.get(algorithm)
        if algo_class is None:
            raise ValueError(f"Unknown defense algorithm: {algorithm}")
        return algo_class(params)
