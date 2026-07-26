import os
import json
import re
import time
import uuid
import threading
from datetime import date, datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

import pdfplumber
import docx
import requests
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session

from ..database import SessionLocal, get_db
from .. import models, schemas
from ..apify_scraper import (
    run_rozee_scraper,
    run_linkedin_serp_search,
    normalize_rozee_to_candidate,
    normalize_serp_to_candidate,
)

router = APIRouter(prefix="/candidates", tags=["candidates"])

MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY")

# ── In-memory fetch job tracking for background fetch ────────────────────
_fetch_jobs: dict[str, dict] = {}
_fetch_jobs_lock = threading.Lock()


def clean_name(raw: str) -> str:
    import re
    name = raw.strip()
    cleaned = re.sub(r'[^A-Za-z \-.\']', '', name).strip()
    if len(cleaned) < 2:
        words = re.findall(r'[A-Za-z]+', name)
        return words[0].capitalize() if words else "Unknown"
    cleaned = re.sub(r'\s+', ' ', cleaned)
    if cleaned.count(' ') > 3:
        parts = cleaned.split()
        cleaned = ' '.join(parts[:3])
    return cleaned.strip()[:100] or "Unknown"
MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions"


def extract_text(file: UploadFile) -> str:
    """extract actual text from PDF/DOCX """
    filename = file.filename.lower()
    content = file.file.read()
    file.file.seek(0)

    if filename.endswith(".pdf"):
        text = ""
        import io
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            for page in pdf.pages:
                text += (page.extract_text() or "") + "\n"
        return text.strip()

    if filename.endswith(".docx"):
        import io
        d = docx.Document(io.BytesIO(content))
        return "\n".join(p.text for p in d.paragraphs).strip()


    try:
        return content.decode("utf-8", errors="ignore")
    except Exception:
        return ""


def score_with_mistral(cv_text: str, job_description: str) -> dict:
    prompt = f"""You are a senior HR recruiter AI. Given the job description and actual CV text below,
produce a JSON object with these fields:
- name: candidate's real full name found in the CV
- role: a fitting job title based on the JD
- score: integer 0-100, how well this candidate matches the JD
- summary: 2-sentence assessment
- email: candidate's real email if found in CV, else a plausible one
- gender: candidate's gender if evident from CV (Male/Female/null)
- shift_preference: inferred from CV (Morning/Night/Remote/Hybrid/Any)
- age: estimated age as integer if evident, else null
- is_remote: boolean, does the candidate prefer remote work
- skills: comma-separated key skills found in CV
- experience_years: integer, total years of experience

Job Description:
{job_description}

CV Text:
{cv_text[:6000]}

Respond with ONLY valid JSON, no markdown, no explanation."""

    try:
        response = requests.post(
            MISTRAL_URL,
            headers={
                "Authorization": f"Bearer {MISTRAL_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "mistral-small-latest",
                "messages": [{"role": "user", "content": prompt}],
                "response_format": {"type": "json_object"},
            },
            timeout=30,
        )
        response.raise_for_status()
        text = response.json()["choices"][0]["message"]["content"].strip()
        match = re.search(r"\{[\s\S]*\}", text)
        if match:
            return json.loads(match.group(0))
    except Exception:
        pass

    return {"name": "Unknown Candidate", "role": "Software Engineer", "score": 75,
            "summary": "Automated scoring fallback - Mistral call failed.", "email": "",
            "gender": None, "shift_preference": "Any", "age": None,
            "is_remote": None, "skills": "", "experience_years": None}




