# backend/models/project.py

from __future__ import annotations

from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime

from backend.database import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)

    tech_stack = Column(String, nullable=True)
    infrastructure = Column(String, nullable=True)
    members_count = Column(Integer, default=0)

    start_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)