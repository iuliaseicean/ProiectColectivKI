# backend/schemas/notification_schema.py
from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, ConfigDict


class NotificationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    project_id: int | None = None
    task_id: int | None = None
    type: str
    title: str
    message: str | None = None
    is_read: bool
    created_at: datetime


class NotificationCreate(BaseModel):
    user_id: int
    project_id: int | None = None
    task_id: int | None = None
    type: str = "info"
    title: str
    message: str | None = None