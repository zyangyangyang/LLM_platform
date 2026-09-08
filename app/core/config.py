from functools import lru_cache
from pathlib import Path
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

    # Database
    db_host: str = "127.0.0.1"
    db_port: int = 3306
    db_user: str = "root"
    db_password: str = "123456"
    db_name: str = "safety_platform"
    db_charset: str = "utf8mb4"

    # Runtime
    max_concurrent_runs: int = 2
    stale_running_timeout_minutes: int = 60

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
        "\"auth_type\":\"bearer\",\"auth_secret_ref\":\"DASHSCOPE_API_KEY\","
        "\"params_json\":{\"model\":\"qwen-max\",\"temperature\":0,\"max_tokens\":8}}"
    )

    # Dataset presets
    dataset_presets_json: str = (
        "["
        "{\"id\":\"entity-relation-hallucination-v1\","
        "\"name\":\"Entity Relation Hallucination\","
        "\"description\":\"Entity relation extraction hallucination benchmark\","
        "\"source_type\":\"file_upload\","
        f"\"storage_uri\":\"{(PROJECT_ROOT / 'entity_relation_hallucination.json').as_posix()}\","
        "\"schema_json\":{\"prompt_field\":\"description\"}},"
        "{\"id\":\"prompt-attack-v1\","
        "\"name\":\"Prompt Attack Benchmark\","
        "\"description\":\"Prompt injection and jailbreak benchmark\","
        "\"source_type\":\"file_upload\","
        f"\"storage_uri\":\"{(PROJECT_ROOT / 'prompt_attack_dataset.json').as_posix()}\","
        "\"schema_json\":{\"prompt_field\":\"malicious_prompt\"}},"
        "{\"id\":\"multimodal-attack-v1-100\","
        "\"name\":\"Multimodal Attack 100\","
        "\"description\":\"First 100 samples from multimodal attack dataset\","
        "\"source_type\":\"file_upload\","
        f"\"storage_uri\":\"{(PROJECT_ROOT / 'multimodal_attack_100.json').as_posix()}\","
        "\"schema_json\":{\"prompt_field\":\"adversarial.question\"}}"
        "]"
    )

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
