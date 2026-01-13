# backend/project/project_router.py

from __future__ import annotations

import os
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.auth.auth_router import get_db
from backend.schemas.project_schema import ProjectCreate, ProjectUpdate, ProjectRead

from backend.task.ai_service import (
    AIService,
    AIServiceError,
    AIServiceTimeoutError,
    AIServiceInvalidResponseError,
)

# ✅ MODELS must live in ONE place only
from backend.models.project import Project
from backend.models.task import Task

logger = logging.getLogger("backend.project")

router = APIRouter(prefix="/projects", tags=["projects"])


# ==========================
# Helpers
# ==========================
def _ai_enabled_or_503() -> None:
    if os.getenv("AI_ENABLED", "false").strip().lower() != "true":
        raise HTTPException(
            status_code=503,
            detail="AI functionality is disabled (set AI_ENABLED=true)",
        )


def _tasks_to_text(tasks: List[Task], max_tasks: int = 60) -> str:
    """
    Build a compact text snapshot for AI prompt.
    """
    lines: List[str] = []
    for t in tasks[:max_tasks]:
        sp = t.estimated_story_points if t.estimated_story_points is not None else "-"
        desc = (t.description or "").strip().replace("\n", " ")
        if len(desc) > 240:
            desc = desc[:240] + "..."
        lines.append(
            f"- {t.title} | status={t.status} | priority={t.priority} | "
            f"complexity={t.complexity} | sp={sp} | assignee={t.assignee or '-'} | "
            f"tags={t.tags or '-'} | desc={desc}"
        )
    return "\n".join(lines).strip()


# ==========================
# CRUD: Projects
# ==========================
@router.post("/", response_model=ProjectRead)
def create_project(data: ProjectCreate, db: Session = Depends(get_db)):
    project = Project(
        name=data.name,
        description=data.description,
        tech_stack=data.tech_stack,
        infrastructure=data.infrastructure,
        members_count=data.members_count,
        start_date=data.start_date,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("/", response_model=list[ProjectRead])
def get_all_projects(db: Session = Depends(get_db)):
    return db.query(Project).all()


@router.get("/{project_id}", response_model=ProjectRead)
def get_project(project_id: int, db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.patch("/{project_id}", response_model=ProjectRead)
def update_project(project_id: int, data: ProjectUpdate, db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if data.name is not None:
        project.name = data.name
    if data.description is not None:
        project.description = data.description
    if data.tech_stack is not None:
        project.tech_stack = data.tech_stack
    if data.infrastructure is not None:
        project.infrastructure = data.infrastructure
    if data.members_count is not None:
        project.members_count = data.members_count
    if data.start_date is not None:
        project.start_date = data.start_date

    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: int, db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    db.delete(project)
    db.commit()
    return


# ==========================
# ✅ AI: Project Summary
# POST /projects/{project_id}/ai/summary
# Body: { task_ids?: [..], include_done?: bool }
# IMPORTANT: body MUST be OPTIONAL ca să nu primești 422 când frontend-ul trimite {} sau nimic
# ==========================
class ProjectSummaryRequest(BaseModel):
    task_ids: Optional[List[int]] = None
    include_done: bool = True


class ProjectSummaryResponse(BaseModel):
    project_id: int
    summary: str
    method: str


@router.post("/{project_id}/ai/summary", response_model=ProjectSummaryResponse)
def create_project_summary(
    project_id: int,
    req: Optional[ProjectSummaryRequest] = None,  # ✅ FIX: optional body
    db: Session = Depends(get_db),
):
    _ai_enabled_or_503()

    # ✅ dacă nu vine body deloc, folosim default
    if req is None:
        req = ProjectSummaryRequest()

    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    q = db.query(Task).filter(Task.project_id == project_id)

    # dacă task_ids e trimis explicit, îl validăm
    if req.task_ids is not None:
        if len(req.task_ids) == 0:
            raise HTTPException(status_code=400, detail="task_ids cannot be empty when provided")
        q = q.filter(Task.id.in_(req.task_ids))

    if not req.include_done:
        q = q.filter(Task.status != "done")

    tasks = q.order_by(Task.created_at.asc()).all()
    tasks_text = _tasks_to_text(tasks)

    payload = {
        "project_name": project.name,
        "project_description": project.description,
        "tech_stack": project.tech_stack,
        "infrastructure": project.infrastructure,
        "tasks": tasks_text if tasks_text else "- No tasks yet.",
    }

    ai = AIService()

    try:
        summary = ai.generate_project_summary(payload)
        return ProjectSummaryResponse(
            project_id=project_id,
            summary=summary,
            method=ai.provider,  # "openai" sau "placeholder"
        )

    except (AIServiceTimeoutError, AIServiceInvalidResponseError, AIServiceError) as exc:
        logger.warning(
            "ai_project_summary_failed_fallback_placeholder",
            extra={"project_id": project_id, "err": str(exc)},
        )

        fb = AIService()
        fb.provider = "placeholder"
        summary = fb.generate_project_summary(payload)

        return ProjectSummaryResponse(project_id=project_id, summary=summary, method="placeholder")