from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey

from backend.database import Base, engine
from backend.auth.auth_router import get_db
from backend.schemas.task_schema import TaskCreate, TaskUpdate, TaskRead


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String)
    status = Column(String, default="todo")      # todo / in_progress / done
    ai_story = Column(String)

    project_id = Column(Integer, ForeignKey("projects.id"))

    created_at = Column(DateTime, default=datetime.utcnow)


Base.metadata.create_all(bind=engine)

router = APIRouter(prefix="/tasks")
@router.post("/", response_model=TaskRead)
def create_task(data: TaskCreate, db: Session = Depends(get_db)):
    task = Task(
        title=data.title,
        description=data.description,
        project_id=data.project_id
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

    # pana fac ai
    ai_text = f"AI-generated story for task '{task.title}':\n\nBased on previous tasks..."

    task.ai_story = ai_text
    db.commit()
    db.refresh(task)
    return task
