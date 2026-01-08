# backend/schemas/task_schema.py

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, ConfigDict, field_validator


# ====== CREATE ======
class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1)
    description: Optional[str] = None

    project_id: int

    priority: str = Field(default="medium", pattern="^(low|medium|high)$")
    complexity: str = Field(default="medium", pattern="^(low|medium|high)$")

    assignee: Optional[str] = None
    tags: Optional[str] = None



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



# ====== READ ======
class TaskRead(BaseModel):
    id: int
    title: str
    description: Optional[str]
    status: str

    priority: str
    complexity: str
    estimated_story_points: Optional[int]
    ai_confidence: Optional[float]
    assignee: Optional[str]
    tags: Optional[str]
    source: str

    ai_story: Optional[str]
    project_id: int
    created_at: datetime
    updated_at: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)


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
