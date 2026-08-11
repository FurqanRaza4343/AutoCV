import json
import os
import re
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY")
MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions"
MAX_WORKERS = 8


def _call_mistral(prompt: str, response_format: dict | None = None) -> str:
    payload = {
        "model": "mistral-small-latest",
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 2000,
    }
    if response_format:
        payload["response_format"] = response_format
    resp = requests.post(
        MISTRAL_URL,
        headers={
            "Authorization": f"Bearer {MISTRAL_API_KEY}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=(8, 20),
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"].strip()


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=10),
    retry=retry_if_exception_type((requests.ConnectionError, requests.Timeout, requests.HTTPError)),
)
def _call_mistral_safe(prompt: str, response_format: dict | None = None) -> str:
    return _call_mistral(prompt, response_format)


def has_real_cv(cv_text: str | None) -> bool:
    """A lead sourced from LinkedIn/SERP has no resume - its cv_text is a JSON dump
    of the search snippet (see apify_scraper.normalize_serp_to_candidate), not prose.
    Duplicated from routers/candidates.py to avoid a circular import."""
    return bool(cv_text) and not cv_text.strip().startswith("{")


def _parse_json(text: str) -> dict:
    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return {}
    return {}


def agent_parse(candidate: dict, job_description: str) -> dict:
    cv_text = candidate.get("cv_text", "") or json.dumps(candidate)
    prompt = f"""You are Agentix Parser AI — an expert HR parsing agent.
Extract structured data from the raw candidate data below.

Job Context: {job_description[:1000]}

Raw Candidate Data:
{cv_text[:4000]}

Respond with ONLY valid JSON:
{{
  "name": "full name",
  "email": "email",
  "role": "best-fit job title",
  "skills": ["skill1", "skill2"],
  "experience_years": <number or null>,
  "location": "city",
  "gender": "Male/Female/null",
  "shift_preference": "Morning/Night/Any",
  "is_remote": true/false/null,
  "age": <number or null>,
  "summary": "1-2 sentence summary"
}}"""

    try:
        raw = _call_mistral_safe(prompt, {"type": "json_object"})
        data = _parse_json(raw)
        status = "ok" if data else "failed"
    except Exception:
        data = {}
        status = "failed"

    return {
        "status": status,
        "name": data.get("name", candidate.get("name", "Unknown")),
        "email": data.get("email", candidate.get("email", "")),
        "role": data.get("role", candidate.get("role", "Professional")),
        "skills": data.get("skills", candidate.get("skills", "").split(", ") if candidate.get("skills") else []),
        "experience_years": data.get("experience_years", candidate.get("experience_years")),
        "location": data.get("location", candidate.get("location", "")),
        "gender": data.get("gender", candidate.get("gender")),
        "shift_preference": data.get("shift_preference", candidate.get("shift_preference", "Any")),
        "is_remote": data.get("is_remote", candidate.get("is_remote")),
        "age": data.get("age", candidate.get("age")),
        "summary": data.get("summary", ""),
    }


def agent_screen(candidate: dict, parsed: dict, job_description: str) -> dict:
    skills_str = ", ".join(parsed.get("skills", [])) if isinstance(parsed.get("skills"), list) else str(parsed.get("skills", ""))
    prompt = f"""You are Agentix Screener AI — an expert HR screening agent.
Score this candidate against the job description on a scale of 0-100.

Job Description:
{job_description[:2000]}

Candidate Profile:
- Name: {parsed.get("name", candidate.get("name", "Unknown"))}
- Role: {parsed.get("role", candidate.get("role", ""))}
- Skills: {skills_str}
- Experience: {parsed.get("experience_years")} years
- Location: {parsed.get("location", "")}

Respond with ONLY valid JSON:
{{
  "score": <integer 0-100>,
  "summary": "2-3 sentence screening assessment",
  "strengths": ["strength1", "strength2"],
  "gaps": ["gap1", "gap2"],
  "verdict": "Strong Match / Moderate Match / Weak Match"
}}"""

    try:
        raw = _call_mistral_safe(prompt, {"type": "json_object"})
        data = _parse_json(raw)
    except Exception:
        data = {}

    # A response is only trustworthy if the model actually returned a numeric score.
    # Never invent a plausible-looking default - that's what produced the "everyone
    # scores 50" illusion. Failures must be visibly different from real low scores.
    status = "ok" if isinstance(data.get("score"), (int, float)) else "failed"

    if status == "failed":
        return {
            "status": "failed",
            "screened_score": None,
            "screened_summary": "AI screening failed for this candidate (no response from model).",
            "strengths": [],
            "gaps": [],
            "verdict": "Needs Rescoring",
        }

    return {
        "status": "ok",
        "screened_score": int(data["score"]),
        "screened_summary": data.get("summary", ""),
        "strengths": data.get("strengths", []),
        "gaps": data.get("gaps", []),
        "verdict": data.get("verdict", "Moderate Match"),
    }


