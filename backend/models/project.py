# backend/models/project.py
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from backend.database import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)

    # ✅ owner
    # IMPORTANT (dev / SQLite):
    # - În DB-ul existent, coloana user_id a fost adăugată ulterior.
    # - Până se face backfill (UPDATE projects SET user_id=...), pot exista rânduri cu NULL.
    # - Ca să nu crape aplicația, îl lăsăm nullable=True în dev.
    # - După ce ai migrare reală (Alembic), îl poți pune înapoi nullable=False.
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    name = Column(String, nullable=False)
    description = Column(String, nullable=True)

    tech_stack = Column(String, nullable=True)
    infrastructure = Column(String, nullable=True)

    members_count = Column(Integer, default=0, nullable=False)

    start_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)