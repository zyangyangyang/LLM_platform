from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    系统全局配置类
    使用 Pydantic BaseSettings 管理环境变量和默认值
    """
    app_name: str = "Safety Platform"
    api_prefix: str = "/api"
    
    # Security 安全配置
    secret_key: str = "change_this_to_a_secure_random_key_in_production"  # 用于JWT签名的密钥，生产环境务必更换为强随机字符串
    algorithm: str = "HS256"  # JWT签名算法
    access_token_expire_minutes: int = 60  # Token过期时间（分钟）
    
    # Database 数据库配置
    db_host: str = "127.0.0.1"
    db_port: int = 3306
    db_user: str = "root"
    db_password: str = "123456"
    db_name: str = "safety_platform"
    db_charset: str = "utf8mb4"
    max_concurrent_runs: int = 2

    # Model Presets 预置模型配置 (JSON 字符串格式)
    # 格式: [{"id": "gpt-4", "name": "GPT-4 (Platform)", "provider": "openai", "endpoint": "...", "auth_secret_ref": "env_var_name"}]
    model_presets_json: str = "[{\"id\":\"qwen-plus\",\"name\":\"qwen-plus\",\"provider\":\"openai\",\"endpoint\":\"https://dashscope.aliyuncs.com/compatible-mode/v1\",\"auth_type\":\"bearer\",\"auth_secret_ref\":\"DASHSCOPE_API_KEY\",\"params_json\":{\"temperature\":0.2,\"max_tokens\":512}}]"
    # 可写入多个模型配置，每个配置包含模型ID、名称、供应商、API Endpoint、认证类型和认证密钥引用

    # Dataset Presets 预置数据集配置 (JSON 字符串格式)
    # 格式: [{"id": "safety-v1", "name": "Safety Benchmark v1", "description": "...", "source_type": "file_upload", "storage_uri": "..."}]
    dataset_presets_json: str = "[{\"id\":\"entity-relation-hallucination-v1\",\"name\":\"实体关系抽取幻觉测评\",\"description\":\"实体关系抽取幻觉评测数据集\",\"source_type\":\"file_upload\",\"storage_uri\":\"d:\\\\LLM_platform\\\\实体关系抽取幻觉测评数据集.json\",\"schema_json\":{\"prompt_field\":\"description\"}}]"

    # 配置 Pydantic 加载环境变量的行为：前缀为 SAFETY_，读取 .env 文件
    model_config = SettingsConfigDict(env_prefix="SAFETY_", env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    """
    获取单例配置对象，避免重复读取环境变量
    """
    return Settings()