def agent_parse_and_screen(candidate: dict, job_description: str) -> tuple[dict, dict]:
    """Combines what agent_parse + agent_screen used to do as two sequential Mistral
    calls into a single round-trip - this is the single biggest lever on pipeline
    latency, since every candidate previously paid for two full API round-trips
    (each with its own network + inference time) before ranking could even start."""
    cv_text = candidate.get("cv_text", "") or json.dumps(candidate)
    prompt = f"""You are Agentix AI — an expert HR parsing and screening agent.
Extract structured data from the raw candidate data below AND score how well they
match the job description, in one response.

Job Description:
{job_description[:2000]}

Raw Candidate Data:
{cv_text[:4000]}

Respond with ONLY valid JSON:
{{
  "name": "full name",
  "email": "email",
  "role": "best-fit job title",
  "skills": ["skill1", "skill2"],
  "experience_years": <number or null>,
  "location": "city",
  "gender": "Male/Female/null",
  "shift_preference": "Morning/Night/Any",
  "is_remote": true/false/null,
  "age": <number or null>,
  "summary": "1-2 sentence candidate summary",
  "score": <integer 0-100 fit against the job description>,
  "screening_summary": "2-3 sentence screening assessment",
  "strengths": ["strength1", "strength2"],
  "gaps": ["gap1", "gap2"],
  "verdict": "Strong Match / Moderate Match / Weak Match"
}}"""

    try:
        raw = _call_mistral_safe(prompt, {"type": "json_object"})
        data = _parse_json(raw)
    except Exception:
        data = {}

    parse_status = "ok" if data else "failed"
    parsed = {
        "status": parse_status,
        "name": data.get("name", candidate.get("name", "Unknown")),
        "email": data.get("email", candidate.get("email", "")),
        "role": data.get("role", candidate.get("role", "Professional")),
        "skills": data.get("skills", candidate.get("skills", "").split(", ") if candidate.get("skills") else []),
        "experience_years": data.get("experience_years", candidate.get("experience_years")),
        "location": data.get("location", candidate.get("location", "")),
        "gender": data.get("gender", candidate.get("gender")),
        "shift_preference": data.get("shift_preference", candidate.get("shift_preference", "Any")),
        "is_remote": data.get("is_remote", candidate.get("is_remote")),
        "age": data.get("age", candidate.get("age")),
        "summary": data.get("summary", ""),
    }

    # Same "never invent a plausible-looking score" rule as agent_screen: only trust
    # a response that actually returned a numeric score.
    screen_status = "ok" if isinstance(data.get("score"), (int, float)) else "failed"
    if screen_status == "failed":
        screened = {
            "status": "failed",
            "screened_score": None,
            "screened_summary": "AI screening failed for this candidate (no response from model).",
            "strengths": [],
            "gaps": [],
            "verdict": "Needs Rescoring",
        }
    else:
        screened = {
            "status": "ok",
            "screened_score": int(data["score"]),
            "screened_summary": data.get("screening_summary", ""),
            "strengths": data.get("strengths", []),
            "gaps": data.get("gaps", []),
            "verdict": data.get("verdict", "Moderate Match"),
        }

    return parsed, screened


def agent_deep_rank(candidates_with_scores: list[dict], job_description: str) -> list[dict]:
    # Ranking is derived directly from each candidate's own screened_score instead of
    # a second comparative-ranking Mistral call. That extra round-trip (one big prompt
    # listing every candidate) was the dominant source of pipeline slowness and the
    # single point where runs would hang for minutes - agent_parse_and_screen already
    # produces a real, job-description-aware 0-100 score per candidate, so re-asking
    # the model to rank the same candidates added latency without adding information.
    rankable = [c for c in candidates_with_scores if c.get("screened", {}).get("status") == "ok"]
    unrankable = [c for c in candidates_with_scores if c.get("screened", {}).get("status") != "ok"]

    for c in rankable:
        s = c["screened"]
        c["ranked"] = {
            "status": "ok",
            "ranked_score": s["screened_score"],
            "ranked_analysis": s.get("screened_summary", ""),
        }
    for c in unrankable:
        # Preserve "low_confidence" (no real CV) vs "failed" (AI call errored) instead
        # of collapsing both into "failed" - they need different verdicts downstream.
        status = c.get("screened", {}).get("status", "failed")
        c["ranked"] = {"status": status, "ranked_score": None, "ranked_analysis": ""}

    rankable.sort(key=lambda x: x["ranked"]["ranked_score"], reverse=True)
    for i, c in enumerate(rankable):
        c["ranked"]["rank_position"] = i + 1
    for c in unrankable:
        c["ranked"]["rank_position"] = None

    return rankable + unrankable


