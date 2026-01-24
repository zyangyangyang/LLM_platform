from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm
from app.services.auth_service import AuthService
from app.schemas.user import UserCreate, Token, UserResponse
from app.api.deps import get_current_user
from typing import Dict, Any

router = APIRouter()

@router.post("/register", response_model=Dict[str, Any])
def register(user: UserCreate):
    return AuthService.register_user(user)

@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    return AuthService.authenticate_user(form_data.username, form_data.password)

@router.get("/users/me", response_model=Dict[str, Any])
def read_users_me(current_user: Dict[str, Any] = Depends(get_current_user)):
    # Remove password hash before returning
    current_user_data = current_user.copy()
    current_user_data.pop("password_hash", None)
    return current_user_data
