import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./kingshot_atlas.db")

# Dual-DB: SQLite by default (local dev + Render ephemeral storage)
# PostgreSQL when DATABASE_URL is set (Supabase uses postgres:// which SQLAlchemy needs as postgresql://)
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Configure engine based on database type
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=300)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    """SQLAlchemy 2.x declarative base class"""
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
