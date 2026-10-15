"""Connexion à PostgreSQL (SQLAlchemy 2, mode synchrone) et session par requête."""

from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings

engine = create_engine(get_settings().database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    """Classe mère de tous les modèles : leurs tables forment Base.metadata (utilisé par Alembic)."""


def get_db() -> Iterator[Session]:
    """Dépendance FastAPI : une session par requête, fermée à la fin."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
