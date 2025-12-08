# backend/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

# ---------------- ENV ----------------
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

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

# ---------------- DATABASE INIT ----------------
from backend.database import Base, engine  # noqa: E402
from backend.task_model import Task  # noqa: F401


print("🔧 Checking database models...")
Base.metadata.create_all(bind=engine)
print("✅ Database ready.")

# ---------------- ROUTERS ----------------
from backend.auth.auth_router import router as auth_router  # noqa: E402
from backend.project.project_router import router as project_router  # noqa: E402

app.include_router(auth_router, prefix="/auth")
# ATENȚIE: aici NU mai punem prefix, îl are routerul deja
app.include_router(project_router)

# ---------------- ROOT ----------------
@app.get("/")
def read_root():
    return {"message": "Backend running successfully 🚀"}