def fix_scraped_name_with_mistral(raw_name: str, raw_data: str, jd_text: str) -> str:
    if "Candidate - " not in raw_name and "@linkedin.com" not in raw_name:
        return raw_name
    try:
        prompt = f"""Extract the real candidate name from this job board data.
The raw title/name is: {raw_name}
Raw data: {raw_data[:1500]}
Job: {jd_text[:500]}
Respond with ONLY a valid JSON: {{"name": "real full name"}}"""
        resp = requests.post(
            MISTRAL_URL,
            headers={"Authorization": f"Bearer {MISTRAL_API_KEY}", "Content-Type": "application/json"},
            json={"model": "mistral-small-latest", "messages": [{"role": "user", "content": prompt}], "response_format": {"type": "json_object"}},
            timeout=30,
        )
        data = resp.json()["choices"][0]["message"]["content"].strip()
        import re
        m = re.search(r'\{[\s\S]*\}', data)
        if m:
            parsed = json.loads(m.group(0))
            name = parsed.get("name", "").strip()
            if name and len(name) > 3 and "Candidate" not in name:
                return name
    except Exception as e:
        print(f"[fix_name] Error: {e}")
    return raw_name


def auto_pipeline_after_fetch(db: Session):
    from .pipeline import run_pipeline
    from ..schemas import PipelineRunCreate
    try:
        all_candidates = db.query(models.Candidate).order_by(models.Candidate.created_at.desc()).limit(50).all()
        if all_candidates:
            payload = PipelineRunCreate(job_title="Auto Pipeline", job_description="Automated pipeline after candidate fetch")
            run_pipeline(payload, db)
            print("[auto-pipeline] Pipeline completed for fetched candidates")
    except Exception as e:
        print(f"[auto-pipeline] Error: {e}")


def auto_email_best_candidates(db: Session):
    from ..email_service import send_screening_result, send_interview_invite
    try:
        results = db.query(models.PipelineResult).filter(models.PipelineResult.is_best_match == True).all()
        for r in results:
            if r.candidate_email and "@example.com" not in r.candidate_email and "@linkedin.com" not in r.candidate_email:
                send_screening_result(
                    r.candidate_name, r.candidate_email,
                    r.screened_score or 0, r.final_verdict or "Consider", r.final_notes or ""
                )
                if r.final_verdict in ("Strongly Recommend", "Recommend"):
                    send_interview_invite(r.candidate_name, r.candidate_email, r.role or "Position")
    except Exception as e:
        print(f"[auto-email] Error: {e}")


# ── Background fetch with parallel Mistral scoring ────────────────────────

