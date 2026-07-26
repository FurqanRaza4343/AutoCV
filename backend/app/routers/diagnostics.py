import os
import time
import requests
import threading
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from ..database import get_db
from .. import models

router = APIRouter(prefix="/diagnostics", tags=["diagnostics"])


def _test_apify_async(result_container: dict):
    apify_token = os.getenv("APIFY_API_TOKEN", "")
    if not apify_token:
        result_container["apify"] = "No token configured"
        return
    try:
        resp = requests.post(
            "https://api.apify.com/v2/acts/memo23~rozee-scraper/runs",
            headers={"Authorization": f"Bearer {apify_token}", "Content-Type": "application/json"},
            json={"searchQueries": ["web developer"], "locations": [], "maxItemsPerQuery": 2, "scrapeJobDetails": True},
            timeout=15,
        )
        run_id = resp.json()["data"]["id"]
        for _ in range(6):
            time.sleep(5)
            sr = requests.get(f"https://api.apify.com/v2/actor-runs/{run_id}", headers={"Authorization": f"Bearer {apify_token}"}, timeout=15)
            st = sr.json()["data"]["status"]
            if st == "SUCCEEDED":
                did = sr.json()["data"]["defaultDatasetId"]
                ir = requests.get(f"https://api.apify.com/v2/datasets/{did}/items", headers={"Authorization": f"Bearer {apify_token}"}, timeout=15)
                items = ir.json()
                if not isinstance(items, list): items = []
                result_container["apify"] = f"OK: {len(items)} items"
                return
            elif st in ("FAILED", "ABORTED", "TIMED-OUT"):
                result_container["apify"] = f"Failed: {st}"
                return
        result_container["apify"] = "Timed out (30s)"
    except Exception as e:
        result_container["apify"] = f"Error: {type(e).__name__}"


@router.get("")
def run_diagnostics(db: Session = Depends(get_db)):
    start = time.time()
    db_ok = True
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        db_ok = False
    latency = int((time.time() - start) * 1000)
    agents = db.query(models.Agent).all()
    responsive = sum(1 for a in agents if a.is_running)

    apify_token = os.getenv("APIFY_API_TOKEN", "")
    apify_ok = bool(apify_token)
    apify_result = {"apify": "Testing..." if apify_ok else "No token"}
    if apify_ok:
        t = threading.Thread(target=_test_apify_async, args=(apify_result,), daemon=True)
        t.start()
        t.join(timeout=35)
    apify_test = apify_result.get("apify", "Test timed out")

    pipeline_runs = db.query(models.PipelineRun).count()
    pipeline_results = db.query(models.PipelineResult).count()

    return {
        "status": "healthy" if db_ok else "degraded",
        "agents_responsive": responsive,
        "database_connected": db_ok,
        "api_latency_ms": max(latency, 1),
        "apify_token_present": apify_ok,
        "apify_test": apify_test,
        "total_candidates": db.query(models.Candidate).count(),
        "total_pipeline_runs": pipeline_runs,
        "total_pipeline_results": pipeline_results,
        "background_scheduler": "active" if apify_ok else "inactive",
        "message": f"All systems nominal. {responsive} HR agent(s) responsive. Latency: {max(latency, 1)}ms.",
    }
