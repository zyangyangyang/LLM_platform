import importlib
import pkgutil

from app.services.attack.base import AttackRegistry, BaseAttack


def _discover_attacks():
    """自动发现并导入本包下所有子模块，触发各算法文件的装饰器注册。

    新增算法只需在 attack/ 下任意子目录放一个 .py 文件，
    无需手动修改本文件或任何 __init__.py。
    """
    import app.services.attack as package
    for module_info in pkgutil.walk_packages(package.__path__, prefix="app.services.attack."):
        importlib.import_module(module_info.name)


_discover_attacks()

__all__ = ["BaseAttack", "AttackRegistry"]
