# backend/models/notification.py
from __future__ import annotations

from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from backend.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)

    # dacă ai user_id în sistem (users table), păstrează-l
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # opțional: legătură cu proiect/task pentru filtrare și navigare
    project_id = Column(Integer, nullable=True, index=True)
    task_id = Column(Integer, nullable=True, index=True)

    # tip + text
    type = Column(String, nullable=False, default="info")  # info | success | warning | error
    title = Column(String, nullable=False)
    message = Column(String, nullable=True)

    is_read = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)