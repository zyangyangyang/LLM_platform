from typing import Optional, Dict, Any, List
from uuid import uuid4
from app.core.database import execute, fetch_one, fetch_all

class UserRepository:
    EVALUATOR_ROLE = "evaluator"
    ADMIN_ROLE = "platform_admin"

    @staticmethod
    def get_by_email(email: str) -> Optional[Dict[str, Any]]:
        user = fetch_one("SELECT * FROM users WHERE email = %s", (email,))
        if user:
            user["roles"] = UserRepository.list_role_names(user["id"])
        return user

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
        user = fetch_one("SELECT * FROM users WHERE id = %s", (user_id,))
        if user:
            user["roles"] = UserRepository.list_role_names(user_id)
        return user

    @staticmethod
    def ensure_role(name: str, description: str = None) -> str:
        role = fetch_one("SELECT id FROM roles WHERE name = %s", (name,))
        if role:
            return role["id"]
        role_id = str(uuid4())
        execute(
            "INSERT INTO roles (id, name, description) VALUES (%s, %s, %s)",
            (role_id, name, description),
        )
        return role_id

    @staticmethod
    def assign_role(user_id: str, role_name: str):
        role_id = UserRepository.ensure_role(role_name)
        existing = fetch_one(
            "SELECT 1 FROM user_roles WHERE user_id = %s AND role_id = %s LIMIT 1",
            (user_id, role_id),
        )
        if existing:
            return
        execute(
            "INSERT INTO user_roles (id, user_id, role_id) VALUES (%s, %s, %s)",
            (str(uuid4()), user_id, role_id),
        )

    @staticmethod
    def list_role_names(user_id: str) -> List[str]:
        rows = fetch_all(
            """
            SELECT r.name
            FROM roles r
            INNER JOIN user_roles ur ON ur.role_id = r.id
            WHERE ur.user_id = %s
            ORDER BY r.name
            """,
            (user_id,),
        )
        return [row["name"] for row in rows]
