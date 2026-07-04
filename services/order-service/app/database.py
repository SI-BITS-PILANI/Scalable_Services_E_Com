from __future__ import annotations

import os
from typing import Optional

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


DEFAULT_DATABASE_URL = "sqlite:///./order_service.db"


def get_database_url(explicit_url: Optional[str] = None) -> str:
    return explicit_url or os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL)


def create_session_factory(database_url: Optional[str] = None) -> sessionmaker:
    resolved_url = get_database_url(database_url)
    connect_args = {"check_same_thread": False} if resolved_url.startswith("sqlite") else {}
    engine = create_engine(resolved_url, future=True, connect_args=connect_args)
    return sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
