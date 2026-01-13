# backend/notification/notification_router.py
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.auth.auth_router import get_db
from backend.models.notification import Notification
from backend.schemas.notification_schema import NotificationRead, NotificationCreate

router = APIRouter(prefix="/notifications", tags=["notifications"])


# IMPORTANT:
# dacă ai auth real (JWT) ia user_id din token.
# Până atunci, folosim query param user_id ca MVP.
def _require_user_id(user_id: int | None):
    if user_id is None:
        raise HTTPException(status_code=400, detail="user_id is required for MVP notifications")


@router.get("/", response_model=list[NotificationRead])
def list_notifications(
    user_id: int | None = None,
    limit: int = 30,
    db: Session = Depends(get_db),
):
    _require_user_id(user_id)
    q = (
        db.query(Notification)
        .filter(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
    )
    return q.all()


@router.get("/unread_count")
def unread_count(user_id: int | None = None, db: Session = Depends(get_db)):
    _require_user_id(user_id)
    count = (
        db.query(func.count(Notification.id))
        .filter(Notification.user_id == user_id, Notification.is_read == False)  # noqa: E712
        .scalar()
    )
    return {"unread": int(count or 0)}


@router.post("/", response_model=NotificationRead)
def create_notification(data: NotificationCreate, db: Session = Depends(get_db)):
    n = Notification(**data.model_dump())
    db.add(n)
    db.commit()
    db.refresh(n)
    return n


@router.post("/{notification_id}/read", response_model=NotificationRead)
def mark_read(notification_id: int, user_id: int | None = None, db: Session = Depends(get_db)):
    _require_user_id(user_id)

    n = db.get(Notification, notification_id)
    if not n or n.user_id != user_id:
        raise HTTPException(status_code=404, detail="Notification not found")

    n.is_read = True
    db.commit()
    db.refresh(n)
    return n


@router.post("/read_all")
def mark_all_read(user_id: int | None = None, db: Session = Depends(get_db)):
    _require_user_id(user_id)

    db.query(Notification).filter(Notification.user_id == user_id, Notification.is_read == False).update(  # noqa: E712
        {"is_read": True}
    )
    db.commit()
    return {"ok": True}


@router.delete("/{notification_id}", status_code=204)
def delete_notification(notification_id: int, user_id: int | None = None, db: Session = Depends(get_db)):
    _require_user_id(user_id)

    n = db.get(Notification, notification_id)
    if not n or n.user_id != user_id:
        raise HTTPException(status_code=404, detail="Notification not found")

    db.delete(n)
    db.commit()
    return