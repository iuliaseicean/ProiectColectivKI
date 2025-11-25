# backend/schemas/project_schema.py

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


# --------- Base schema (common fields) ---------
class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None

    # Extra info for project details
    tech_stack: Optional[str] = None          
    infrastructure: Optional[str] = None     
    members_count: int = 0                   


# --------- For creating a project (POST) ---------
class ProjectCreate(ProjectBase):
    start_date: datetime


# --------- For updating a project (PATCH/PUT) ---------
class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    tech_stack: Optional[str] = None
    infrastructure: Optional[str] = None
    members_count: Optional[int] = None
    start_date: Optional[datetime] = None


# --------- For reading a project (GET responses) ---------
class ProjectRead(ProjectBase):
    id: int
    start_date: datetime
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True
