from fastapi import APIRouter, Depends
from typing import List, Dict, Any
from app.api.deps import get_current_user
from app.schemas.project import ProjectCreate, ProjectResponse, ProjectMemberCreate, ProjectMemberResponse
from app.services.project_service import ProjectService

router = APIRouter()

@router.post("/", response_model=ProjectResponse)
def create_project(
    project_in: ProjectCreate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    return ProjectService.create_project(project_in, current_user["id"])

@router.get("/", response_model=List[ProjectResponse])
def list_projects(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    return ProjectService.list_projects(current_user["id"])

@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    return ProjectService.get_project(project_id, current_user["id"])

@router.post("/{project_id}/members", response_model=ProjectMemberResponse)
def add_project_member(
    project_id: str,
    member_in: ProjectMemberCreate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    return ProjectService.add_member(project_id, member_in, current_user["id"])

@router.get("/{project_id}/members", response_model=List[ProjectMemberResponse])
def list_project_members(
    project_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    return ProjectService.get_members(project_id, current_user["id"])
