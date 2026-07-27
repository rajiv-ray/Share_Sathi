# backend/app/core/database.py
import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Load the environment variables from the .env file
load_dotenv()

# Fetch the database URL
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")
if not SQLALCHEMY_DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL environment variable is not set. Add it to your .env file "
        "before starting the server."
    )

# SQLite restricts a connection to the thread that created it by default;
# FastAPI runs sync 'def' endpoints in a worker thread pool, so without this
# a request can fail with "SQLite objects created in a thread can only be
# used in that same thread". Other databases ignore this option.
connect_args = {"check_same_thread": False} if SQLALCHEMY_DATABASE_URL.startswith("sqlite") else {}

# pool_pre_ping checks a pooled connection is still alive before handing it
# to a session. Without it, a connection the DB server silently closed after
# sitting idle (common on hosted Postgres) surfaces as a confusing
# "server closed the connection unexpectedly" on a random, unrelated request.
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,
)

# Create a SessionLocal class for database sessions
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create a Base class for our models to inherit from
Base = declarative_base()


# Dependency to get the database session in our API routes
def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()