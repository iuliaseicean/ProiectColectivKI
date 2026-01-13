# backend/task/task_router.py

from __future__ import annotations

import logging
import os
from typing import Optional, List, Any, Dict

from datetime import datetime  # (poate rămâne util în log / payload)

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.auth.auth_router import get_db
from backend.schemas.task_schema import (
    TaskCreate,
    TaskUpdate,
    TaskRead,
    EffortEstimateRequest,
    EffortEstimateResponse,
)

from backend.task.ai_service import (
    AIService,
    AIServiceError,
    AIServiceTimeoutError,
    AIServiceInvalidResponseError,
)

# ✅ importă DOAR modelele din backend/models
from backend.models.task import Task
from backend.models.project import Project


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
# CRUD TASKS
# =========================================================
@router.post("/", response_model=TaskRead)
def create_task(data: TaskCreate, db: Session = Depends(get_db)):
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
    db.commit()
    db.refresh(task)
    return task


@router.get("/", response_model=list[TaskRead])
def get_all_tasks(db: Session = Depends(get_db)):
    return db.query(Task).all()


@router.get("/project/{project_id}", response_model=list[TaskRead])
def get_tasks_by_project(project_id: int, db: Session = Depends(get_db)):
    return db.query(Task).filter(Task.project_id == project_id).all()


@router.get("/{task_id}", response_model=TaskRead)
def get_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.patch("/{task_id}", response_model=TaskRead)
def update_task(task_id: int, data: TaskUpdate, db: Session = Depends(get_db)):
    task = db.query(Task).get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

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

    db.commit()
    db.refresh(task)
    return task


@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task)
    db.commit()
    return


@router.patch("/{task_id}/status", response_model=TaskRead)
def update_status(task_id: int, status: str, db: Session = Depends(get_db)):
    task = db.query(Task).get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.status = status
    db.commit()
    db.refresh(task)
    return task