def _run_fetch_background(job_id: str, payload: schemas.FetchRequest):
    """Run the full fetch+scoring in background, updating _fetch_jobs dict."""
    db = SessionLocal()
    start_time = time.time()
    try:
        import traceback as _tb
        with _fetch_jobs_lock:
            _fetch_jobs[job_id] = {"status": "processing", "progress": 0, "message": "Starting scrape..."}

        all_candidates = []
        platform_counts: dict[str, int] = {}
        keyword = payload.job_title or payload.job_description[:50]
        f = payload.filters
        loc = f.location if f else None

        with _fetch_jobs_lock:
            _fetch_jobs[job_id] = {"status": "processing", "progress": 5, "message": "Scraping Rozee.pk..."}
        try:
            rozee_items = run_rozee_scraper(keyword, loc, payload.max_results_per_source)
            print(f"[bg-fetch] Rozee returned {len(rozee_items)} items")
            if rozee_items:
                for item in rozee_items:
                    cand = normalize_rozee_to_candidate(item, payload.job_description)
                    all_candidates.append(cand)
                platform_counts["Rozee.pk"] = len(rozee_items)
        except Exception as e:
            print(f"[bg-fetch] Rozee error: {e}\n{_tb.format_exc()}")

        with _fetch_jobs_lock:
            _fetch_jobs[job_id] = {"status": "processing", "progress": 15, "message": "Searching LinkedIn..."}
        try:
            serp_items = run_linkedin_serp_search(keyword, loc, payload.max_results_per_source)
            print(f"[bg-fetch] SerpAPI returned {len(serp_items)} items")
            if serp_items:
                for item in serp_items:
                    cand = normalize_serp_to_candidate(item, payload.job_description)
                    all_candidates.append(cand)
                platform_counts["LinkedIn (Google)"] = len(serp_items)
        except Exception as e:
            print(f"[bg-fetch] SerpAPI error: {e}\n{_tb.format_exc()}")

        # Parallel name fix + scoring via Mistral
        total = len(all_candidates)
        if total == 0:
            with _fetch_jobs_lock:
                _fetch_jobs[job_id] = {"status": "completed", "progress": 100, "message": "No candidates found", "candidates": [], "total_fetched": 0, "platform_breakdown": platform_counts, "fetch_time_ms": int((time.time() - start_time) * 1000)}
            return

        with _fetch_jobs_lock:
            _fetch_jobs[job_id] = {"status": "processing", "progress": 20, "message": f"Scoring {total} candidates with AI..."}

        scored = [None] * total
        done_count = 0

        def score_one(idx: int, cand: dict) -> tuple[int, dict]:
            cv_text = cand.get("cv_text", "")
            raw_name = cand.get("name", "")
            # fix name for scraped candidates
            if ("Candidate - " in raw_name or "@linkedin.com" in raw_name) and cv_text and MISTRAL_API_KEY:
                fixed = fix_scraped_name_with_mistral(raw_name, cv_text, payload.job_description)
                if fixed != raw_name:
                    cand["name"] = clean_name(fixed)
            # run score
            if cv_text and MISTRAL_API_KEY:
                try:
                    result = score_with_mistral(cv_text, payload.job_description)
                    cand["match_score"] = int(result.get("score", 50))
                    cand["summary"] = result.get("summary", cand.get("summary", ""))
                    name = result.get("name", "")
                    if name and len(name) > 3 and "Candidate" not in name:
                        cand["name"] = clean_name(name)
                    cand["email"] = result.get("email", cand.get("email", ""))
                    if result.get("gender"):       cand["gender"] = cand["gender"] or result["gender"]
                    if result.get("shift_preference"): cand["shift_preference"] = result.get("shift_preference", cand.get("shift_preference"))
                    if result.get("age") is not None:           cand["age"] = cand["age"] or result["age"]
                    if result.get("is_remote") is not None: cand["is_remote"] = result["is_remote"]
                    if result.get("skills"):        cand["skills"] = result["skills"]
                    if result.get("experience_years") is not None: cand["experience_years"] = cand["experience_years"] or result["experience_years"]
                except Exception:
                    cand["match_score"] = 50
            else:
                cand["match_score"] = 50
            return idx, cand

        with ThreadPoolExecutor(max_workers=8) as pool:
            futures = [pool.submit(score_one, i, cand) for i, cand in enumerate(all_candidates)]
            for f in as_completed(futures):
                idx, cand = f.result()
                scored[idx] = cand
                done_count += 1
                pct = 20 + int(done_count / total * 50)
                with _fetch_jobs_lock:
                    _fetch_jobs[job_id] = {"status": "processing", "progress": min(pct, 70), "message": f"Scored {done_count}/{total} candidates..."}

        # Apply filters
        filtered = []
        for cand in scored:
            if cand is None: continue
            if f.gender and cand.get("gender") and cand["gender"].lower() != f.gender.lower(): continue
            if f.shift and cand.get("shift_preference") and cand["shift_preference"].lower() != f.shift.lower(): continue
            if f.remote is not None and cand.get("is_remote") is not None and cand["is_remote"] != f.remote: continue
            if f.age_min and cand.get("age") and cand["age"] < f.age_min: continue
            if f.age_max and cand.get("age") and cand["age"] > f.age_max: continue
            if f.experience_min is not None and cand.get("experience_years") is not None and cand["experience_years"] < f.experience_min: continue
            if f.experience_max is not None and cand.get("experience_years") is not None and cand["experience_years"] > f.experience_max: continue
            if f.location and cand.get("location") and f.location.lower() not in cand["location"].lower(): continue
            filtered.append(cand)

        with _fetch_jobs_lock:
            _fetch_jobs[job_id] = {"status": "processing", "progress": 75, "message": f"Saving {len(filtered)} candidates to database..."}

        # Save to DB
        saved = []
        for cand in filtered:
            candidate = models.Candidate(
                name=cand.get("name", "Unknown")[:100],
                email=cand.get("email", "unknown@example.com")[:200],
                role=cand.get("role", "Professional")[:100],
                department=cand.get("department", "Engineering")[:100],
                applied_date=date.today().isoformat(),
                match_score=cand.get("match_score"),
                status=cand.get("status", "Screening"),
                current_stage=cand.get("current_stage", "Awaiting Ranking"),
                summary=cand.get("summary", "")[:1000] if cand.get("summary") else None,
                cv_text=cand.get("cv_text"),
                gender=cand.get("gender"),
                shift_preference=cand.get("shift_preference"),
                age=cand.get("age"),
                source_platform=cand.get("source_platform"),
                is_remote=cand.get("is_remote"),
                location=cand.get("location"),
                skills=cand.get("skills"),
                experience_years=cand.get("experience_years"),
                phone=cand.get("phone"),
            )
            db.add(candidate)
        db.commit()
        # Refresh to get IDs
        for cand in filtered:
            saved_candidate = db.query(models.Candidate).filter(models.Candidate.email == cand.get("email", "")).order_by(models.Candidate.created_at.desc()).first()
            if saved_candidate:
                saved.append(saved_candidate)

        with _fetch_jobs_lock:
            _fetch_jobs[job_id] = {"status": "processing", "progress": 90, "message": "Starting automatic pipeline..."}

        # Run auto pipeline in background (don't wait)
        try:
            from .pipeline import _background_run_pipeline
            cids = [c.id for c in saved]
            if cids:
                auto_run_id = str(uuid.uuid4())
                auto_run = models.PipelineRun(
                    id=auto_run_id, job_title=payload.job_title or "Auto Pipeline",
                    job_description=payload.job_description, status="running",
                    created_at=datetime.now().astimezone(),
                )
                db.add(auto_run)
                db.commit()
                t = threading.Thread(target=_background_run_pipeline, args=(auto_run_id, cids, payload.job_title or "Auto Pipeline", payload.job_description), daemon=True)
                t.start()
        except Exception as e:
            print(f"[bg-fetch] Auto pipeline error: {e}")

        elapsed = int((time.time() - start_time) * 1000)
        with _fetch_jobs_lock:
            _fetch_jobs[job_id] = {
                "status": "completed", "progress": 100,
                "message": f"Fetched {len(saved)} candidates in {elapsed}ms",
                "candidates": [schemas.FetchedCandidateOut.model_validate(c) for c in saved],
                "total_fetched": len(saved),
                "platform_breakdown": platform_counts,
                "fetch_time_ms": elapsed,
            }

    except Exception as e:
        import traceback as _tb2
        print(f"[bg-fetch] Fatal error: {e}\n{_tb2.format_exc()}")
        cur_progress = 0
        with _fetch_jobs_lock:
            existing = _fetch_jobs.get(job_id, {})
            if isinstance(existing, dict):
                cur_progress = existing.get("progress", 0)
            _fetch_jobs[job_id] = {"status": "error", "progress": cur_progress, "message": str(e), "candidates": [], "total_fetched": 0, "platform_breakdown": {}, "fetch_time_ms": 0}
    finally:
        db.close()


