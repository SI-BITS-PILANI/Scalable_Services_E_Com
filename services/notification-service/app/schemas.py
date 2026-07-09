from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = "notification-service"


class NotificationResponse(BaseModel):
    notification_id: str
    customer_id: str
    event_type: str
    order_id: Optional[str] = None
    message: str
    read: bool = False
    created_at: datetime


class SeedNotificationRequest(BaseModel):
    customer_id: str
    event_type: str
    order_id: Optional[str] = None
