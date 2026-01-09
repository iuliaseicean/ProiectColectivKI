from datetime import datetime
import os
import logging

from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, desc, Float
from sqlalchemy.orm import Session

from backend.database import Base
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

from backend.project.project_router import Project

logger = logging.getLogger("backend.task")

# ==========================
#  SQLAlchemy MODEL
# ==========================
class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String)
    status = Column(String, default="todo")

    priority = Column(String, default="medium")
    complexity = Column(String, default="medium")
    estimated_story_points = Column(Integer, nullable=True)
    ai_confidence = Column(Float, nullable=True)
    assignee = Column(String, nullable=True)
    tags = Column(String, nullable=True)
    source = Column(String, default="manual")
    ai_story = Column(String)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# ==========================
#  ROUTER
# ==========================
router = APIRouter(
    prefix="/tasks",
    tags=["tasks"],
)

# --------------------------
# CRUD TASKS
# --------------------------
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
        raise HTTPException(404, "Task not found")
    return task

@router.patch("/{task_id}", response_model=TaskRead)
def update_task(task_id: int, data: TaskUpdate, db: Session = Depends(get_db)):
    task = db.query(Task).get(task_id)
    if not task:
        raise HTTPException(404, "Task not found")

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
        raise HTTPException(404, "Task not found")
    db.delete(task)
    db.commit()
    return

