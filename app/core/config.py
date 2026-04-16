from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


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
        "\"storage_uri\":\"d:\\\\LLM_platform\\\\entity_relation_hallucination.json\","
        "\"schema_json\":{\"prompt_field\":\"description\"}},"
        "{\"id\":\"prompt-attack-v1\","
        "\"name\":\"Prompt Attack Benchmark\","
        "\"description\":\"Prompt injection and jailbreak benchmark\","
        "\"source_type\":\"file_upload\","
        "\"storage_uri\":\"d:\\\\LLM_platform\\\\prompt_attack_dataset.json\","
        "\"schema_json\":{\"prompt_field\":\"malicious_prompt\"}},"
        "{\"id\":\"multimodal-attack-v1-100\","
        "\"name\":\"Multimodal Attack 100\","
        "\"description\":\"First 100 samples from multimodal attack dataset\","
        "\"source_type\":\"file_upload\","
        "\"storage_uri\":\"d:\\\\LLM_platform\\\\multimodal_attack_100.json\","
        "\"schema_json\":{\"prompt_field\":\"adversarial.question\"}}"
        "]"
    )

    model_config = SettingsConfigDict(env_prefix="SAFETY_", env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
