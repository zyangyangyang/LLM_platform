from typing import Optional, Dict, Any, List
from uuid import uuid4
from app.core.database import execute, fetch_one, fetch_all

class ProjectRepository:
    @staticmethod
    def create(project_data: Dict[str, Any]) -> str:
        project_id = str(uuid4())
        execute(
            "INSERT INTO projects (id, name, description, owner_id) VALUES (%s, %s, %s, %s)",
            (project_id, project_data['name'], project_data.get('description'), project_data['owner_id'])
        )
        return project_id

    @staticmethod
    def get_by_id(project_id: str) -> Optional[Dict[str, Any]]:
        return fetch_one("SELECT * FROM projects WHERE id = %s", (project_id,))

    @staticmethod
    def list_by_owner(owner_id: str) -> List[Dict[str, Any]]:
        return fetch_all(
            "SELECT * FROM projects WHERE owner_id = %s ORDER BY created_at DESC",
            (owner_id,)
        )

    @staticmethod
    def list_all() -> List[Dict[str, Any]]:
        return fetch_all("SELECT * FROM projects ORDER BY created_at DESC")

    @staticmethod
    def add_member(project_id: str, user_id: str, role: str) -> str:
        member_id = str(uuid4())
        execute(
            """
            INSERT INTO project_members (id, project_id, user_id, role_in_project)
            VALUES (%s, %s, %s, %s)
            """,
            (member_id, project_id, user_id, role)
        )
        return member_id
    
    @staticmethod
    def get_members(project_id: str) -> List[Dict[str, Any]]:
        return fetch_all(
            """
            SELECT pm.*, u.name as user_name, u.email as user_email 
            FROM project_members pm
            JOIN users u ON pm.user_id = u.id
            WHERE pm.project_id = %s
            """,
            (project_id,)
        )

    @staticmethod
    def is_member(project_id: str, user_id: str) -> bool:
        result = fetch_one(
            "SELECT 1 FROM project_members WHERE project_id = %s AND user_id = %s",
            (project_id, user_id)
        )
        return result is not None
