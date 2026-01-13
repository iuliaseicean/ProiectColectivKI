# backend/models/task.py

from __future__ import annotations

from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float
from backend.database import Base


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)

    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    status = Column(String, default="todo")

    priority = Column(String, default="medium")
    complexity = Column(String, default="medium")

    estimated_story_points = Column(Integer, nullable=True)
    ai_confidence = Column(Float, nullable=True)

    assignee = Column(String, nullable=True)
    tags = Column(String, nullable=True)

    source = Column(String, default="manual")
    ai_story = Column(String, nullable=True)

    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)