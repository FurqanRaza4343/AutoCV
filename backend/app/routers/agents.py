import os
import json
import threading
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
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
            threading.Thread(target=_run_fetcher_bot, args=(db,), daemon=True).start()
        elif agent_id == "parser":
            threading.Thread(target=_run_parser_bot, args=(db,), daemon=True).start()
        elif agent_id == "ranker":
            threading.Thread(target=_run_ranker_bot, args=(db,), daemon=True).start()
        elif agent_id == "scheduler":
            threading.Thread(target=_run_scheduler_bot, args=(db,), daemon=True).start()

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
    threading.Thread(target=_run_fetcher_bot, args=(db,), daemon=True).start()
    return {"ok": True, "message": "Fetcher bot started in background"}

@router.post("/parser/run-now")
def trigger_parser_bot(db: Session = Depends(get_db)):
    threading.Thread(target=_run_parser_bot, args=(db,), daemon=True).start()
    return {"ok": True, "message": "Parser bot started in background"}

@router.post("/ranker/run-now")
def trigger_ranker_bot(db: Session = Depends(get_db)):
    threading.Thread(target=_run_ranker_bot, args=(db,), daemon=True).start()
    return {"ok": True, "message": "Ranker bot started in background"}

@router.post("/scheduler/send-interviews")
def trigger_scheduler_bot(db: Session = Depends(get_db)):
    threading.Thread(target=_run_scheduler_bot, args=(db,), daemon=True).start()
    return {"ok": True, "message": "Scheduler bot started in background"}


def _run_fetcher_bot(db: Session):
    try:
        from ..apify_scraper import run_rozee_scraper, run_linkedin_serp_search, normalize_rozee_to_candidate, normalize_serp_to_candidate
        from .candidates import fix_scraped_name_with_mistral, score_with_mistral
        from .. import models

        print("[fetcher-bot] Starting auto-fetch cycle...")
        queries = ["Software Engineer", "Data Analyst", "Full Stack Developer", "AI Engineer"]
        all_saved = []
        for keyword in queries:
            try:
                items = run_rozee_scraper(keyword, "", 5)
                for item in items:
                    cand = normalize_rozee_to_candidate(item, keyword)
                    cand["name"] = fix_scraped_name_with_mistral(
                        cand.get("name", ""), str(item), keyword
                    )
                    cv_text = cand.get("cv_text", "")
                    if cv_text:
                        result = score_with_mistral(cv_text, keyword)
                        cand["match_score"] = int(result.get("score", 50))
                        if result.get("name") and "Candidate" not in result.get("name", ""):
                            cand["name"] = result["name"]
                    existing = db.query(models.Candidate).filter(models.Candidate.email == cand.get("email", "")).first()
                    if not existing:
                        c = models.Candidate(
                            name=cand.get("name", "Unknown")[:100],
                            email=cand.get("email", "unknown@example.com")[:200],
                            role=cand.get("role", "Professional")[:100],
                            department="Engineering",
                            applied_date=date.today().isoformat(),
                            match_score=cand.get("match_score"),
                            status="Screening",
                            current_stage="Awaiting Ranking",
                            summary=str(cand.get("summary", ""))[:500],
                            cv_text=cand.get("cv_text"),
                            source_platform="Rozee.pk",
                            skills=cand.get("skills"),
                            experience_years=cand.get("experience_years"),
                            location=cand.get("location"),
                        )
                        db.add(c)
                        db.commit()
                        db.refresh(c)
                        all_saved.append(c)
                        print(f"[fetcher-bot] Saved: {c.name}")

                serp_items = run_linkedin_serp_search(keyword, "", 5)
                for item in serp_items:
                    cand = normalize_serp_to_candidate(item, keyword)
                    existing = db.query(models.Candidate).filter(models.Candidate.name == cand.get("name", "")).first()
                    if not existing:
                        c = models.Candidate(
                            name=cand.get("name", "Unknown")[:100],
                            email=cand.get("email", "unknown@example.com")[:200],
                            role=cand.get("role", "Professional")[:100],
                            department="Engineering",
                            applied_date=date.today().isoformat(),
                            status="Screening",
                            current_stage="Awaiting Ranking",
                            summary=str(cand.get("summary", ""))[:500],
                            source_platform="LinkedIn (Google)",
                            location=cand.get("location"),
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


def _run_parser_bot(db: Session):
    try:
        print("[parser-bot] Starting parse cycle...")
        candidates = db.query(models.Candidate).filter(
            models.Candidate.cv_text.isnot(None),
            models.Candidate.cv_text != "",
            models.Candidate.skills.is_(None),
        ).all()

        parsed_count = 0
        for c in candidates:
            try:
                from ..pipeline_agents import agent_parse
                parsed = agent_parse({"cv_text": c.cv_text, "name": c.name}, f"Parse candidate for {c.role or 'Professional'} role")
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
            except Exception as e:
                print(f"[parser-bot] Error parsing {c.name}: {e}")

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


def _run_ranker_bot(db: Session):
    try:
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

        ranked_count = 0
        for c in candidates:
            try:
                from .candidates import score_with_mistral
                result = score_with_mistral(c.cv_text, job_desc)
                score = int(result.get("score", 50))
                c.match_score = score
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
            except Exception as e:
                print(f"[ranker-bot] Error ranking {c.name}: {e}")

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


def _run_scheduler_bot(db: Session):
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
