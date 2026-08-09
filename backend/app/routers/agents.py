import os
import json
import threading
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db, SessionLocal
from .. import models, schemas
from ..email_service import send_screening_result, send_interview_invite

router = APIRouter(prefix="/agents", tags=["agents"])


@router.get("", response_model=list[schemas.AgentOutWithConfig])
def list_agents(db: Session = Depends(get_db)):
    return db.query(models.Agent).all()


@router.get("/{agent_id}", response_model=schemas.AgentOutWithConfig)
def get_agent(agent_id: str, db: Session = Depends(get_db)):
    agent = db.query(models.Agent).filter(models.Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(404, "No Agent found")
    return agent


@router.patch("/{agent_id}", response_model=schemas.AgentOutWithConfig)
def toggle_agent(agent_id: str, payload: schemas.AgentToggle, db: Session = Depends(get_db)):
    agent = db.query(models.Agent).filter(models.Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(404, "No Agent found ")
    agent.is_running = payload.is_running
    db.commit()
    db.refresh(agent)

    if payload.is_running:
        if agent_id == "fetcher":
            threading.Thread(target=_run_fetcher_bot, daemon=True).start()
        elif agent_id == "parser":
            threading.Thread(target=_run_parser_bot, daemon=True).start()
        elif agent_id == "ranker":
            threading.Thread(target=_run_ranker_bot, daemon=True).start()
        elif agent_id == "scheduler":
            threading.Thread(target=_run_scheduler_bot, daemon=True).start()

    return agent


@router.patch("/{agent_id}/config", response_model=schemas.AgentOutWithConfig)
def update_agent_config(agent_id: str, payload: schemas.AgentConfigUpdate, db: Session = Depends(get_db)):
    agent = db.query(models.Agent).filter(models.Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(404, "No Agent found")
    if payload.confidence_threshold is not None:
        agent.confidence_threshold = payload.confidence_threshold
    if payload.channel is not None:
        agent.channel = payload.channel
    if payload.auto_screen is not None:
        agent.auto_screen = payload.auto_screen
    db.commit()
    db.refresh(agent)
    return agent


@router.post("/fetcher/run-now")
def trigger_fetcher_bot(db: Session = Depends(get_db)):
    threading.Thread(target=_run_fetcher_bot, daemon=True).start()
    return {"ok": True, "message": "Fetcher bot started in background"}

@router.post("/parser/run-now")
def trigger_parser_bot(db: Session = Depends(get_db)):
    threading.Thread(target=_run_parser_bot, daemon=True).start()
    return {"ok": True, "message": "Parser bot started in background"}

@router.post("/ranker/run-now")
def trigger_ranker_bot(db: Session = Depends(get_db)):
    threading.Thread(target=_run_ranker_bot, daemon=True).start()
    return {"ok": True, "message": "Ranker bot started in background"}

@router.post("/scheduler/send-interviews")
def trigger_scheduler_bot(db: Session = Depends(get_db)):
    threading.Thread(target=_run_scheduler_bot, daemon=True).start()
    return {"ok": True, "message": "Scheduler bot started in background"}


def _run_fetcher_bot():
    db = SessionLocal()
    try:
        from ..apify_scraper import run_linkedin_serp_search, normalize_serp_to_candidate
        from .candidates import clean_name, score_lead_lightweight
        from .. import models

        print("[fetcher-bot] Starting auto-fetch cycle...")
        queries = ["Software Engineer", "Data Analyst", "Full Stack Developer", "AI Engineer"]
        all_saved = []
        for keyword in queries:
            try:
                serp_items = run_linkedin_serp_search(keyword, "", 5)
                for item in serp_items:
                    cand = normalize_serp_to_candidate(item, keyword)
                    cand["name"] = clean_name(cand.get("name", ""))
                    existing = db.query(models.Candidate).filter(models.Candidate.name == cand.get("name", "")).first()
                    if not existing:
                        # No real CV/resume here - only a headline/snippet. Score
                        # conservatively and label it clearly rather than faking a
                        # full screening result.
                        result = score_lead_lightweight(cand.get("role", ""), cand.get("skills", ""), cand.get("summary", ""), keyword)
                        c = models.Candidate(
                            name=cand.get("name", "Unknown")[:100],
                            email=cand.get("email", "unknown@example.com")[:200],
                            role=cand.get("role", "Professional")[:100],
                            department="Engineering",
                            applied_date=date.today().isoformat(),
                            match_score=result.get("score"),
                            status="Screening",
                            current_stage="Low Confidence — No CV",
                            summary=str(result.get("summary") or cand.get("summary", ""))[:500],
                            source_platform="LinkedIn (Google)",
                            location=cand.get("location"),
                            skills=cand.get("skills"),
                        )
                        db.add(c)
                        db.commit()
                        db.refresh(c)
                        all_saved.append(c)
                        print(f"[fetcher-bot] Saved LinkedIn: {c.name}")
            except Exception as e:
                print(f"[fetcher-bot] Error with {keyword}: {e}")

        if all_saved:
            notif = models.Notification(
                message=f"Fetcher Bot: Auto-imported {len(all_saved)} new candidates",
                type="success",
            )
            db.add(notif)
            db.commit()
            print(f"[fetcher-bot] Cycle complete. Saved {len(all_saved)} candidates")
        else:
            print("[fetcher-bot] No new candidates found")

    except Exception as e:
        print(f"[fetcher-bot] Fatal error: {e}")
    finally:
        db.close()


def _run_parser_bot():
    db = SessionLocal()
    try:
        from ..pipeline_agents import agent_parse
        from concurrent.futures import ThreadPoolExecutor, as_completed

        print("[parser-bot] Starting parse cycle...")
        candidates = db.query(models.Candidate).filter(
            models.Candidate.cv_text.isnot(None),
            models.Candidate.cv_text != "",
            models.Candidate.skills.is_(None),
        ).all()

        # Network-bound AI calls run in parallel; DB writes happen afterward on the
        # main thread since a single SQLAlchemy session isn't safe to share across threads.
        parsed_by_id: dict[str, dict] = {}
        if candidates:
            with ThreadPoolExecutor(max_workers=min(8, len(candidates))) as pool:
                futures = {
                    pool.submit(agent_parse, {"cv_text": c.cv_text, "name": c.name}, f"Parse candidate for {c.role or 'Professional'} role"): c.id
                    for c in candidates
                }
                for future in as_completed(futures):
                    cid = futures[future]
                    try:
                        parsed_by_id[cid] = future.result()
                    except Exception as e:
                        print(f"[parser-bot] Error parsing candidate {cid}: {e}")

        parsed_count = 0
        for c in candidates:
            parsed = parsed_by_id.get(c.id)
            if not parsed or parsed.get("status") == "failed":
                continue
            if parsed.get("skills"):
                c.skills = ", ".join(parsed["skills"]) if isinstance(parsed["skills"], list) else str(parsed["skills"])
            if parsed.get("experience_years") is not None:
                c.experience_years = parsed["experience_years"]
            if parsed.get("location"):
                c.location = parsed["location"]
            if parsed.get("gender"):
                c.gender = parsed["gender"]
            if parsed.get("shift_preference"):
                c.shift_preference = parsed["shift_preference"]
            if parsed.get("age") is not None:
                c.age = parsed["age"]
            if parsed.get("is_remote") is not None:
                c.is_remote = parsed["is_remote"]
            if parsed.get("summary"):
                c.summary = parsed["summary"][:2000]
            parsed_count += 1

        db.commit()
        if parsed_count:
            notif = models.Notification(
                message=f"Parser Bot: Extracted structured data from {parsed_count} candidates",
                type="success",
            )
            db.add(notif)
            db.commit()
        print(f"[parser-bot] Cycle complete. Parsed {parsed_count} candidates")

    except Exception as e:
        print(f"[parser-bot] Fatal error: {e}")
    finally:
        db.close()


def _run_ranker_bot():
    db = SessionLocal()
    try:
        from .candidates import score_with_mistral
        from concurrent.futures import ThreadPoolExecutor, as_completed

        print("[ranker-bot] Starting ranking cycle...")
        jd = db.query(models.JobDescription).order_by(models.JobDescription.created_at.desc()).first()
        if not jd:
            print("[ranker-bot] No job description found")
            return
        job_desc = jd.text

        candidates = db.query(models.Candidate).filter(
            models.Candidate.cv_text.isnot(None),
            models.Candidate.cv_text != "",
        ).all()

        results_by_id: dict[str, dict] = {}
        if candidates:
            with ThreadPoolExecutor(max_workers=min(8, len(candidates))) as pool:
                futures = {pool.submit(score_with_mistral, c.cv_text, job_desc): c.id for c in candidates}
                for future in as_completed(futures):
                    cid = futures[future]
                    try:
                        results_by_id[cid] = future.result()
                    except Exception as e:
                        print(f"[ranker-bot] Error ranking candidate {cid}: {e}")

        ranked_count = 0
        for c in candidates:
            result = results_by_id.get(c.id)
            if not result:
                continue
            if result.get("status") != "ok":
                c.current_stage = "Needs Rescoring"
                continue
            c.match_score = int(result["score"])
            c.summary = result.get("summary", c.summary or "")[:2000]
            if result.get("skills"):
                c.skills = result["skills"]
            if result.get("gender"):
                c.gender = result["gender"]
            if result.get("shift_preference"):
                c.shift_preference = result["shift_preference"]
            if result.get("age") is not None:
                c.age = result["age"]
            if result.get("experience_years") is not None:
                c.experience_years = result["experience_years"]
            c.current_stage = "Done"
            c.status = "Screening"
            ranked_count += 1

        db.commit()
        if ranked_count:
            notif = models.Notification(
                message=f"Ranker Bot: Scored {ranked_count} candidates against latest JD",
                type="success",
            )
            db.add(notif)
            db.commit()
        print(f"[ranker-bot] Cycle complete. Ranked {ranked_count} candidates")

    except Exception as e:
        print(f"[ranker-bot] Fatal error: {e}")
    finally:
        db.close()


def _run_scheduler_bot():
    db = SessionLocal()
    try:
        print("[scheduler-bot] Starting auto-interview scheduling...")
        pipeline_results = db.query(models.PipelineResult).filter(
            models.PipelineResult.final_verdict.in_(["Strongly Recommend", "Recommend"])
        ).all()

        sent_count = 0
        for r in pipeline_results:
            if r.candidate_email and "@" in r.candidate_email and "example.com" not in r.candidate_email:
                success = send_screening_result(
                    r.candidate_name, r.candidate_email,
                    r.screened_score or 0, r.final_verdict or "Recommend", r.final_notes or ""
                )
                if success:
                    success = send_interview_invite(r.candidate_name, r.candidate_email, r.role or "Position")
                if success:
                    sent_count += 1
                    print(f"[scheduler-bot] Interview invite sent to {r.candidate_name}")

        notif = models.Notification(
            message=f"Scheduler Bot: Sent {sent_count} interview invitations",
            type="info",
        )
        db.add(notif)
        db.commit()
        print(f"[scheduler-bot] Cycle complete. Sent {sent_count} emails")

    except Exception as e:
        print(f"[scheduler-bot] Error: {e}")
    finally:
        db.close()
