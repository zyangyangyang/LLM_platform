from datetime import datetime, timedelta
from typing import Optional
from jose import jwt
from passlib.context import CryptContext
from app.core.config import get_settings

settings = get_settings()
# 配置密码哈希上下文，使用 bcrypt 算法
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    """
    验证明文密码与哈希密码是否匹配
    """
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    """
    生成密码哈希值
    """
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """
    创建 JWT 访问令牌
    :param data: 包含在 Payload 中的数据（如 user_id, email）
    :param expires_delta: 可选的过期时间增量
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    
    # 设置过期时间
    to_encode.update({"exp": expire})
    
    # 使用配置的密钥和算法进行编码
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return encoded_jwt
