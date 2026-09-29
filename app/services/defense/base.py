from abc import ABC
from typing import Any, Dict, List, Optional, Type


class BaseDefense(ABC):
    """
    防御算法抽象基类。

    与攻击算法不同，防御在评测管线的三个阶段设卡拦截：
    - apply_input:          输入侧（prompt 进模型前）
    - build_system_prompt:  模型侧（加固 system prompt）
    - apply_output:         输出侧（模型输出后）
    各 hook 默认原样返回，子类按需覆盖。
    """

    # 算法注册名，对应防御策略 config_json 里的 "algorithm"。
    algorithm: str = ""

    def __init__(self, params: Optional[Dict[str, Any]] = None):
        self.params = params or {}

    def apply_input(self, prompt: str) -> str:
        """输入侧防御：对进入模型的 prompt 做清洗/检测。"""
        return prompt

    def build_system_prompt(self, base: str) -> str:
        """模型侧防御：加固 system prompt。"""
        return base

    def apply_output(self, output: str) -> str:
        """输出侧防御：对模型输出做检测/改写。"""
        return output


class DefenseRegistry:
    """
    集中存储防御算法实现：算法名字符串 -> 算法类。

    新增算法只需继承 BaseDefense、覆盖所需 hook，并在模块末尾调用
    `DefenseRegistry.register(YourDefense)` 完成注册，无需改动其他代码。
    """

    _registry: Dict[str, Type[BaseDefense]] = {}

    @classmethod
    def register(cls, algo_class: Type[BaseDefense]) -> Type[BaseDefense]:
        name = getattr(algo_class, "algorithm", "") or algo_class.__name__
        cls._registry[name] = algo_class
        return algo_class

    @classmethod
    def available(cls) -> List[str]:
        """列出已注册的算法名。"""
        return sorted(cls._registry.keys())

    @classmethod
    def build(cls, config_json: Dict[str, Any]) -> BaseDefense:
        """根据 config_json（含 algorithm 与 params）构造算法实例。"""
        algorithm = (config_json or {}).get("algorithm")
        params = (config_json or {}).get("params") or {}
        algo_class = cls._registry.get(algorithm)
        if algo_class is None:
            raise ValueError(f"Unknown defense algorithm: {algorithm}")
        return algo_class(params)
