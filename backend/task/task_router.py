from datetime import datetime
import os
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import Session

from backend.database import Base
from backend.auth.auth_router import get_db
from backend.schemas.task_schema import TaskCreate, TaskUpdate, TaskRead

# AI service (keeps logic out of router)
from backend.task.ai_service import (
    AIService,
    AIServiceError,
    AIServiceTimeoutError,
    AIServiceInvalidResponseError,
)

# Import Project model for contextual info; this mirrors existing project model
from backend.project.project_router import Project

logger = logging.getLogger("backend.task")


# ==========================
#  SQLAlchemy MODEL
# ==========================
class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String)                     # poate fi None
    status = Column(String, default="todo")          # "todo" / "in_progress" / "done"
    ai_story = Column(String)                        # text generat de AI (opțional)

    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)


# !!! NU mai facem Base.metadata.create_all aici !!!
# Tabelele se creează din main.py, o singură dată


# ==========================
#  ROUTER
# ==========================
router = APIRouter(
    prefix="/tasks",
    tags=["tasks"],
)


@router.post("/", response_model=TaskRead)
def create_task(data: TaskCreate, db: Session = Depends(get_db)):
    task = Task(
        title=data.title,
        description=data.description,
        project_id=data.project_id,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.get("/", response_model=list[TaskRead])
def get_all_tasks(db: Session = Depends(get_db)):
    return db.query(Task).all()


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


@router.get("/project/{project_id}", response_model=list[TaskRead])
def get_tasks_by_project(project_id: int, db: Session = Depends(get_db)):
    return db.query(Task).filter(Task.project_id == project_id).all()


@router.patch("/{task_id}/status", response_model=TaskRead)
def update_status(task_id: int, status: str, db: Session = Depends(get_db)):
    task = db.query(Task).get(task_id)
    if not task:
        raise HTTPException(404, "Task not found")

    task.status = status
    db.commit()
    db.refresh(task)
    return task


@router.post("/{task_id}/generate-story", response_model=TaskRead)
def generate_ai_story(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).get(task_id)
    if not task:
        raise HTTPException(404, "Task not found")

    # placeholder până avem AI real
    ai_text = (
        f"AI-generated story for task '{task.title}':\n\n"
        f"Based on previous tasks..."
    )

    task.ai_story = ai_text
    db.commit()
    db.refresh(task)
    return task


@router.post("/{task_id}/ai-description", response_model=TaskRead)
def generate_ai_description(task_id: int, db: Session = Depends(get_db)):
    """Generate a detailed task description using the AI service.

    Uses `AI_ENABLED` environment flag to enable/disable the feature.
    """
    # Feature flag
    ai_enabled = os.getenv("AI_ENABLED", "false").lower() == "true"
    if not ai_enabled:
        raise HTTPException(status_code=503, detail="AI functionality is disabled")

    task = db.query(Task).get(task_id)
    if not task:
        raise HTTPException(404, "Task not found")

    # Load project context when available
    project = db.query(Project).get(task.project_id)

    ai_service = AIService()

    payload = {
        "title": task.title,
        "description": task.description,
        "project_name": project.name if project else None,
        "project_description": project.description if project else None,
        "tech_stack": getattr(project, "tech_stack", None) if project else None,
    }

    # Call AI service and handle domain-specific errors
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

    # Save generated description (do not log full text)
    task.description = generated
    # Optionally record that an AI-generated description exists
    task.ai_story = (task.ai_story or "") + "\n\n[AI description generated]"
    db.commit()
    db.refresh(task)
    return task