@router.post("/batch-analyze", response_model=schemas.BatchAnalyzeResponse)
async def batch_analyze_cvs(
    files: list[UploadFile] = File(...),
    job_description: str = Form(""),
    db: Session = Depends(get_db),
):
    if len(files) > 5:
        raise HTTPException(400, "Maximum 5 CV files allowed at once")
    if not files:
        raise HTTPException(400, "No files provided")

    results = []
    for file in files:
        cv_text = extract_text(file)
        if not cv_text:
            results.append(schemas.CVAnalysisOut(
                name=file.filename or "Unknown",
                email="",
                role="",
                score=0,
                summary="Unable to extract text from file",
                skills="",
                overall_verdict="Error: Unreadable file",
            ))
            continue

        jd_section = f"\nJob Description:\n{job_description[:3000]}\n" if job_description else ""
        prompt = f"""You are a senior HR Tech AI — a world-class recruitment analyst.
Analyze the following CV/resume in detail. Extract ALL useful information and provide a comprehensive candidate assessment.{jd_section}
CV Text:
{cv_text[:6000]}

Respond with ONLY valid JSON in this exact structure:
{{
  "name": "candidate's real full name from CV",
  "email": "candidate's email if found, else empty string",
  "role": "the most fitting job title based on their experience",
  "score": <integer 0-100 overall fit>,
  "summary": "3-4 sentence professional summary of the candidate",
  "skills": "comma-separated list of ALL technical and soft skills found",
  "experience_years": <integer total years of experience, or null>,
  "gender": "Male/Female/null",
  "shift_preference": "Morning/Night/Remote/Hybrid/Any",
  "is_remote": true/false/null,
  "age": <integer estimated age or null>,
  "location": "city, country or empty",
  "strengths": ["list", "of", "top", "strengths"],
  "areas_for_improvement": ["list", "of", "areas", "to", "improve"],
  "detailed_assessment": "A comprehensive 5-7 sentence paragraph assessing this candidate: their background, key qualifications, what makes them unique, what roles they are best suited for, and any notable achievements.",
  "overall_verdict": "Strong Hire / Hire / Consider / Not Recommended"
}}"""

        try:
            response = requests.post(
                MISTRAL_URL,
                headers={"Authorization": f"Bearer {MISTRAL_API_KEY}", "Content-Type": "application/json"},
                json={
                    "model": "mistral-small-latest",
                    "messages": [{"role": "user", "content": prompt}],
                    "response_format": {"type": "json_object"},
                    "max_tokens": 3000,
                },
                timeout=(10, 30),
            )
            response.raise_for_status()
            text = response.json()["choices"][0]["message"]["content"].strip()
            match = re.search(r"\{[\s\S]*\}", text)
            data = json.loads(match.group(0)) if match else {}
        except Exception:
            data = {}

        # Save to DB so candidate has an ID for pipeline
        candidate = models.Candidate(
            name=data.get("name", file.filename or "Unknown")[:100],
            email=data.get("email", "")[:200],
            role=data.get("role", "Professional")[:100],
            match_score=int(data.get("score", 50)),
            summary=data.get("summary", "")[:1000],
            cv_text=cv_text[:50000],
            skills=data.get("skills", ""),
            experience_years=data.get("experience_years"),
            gender=data.get("gender"),
            shift_preference=data.get("shift_preference"),
            is_remote=data.get("is_remote"),
            age=data.get("age"),
            location=data.get("location"),
            department="Engineering",
            applied_date=date.today().isoformat(),
            status="Screening",
            current_stage="Awaiting Ranking",
        )
        db.add(candidate)
        db.flush()

        results.append(schemas.CVAnalysisOut(
            id=candidate.id,
            name=data.get("name", file.filename or "Unknown"),
            email=data.get("email", ""),
            role=data.get("role", "Professional"),
            score=int(data.get("score", 50)),
            summary=data.get("summary", ""),
            skills=data.get("skills", ""),
            experience_years=data.get("experience_years"),
            gender=data.get("gender"),
            shift_preference=data.get("shift_preference", "Any"),
            is_remote=data.get("is_remote"),
            age=data.get("age"),
            location=data.get("location", ""),
            strengths=data.get("strengths", []),
            areas_for_improvement=data.get("areas_for_improvement", []),
            detailed_assessment=data.get("detailed_assessment", ""),
            overall_verdict=data.get("overall_verdict", "Consider"),
        ))

    db.commit()
    return schemas.BatchAnalyzeResponse(candidates=results, total_processed=len(results))


