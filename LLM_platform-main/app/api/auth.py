from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm
from app.services.auth_service import AuthService
from app.schemas.user import UserCreate, Token, UserResponse
from app.api.deps import get_current_user
from typing import Dict, Any

router = APIRouter()

@router.post("/register", response_model=Dict[str, Any])
def register(user: UserCreate):
    """
    用户注册接口
    接收邮箱、密码和姓名，创建新用户
    """
    return AuthService.register_user(user)

@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    用户登录接口 (OAuth2 兼容)
    接收 username (邮箱) 和 password，验证成功后返回 Access Token
    """
    return AuthService.authenticate_user(form_data.username, form_data.password)

@router.get("/users/me", response_model=Dict[str, Any])
def read_users_me(current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    获取当前登录用户信息
    需要携带有效的 Bearer Token
    """
    # Remove password hash before returning
    current_user_data = current_user.copy()
    current_user_data.pop("password_hash", None)
    return current_user_data
