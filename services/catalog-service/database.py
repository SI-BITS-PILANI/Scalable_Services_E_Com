"""MongoDB connection for the Catalog Service.

This service OWNS catalog_db. No other service connects here — cross-service
data is only ever exchanged via the Catalog API (REST/gRPC). This is the
Database-per-Service pattern.
"""
from motor.motor_asyncio import AsyncIOMotorClient

from config import settings

client = AsyncIOMotorClient(settings.mongo_uri)
db = client[settings.db_name]
products_collection = db["products"]
