import logging
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path

_LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
_MAX_BYTES = 5 * 1024 * 1024
_BACKUP_COUNT = 5

# 全局唯一的文件 handler 实例，由 _install_file_handler 创建并复用
_file_handler: RotatingFileHandler | None = None


def _detect_role() -> str:
    """给日志文件分个角色名，区分「谁在写」。

    同一套代码会以两种身份跑起来：uvicorn 的 API 进程和 celery 的 worker 进程。
    让它们往同一个文件写，轮转时会互相踩——Windows 上尤其明显，轮转要重命名
    文件，而另一个进程正开着它，直接 PermissionError，日志线程静默死掉。
    分开写既绕开这个，也让排查时一眼看出是 API 报的还是 worker 报的。
    """
    argv = " ".join(sys.argv).lower()
    if "celery" in argv:
        return "worker"
    if "uvicorn" in argv:
        return "api"
    return "app"


def _log_dir() -> Path:
    # app/utils/logger.py -> parents[2] 是项目根
    return Path(__file__).resolve().parents[2] / "logs"


# uvicorn 用 dictConfig 配自己的 logger 时设了 propagate=False，这些日志压根到不了
# root。而「服务起不来」的报错往往正是它们打的（端口占用、import 失败），所以必须
# 单独挂上去，不能只靠 root。
#
# 只挂这两个顶层 logger，不要挂 uvicorn.error —— uvicorn 默认配置里没给它设
# propagate，所以它默认为 True，会自己写一遍再往父级 uvicorn 传一遍。两个都挂上
# 同一个 handler，每条日志就会在文件里出现两次。
_EXTRA_LOGGERS = (
    "uvicorn",
    "uvicorn.access",
)


def _install_file_handler() -> Path:
    """把滚动文件 handler 挂到 root 和几个「不传播」的具名 logger 上。

    挂 root 是为了收 get_logger 以及 pymysql / httpx 这类第三方库的日志；
    额外挂的那几个是因为它们 propagate=False，绕过 root 自成一路。
    """
    global _file_handler

    path = _log_dir() / f"{_detect_role()}.log"
    path.parent.mkdir(parents=True, exist_ok=True)
    filename = str(path)

    # 全局只保留一个 handler 实例：多个实例会让同一行日志被写多遍
    if _file_handler is None or getattr(_file_handler, "baseFilename", None) != filename:
        _file_handler = RotatingFileHandler(
            path,
            maxBytes=_MAX_BYTES,
            backupCount=_BACKUP_COUNT,
            encoding="utf-8",
            # 延迟到第一次真正写日志时才建文件，免得空跑一次也留个 0 字节文件
            delay=True,
        )
        _file_handler.setFormatter(logging.Formatter(_LOG_FORMAT))

    # 必须**逐个 logger** 判断，不能用「任一 logger 已有就整体返回」的写法：
    # Celery 的 dictConfig 会单独替换 root 的 handlers（_file_handler 从 root 上被
    # 摘掉），但 uvicorn 那几个 logger 上的没动。整体判断会因为后者已存在而直接返回，
    # root 就再也补不回来了——worker 的日志于是永远进不了文件。
    for logger in [logging.getLogger()] + [logging.getLogger(n) for n in _EXTRA_LOGGERS]:
        if _file_handler not in logger.handlers:
            logger.addHandler(_file_handler)
        # 默认 WARNING，不抬到 INFO 的话大部分日志会被拦在 handler 之前
        if logger.level == logging.NOTSET or logger.level > logging.INFO:
            logger.setLevel(logging.INFO)
    return path


def attach_file_handler() -> None:
    """（重新）挂上文件 handler。幂等，可反复调用。

    单独暴露出来是因为 Celery：它启动 worker 时会跑一次自己的 dictConfig，那份
    配置里带 'root' 条目，会**整个替换掉 root 的 handlers**，把 import 阶段挂上去的
    这个冲掉。所以 worker 那边必须在 Celery 配置完日志之后再调一次（见
    app/workers/celery_app.py 的 signal 回调）。
    """
    try:
        _install_file_handler()
    except Exception as exc:  # pragma: no cover
        print(f"[logger] 文件日志挂载失败: {exc}", file=sys.stderr)


def _install_excepthook() -> None:
    """未捕获异常也写进文件。

    excepthook 收到的是「冒到最外层、没人接」的异常——请求处理里漏掉的 bug 都
    是这一类。默认只打到 stderr，进程一重开就没了，而这恰恰是最需要事后翻查的。
    """
    previous = sys.excepthook

    def hook(exc_type, exc_value, exc_tb):
        if not issubclass(exc_type, KeyboardInterrupt):
            logging.getLogger("unhandled").critical(
                "未捕获异常", exc_info=(exc_type, exc_value, exc_tb)
            )
        previous(exc_type, exc_value, exc_tb)

    sys.excepthook = hook


try:
    LOG_FILE = _install_file_handler()
    _install_excepthook()
except Exception as exc:  # pragma: no cover
    # 目录不可写、磁盘满之类不该让整个服务起不来。退化成只有 stdout，并说清楚。
    LOG_FILE = None
    print(f"[logger] 文件日志初始化失败，仅输出到 stdout: {exc}", file=sys.stderr)


def get_logger(name: str):
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)

    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        formatter = logging.Formatter(_LOG_FORMAT)
        handler.setFormatter(formatter)
        logger.addHandler(handler)

    return logger
