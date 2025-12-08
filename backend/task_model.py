# backend/task_model.py

from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey

from backend.database import Base, engine
# 👇 importăm Project ca să fie înregistrat în metadata înainte de create_all
from backend.project.project_router import Project  # noqa: F401


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String)

    status = Column(String, default="todo")
    priority = Column(Integer, default=1)

    due_date = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # legătura cu projects.id
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)


# Creează tabela tasks (acum știe și de projects)
Base.metadata.create_all(bind=engine)
