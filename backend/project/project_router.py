# backend/project/project_router.py

from __future__ import annotations

import logging
import os
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.auth.auth_router import get_db
from backend.models.notification import Notification
from backend.models.project import Project
from backend.models.task import Task
from backend.schemas.project_schema import ProjectCreate, ProjectRead, ProjectUpdate
from backend.task.ai_service import (
    AIService,
    AIServiceError,
    AIServiceInvalidResponseError,
    AIServiceTimeoutError,
)

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


def _get_user_id(request: Request) -> int:
    """
    TEMP helper:
    - dacă nu ai auth completă, poți trimite header X-User-Id din frontend.
    - fallback 1 ca să nu pice DB (NOT NULL).
    """
    # dacă ai middleware care pune user_id în request.state
    uid = getattr(request.state, "user_id", None)
    if isinstance(uid, int) and uid > 0:
        return uid

    # fallback pe header
    h = request.headers.get("x-user-id")
    if h:
        try:
            hid = int(h)
            if hid > 0:
                return hid
        except Exception:
            pass

    return 1


def _tasks_to_text(tasks: List[Task], max_tasks: int = 60) -> str:
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


def _notify(
    db: Session,
    *,
    user_id: int,
    ntype: str,
    title: str,
    message: str,
    project_id: Optional[int] = None,
    task_id: Optional[int] = None,
) -> None:
    """
    Creează o notificare.
    - NU face commit aici
    - dacă notificarea eșuează, nu stricăm endpoint-ul
    """
    try:
        n = Notification(
            user_id=user_id,  # ✅ IMPORTANT (altfel crapă commit-ul)
            type=ntype,
            title=title,
            message=message,
            is_read=False,
            created_at=datetime.utcnow(),
            project_id=project_id,
            task_id=task_id,
        )
        db.add(n)
    except Exception:
        logger.exception(
            "notification_create_failed",
            extra={"type": ntype, "project_id": project_id, "task_id": task_id, "user_id": user_id},
        )


# ==========================
# CRUD: Projects
# ==========================
@router.post("/", response_model=ProjectRead)
def create_project(data: ProjectCreate, request: Request, db: Session = Depends(get_db)):
    user_id = _get_user_id(request)

    project = Project(
        name=data.name,
        description=data.description,
        tech_stack=data.tech_stack,
        infrastructure=data.infrastructure,
        members_count=data.members_count,
        start_date=data.start_date,
    )
    db.add(project)
    db.flush()  # ✅ avem project.id fără commit

    _notify(
        db,
        user_id=user_id,
        ntype="project_created",
        title="Project created",
        message=f"Project created: {project.name}",
        project_id=project.id,
    )

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
def update_project(project_id: int, data: ProjectUpdate, request: Request, db: Session = Depends(get_db)):
    user_id = _get_user_id(request)

    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    old_name = project.name
    changed_fields: List[str] = []

    if data.name is not None and data.name != project.name:
        project.name = data.name
        changed_fields.append("name")
    if data.description is not None:
        project.description = data.description
        changed_fields.append("description")
    if data.tech_stack is not None:
        project.tech_stack = data.tech_stack
        changed_fields.append("tech_stack")
    if data.infrastructure is not None:
        project.infrastructure = data.infrastructure
        changed_fields.append("infrastructure")
    if data.members_count is not None:
        project.members_count = data.members_count
        changed_fields.append("members_count")
    if data.start_date is not None:
        project.start_date = data.start_date
        changed_fields.append("start_date")

    if changed_fields:
        display_name = project.name or old_name
        _notify(
            db,
            user_id=user_id,
            ntype="project_updated",
            title="Project updated",
            message=f"Project updated ({', '.join(changed_fields)}): {display_name}",
            project_id=project_id,
        )

    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: int, request: Request, db: Session = Depends(get_db)):
    user_id = _get_user_id(request)

    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    pname = project.name

    _notify(
        db,
        user_id=user_id,
        ntype="project_deleted",
        title="Project deleted",
        message=f"Project deleted: {pname}",
        project_id=project_id,
    )

    db.delete(project)
    db.commit()
    return


# ==========================
# ✅ AI: Project Summary
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
    request: Request,
    req: Optional[ProjectSummaryRequest] = None,
    db: Session = Depends(get_db),
):
    _ai_enabled_or_503()
    user_id = _get_user_id(request)

    if req is None:
        req = ProjectSummaryRequest()

    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    q = db.query(Task).filter(Task.project_id == project_id)

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
        method = ai.provider
    except (AIServiceTimeoutError, AIServiceInvalidResponseError, AIServiceError) as exc:
        logger.warning(
            "ai_project_summary_failed_fallback_placeholder",
            extra={"project_id": project_id, "err": str(exc)},
        )
        fb = AIService()
        fb.provider = "placeholder"
        summary = fb.generate_project_summary(payload)
        method = "placeholder"

    _notify(
        db,
        user_id=user_id,
        ntype="ai_project_summary",
        title="AI project summary",
        message=f"AI summary generated for project: {project.name}",
        project_id=project_id,
    )

    db.commit()

    return ProjectSummaryResponse(
        project_id=project_id,
        summary=summary,
        method=method,
    )