# backend/schemas/task_schema.py

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator


# ----------------------------
# Helpers
# ----------------------------
_ALLOWED_LEVELS = {"low", "medium", "high"}
_ALLOWED_STATUS = {"todo", "in_progress", "done"}


def _norm_level(v: Optional[str], default: str = "medium") -> str:
    if v is None:
        return default
    s = str(v).strip().lower()
    return s if s in _ALLOWED_LEVELS else default


def _norm_status(v: Optional[str], default: str = "todo") -> str:
    if v is None:
        return default
    s = str(v).strip().lower()
    return s if s in _ALLOWED_STATUS else default


# ============================
# TASKS
# ============================

# ====== CREATE ======
class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1)
    description: Optional[str] = None

    project_id: int

    priority: str = Field(default="medium", pattern="^(low|medium|high)$")
    complexity: str = Field(default="medium", pattern="^(low|medium|high)$")

    assignee: Optional[str] = None
    tags: Optional[str] = None
    source: Optional[str] = Field(default="manual")

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Title cannot be empty")
        return s

    @field_validator("priority", "complexity")
    @classmethod
    def validate_levels(cls, v: str) -> str:
        return _norm_level(v)


# ====== UPDATE ======
class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None

    priority: Optional[str] = None
    complexity: Optional[str] = None

    assignee: Optional[str] = None
    tags: Optional[str] = None

    ai_story: Optional[str] = None
    source: Optional[str] = None

    @field_validator("title")
    @classmethod
    def validate_title_optional(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        s = v.strip()
        if not s:
            raise ValueError("Title cannot be empty")
        return s

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        return _norm_status(v)

    @field_validator("priority", "complexity")
    @classmethod
    def validate_levels_optional(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        return _norm_level(v)


# ====== READ ======
class TaskRead(BaseModel):
    id: int
    title: str
    description: Optional[str]
    status: str

    priority: str
    complexity: str

    # 🔹 Persisted in DB
    estimated_story_points: Optional[int] = None
    ai_confidence: Optional[float] = None

    # 🔹 Frontend-friendly field (alias)
    story_points: Optional[int] = None

    assignee: Optional[str] = None
    tags: Optional[str] = None
    source: str

    ai_story: Optional[str] = None
    project_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="after")
    def fill_story_points(self):
        """
        If story_points is not provided, map it from estimated_story_points.
        This keeps UI simple: it can read task.story_points directly.
        """
        if self.story_points is None and self.estimated_story_points is not None:
            self.story_points = self.estimated_story_points

        # defensive normalization (in case DB contains unexpected values)
        self.status = _norm_status(self.status)
        self.priority = _norm_level(self.priority)
        self.complexity = _norm_level(self.complexity)

        return self


# ============================
# AI: EFFORT ESTIMATION
# ============================

class EffortEstimateResponse(BaseModel):
    task_id: int
    project_id: int
    story_points: int
    confidence: float  # 0..1
    method: str        # "openai" / "placeholder" / "local"
    rationale: str     # scurt, 1-4 propoziții


class EffortEstimateRequest(BaseModel):
    include_history: bool = True
    max_history_tasks: int = Field(default=20, ge=0, le=100)


# ============================
# AI: PROJECT SUMMARY
# ============================

class ProjectSummaryRequest(BaseModel):
    project_id: int
    include_done: bool = True
    max_tasks: int = Field(default=50, ge=0, le=200)


class ProjectSummaryResponse(BaseModel):
    project_id: int
    summary: str
    method: str