def agent_finalize(candidates_ranked: list[dict], job_description: str) -> tuple[list[dict], dict | None]:
    # Deterministic verdict for every genuinely-ranked candidate - no LLM call needed
    # per candidate, and a failed screen/rank never gets silently mapped to a fake
    # "Do Not Recommend".
    for c in candidates_ranked:
        ranked = c.get("ranked", {})
        if ranked.get("status") == "low_confidence":
            c["final"] = {
                "final_verdict": "Low Confidence — No CV",
                "final_notes": "This is a sourced lead with no CV on file, not a fully screened candidate.",
                "next_steps": "Ask the candidate for a resume, then re-run the pipeline.",
            }
            continue
        if ranked.get("status") != "ok":
            c["final"] = {
                "final_verdict": "Needs Rescoring",
                "final_notes": "AI scoring failed for this candidate - retry the pipeline to get a real verdict.",
                "next_steps": "Re-run the pipeline for this candidate.",
            }
            continue
        score = ranked["ranked_score"]
        if score >= 75:
            verdict = "Recommend"
        elif score >= 60:
            verdict = "Consider"
        else:
            verdict = "Do Not Recommend"
        c["final"] = {"final_verdict": verdict, "final_notes": "", "next_steps": ""}

    # The top candidate's notes are built from what agent_parse_and_screen already
    # extracted (strengths/gaps/summary) instead of a third Mistral round-trip -
    # that call was non-essential (decorative recommendation text) but still added
    # a full request's worth of latency and failure risk to every pipeline run.
    best = next((c for c in candidates_ranked if c.get("ranked", {}).get("status") == "ok"), None)
    if best:
        s = best.get("screened", {})
        strengths = s.get("strengths", [])
        gaps = s.get("gaps", [])
        notes_parts = [s.get("screened_summary", "")]
        if strengths:
            notes_parts.append("Strengths: " + ", ".join(strengths) + ".")
        if gaps:
            notes_parts.append("Gaps: " + ", ".join(gaps) + ".")
        best["final"]["final_notes"] = " ".join(p for p in notes_parts if p)
        best["final"]["next_steps"] = (
            "Schedule an interview to validate fit." if best["final"]["final_verdict"] == "Recommend"
            else "Review gaps before proceeding to interview." if best["final"]["final_verdict"] == "Consider"
            else "Not recommended - consider other candidates first."
        )

    return candidates_ranked, best


def run_pipeline_stage(cand_dict: dict, cand_id: str, job_description: str) -> dict:
    if not has_real_cv(cand_dict.get("cv_text", "")):
        # A lead with no real CV (e.g. a LinkedIn/SERP-sourced snippet) must never be
        # run through the full CV-scoring prompt as if it were a real resume.
        low_confidence = {
            "status": "low_confidence",
            "name": cand_dict.get("name", "Unknown"),
        }
        return {
            "candidate_id": cand_id,
            "candidate": cand_dict,
            "parsed": {**low_confidence, "role": cand_dict.get("role", "Professional"), "skills": []},
            "screened": {**low_confidence, "screened_score": None, "screened_summary": "No CV on file - this is a sourced lead, not a fully screened candidate.", "strengths": [], "gaps": [], "verdict": "Low Confidence — No CV"},
        }
    parsed, screened = agent_parse_and_screen(cand_dict, job_description)
    return {"candidate_id": cand_id, "candidate": cand_dict, "parsed": parsed, "screened": screened}


def run_pipeline_parallel(candidates_map: dict, candidate_ids: list[str], job_description: str, progress_callback=None) -> tuple[list[dict], dict | None]:
    working_data = []
    total = len(candidate_ids)

    cand_list = []
    for cid in candidate_ids:
        c = candidates_map.get(cid)
        if not c:
            continue
        cand_dict = {
            "id": c.id,
            "name": c.name,
            "email": c.email,
            "role": c.role,
            "cv_text": c.cv_text or "",
            "skills": c.skills or "",
            "experience_years": c.experience_years,
            "location": c.location or "",
            "gender": c.gender,
            "shift_preference": c.shift_preference,
            "is_remote": c.is_remote,
            "age": c.age,
            "summary": c.summary or "",
        }
        cand_list.append((cand_dict, cid))

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {
            executor.submit(run_pipeline_stage, cd, cid, job_description): (i, cid)
            for i, (cd, cid) in enumerate(cand_list)
        }
        for future in as_completed(futures):
            i, cid = futures[future]
            try:
                result = future.result()
                working_data.append(result)
            except Exception as e:
                working_data.append({
                    "candidate_id": cid,
                    "candidate": cand_list[i][0],
                    "parsed": {"status": "failed", "name": cand_list[i][0].get("name", "Unknown")},
                    "screened": {"status": "failed", "screened_score": None, "verdict": "Needs Rescoring"},
                })
                print(f"[pipeline] Error processing candidate {cid}: {e}")
            if progress_callback:
                progress_callback(len([f for f in futures if f.done()]), total)

    if progress_callback:
        progress_callback(total, total)

    working_data = agent_deep_rank(working_data, job_description)
    working_data, best = agent_finalize(working_data, job_description)
    return working_data, best
