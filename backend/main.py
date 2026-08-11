import os
import threading
import time
import requests
from dotenv import load_dotenv
from sqlalchemy import text
from sqlalchemy.exc import OperationalError
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine, SessionLocal
from app import models
from app.routers import auth, candidates, agents, dashboard, diagnostics, notifications, jobs, queue, pipeline

load_dotenv()


def _init_db(max_attempts: int = 5, delay_seconds: int = 3) -> None:
    # A single transient DB connectivity blip at import time used to crash the whole
    # process before the FastAPI app object even existed, with no chance to recover.
    # Retry a few times first - a momentary hiccup shouldn't take the whole server down.
    for attempt in range(1, max_attempts + 1):
        try:
            Base.metadata.create_all(bind=engine)
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE job_descriptions ADD COLUMN IF NOT EXISTS embedding TEXT"))
                conn.commit()
            return
        except OperationalError as e:
            if attempt == max_attempts:
                print(f"[startup] Database unreachable after {max_attempts} attempts: {e}")
                raise
            print(f"[startup] Database not reachable yet (attempt {attempt}/{max_attempts}), retrying in {delay_seconds}s...")
            time.sleep(delay_seconds)


_init_db()


app = FastAPI(title="Agentix HR Backend")

frontend_origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")
origins = [o.strip() for o in frontend_origin.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(candidates.router, prefix="/api")
app.include_router(agents.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(diagnostics.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(jobs.router, prefix="/api")
app.include_router(queue.router, prefix="/api")
app.include_router(pipeline.router, prefix="/api")


@app.on_event("startup")
def validate_env():
    missing = []
    mistral_key = os.getenv("MISTRAL_API_KEY", "")
    if not mistral_key:
        missing.append("MISTRAL_API_KEY")
    else:
        try:
            r = requests.post(
                "https://api.mistral.ai/v1/chat/completions",
                headers={"Authorization": f"Bearer {mistral_key}", "Content-Type": "application/json"},
                json={"model": "mistral-small-latest", "messages": [{"role": "user", "content": "ping"}], "max_tokens": 1},
                timeout=10,
            )
            if r.status_code == 401:
                print("[startup] WARNING: MISTRAL_API_KEY is invalid (401)")
            else:
                print(f"[startup] Mistral API key validated ({r.status_code})")
        except Exception as e:
            print(f"[startup] WARNING: Could not validate Mistral API key: {e}")

    if os.getenv("DATABASE_URL", "").startswith("postgresql://"):
        pass
    else:
        missing.append("DATABASE_URL (not a postgres URL)")

    if missing:
        print(f"[startup] Missing env vars: {', '.join(missing)}")


@app.get("/")
def root():
    return {"status": "Agentix backend is working"}


FETCH_INTERVAL_HOURS = int(os.getenv("FETCH_INTERVAL_HOURS", "6"))


def _background_fetcher():
    time.sleep(60)
    while True:
        try:
            db = SessionLocal()
            fetcher_agent = db.query(models.Agent).filter(models.Agent.id == "fetcher").first()
            if fetcher_agent and fetcher_agent.is_running:
                from app.routers.agents import _run_fetcher_bot
                print("[scheduler] Background fetcher: running auto-fetch cycle...")
                _run_fetcher_bot()
            db.close()
        except Exception as e:
            print(f"[scheduler] Background fetcher error: {e}")
        time.sleep(FETCH_INTERVAL_HOURS * 3600)


scheduler_thread = threading.Thread(target=_background_fetcher, daemon=True)
scheduler_thread.start()
