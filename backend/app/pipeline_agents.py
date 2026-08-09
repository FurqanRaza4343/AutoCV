import json
import os
import re
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY")
MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions"
MAX_WORKERS = 5
RANK_CHUNK_SIZE = 12


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
        timeout=(10, 25),
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


def _rank_chunk(chunk: list[dict], job_description: str) -> None:
    """Rank one chunk of candidates in place, mutating each entry's 'ranked' key."""
    profiles_text = ""
    for i, c in enumerate(chunk):
        p = c.get("parsed", {})
        s = c.get("screened", {})
        skills_str = ", ".join(p.get("skills", [])) if isinstance(p.get("skills"), list) else str(p.get("skills", ""))
        profiles_text += f"\nCandidate {i}: {p.get('name', 'Unknown')}\n  Role: {p.get('role', '')}\n  Skills: {skills_str}\n  Experience: {p.get('experience_years')}y\n  Screened Score: {s.get('screened_score')}\n  Verdict: {s.get('verdict', '')}\n"

    prompt = f"""You are Agentix Deep Ranker AI — an expert comparative ranking agent.
Rank the following candidates by fit for the job description. Provide a ranked score (0-100) and analysis for each.

Job Description:
{job_description[:2000]}

Candidates:
{profiles_text}

Respond with ONLY valid JSON as an array:
[
  {{
    "candidate_index": 0,
    "ranked_score": <integer 0-100>,
    "analysis": "detailed comparative analysis"
  }},
  ...
]
Include every candidate index exactly once."""

    try:
        raw = _call_mistral_safe(prompt)
        array_match = re.search(r"\[[\s\S]*\]", raw)
        if array_match:
            rankings = json.loads(array_match.group(0))
            for r in rankings:
                idx = r.get("candidate_index")
                if isinstance(idx, int) and 0 <= idx < len(chunk) and isinstance(r.get("ranked_score"), (int, float)):
                    chunk[idx]["ranked"] = {
                        "status": "ok",
                        "ranked_score": int(r["ranked_score"]),
                        "ranked_analysis": r.get("analysis", ""),
                    }
    except Exception:
        pass

    for c in chunk:
        if "ranked" not in c:
            c["ranked"] = {"status": "failed", "ranked_score": None, "ranked_analysis": ""}


def agent_deep_rank(candidates_with_scores: list[dict], job_description: str) -> list[dict]:
    # Only candidates that were genuinely screened can be meaningfully ranked -
    # a failed screen has no real score to compare against peers.
    rankable = [c for c in candidates_with_scores if c.get("screened", {}).get("status") == "ok"]
    unrankable = [c for c in candidates_with_scores if c.get("screened", {}).get("status") != "ok"]

    for c in unrankable:
        c["ranked"] = {"status": "failed", "ranked_score": None, "ranked_analysis": ""}

    chunks = [rankable[i:i + RANK_CHUNK_SIZE] for i in range(0, len(rankable), RANK_CHUNK_SIZE)]
    if chunks:
        with ThreadPoolExecutor(max_workers=min(MAX_WORKERS, len(chunks))) as executor:
            futures = [executor.submit(_rank_chunk, chunk, job_description) for chunk in chunks]
            for future in as_completed(futures):
                future.result()

    ranked_ok = [c for c in rankable if c.get("ranked", {}).get("status") == "ok"]
    ranked_ok.sort(key=lambda x: x["ranked"]["ranked_score"], reverse=True)
    for i, c in enumerate(ranked_ok):
        c["ranked"]["rank_position"] = i + 1

    failed = [c for c in candidates_with_scores if c.get("ranked", {}).get("status") != "ok"]
    for c in failed:
        c["ranked"]["rank_position"] = None

    return ranked_ok + failed


def agent_finalize(candidates_ranked: list[dict], job_description: str) -> tuple[list[dict], dict | None]:
    # Deterministic verdict for every genuinely-ranked candidate - no LLM call needed
    # per candidate, and a failed screen/rank never gets silently mapped to a fake
    # "Do Not Recommend".
    for c in candidates_ranked:
        ranked = c.get("ranked", {})
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

    best = next((c for c in candidates_ranked if c.get("ranked", {}).get("status") == "ok"), None)
    if best:
        p = best.get("parsed", {})
        r = best.get("ranked", {})
        s = best.get("screened", {})
        prompt = f"""You are Agentix Finalizer AI — the concluding HR decision agent.
Given the best-matching candidate, produce a final hiring recommendation.

Best Candidate:
- Name: {p.get('name', 'Unknown')}
- Role: {p.get('role', '')}
- Skills: {p.get('skills', [])}
- Experience: {p.get('experience_years')}y
- Screened Score: {s.get('screened_score')}
- Ranked Score: {r.get('ranked_score')}
- Rank Position: {r.get('rank_position')}

Job Description:
{job_description[:1500]}

Respond with ONLY valid JSON:
{{
  "final_notes": "detailed final recommendation",
  "next_steps": "suggested next steps"
}}"""
        try:
            raw = _call_mistral_safe(prompt, {"type": "json_object"})
            data = _parse_json(raw)
            if data:
                # Verdict stays deterministic (set above) - the LLM only enriches notes/next_steps.
                best["final"]["final_notes"] = data.get("final_notes", "")
                best["final"]["next_steps"] = data.get("next_steps", "")
        except Exception:
            pass

    return candidates_ranked, best


def run_pipeline_stage(cand_dict: dict, cand_id: str, job_description: str) -> dict:
    parsed = agent_parse(cand_dict, job_description)
    screened = agent_screen(cand_dict, parsed, job_description)
    return {"candidate_id": cand_id, "candidate": cand_dict, "parsed": parsed, "screened": screened}


def run_pipeline_parallel(candidates_map: dict, candidate_ids: list[str], job_description: str, progress_callback=None) -> list[dict]:
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
    return working_data
