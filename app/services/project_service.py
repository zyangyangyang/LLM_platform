from typing import List, Dict, Any
from fastapi import HTTPException, status
from app.repositories.project_repo import ProjectRepository
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectMemberCreate

class ProjectService:
    @staticmethod
    def create_project(data: ProjectCreate, owner_id: str) -> Dict[str, Any]:
        project_data = data.model_dump()
        project_data['owner_id'] = owner_id
        
        project_id = ProjectRepository.create(project_data)
        # Owner is automatically a member with admin role? Or just rely on owner_id?
        # Let's add owner as admin member for consistency in queries if needed, 
        # but the schema has owner_id on project table.
        # Strategy: explicit owner column is good.
        
        return ProjectRepository.get_by_id(project_id)

    @staticmethod
    def get_project(project_id: str, user_id: str) -> Dict[str, Any]:
        project = ProjectRepository.get_by_id(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
            
        # Permission check: owner or member
        if project['owner_id'] != user_id and not ProjectRepository.is_member(project_id, user_id):
             raise HTTPException(status_code=403, detail="Not a member of this project")
             
        return project

    @staticmethod
    def list_projects(user_id: str) -> List[Dict[str, Any]]:
        # Return projects owned by user + projects where user is member
        # Simple version: just owned projects for now, or all if admin?
        # Let's return owned projects first.
        return ProjectRepository.list_by_owner(user_id)

    @staticmethod
    def add_member(project_id: str, member_data: ProjectMemberCreate, current_user_id: str) -> Dict[str, Any]:
        project = ProjectRepository.get_by_id(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        if project['owner_id'] != current_user_id:
            raise HTTPException(status_code=403, detail="Only owner can add members")
            
        try:
            member_id = ProjectRepository.add_member(project_id, member_data.user_id, member_data.role)
            return {"id": member_id, "project_id": project_id, "user_id": member_data.user_id, "role": member_data.role}
        except Exception as e:
            # Likely duplicate entry
            raise HTTPException(status_code=400, detail="User already in project or invalid data")

    @staticmethod
    def get_members(project_id: str, current_user_id: str) -> List[Dict[str, Any]]:
        # Verify access
        ProjectService.get_project(project_id, current_user_id)
        return ProjectRepository.get_members(project_id)
