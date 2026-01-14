from __future__ import annotations

import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import desc
from sqlalchemy.orm import Session

from backend.auth.auth_router import get_db
from backend.models.notification import Notification
from backend.models.project import Project
from backend.models.task import Task
from backend.schemas.task_schema import (
    EffortEstimateRequest,
    EffortEstimateResponse,
    TaskCreate,
    TaskRead,
    TaskUpdate,
)
from backend.task.ai_service import (
    AIService,
    AIServiceError,
    AIServiceInvalidResponseError,
    AIServiceTimeoutError,
)

logger = logging.getLogger("backend.task")
router = APIRouter(prefix="/tasks", tags=["tasks"])


# =========================================================
# REQUEST MODELS
# =========================================================
class GenerateDescriptionsRequest(BaseModel):
    project_id: int
    task_ids: Optional[List[int]] = None
    include_done: bool = False


class EstimateEffortBatchRequest(BaseModel):
    project_id: int
    include_history: bool = True
    max_history_tasks: int = Field(default=20, ge=0, le=100)


class ProjectSummaryRequest(BaseModel):
    project_id: int
    task_ids: Optional[List[int]] = None
    include_done: bool = True


class ProjectSummaryResponse(BaseModel):
    project_id: int
    summary: str
    method: str


# =========================================================
# HELPERS
# =========================================================
def _ai_enabled_or_503() -> None:
    if os.getenv("AI_ENABLED", "false").strip().lower() != "true":
        raise HTTPException(
            status_code=503,
            detail="AI functionality is disabled (set AI_ENABLED=true)",
        )


