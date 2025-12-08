# backend/schemas/task_schema.py

from datetime import datetime
from pydantic import BaseModel
from typing import Optional


# ====== CREATE ======
class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    project_id: int


# ====== UPDATE ======
class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    ai_story: Optional[str] = None


# ====== READ ======
class TaskRead(BaseModel):
    id: int
    title: str
    description: Optional[str]
    status: Optional[str]
    ai_story: Optional[str]
    project_id: int
    created_at: datetime

    class Config:
        orm_mode = True
