from typing import Optional, Dict, Any
from uuid import uuid4
from app.core.database import execute, fetch_one

class UserRepository:
    @staticmethod
    def get_by_email(email: str) -> Optional[Dict[str, Any]]:
        return fetch_one("SELECT * FROM users WHERE email = %s", (email,))

    @staticmethod
    def create(user_data: Dict[str, Any]) -> str:
        user_id = str(uuid4())
        execute(
            "INSERT INTO users (id, email, password_hash, name) VALUES (%s, %s, %s, %s)",
            (user_id, user_data['email'], user_data['password_hash'], user_data['name'])
        )
        return user_id

    @staticmethod
    def get_by_id(user_id: str) -> Optional[Dict[str, Any]]:
        return fetch_one("SELECT * FROM users WHERE id = %s", (user_id,))
