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
    access_token_expire_minutes: int = 30  # Token过期时间（分钟）
    
    # Database 数据库配置
    db_host: str = "127.0.0.1"
    db_port: int = 3306
    db_user: str = "root"
    db_password: str = "123456"
    db_name: str = "safety_platform"
    db_charset: str = "utf8mb4"

    # Model Presets 预置模型配置 (JSON 字符串格式)
    # 格式: [{"id": "gpt-4", "name": "GPT-4 (Platform)", "provider": "openai", "endpoint": "...", "auth_secret_ref": "env_var_name"}]
    model_presets_json: str = "[{\"id\":\"Qwen-plus\",\"name\":\"Qwen-plus\",\"provider\":\"openai\",\"endpoint\":\"https://dashscope.aliyuncs.com/compatible-mode/v1\",\"auth_type\":\"bearer\",\"auth_secret_ref\":\"sk-f047c83aef464c6582b3226de15889be\",\"params_json\":{\"temperature\":0.2,\"max_tokens\":512}}]"
    # 可写入多个模型配置，每个配置包含模型ID、名称、供应商、API Endpoint、认证类型和认证密钥引用
    # 配置 Pydantic 加载环境变量的行为：前缀为 SAFETY_，读取 .env 文件
    model_config = SettingsConfigDict(env_prefix="SAFETY_", env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    """
    获取单例配置对象，避免重复读取环境变量
    """
    return Settings()