@router.post("/fetch-from-boards")
def fetch_from_job_boards(payload: schemas.FetchRequest):
    """Start a background fetch and return immediately with a fetch_id for polling."""
    job_id = str(uuid.uuid4())
    with _fetch_jobs_lock:
        _fetch_jobs[job_id] = {"status": "processing", "progress": 0, "message": "Starting...", "candidates": [], "total_fetched": 0, "platform_breakdown": {}, "fetch_time_ms": 0}

    t = threading.Thread(target=_run_fetch_background, args=(job_id, payload), daemon=True)
    t.start()

    return {"fetch_id": job_id, "status": "processing"}


@router.get("/fetch-status/{fetch_id}", response_model=schemas.FetchStatusResponse)
def get_fetch_status(fetch_id: str):
    with _fetch_jobs_lock:
        job = _fetch_jobs.get(fetch_id)
    if not job:
        raise HTTPException(404, "Fetch job not found")
    return schemas.FetchStatusResponse(fetch_id=fetch_id, **job)


@router.get("", response_model=list[schemas.CandidateOut])
def list_candidates(db: Session = Depends(get_db)):
    return db.query(models.Candidate).order_by(models.Candidate.created_at.desc()).all()


@router.post("", response_model=schemas.CandidateOut)
def create_candidate(payload: schemas.CandidateCreate, db: Session = Depends(get_db)):
    candidate = models.Candidate(**payload.model_dump())
    db.add(candidate)
    db.commit()
    db.refresh(candidate)
    return candidate


