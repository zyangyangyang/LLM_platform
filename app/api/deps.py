from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from app.core.config import get_settings
from app.repositories.user_repo import UserRepository

settings = get_settings()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.api_prefix}/auth/login")

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    user = UserRepository.get_by_email(email)
    if user is None:
        raise credentials_exception
    if user.get("status") != "active":
        raise HTTPException(status_code=400, detail="Inactive user")
    if not user.get("roles"):
        UserRepository.assign_role(user["id"], UserRepository.EVALUATOR_ROLE)
        user["roles"] = [UserRepository.EVALUATOR_ROLE]
    return user

def require_role(role_name: str):
    async def _require_role(current_user: dict = Depends(get_current_user)):
        roles = current_user.get("roles") or []
        if role_name not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return _require_role

async def get_current_admin_user(current_user: dict = Depends(require_role(UserRepository.ADMIN_ROLE))):
    return current_user
