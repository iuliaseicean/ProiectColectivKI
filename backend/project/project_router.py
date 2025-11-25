# backend/project/project_router.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime

from backend.database import Base, engine
from backend.auth.auth_router import get_db
from backend.schemas.project_schema import ProjectCreate, ProjectUpdate, ProjectRead


# ==========================
#  SQLAlchemy MODEL
# ==========================
class Project(Base):
    __tablename__ = "projects"  # !!! FOARTE IMPORTANT: DOUĂ underscore la început și DOUĂ la final

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String)

    # câmpuri extra pentru detaliile proiectului
    tech_stack = Column(String, nullable=True)
    infrastructure = Column(String, nullable=True)
    members_count = Column(Integer, default=0)

    start_date = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)


# Creează tabelele în baza de date (SQLite → app.db)
Base.metadata.create_all(bind=engine)

router = APIRouter()


# ==========================
#  CREATE PROJECT
# ==========================
@router.post("/", response_model=ProjectRead)
def create_project(data: ProjectCreate, db: Session = Depends(get_db)):
    project = Project(
        name=data.name,
        description=data.description,
        tech_stack=data.tech_stack,
        infrastructure=data.infrastructure,
        members_count=data.members_count,
        start_date=data.start_date,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


# ==========================
#  GET ALL PROJECTS
# ==========================
@router.get("/", response_model=list[ProjectRead])
def get_all_projects(db: Session = Depends(get_db)):
    return db.query(Project).all()


# ==========================
#  GET PROJECT BY ID
# ==========================
@router.get("/{project_id}", response_model=ProjectRead)
def get_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).get(project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    return project


# ==========================
#  UPDATE PROJECT (PATCH)
# ==========================
@router.patch("/{project_id}", response_model=ProjectRead)
def update_project(
    project_id: int,
    data: ProjectUpdate,
    db: Session = Depends(get_db),
):
    project = db.query(Project).get(project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    # folosim "is not None" ca să putem salva și string gol sau 0
    if data.name is not None:
        project.name = data.name
    if data.description is not None:
        project.description = data.description
    if data.tech_stack is not None:
        project.tech_stack = data.tech_stack
    if data.infrastructure is not None:
        project.infrastructure = data.infrastructure
    if data.members_count is not None:
        project.members_count = data.members_count
    if data.start_date is not None:
        project.start_date = data.start_date

    db.commit()
    db.refresh(project)
    return project


# ==========================
#  DELETE PROJECT
# ==========================
@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    db.delete(project)
    db.commit()
    return