# =========================================================
# AI STORY / DESCRIPTION (single)
# =========================================================
@router.post("/{task_id}/generate-story", response_model=TaskRead)
def generate_ai_story(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    ai_text = f"AI-generated story for task '{task.title}':\n\nBased on previous tasks..."
    task.ai_story = ai_text
    db.commit()
    db.refresh(task)
    return task


@router.post("/{task_id}/ai-description", response_model=TaskRead)
def generate_ai_description(task_id: int, db: Session = Depends(get_db)):
    _ai_enabled_or_503()

    task = db.query(Task).get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    project = db.query(Project).get(task.project_id)

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

    db.commit()
    db.refresh(task)
    return task


# =========================================================
# AI DESCRIPTION (batch)
# POST /tasks/ai/generate-descriptions
# =========================================================
@router.post("/ai/generate-descriptions", response_model=list[TaskRead])
def generate_descriptions_batch(req: GenerateDescriptionsRequest, db: Session = Depends(get_db)):
    _ai_enabled_or_503()

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

    project = db.query(Project).get(req.project_id)
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
            try:
                generated = _fallback_placeholder_description(payload)
                method = "placeholder"
            except Exception:
                continue

        try:
            task.description = generated
            task.ai_story = (task.ai_story or "") + "\n\n[AI description generated]"
            task.source = f"ai_description:{method}"

            db.add(task)
            db.commit()
            db.refresh(task)
            updated.append(task)
        except Exception:
            db.rollback()
            continue

    if not updated:
        raise HTTPException(status_code=502, detail="AI failed to generate descriptions for all tasks")

    return updated


# =========================================================
# AI EFFORT ESTIMATION (single)
# POST /tasks/{task_id}/estimate
# =========================================================
@router.post("/{task_id}/estimate", response_model=EffortEstimateResponse)
def estimate_effort(
    task_id: int,
    req: Optional[EffortEstimateRequest] = None,
    db: Session = Depends(get_db),
):
    _ai_enabled_or_503()

    task = db.query(Task).get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if (task.status or "").lower() == "done":
        raise HTTPException(status_code=409, detail="Cannot estimate effort for a DONE task")

    include_history = True
    max_history_tasks = 20
    if req is not None:
        include_history = bool(req.include_history)
        max_history_tasks = int(req.max_history_tasks or 0)

    project = db.query(Project).get(task.project_id)

    history_text = None
    if include_history:
        history_text = _build_history_text(db, task.project_id, task.id, max_history_tasks)

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
    except (AIServiceTimeoutError, AIServiceInvalidResponseError, AIServiceError) as exc:
        logger.warning(
            "ai_estimate_failed_fallback_placeholder",
            extra={"task_id": task_id, "project_id": task.project_id, "error": str(exc)},
        )
        out = _fallback_placeholder_estimate(payload)
    except Exception as exc:
        logger.warning(
            "ai_estimate_unknown_failed_fallback_placeholder",
            extra={"task_id": task_id, "project_id": task.project_id, "error": str(exc)},
        )
        out = _fallback_placeholder_estimate(payload)

    try:
        task.estimated_story_points = int(out["story_points"])
        task.ai_confidence = float(out.get("confidence", 0.0))
        task.source = str(out.get("method", "unknown"))
        db.commit()
        db.refresh(task)
    except Exception:
        db.rollback()
        logger.exception(
            "ai_estimate_db_error",
            extra={"task_id": task_id, "project_id": task.project_id},
        )
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
# POST /tasks/ai/estimate-effort
# =========================================================
@router.post("/ai/estimate-effort", response_model=list[EffortEstimateResponse])
def estimate_effort_all(req: EstimateEffortBatchRequest, db: Session = Depends(get_db)):
    _ai_enabled_or_503()

    tasks = db.query(Task).filter(Task.project_id == req.project_id).all()
    if not tasks:
        raise HTTPException(status_code=404, detail="No tasks found for project")

    project = db.query(Project).get(req.project_id)
    responses: list[EffortEstimateResponse] = []
    ai_service = AIService()

    for task in tasks:
        if (task.status or "").lower() == "done":
            continue

        history_text = None
        if req.include_history:
            history_text = _build_history_text(db, req.project_id, task.id, req.max_history_tasks)

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
            try:
                out = _fallback_placeholder_estimate(payload)
            except Exception:
                continue

        try:
            task.estimated_story_points = int(out["story_points"])
            task.ai_confidence = float(out.get("confidence", 0.0))
            task.source = str(out.get("method", "unknown"))

            db.commit()
            db.refresh(task)

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

    return responses


# =========================================================
# AI PROJECT SUMMARY
# POST /tasks/ai/project-summary
# =========================================================
@router.post("/ai/project-summary", response_model=ProjectSummaryResponse)
def create_project_summary(req: ProjectSummaryRequest, db: Session = Depends(get_db)):
    _ai_enabled_or_503()

    project = db.query(Project).get(req.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    q = db.query(Task).filter(Task.project_id == req.project_id)

    if req.task_ids is not None:
        if len(req.task_ids) == 0:
            raise HTTPException(status_code=400, detail="task_ids cannot be empty when provided")
        q = q.filter(Task.id.in_(req.task_ids))

    if not req.include_done:
        q = q.filter(Task.status != "done")

    tasks = q.order_by(desc(Task.created_at)).all()

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
    except (AIServiceTimeoutError, AIServiceInvalidResponseError, AIServiceError) as exc:
        logger.warning(
            "ai_project_summary_failed_fallback_placeholder",
            extra={"project_id": req.project_id, "error": str(exc)},
        )
        summary_text = _fallback_placeholder_project_summary(payload)
        method = "placeholder"
    except Exception as exc:
        logger.warning(
            "ai_project_summary_unknown_failed_fallback_placeholder",
            extra={"project_id": req.project_id, "error": str(exc)},
        )
        summary_text = _fallback_placeholder_project_summary(payload)
        method = "placeholder"

    return ProjectSummaryResponse(
        project_id=req.project_id,
        summary=summary_text,
        method=method,
    )