# backend/auth/auth_router.py

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy.orm import Session
from sqlalchemy import Column, Integer, String, Boolean
from dotenv import load_dotenv
import os
import re

# ================= ENV =================
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
RESET_TOKEN_EXPIRE_MINUTES = int(os.getenv("RESET_TOKEN_EXPIRE_MINUTES", "15"))
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173")

if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY missing in .env!")

# ================= SECURITY =================
router = APIRouter(tags=["auth"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# ================= DATABASE =================
from backend.database import Base, engine, SessionLocal


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)


Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ================= HELPERS =================
def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(sub: str, minutes: int = ACCESS_TOKEN_EXPIRE_MINUTES):
    exp = datetime.now(timezone.utc) + timedelta(minutes=minutes)
    return jwt.encode({"sub": sub, "exp": exp}, SECRET_KEY, algorithm=ALGORITHM)


def create_password_reset_token(user_id: int):
    exp = datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(
        {"sub": str(user_id), "exp": exp, "type": "pwd_reset"},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def decode_password_reset_token(token: str) -> int:
    try:
        data = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if data.get("type") != "pwd_reset":
            raise HTTPException(status_code=400, detail="Invalid reset token")
        return int(data["sub"])
    except JWTError:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")


# ================= SCHEMAS =================
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    confirm_password: str

    @field_validator("password")
    def validate_password(cls, value):
        if len(value) < 8:
            raise ValueError("Password must be at least 8 chars")
        if not re.search(r"[A-Z]", value):
            raise ValueError("Must contain uppercase")
        if not re.search(r"\d", value):
            raise ValueError("Must contain number")
        if not re.search(r"[^A-Za-z0-9]", value):
            raise ValueError("Must contain symbol")
        return value

    @field_validator("confirm_password")
    def passwords_match(cls, v, info):
        if v != info.data.get("password"):
            raise ValueError("Passwords do not match.")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str
    confirm_password: str

    @field_validator("new_password")
    def validate_password(cls, value):
        if len(value) < 8:
            raise ValueError("Password must be at least 8 chars")
        if not re.search(r"[A-Z]", value):
            raise ValueError("Must contain uppercase")
        if not re.search(r"\d", value):
            raise ValueError("Must contain number")
        if not re.search(r"[^A-Za-z0-9]", value):
            raise ValueError("Must contain symbol")
        return value

    @field_validator("confirm_password")
    def passwords_match(cls, v, info):
        if v != info.data.get("new_password"):
            raise ValueError("Passwords do not match.")
        return v


# ================= ROUTES =================
@router.post("/register", status_code=201)
def register_user(request: RegisterRequest, db: Session = Depends(get_db)):
    exists = db.query(User).filter(User.email == request.email).first()
    if exists:
        raise HTTPException(400, "Email already registered")

    user = User(
        email=request.email,
        password_hash=hash_password(request.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return {"message": "User registered", "email": user.email}


@router.post("/login")
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == request.email).first()

    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(401, "Invalid credentials")

    token = create_access_token(str(user.id))
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me")
def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    try:
        data = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(data["sub"])
    except JWTError:
        raise HTTPException(401, "Invalid or expired token")

    user = db.query(User).get(user_id)
    if not user:
        raise HTTPException(404, "User not found")

    return {"id": user.id, "email": user.email}


@router.post("/forgot-password")
def forgot_password(
    req: ForgotPasswordRequest,
    db: Session = Depends(get_db),
):
    """
    IMPORTANT:
    - Răspuns identic indiferent dacă email-ul există
    - Anti user-enumeration
    """
    user = db.query(User).filter(User.email == req.email).first()

    response = {"message": "If the email exists, a reset link was sent."}

    if not user:
        return response

    token = create_password_reset_token(user.id)
    reset_link = f"{FRONTEND_BASE_URL}/reset-password?token={token}"

    # Placeholder pentru email real
    print(f"[PASSWORD RESET LINK] {user.email}: {reset_link}")

    return response


@router.post("/reset-password")
def reset_password(
    req: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    user_id = decode_password_reset_token(req.token)

    user = db.query(User).get(user_id)
    if not user:
        raise HTTPException(404, "User not found")

    user.password_hash = hash_password(req.new_password)
    db.commit()

    return {"message": "Password updated successfully"}
