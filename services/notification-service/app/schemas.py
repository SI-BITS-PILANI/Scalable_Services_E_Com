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


# v2 schema adds non-breaking fields: priority, action_required, service_version
# v1 clients ignore these; v2-aware clients get prioritization and action hints
class NotificationResponseV2(BaseModel):
    # v1 fields (unchanged for backward compatibility)
    notification_id: str
    customer_id: str
    event_type: str
    order_id: Optional[str] = None
    message: str
    read: bool = False
    created_at: datetime
    # v2 additions (non-breaking, optional fields)
    priority: str  # "HIGH" for payment failures, "NORMAL" for others
    action_required: bool  # True if action needed (e.g., retry payment)
    service_version: str = "2.0"


class SeedNotificationRequest(BaseModel):
    customer_id: str
    event_type: str
    order_id: Optional[str] = None