def _get_user_id(request: Request) -> int:
    """
    TEMP helper (până ai auth complet):
      1) request.state.user_id
      2) request.state.user.id
      3) header X-User-Id
      4) fallback 1 (TEMP)
    """
    uid = getattr(request.state, "user_id", None)
    if isinstance(uid, int) and uid > 0:
        return uid

    u = getattr(request.state, "user", None)
    if u is not None:
        u_id = getattr(u, "id", None)
        if isinstance(u_id, int) and u_id > 0:
            return u_id

    h = request.headers.get("x-user-id")
    if h:
        try:
            hid = int(h)
            if hid > 0:
                return hid
        except Exception:
            pass

    return 1


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
    Creează o notificare. Nu face commit aici.
    IMPORTANT: notifications.user_id e NOT NULL.
    """
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


def _get_owned_project(db: Session, project_id: int, user_id: int) -> Project:
    """
    Returnează proiectul doar dacă aparține user-ului.
    """
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == user_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _get_owned_task(db: Session, task_id: int, user_id: int) -> Task:
    """
    Returnează task-ul doar dacă task-ul este într-un proiect al user-ului.
    (join Task -> Project)
    """
    task = (
        db.query(Task)
        .join(Project, Project.id == Task.project_id)
        .filter(Task.id == task_id, Project.user_id == user_id)
        .first()
    )
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


def _build_history_text(
    db: Session,
    project_id: int,
    current_task_id: int,
    max_history_tasks: int,
) -> Optional[str]:
    if max_history_tasks <= 0:
        return None

    prev_tasks = (
        db.query(Task)
        .filter(Task.project_id == project_id, Task.id != current_task_id)
        .order_by(desc(Task.created_at))
        .limit(max_history_tasks)
        .all()
    )

    lines = [
        f"- {t.title} | status={t.status} | desc={t.description or ''}".strip()
        for t in reversed(prev_tasks)
    ]
    return "\n".join(lines) if lines else None


def _fallback_placeholder_estimate(payload: Dict[str, Any]) -> Dict[str, Any]:
    fallback = AIService()
    fallback.provider = "placeholder"
    return fallback.estimate_effort(payload)


def _fallback_placeholder_description(payload: Dict[str, Any]) -> str:
    fallback = AIService()
    fallback.provider = "placeholder"
    return fallback.generate_description(payload)


def _fallback_placeholder_project_summary(payload: Dict[str, Any]) -> str:
    fallback = AIService()
    fallback.provider = "placeholder"
    return fallback.generate_project_summary(payload)


def _task_to_summary_item(t: Task) -> Dict[str, Any]:
    return {
        "id": t.id,
        "title": t.title,
        "status": (t.status or "").lower(),
        "priority": (t.priority or "").lower(),
        "complexity": (t.complexity or "").lower(),
        "assignee": t.assignee,
        "tags": t.tags,
        "story_points": t.estimated_story_points,
    }


# =========================================================
# CRUD TASKS (scoped to user)
# =========================================================
@router.post("/", response_model=TaskRead)
def create_task(data: TaskCreate, request: Request, db: Session = Depends(get_db)):
    user_id = _get_user_id(request)

    # ✅ NU permite creare task într-un project care nu aparține user-ului
    _get_owned_project(db, data.project_id, user_id)

    task = Task(
        title=data.title,
        description=data.description,
        project_id=data.project_id,
        priority=data.priority,
        complexity=data.complexity,
        assignee=data.assignee,
        tags=data.tags,
        source=getattr(data, "source", "manual"),
    )
    db.add(task)
    db.flush()

    _notify(
        db,
        user_id=user_id,
        ntype="task_created",
        title="Task created",
        message=f"Task created: {task.title}",
        project_id=task.project_id,
        task_id=task.id,
    )

    db.commit()
    db.refresh(task)
    return task


@router.get("/", response_model=list[TaskRead])
def get_all_tasks(request: Request, db: Session = Depends(get_db)):
    """
    Dacă vrei să existe, îl facem și pe ăsta scoped pe user.
    """
    user_id = _get_user_id(request)
    return (
        db.query(Task)
        .join(Project, Project.id == Task.project_id)
        .filter(Project.user_id == user_id)
        .order_by(Task.created_at.desc())
        .all()
    )


@router.get("/project/{project_id}", response_model=list[TaskRead])
def get_tasks_by_project(project_id: int, request: Request, db: Session = Depends(get_db)):
    user_id = _get_user_id(request)

    # ✅ verifică ownership la proiect (altfel poți vedea task-urile altuia)
    _get_owned_project(db, project_id, user_id)

    return db.query(Task).filter(Task.project_id == project_id).order_by(Task.created_at.asc()).all()


@router.get("/{task_id}", response_model=TaskRead)
def get_task(task_id: int, request: Request, db: Session = Depends(get_db)):
    user_id = _get_user_id(request)
    return _get_owned_task(db, task_id, user_id)


@router.patch("/{task_id}", response_model=TaskRead)
def update_task(task_id: int, data: TaskUpdate, request: Request, db: Session = Depends(get_db)):
    user_id = _get_user_id(request)
    task = _get_owned_task(db, task_id, user_id)

    old_title = task.title
    old_status = (task.status or "").lower()

    if data.title is not None:
        task.title = data.title
    if data.description is not None:
        task.description = data.description
    if data.status is not None:
        task.status = data.status
    if data.priority is not None:
        task.priority = data.priority
    if data.complexity is not None:
        task.complexity = data.complexity
    if data.assignee is not None:
        task.assignee = data.assignee
    if data.tags is not None:
        task.tags = data.tags
    if data.ai_story is not None:
        task.ai_story = data.ai_story

    changed_bits: list[str] = []
    if data.title is not None and data.title != old_title:
        changed_bits.append("title")
    if data.status is not None and (data.status or "").lower() != old_status:
        changed_bits.append("status")
    if data.description is not None:
        changed_bits.append("description")
    if data.priority is not None:
        changed_bits.append("priority")
    if data.complexity is not None:
        changed_bits.append("complexity")
    if data.assignee is not None:
        changed_bits.append("assignee")
    if data.tags is not None:
        changed_bits.append("tags")

    if changed_bits:
        _notify(
            db,
            user_id=user_id,
            ntype="task_updated",
            title="Task updated",
            message=f"Updated ({', '.join(changed_bits)}): {task.title}",
            project_id=task.project_id,
            task_id=task.id,
        )

    db.commit()
    db.refresh(task)
    return task


@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: int, request: Request, db: Session = Depends(get_db)):
    user_id = _get_user_id(request)
    task = _get_owned_task(db, task_id, user_id)

    _notify(
        db,
        user_id=user_id,
        ntype="task_deleted",
        title="Task deleted",
        message=f"Task deleted: {task.title}",
        project_id=task.project_id,
        task_id=task.id,
    )

    db.delete(task)
    db.commit()
    return


@router.patch("/{task_id}/status", response_model=TaskRead)
def update_status(task_id: int, status: str, request: Request, db: Session = Depends(get_db)):
    user_id = _get_user_id(request)
    task = _get_owned_task(db, task_id, user_id)

    old = (task.status or "").lower()
    task.status = status

    if old != (status or "").lower():
        _notify(
            db,
            user_id=user_id,
            ntype="task_status_changed",
            title="Task status changed",
            message=f"{task.title}: {old} → {status}",
            project_id=task.project_id,
            task_id=task.id,
        )

    db.commit()
    db.refresh(task)
    return task


# =========================================================
# AI STORY / DESCRIPTION (single)
# =========================================================
@router.post("/{task_id}/generate-story", response_model=TaskRead)
def generate_ai_story(task_id: int, request: Request, db: Session = Depends(get_db)):
    user_id = _get_user_id(request)
    task = _get_owned_task(db, task_id, user_id)

    ai_text = f"AI-generated story for task '{task.title}':\n\nBased on previous tasks..."
    task.ai_story = ai_text

    _notify(
        db,
        user_id=user_id,
        ntype="ai_story_generated",
        title="AI story generated",
        message=f"AI story generated for: {task.title}",
        project_id=task.project_id,
        task_id=task.id,
    )

    db.commit()
    db.refresh(task)
    return task


@router.post("/{task_id}/ai-description", response_model=TaskRead)
def generate_ai_description(task_id: int, request: Request, db: Session = Depends(get_db)):
    user_id = _get_user_id(request)
    _ai_enabled_or_503()

    task = _get_owned_task(db, task_id, user_id)
    project = _get_owned_project(db, task.project_id, user_id)

    payload = {
        "title": task.title,
        "description": task.description,
        "project_name": project.name if project else None,
        "project_description": project.description if project else None,
        "tech_stack": getattr(project, "tech_stack", None) if project else None,
        "infrastructure": getattr(project, "infrastructure", None) if project else None,
        "priority": task.priority,
        "complexity": task.complexity,
        "assignee": task.assignee,
        "tags": task.tags,
    }

    ai_service = AIService()

    try:
        generated = ai_service.generate_description(payload)
        method = "openai" if ai_service.provider == "openai" else ai_service.provider
    except (AIServiceTimeoutError, AIServiceInvalidResponseError, AIServiceError) as exc:
        logger.warning(
            "ai_description_failed_fallback_placeholder",
            extra={"task_id": task_id, "project_id": task.project_id, "error": str(exc)},
        )
        generated = _fallback_placeholder_description(payload)
        method = "placeholder"
    except Exception as exc:
        logger.warning(
            "ai_description_unknown_failed_fallback_placeholder",
            extra={"task_id": task_id, "project_id": task.project_id, "error": str(exc)},
        )
        generated = _fallback_placeholder_description(payload)
        method = "placeholder"

    task.description = generated
    task.ai_story = (task.ai_story or "") + "\n\n[AI description generated]"
    task.source = f"ai_description:{method}"

    _notify(
        db,
        user_id=user_id,
        ntype="ai_description_generated",
        title="AI description generated",
        message=f"AI description generated for: {task.title}",
        project_id=task.project_id,
        task_id=task.id,
    )

    db.commit()
    db.refresh(task)
    return task


# =========================================================
# AI DESCRIPTION (batch)
# =========================================================
@router.post("/ai/generate-descriptions", response_model=list[TaskRead])
def generate_descriptions_batch(
    req: GenerateDescriptionsRequest, request: Request, db: Session = Depends(get_db)
):
    user_id = _get_user_id(request)
    _ai_enabled_or_503()

    # ✅ ownership check
    _get_owned_project(db, req.project_id, user_id)

    q = db.query(Task).filter(Task.project_id == req.project_id)

    if req.task_ids is not None:
        if len(req.task_ids) == 0:
            raise HTTPException(status_code=400, detail="task_ids cannot be empty when provided")
        q = q.filter(Task.id.in_(req.task_ids))

    if not req.include_done:
        q = q.filter(Task.status != "done")

    tasks = q.all()
    if not tasks:
        raise HTTPException(status_code=404, detail="No tasks found for the given scope")

    project = db.get(Project, req.project_id)
    ai_service = AIService()
    updated: list[Task] = []

    for task in tasks:
        payload = {
            "title": task.title,
            "description": task.description,
            "project_name": project.name if project else None,
            "project_description": project.description if project else None,
            "tech_stack": getattr(project, "tech_stack", None) if project else None,
            "infrastructure": getattr(project, "infrastructure", None) if project else None,
            "priority": task.priority,
            "complexity": task.complexity,
            "assignee": task.assignee,
            "tags": task.tags,
        }

        try:
            generated = ai_service.generate_description(payload)
            method = "openai" if ai_service.provider == "openai" else ai_service.provider
        except Exception:
            generated = _fallback_placeholder_description(payload)
            method = "placeholder"

        task.description = generated
        task.ai_story = (task.ai_story or "") + "\n\n[AI description generated]"
        task.source = f"ai_description:{method}"
        updated.append(task)

        _notify(
            db,
            user_id=user_id,
            ntype="ai_description_generated",
            title="AI description generated",
            message=f"AI description generated for: {task.title}",
            project_id=task.project_id,
            task_id=task.id,
        )

    _notify(
        db,
        user_id=user_id,
        ntype="ai_batch_done",
        title="AI batch complete",
        message=f"AI generated descriptions for {len(updated)} task(s).",
        project_id=req.project_id,
    )

    db.commit()
    return updated


# =========================================================
# AI EFFORT ESTIMATION (single)
# =========================================================
@router.post("/{task_id}/estimate", response_model=EffortEstimateResponse)
def estimate_effort(
    task_id: int,
    request: Request,
    req: Optional[EffortEstimateRequest] = None,
    db: Session = Depends(get_db),
):
    user_id = _get_user_id(request)
    _ai_enabled_or_503()

    task = _get_owned_task(db, task_id, user_id)

    if (task.status or "").lower() == "done":
        raise HTTPException(status_code=409, detail="Cannot estimate effort for a DONE task")

    include_history = True
    max_history_tasks = 20
    if req is not None:
        include_history = bool(req.include_history)
        max_history_tasks = int(req.max_history_tasks or 0)

    project = _get_owned_project(db, task.project_id, user_id)

    history_text = _build_history_text(db, task.project_id, task.id, max_history_tasks) if include_history else None

    payload = {
        "title": task.title,
        "description": task.description,
        "project_name": project.name if project else None,
        "project_description": project.description if project else None,
        "tech_stack": getattr(project, "tech_stack", None) if project else None,
        "infrastructure": getattr(project, "infrastructure", None) if project else None,
        "history": history_text,
        "scale": "Fibonacci 1,2,3,5,8,13,21",
    }

    try:
        out = AIService().estimate_effort(payload)
    except (AIServiceTimeoutError, AIServiceInvalidResponseError, AIServiceError):
        out = _fallback_placeholder_estimate(payload)
    except Exception:
        out = _fallback_placeholder_estimate(payload)

    try:
        task.estimated_story_points = int(out["story_points"])
        task.ai_confidence = float(out.get("confidence", 0.0))
        task.source = str(out.get("method", "unknown"))

        _notify(
            db,
            user_id=user_id,
            ntype="ai_estimate_done",
            title="AI estimate ready",
            message=f"{task.title}: SP={task.estimated_story_points}",
            project_id=task.project_id,
            task_id=task.id,
        )

        db.commit()
        db.refresh(task)
    except Exception:
        db.rollback()
        logger.exception("ai_estimate_db_error", extra={"task_id": task_id, "project_id": task.project_id})
        raise HTTPException(status_code=500, detail="Failed to persist estimate to database")

    return EffortEstimateResponse(
        task_id=task.id,
        project_id=task.project_id,
        story_points=task.estimated_story_points or 0,
        confidence=task.ai_confidence or 0.0,
        method=task.source or "unknown",
        rationale=str(out.get("rationale", "")),
    )


# =========================================================
# AI EFFORT ESTIMATION (batch)
# =========================================================
@router.post("/ai/estimate-effort", response_model=list[EffortEstimateResponse])
def estimate_effort_all(req: EstimateEffortBatchRequest, request: Request, db: Session = Depends(get_db)):
    user_id = _get_user_id(request)
    _ai_enabled_or_503()

    _get_owned_project(db, req.project_id, user_id)

    tasks = db.query(Task).filter(Task.project_id == req.project_id).all()
    if not tasks:
        raise HTTPException(status_code=404, detail="No tasks found for project")

    project = db.get(Project, req.project_id)
    responses: list[EffortEstimateResponse] = []
    ai_service = AIService()

    updated_count = 0

    for task in tasks:
        if (task.status or "").lower() == "done":
            continue

        history_text = _build_history_text(db, req.project_id, task.id, req.max_history_tasks) if req.include_history else None

        payload = {
            "title": task.title,
            "description": task.description,
            "project_name": project.name if project else None,
            "project_description": project.description if project else None,
            "tech_stack": getattr(project, "tech_stack", None) if project else None,
            "infrastructure": getattr(project, "infrastructure", None) if project else None,
            "history": history_text,
            "scale": "Fibonacci 1,2,3,5,8,13,21",
        }

        try:
            out = ai_service.estimate_effort(payload)
        except Exception:
            out = _fallback_placeholder_estimate(payload)

        try:
            task.estimated_story_points = int(out["story_points"])
            task.ai_confidence = float(out.get("confidence", 0.0))
            task.source = str(out.get("method", "unknown"))

            _notify(
                db,
                user_id=user_id,
                ntype="ai_estimate_done",
                title="AI estimate ready",
                message=f"{task.title}: SP={task.estimated_story_points}",
                project_id=task.project_id,
                task_id=task.id,
            )

            updated_count += 1

            responses.append(
                EffortEstimateResponse(
                    task_id=task.id,
                    project_id=task.project_id,
                    story_points=task.estimated_story_points or 0,
                    confidence=task.ai_confidence or 0.0,
                    method=task.source or "unknown",
                    rationale=str(out.get("rationale", "")),
                )
            )
        except Exception:
            db.rollback()
            continue

    _notify(
        db,
        user_id=user_id,
        ntype="ai_batch_done",
        title="AI batch complete",
        message=f"AI effort estimation completed for {updated_count} task(s).",
        project_id=req.project_id,
    )

    db.commit()
    return responses


# =========================================================
# AI PROJECT SUMMARY
# =========================================================
@router.post("/ai/project-summary", response_model=ProjectSummaryResponse)
def create_project_summary(req: ProjectSummaryRequest, request: Request, db: Session = Depends(get_db)):
    user_id = _get_user_id(request)
    _ai_enabled_or_503()

    _get_owned_project(db, req.project_id, user_id)

    q = db.query(Task).filter(Task.project_id == req.project_id)

    if req.task_ids is not None:
        if len(req.task_ids) == 0:
            raise HTTPException(status_code=400, detail="task_ids cannot be empty when provided")
        q = q.filter(Task.id.in_(req.task_ids))

    if not req.include_done:
        q = q.filter(Task.status != "done")

    tasks = q.order_by(desc(Task.created_at)).all()

    project = db.get(Project, req.project_id)

    payload = {
        "project_name": getattr(project, "name", None),
        "project_description": getattr(project, "description", None),
        "tech_stack": getattr(project, "tech_stack", None),
        "infrastructure": getattr(project, "infrastructure", None),
        "tasks": [_task_to_summary_item(t) for t in tasks],
    }

    ai_service = AIService()

    try:
        summary_text = ai_service.generate_project_summary(payload)
        method = "openai" if ai_service.provider == "openai" else ai_service.provider
    except (AIServiceTimeoutError, AIServiceInvalidResponseError, AIServiceError):
        summary_text = _fallback_placeholder_project_summary(payload)
        method = "placeholder"
    except Exception:
        summary_text = _fallback_placeholder_project_summary(payload)
        method = "placeholder"

    _notify(
        db,
        user_id=user_id,
        ntype="ai_project_summary",
        title="AI project summary",
        message=f"AI project summary generated for project_id={req.project_id}",
        project_id=req.project_id,
    )

    db.commit()

    return ProjectSummaryResponse(
        project_id=req.project_id,
        summary=summary_text,
        method=method,
    )