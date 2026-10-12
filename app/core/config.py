from functools import lru_cache
from pathlib import Path
from typing import Optional
import os

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BASE_DIR.parent
APP_ENV_FILE = BASE_DIR / ".env"


def _load_env_file_to_os_environ(env_file: Path) -> None:
    """
    将 .env 中的键值对注入到 os.environ 中，确保代码里用 os.getenv(...) 读取
    到的是 .env 里的真实值（例如 DASHSCOPE_API_KEY，不带 SAFETY_ 前缀）。
    """
    try:
        if not env_file.exists():
            return

        content = env_file.read_text(encoding="utf-8", errors="ignore")
        for raw_line in content.splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip("'").strip('"')
            if key and value and key not in os.environ:
                os.environ[key] = value
    except Exception:
        # 启动阶段尽量不阻断服务
        return


# 在创建 Settings 之前就先把 .env 注入进当前进程环境中
_load_env_file_to_os_environ(APP_ENV_FILE)


class Settings(BaseSettings):
    app_name: str = "Safety Platform"
    api_prefix: str = "/api"

    # Security
    secret_key: str = "change_this_to_a_secure_random_key_in_production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    # 自带密钥（BYOK）的主密钥，Fernet 格式（urlsafe base64 的 32 字节）。
    # 生成：python -c "from cryptography.fernet import Fernet;print(Fernet.generate_key().decode())"
    #
    # 默认 None = 不启用 BYOK：用户仍只能用「环境变量名」引用运维预先配好的
    # 密钥，行为与加这个功能之前完全一致。这样没配主密钥的部署不会因为升级
    # 而挂掉，只是用不了自带密钥。
    #
    # 支持逗号分隔多个密钥：第一个用于加密，全部参与解密 —— 轮换时把新密钥
    # 放最前面、旧密钥留在后面，正在用的密文照样解得开，无需停机。
    secret_encryption_key: Optional[str] = None

    # Database
    db_host: str = "127.0.0.1"
    db_port: int = 3306
    db_user: str = "root"
    db_password: str = "123456"
    db_name: str = "safety_platform"
    db_charset: str = "utf8mb4"

    # Runtime
    max_concurrent_runs: int = 2
    stale_running_timeout_minutes: int = 10

    # Celery / Redis
    celery_broker_url: str = "redis://127.0.0.1:6379/0"
    celery_result_backend: str = "redis://127.0.0.1:6379/1"
    celery_worker_prefetch_multiplier: int = 1

    # Model rate limiting
    model_rate_limit_enabled: bool = True
    model_rate_limit_rps: int = 3
    model_rate_limit_wait_timeout_seconds: int = 10
    model_rate_limit_redis_db: int = 2
    model_rate_limit_requeue_delay_seconds: int = 3

    # Model presets
    model_presets_json: str = (
        "[{\"id\":\"qwen-plus\",\"name\":\"qwen-plus\",\"provider\":\"openai\","
        "\"endpoint\":\"https://dashscope.aliyuncs.com/compatible-mode/v1\","
        "\"auth_type\":\"bearer\",\"auth_secret_ref\":\"DASHSCOPE_API_KEY\","
        "\"params_json\":{\"temperature\":0.2,\"max_tokens\":512}}]"
    )

    semantic_judge_model_json: str = (
        "{\"name\":\"semantic-judge\",\"provider\":\"openai\","
        "\"endpoint\":\"https://dashscope.aliyuncs.com/compatible-mode/v1\","
        "\"auth_type\":\"bearer\",\"auth_secret_ref\":\"DASHSCOPE_API_KEY1\","
        "\"params_json\":{\"model\":\"qwen3.8-flash\",\"temperature\":0,\"max_tokens\":8}}"
    )

    # Dataset presets
    dataset_presets_json: str = (
        "["
        "{\"id\":\"entity-relation-hallucination-v1\","
        "\"name\":\"Entity Relation Hallucination\","
        "\"description\":\"Entity relation extraction hallucination benchmark\","
        "\"source_type\":\"file_upload\","
        f"\"storage_uri\":\"{(PROJECT_ROOT / 'entity_relation_hallucination.json').as_posix()}\","
        # label_field 决定结果页「按标注分组通过率」怎么分组。不配就会走
        # _extract_label_text 的兜底键名，而这个数据集的 label 字段恒为「是」，
        # 于是那张图会退化成孤零零一根柱子。真正有区分度的是 hallucination_type。
        "\"schema_json\":{\"prompt_field\":\"description\","
        "\"label_field\":\"hallucination_type\"}},"
        "{\"id\":\"prompt-attack-v1\","
        "\"name\":\"Prompt Attack Benchmark\","
        "\"description\":\"Prompt injection and jailbreak benchmark\","
        "\"source_type\":\"file_upload\","
        f"\"storage_uri\":\"{(PROJECT_ROOT / 'prompt_attack_dataset.json').as_posix()}\","
        # 同上：这个数据集的 label 恒为 harmful，兜底取到它只会画出一根柱子。
        # category 有 27 个类别（每类 80 条），才是这张图该分的组。
        "\"schema_json\":{\"prompt_field\":\"malicious_prompt\","
        "\"label_field\":\"category\"}},"
        "{\"id\":\"multimodal-attack-v1-100\","
        "\"name\":\"Multimodal Attack 100\","
        "\"description\":\"First 100 samples from multimodal attack dataset\","
        "\"source_type\":\"file_upload\","
        f"\"storage_uri\":\"{(PROJECT_ROOT / 'multimodal_attack_100.json').as_posix()}\","
        "\"schema_json\":{\"prompt_field\":\"adversarial.question\"}}"
        "]"
    )

    @property
    def secret_encryption_keys(self) -> list[str]:
        """解析出主密钥列表：第一个用于加密，全部用于解密。

        跳过空串，免得 `KEY_A,,KEY_B` 这种手滑写法把 MultiFernet 弄崩。
        """
        raw = (self.secret_encryption_key or "").strip()
        if not raw:
            return []
        return [k.strip() for k in raw.split(",") if k.strip()]

    @property
    def byok_enabled(self) -> bool:
        """是否允许用户自带密钥。未配主密钥时为 False。"""
        return bool(self.secret_encryption_keys)

    # 固定读取 app/.env，避免从不同工作目录启动时读取错配置文件
    model_config = SettingsConfigDict(
        env_prefix="SAFETY_",
        env_file=str(APP_ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
