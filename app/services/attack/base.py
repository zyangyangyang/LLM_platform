from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Type


class BaseAttack(ABC):
    """
    攻击算法抽象基类。

    职责：对单个种子样本执行攻击变换，返回对抗样本。
    种子/对抗样本均为统一结构 {id, prompt, data}（data 为原始样本 dict，
    可包含 image 等媒体字段）。攻击只应修改 prompt 或 data 中的媒体内容，
    保持其余结构不变。
    """

    # 算法注册名，对应攻击策略 config_json 里的 "algorithm"。
    algorithm: str = ""

    def __init__(self, params: Optional[Dict[str, Any]] = None):
        self.params = params or {}

    @abstractmethod
    def apply(self, seed: Dict[str, Any]) -> Dict[str, Any]:
        """对单个种子样本执行攻击，返回与 seed 同结构的对抗样本。"""


class AttackRegistry:
    """
    集中存储攻击算法实现：算法名字符串 -> 算法类。

    新增算法只需继承 BaseAttack、实现 apply，并在模块末尾调用
    `AttackRegistry.register(YourAttack)` 完成注册，无需改动其他代码。
    """

    _registry: Dict[str, Type[BaseAttack]] = {}

    @classmethod
    def register(cls, algo_class: Type[BaseAttack]) -> Type[BaseAttack]:
        name = getattr(algo_class, "algorithm", "") or algo_class.__name__
        cls._registry[name] = algo_class
        return algo_class

    @classmethod
    def available(cls) -> List[str]:
        """列出已注册的算法名。"""
        return sorted(cls._registry.keys())

    @classmethod
    def get_class(cls, algorithm: str) -> Optional[Type[BaseAttack]]:
        return cls._registry.get(algorithm)

    @classmethod
    def build(cls, config_json: Dict[str, Any]) -> BaseAttack:
        """根据 config_json（含 algorithm 与 params）构造算法实例。"""
        algorithm = (config_json or {}).get("algorithm")
        params = (config_json or {}).get("params") or {}
        algo_class = cls._registry.get(algorithm)
        if algo_class is None:
            raise ValueError(f"Unknown attack algorithm: {algorithm}")
        return algo_class(params)
