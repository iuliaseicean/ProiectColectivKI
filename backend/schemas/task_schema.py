# backend/schemas/task_schema.py

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


# ====== CREATE ======
class TaskCreate(BaseModel):
    """
    Schema folosită la crearea unui task nou.
    """
    title: str
    description: Optional[str] = None
    project_id: int


# ====== UPDATE ======
class TaskUpdate(BaseModel):
    """
    Schema folosită la actualizarea (parțială) a unui task existent.
    Toate câmpurile sunt opționale.
    """
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None          # "todo" / "in_progress" / "done"
    ai_story: Optional[str] = None        # text generat de AI (opțional)


# ====== READ ======
class TaskRead(BaseModel):
    """
    Schema folosită la răspunsurile API (citire task).
    """
    id: int
    title: str
    description: Optional[str] = None
    status: str = "todo"
    ai_story: Optional[str] = None
    project_id: int
    created_at: datetime

    class Config:
        orm_mode = True
