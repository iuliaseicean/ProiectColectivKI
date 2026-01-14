from __future__ import annotations

from typing import Optional
from sqlalchemy.orm import Session

from backend.models.notification import Notification


def create_notification(
    db: Session,
    *,
    user_id: int,
    title: str,
    message: str | None = None,
    project_id: Optional[int] = None,
    link: Optional[str] = None,
) -> Notification:
    n = Notification(
        user_id=user_id,
        project_id=project_id,
        title=title,
        message=message,
        link=link,
        is_read=False,
    )
    db.add(n)
    db.commit()
    db.refresh(n)
    return n