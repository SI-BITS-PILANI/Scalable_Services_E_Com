"""MongoDB connection for the Notification Service.

This service OWNS notification_db. No other service connects here — cross-service
data is only ever exchanged via the Notification API (REST). This is the
Database-per-Service pattern.

MongoDB is used because notifications are naturally document-shaped, append-only,
and require flexible querying by customer.
"""
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorCollection


def get_notifications_collection(mongo_uri: str, db_name: str) -> AsyncIOMotorCollection:
    """Return the notifications collection for the given database URI."""
    client = AsyncIOMotorClient(mongo_uri)
    db = client[db_name]
    return db["notifications"]