@router.patch("/{task_id}/status", response_model=TaskRead)
def update_status(task_id: int, status: str, db: Session = Depends(get_db)):
    task = db.query(Task).get(task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    task.status = status
    db.commit()
    db.refresh(task)
    return task

# --------------------------
# AI STORY / DESCRIPTION
# --------------------------
@router.post("/{task_id}/generate-story", response_model=TaskRead)
def generate_ai_story(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).get(task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    ai_text = f"AI-generated story for task '{task.title}':\n\nBased on previous tasks..."
    task.ai_story = ai_text
    db.commit()
    db.refresh(task)
    return task

@router.post("/{task_id}/ai-description", response_model=TaskRead)
def generate_ai_description(task_id: int, db: Session = Depends(get_db)):
    ai_enabled = os.getenv("AI_ENABLED", "false").lower() == "true"
    if not ai_enabled:
        raise HTTPException(status_code=503, detail="AI functionality is disabled")
    task = db.query(Task).get(task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    project = db.query(Project).get(task.project_id)
    ai_service = AIService()
    payload = {
        "title": task.title,
        "description": task.description,
        "project_name": project.name if project else None,
        "project_description": project.description if project else None,
        "tech_stack": getattr(project, "tech_stack", None) if project else None,
    }
    try:
        generated = ai_service.generate_description(payload)
    except AIServiceTimeoutError:
        logger.error("ai_timeout", extra={"task_id": task_id, "project_id": task.project_id, "error_type": "timeout"})
        raise HTTPException(status_code=504, detail="AI service timed out, please try again later")
    except AIServiceInvalidResponseError:
        logger.error("ai_invalid_response", extra={"task_id": task_id, "project_id": task.project_id, "error_type": "invalid_response"})
        raise HTTPException(status_code=502, detail="AI produced an invalid response")
    except AIServiceError:
        logger.exception("ai_service_error", extra={"task_id": task_id, "project_id": task.project_id, "error_type": "service_error"})
        raise HTTPException(status_code=502, detail="AI service failure")
    task.description = generated
    task.ai_story = (task.ai_story or "") + "\n\n[AI description generated]"
    db.commit()
    db.refresh(task)
    return task

# --------------------------
# AI EFFORT ESTIMATION (single)
# --------------------------
@router.post("/{task_id}/estimate", response_model=EffortEstimateResponse)
def estimate_effort(task_id: int, req: EffortEstimateRequest, db: Session = Depends(get_db)):
    ai_enabled = os.getenv("AI_ENABLED", "false").lower() == "true"
    if not ai_enabled:
        raise HTTPException(status_code=503, detail="AI functionality is disabled")
    task = db.query(Task).get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if (task.status or "").lower() == "done":
        raise HTTPException(status_code=409, detail="Cannot estimate effort for a DONE task")
    project = db.query(Project).get(task.project_id)

    history_text = None
    if req.include_history and req.max_history_tasks > 0:
        prev_tasks = (
            db.query(Task)
            .filter(Task.project_id == task.project_id, Task.id != task.id)
            .order_by(desc(Task.created_at))
            .limit(req.max_history_tasks)
            .all()
        )
        lines = [f"- {t.title} | status={t.status} | desc={t.description or ''}".strip() for t in reversed(prev_tasks)]
        history_text = "\n".join(lines) if lines else None

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

    ai_service = AIService()

    try:
        out = ai_service.estimate_effort(payload)
    except AIServiceTimeoutError:
        logger.warning("ai_estimate_timeout", extra={"task_id": task_id, "project_id": task.project_id})
        try:
            os.environ["AI_PROVIDER"] = "placeholder"
            out = AIService().estimate_effort(payload)
        except Exception:
            raise HTTPException(status_code=504, detail="AI service timed out")
    except AIServiceInvalidResponseError:
        logger.warning("ai_estimate_invalid_response", extra={"task_id": task_id, "project_id": task.project_id})
        try:
            os.environ["AI_PROVIDER"] = "placeholder"
            out = AIService().estimate_effort(payload)
        except Exception:
            raise HTTPException(status_code=502, detail="AI produced an invalid response")
    except AIServiceError:
        logger.exception("ai_estimate_service_error", extra={"task_id": task_id, "project_id": task.project_id})
        try:
            os.environ["AI_PROVIDER"] = "placeholder"
            out = AIService().estimate_effort(payload)
        except Exception:
            raise HTTPException(status_code=502, detail="AI service failure")

    try:
        task.estimated_story_points = int(out["story_points"])
        task.ai_confidence = float(out.get("confidence", 0.0))
        task.source = str(out.get("method", "unknown"))
        db.commit()
        db.refresh(task)
    except Exception:
        db.rollback()
        logger.exception("ai_estimate_db_error", extra={"task_id": task_id, "project_id": task.project_id})
        raise HTTPException(status_code=500, detail="Failed to persist estimate to database")

    return EffortEstimateResponse(
        task_id=task.id,
        project_id=task.project_id,
        story_points=task.estimated_story_points,
        confidence=task.ai_confidence,
        method=task.source,
        rationale=str(out.get("rationale", "")),
    )

# --------------------------
# 🔹 AI EFFORT ESTIMATION (batch for frontend)
# --------------------------
@router.post("/ai/estimate-effort", response_model=list[EffortEstimateResponse])
def estimate_effort_all(
    project_id: int = Body(...),
    include_history: bool = Body(True),
    max_history_tasks: int = Body(20),
    db: Session = Depends(get_db),
):
    tasks = db.query(Task).filter(Task.project_id == project_id).all()
    if not tasks:
        raise HTTPException(404, "No tasks found for project")

    ai_service = AIService()
    responses = []

    for task in tasks:
        history_text = None
        if include_history and max_history_tasks > 0:
            prev_tasks = (
                db.query(Task)
                .filter(Task.project_id == project_id, Task.id != task.id)
                .order_by(desc(Task.created_at))
                .limit(max_history_tasks)
                .all()
            )
            lines = [f"- {t.title} | status={t.status} | desc={t.description or ''}".strip() for t in reversed(prev_tasks)]
            history_text = "\n".join(lines) if lines else None

        payload = {
            "title": task.title,
            "description": task.description,
            "project_name": getattr(task, "project_id", None),
            "history": history_text,
            "scale": "Fibonacci 1,2,3,5,8,13,21",
        }

        try:
            out = ai_service.estimate_effort(payload)
            task.estimated_story_points = int(out["story_points"])
            task.ai_confidence = float(out.get("confidence", 0.0))
            task.source = str(out.get("method", "unknown"))
            db.commit()
            db.refresh(task)

            responses.append(EffortEstimateResponse(
                task_id=task.id,
                project_id=task.project_id,
                story_points=task.estimated_story_points,
                confidence=task.ai_confidence,
                method=task.source,
                rationale=str(out.get("rationale", "")),
            ))
        except Exception:
            db.rollback()
            continue

    return responses
