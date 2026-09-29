import importlib
import pkgutil

from app.services.defense.base import DefenseRegistry, BaseDefense


def _discover_defenses():
    """自动发现并导入本包下所有子模块，触发各算法文件的装饰器注册。

    新增算法只需在 defense/ 下任意子目录放一个 .py 文件，
    无需手动修改本文件或任何 __init__.py。
    """
    import app.services.defense as package
    for module_info in pkgutil.walk_packages(package.__path__, prefix="app.services.defense."):
        importlib.import_module(module_info.name)


_discover_defenses()

__all__ = ["BaseDefense", "DefenseRegistry"]
