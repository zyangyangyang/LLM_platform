from fastapi import HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from app.core.security import verify_password, get_password_hash, create_access_token
from app.repositories.user_repo import UserRepository
from app.schemas.user import UserCreate, UserUpdate, Token
from datetime import timedelta
from app.core.config import get_settings

settings = get_settings()

class AuthService:
    """
    认证服务层
    处理用户注册、登录验证和 Token 生成逻辑
    """
    
    @staticmethod
    def register_user(user: UserCreate) -> dict:
        """
        注册新用户
        1. 检查邮箱是否已存在
        2. 对密码进行哈希加密
        3. 存储用户信息
        """
        existing = UserRepository.get_by_email(user.email)
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
        
        hashed_pw = get_password_hash(user.password)
        user_data = {
            "email": user.email,
            "password_hash": hashed_pw,
            "name": user.name
        }
        user_id = UserRepository.create(user_data)
        UserRepository.assign_role(user_id, UserRepository.EVALUATOR_ROLE)
        return {
            "id": user_id,
            "email": user.email,
            "name": user.name,
            "roles": [UserRepository.EVALUATOR_ROLE],
        }

    @staticmethod
    def authenticate_user(username: str, password: str) -> Token:
        """
        验证用户凭据并生成 Token
        1. 根据邮箱查找用户
        2. 验证密码哈希是否匹配
        3. 验证通过则生成 JWT Access Token
        """
        user = UserRepository.get_by_email(username)
        if not user or not verify_password(password, user["password_hash"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # 设置 Token 过期时间
        access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
        # 生成 Token，Payload 中包含用户邮箱和 ID
        access_token = create_access_token(
            data={"sub": user["email"], "user_id": user["id"]},
            expires_delta=access_token_expires
        )
        return Token(access_token=access_token, token_type="bearer")

    @staticmethod
    def update_current_user(user_id: str, payload: UserUpdate) -> dict:
        """
        更新当前用户信息
        支持修改姓名、邮箱和密码
        """
        current_user = UserRepository.get_by_id(user_id)
        if not current_user:
            raise HTTPException(status_code=404, detail="User not found")

        update_data = {}
        incoming = payload.model_dump(exclude_unset=True)

        if "email" in incoming:
            new_email = incoming["email"]
            existing = UserRepository.get_by_email(new_email)
            if existing and existing["id"] != user_id:
                raise HTTPException(status_code=400, detail="Email already registered")
            update_data["email"] = new_email

        if "name" in incoming:
            new_name = (incoming["name"] or "").strip()
            if not new_name:
                raise HTTPException(status_code=400, detail="Name cannot be empty")
            update_data["name"] = new_name

        if "password" in incoming:
            new_password = incoming["password"] or ""
            if len(new_password) < 6:
                raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
            update_data["password_hash"] = get_password_hash(new_password)

        if update_data:
            UserRepository.update_user(user_id, update_data)

        updated = UserRepository.get_by_id(user_id)
        response = updated.copy() if updated else current_user.copy()
        response.pop("password_hash", None)
        return response
