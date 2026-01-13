# backend/main.py

import os
from dotenv import load_dotenv

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv(
    dotenv_path=os.path.join(os.path.dirname(__file__), ".env"),
    override=True,
    encoding="utf-8-sig",
)

app = FastAPI(title="Proiect Colectiv AI Backend")

# ---------------- CORS ----------------
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5175",
    "http://127.0.0.1:5175",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

frontend_origin = os.getenv("FRONTEND_ORIGIN")
if frontend_origin:
    origins.append(frontend_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------- DATABASE + ROUTERS ----------------
from backend.database import Base, engine  # noqa: E402
from backend.auth.auth_router import router as auth_router  # noqa: E402
from backend.project.project_router import router as project_router  # noqa: E402
from backend.task.task_router import router as task_router  # noqa: E402

# Creează tabelele (pentru SQLite dev). Dacă folosiți Alembic strict, comentați.
Base.metadata.create_all(bind=engine)

# includem router-ele
# auth_router NU are prefix intern, deci îl setăm aici:
app.include_router(auth_router, prefix="/auth")

# project_router ARE deja prefix="/projects" în fișierul lui,
# deci NU mai adăugăm prefix aici:
app.include_router(project_router)

# task_router are deja prefix="/tasks" intern:
app.include_router(task_router)

# ---------------- ROOT ----------------
@app.get("/", tags=["health"])
def read_root():
    return {"message": "Backend running successfully 🚀"}