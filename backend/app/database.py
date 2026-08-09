import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is missing in .env file. copy connection string from InsForge dashboard  ")
engine = create_engine(
    DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_timeout=15,
    # Recycle/health-check connections so a connection silently dropped by the managed
    # Postgres proxy (idle timeout, etc.) is replaced instead of hanging a request that
    # tries to use it. pool_timeout is also lowered from the 30s default so a genuinely
    # exhausted pool fails fast with a clear error instead of looking like a hang.
    pool_pre_ping=True,
    pool_recycle=1800,
    connect_args={
        # Hard server-side cap: no single query/commit on this connection can block
        # longer than this, no matter what (network half-open, proxy weirdness, a
        # stuck lock, etc.) - it fails with a normal exception instead of hanging the
        # request forever. Pipeline runs already catch and record such failures.
        "options": "-c statement_timeout=15000",
        # TCP keepalives well below Postgres/proxy idle-close windows, so a silently
        # dead connection (server closed it without telling the client) is detected
        # in seconds instead of relying on the OS default (often 2+ hours on Linux).
        "keepalives": 1,
        "keepalives_idle": 15,
        "keepalives_interval": 5,
        "keepalives_count": 3,
        "connect_timeout": 10,
    },
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
