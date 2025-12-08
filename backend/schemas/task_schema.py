# backend/schemas/task_schema.py

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


# --------- Base schema (comune) ----------
class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    status: str = "todo"      # ex: "todo", "in_progress", "done"
    priority: int = 1         # 1 = low, 2 = medium, 3 = high
    project_id: int           # la ce proiect aparține task-ul


# --------- Pentru CREATE ----------
class TaskCreate(TaskBase):
    due_date: Optional[datetime] = None


# --------- Pentru UPDATE (PATCH) ----------
class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[int] = None
    due_date: Optional[datetime] = None


# --------- Pentru READ (răspunsuri) ----------
class TaskRead(TaskBase):
    id: int
    due_date: Optional[datetime]
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True
