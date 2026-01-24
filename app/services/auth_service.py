from fastapi import HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from app.core.security import verify_password, get_password_hash, create_access_token
from app.repositories.user_repo import UserRepository
from app.schemas.user import UserCreate, UserLogin, Token
from datetime import timedelta
from app.core.config import get_settings

settings = get_settings()

class AuthService:
    @staticmethod
    def register_user(user: UserCreate) -> dict:
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
        return {"id": user_id, "email": user.email, "name": user.name}

    @staticmethod
    def authenticate_user(username: str, password: str) -> Token:
        user = UserRepository.get_by_email(username)
        if not user or not verify_password(password, user["password_hash"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
        access_token = create_access_token(
            data={"sub": user["email"], "user_id": user["id"]},
            expires_delta=access_token_expires
        )
        return Token(access_token=access_token, token_type="bearer")