@router.post("/upload", response_model=schemas.CandidateOut)
async def upload_and_score(
    file: UploadFile = File(...),
    job_description: str = Form(...),
    db: Session = Depends(get_db),
):
    """Real CV file leta hai, text extract karta hai, Mistral se score karta hai (server-side)."""
    cv_text = extract_text(file)
    if not cv_text:
        raise HTTPException(400, "unable to extract text from CV .Only .pdf/.docx  is supported")

    result = score_with_mistral(cv_text, job_description)

    candidate = models.Candidate(
        name=clean_name(result.get("name", "Unknown")),
        email=result.get("email") or "unknown@example.com",
        role=result.get("role", "Software Engineer"),
        department="Engineering",
        applied_date=date.today().isoformat(),
        match_score=int(result.get("score", 75)),
        status="Screening",
        current_stage="Awaiting Ranking",
        summary=result.get("summary", ""),
        cv_text=cv_text,
        gender=result.get("gender"),
        shift_preference=result.get("shift_preference", "Any"),
        age=result.get("age"),
        is_remote=result.get("is_remote"),
        skills=result.get("skills"),
        experience_years=result.get("experience_years"),
    )
    db.add(candidate)
    db.commit()
    db.refresh(candidate)
    return candidate


@router.patch("/{candidate_id}/stage", response_model=schemas.CandidateOut)
def update_stage(candidate_id: str, payload: schemas.CandidateStageUpdate, db: Session = Depends(get_db)):
    candidate = db.query(models.Candidate).filter(models.Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(404, "Couldn't find the Candidate")
    candidate.current_stage = payload.current_stage
    db.commit()
    db.refresh(candidate)
    return candidate


@router.patch("/{candidate_id}/status", response_model=schemas.CandidateOut)
def update_status(candidate_id: str, payload: schemas.CandidateStatusUpdate, db: Session = Depends(get_db)):
    candidate = db.query(models.Candidate).filter(models.Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(404, "Couldn't find the Candidate ")
    candidate.status = payload.status
    db.commit()
    db.refresh(candidate)
    return candidate


@router.post("/deduplicate")
def deduplicate_candidates(db: Session = Depends(get_db)):
    from sqlalchemy import text
    result = db.execute(text("""
        WITH ranked AS (
            SELECT id, name,
                ROW_NUMBER() OVER (PARTITION BY name ORDER BY match_score DESC NULLS LAST, created_at ASC) AS rn
            FROM candidates
        )
        DELETE FROM candidates WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
        RETURNING id
    """))
    db.commit()
    deleted = len(result.fetchall())
    return {"ok": True, "deleted": deleted}


@router.post("/bulk-delete")
def delete_selected_candidates(payload: schemas.BulkDeleteRequest, db: Session = Depends(get_db)):
    if not payload.ids:
        return {"ok": True, "deleted": 0}
    deleted = db.query(models.Candidate).filter(models.Candidate.id.in_(payload.ids)).delete(synchronize_session=False)
    db.query(models.PipelineResult).filter(models.PipelineResult.candidate_id.in_(payload.ids)).delete(synchronize_session=False)
    db.commit()
    return {"ok": True, "deleted": deleted}


@router.delete("/bulk")
def delete_all_candidates(db: Session = Depends(get_db)):
    count = db.query(models.Candidate).delete()
    db.query(models.PipelineResult).delete()
    db.commit()
    return {"ok": True, "deleted": count}


@router.delete("/{candidate_id}")
def delete_candidate(candidate_id: str, db: Session = Depends(get_db)):
    candidate = db.query(models.Candidate).filter(models.Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(404, "Couldn't find the Candidate")
    db.delete(candidate)
    db.commit()
    return {"ok": True}


@router.post("/enrich")
def enrich_candidates(db: Session = Depends(get_db)):
    enriched = 0
    candidates = db.query(models.Candidate).filter(
        models.Candidate.cv_text.isnot(None),
        models.Candidate.cv_text != "",
        models.Candidate.gender.is_(None),
    ).all()
    for c in candidates:
        try:
            job_text = f"Review candidate profile for {c.role or 'Professional'} position"
            result = score_with_mistral(c.cv_text, job_text)
            if result.get("gender"):
                c.gender = result["gender"]
            if result.get("shift_preference"):
                c.shift_preference = result["shift_preference"]
            if result.get("age") is not None:
                c.age = result["age"]
            if result.get("is_remote") is not None:
                c.is_remote = result["is_remote"]
            if result.get("skills"):
                c.skills = result["skills"]
            if result.get("experience_years") is not None:
                c.experience_years = result["experience_years"]
            enriched += 1
        except Exception:
            continue
    db.commit()
    return {"ok": True, "enriched": enriched, "scanned": len(candidates)}


@router.post("/{candidate_id}/screen", response_model=schemas.CandidateOut)
def screen_candidate(candidate_id: str, payload: schemas.JobDescriptionCreate, db: Session = Depends(get_db)):
    candidate = db.query(models.Candidate).filter(models.Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(404, "Candidate not found")
    cv_text = candidate.cv_text or ""
    if not cv_text:
        raise HTTPException(400, "No CV text available for this candidate")
    result = score_with_mistral(cv_text, payload.text)
    candidate.match_score = int(result.get("score", 75))
    candidate.summary = result.get("summary", "")
    candidate.current_stage = "Done"
    candidate.status = "Screening"
    if result.get("gender"):
        candidate.gender = result["gender"]
    if result.get("shift_preference"):
        candidate.shift_preference = result["shift_preference"]
    if result.get("age") is not None:
        candidate.age = result["age"]
    if result.get("is_remote") is not None:
        candidate.is_remote = result["is_remote"]
    if result.get("skills"):
        candidate.skills = result["skills"]
    if result.get("experience_years") is not None:
        candidate.experience_years = result["experience_years"]
    db.commit()
    db.refresh(candidate)
    return candidate
