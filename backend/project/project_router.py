from __future__ import annotations

import logging
import os
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import text
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
    IMPORTANT:
    - NU mai folosim fallback=1, pentru că asta „amestecă” datele userilor.
    - Dacă nu avem user id, returnăm 401 ca să fie clar că frontend-ul nu trimite identitatea.
    """
    uid = getattr(request.state, "user_id", None)
    if isinstance(uid, int) and uid > 0:
        return uid

    h = request.headers.get("x-user-id")
    if h:
        try:
            hid = int(h)
            if hid > 0:
                return hid
        except Exception:
            pass

    raise HTTPException(status_code=401, detail="Missing user identity (X-User-Id or auth)")


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
    try:
        n = Notification(
            user_id=user_id,
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
# ✅ DEV MIGRATION: ensure projects.user_id exists
# ==========================
def _ensure_projects_user_id_column(db: Session) -> None:
    """
    Fix pentru SQLite dev:
    - dacă tabela projects NU are user_id, o adăugăm.
    - folosim DEFAULT 1 ca să nu fie NULL la rândurile existente.
    """
    try:
        cols = db.execute(text("PRAGMA table_info(projects)")).fetchall()
        col_names = {row[1] for row in cols}

        if "user_id" in col_names:
            return

        logger.warning("DEV MIGRATION: adding projects.user_id column (SQLite)")

        # IMPORTANT: punem DEFAULT 1 ca să nu fie NULL
        db.execute(text("ALTER TABLE projects ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1"))

        db.commit()
        logger.warning("DEV MIGRATION: projects.user_id added with DEFAULT 1")
    except Exception:
        db.rollback()
        logger.exception("DEV MIGRATION failed: could not ensure projects.user_id")
        raise HTTPException(status_code=500, detail="Database migration failed for projects.user_id")


def _get_owned_project(db: Session, project_id: int, user_id: int) -> Project:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if getattr(project, "user_id", None) != user_id:
        raise HTTPException(status_code=404, detail="Project not found")

    return project


# ==========================
# CRUD: Projects (per user)
# ==========================
@router.post("/", response_model=ProjectRead)
def create_project(data: ProjectCreate, request: Request, db: Session = Depends(get_db)):
    _ensure_projects_user_id_column(db)
    user_id = _get_user_id(request)

    project = Project(
        user_id=user_id,
        name=data.name,
        description=data.description,
        tech_stack=data.tech_stack,
        infrastructure=data.infrastructure,
        members_count=data.members_count,
        start_date=data.start_date,
    )
    db.add(project)
    db.flush()

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
def get_all_projects(request: Request, db: Session = Depends(get_db)):
    _ensure_projects_user_id_column(db)
    user_id = _get_user_id(request)

    return (
        db.query(Project)
        .filter(Project.user_id == user_id)
        .order_by(Project.created_at.desc())
        .all()
    )


@router.get("/{project_id}", response_model=ProjectRead)
def get_project(project_id: int, request: Request, db: Session = Depends(get_db)):
    _ensure_projects_user_id_column(db)
    user_id = _get_user_id(request)
    return _get_owned_project(db, project_id, user_id)


@router.patch("/{project_id}", response_model=ProjectRead)
def update_project(project_id: int, data: ProjectUpdate, request: Request, db: Session = Depends(get_db)):
    _ensure_projects_user_id_column(db)
    user_id = _get_user_id(request)
    project = _get_owned_project(db, project_id, user_id)

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
    _ensure_projects_user_id_column(db)
    user_id = _get_user_id(request)
    project = _get_owned_project(db, project_id, user_id)

    _notify(
        db,
        user_id=user_id,
        ntype="project_deleted",
        title="Project deleted",
        message=f"Project deleted: {project.name}",
        project_id=project_id,
    )

    db.delete(project)
    db.commit()
    return


# ==========================
# ✅ AI: Project Summary (owned)
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
    _ensure_projects_user_id_column(db)
    _ai_enabled_or_503()
    user_id = _get_user_id(request)

    if req is None:
        req = ProjectSummaryRequest()

    project = _get_owned_project(db, project_id, user_id)

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
        logger.warning("ai_project_summary_failed_fallback_placeholder", extra={"project_id": project_id, "err": str(exc)})
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

    return ProjectSummaryResponse(project_id=project_id, summary=summary, method=method)