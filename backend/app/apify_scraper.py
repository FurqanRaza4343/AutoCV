import os
import json
import re
import time
from typing import Optional

import requests

APIFY_TOKEN = os.getenv("APIFY_API_TOKEN")
APIFY_BASE = "https://api.apify.com/v2"
SERPAPI_KEY = os.getenv("SERPAPI_API_KEY")
SERPAPI_BASE = "https://serpapi.com/search"


def _apify_call(actor_name: str, run_input: dict, timeout_secs: int = 120):
    """Start an Apify actor run, wait for it to finish, return dataset items."""
    if not APIFY_TOKEN:
        print(f"[apify] No token configured")
        return []

    url = f"{APIFY_BASE}/acts/{actor_name}/runs"
    headers = {"Authorization": f"Bearer {APIFY_TOKEN}", "Content-Type": "application/json"}

    try:
        resp = requests.post(url, json=run_input, headers=headers, timeout=30)
        resp.raise_for_status()
        run = resp.json()["data"]
        run_id = run["id"]

        deadline = time.time() + timeout_secs
        while time.time() < deadline:
            time.sleep(5)
            status_resp = requests.get(
                f"{APIFY_BASE}/actor-runs/{run_id}",
                headers={"Authorization": f"Bearer {APIFY_TOKEN}"},
                timeout=30,
            )
            status_resp.raise_for_status()
            status = status_resp.json()["data"]["status"]

            if status == "SUCCEEDED":
                dataset_id = status_resp.json()["data"]["defaultDatasetId"]
                items_resp = requests.get(
                    f"{APIFY_BASE}/datasets/{dataset_id}/items",
                    headers={"Authorization": f"Bearer {APIFY_TOKEN}"},
                    timeout=30,
                )
                items_resp.raise_for_status()
                items = items_resp.json()
                if not isinstance(items, list):
                    items = []
                return items
            elif status in ("FAILED", "ABORTED", "TIMED-OUT", "SUICIDED"):
                print(f"[apify] Run {run_id} ended with status {status}")
                return []
        print(f"[apify] Run {run_id} timed out after {timeout_secs}s")
        return []
    except requests.RequestException as e:
        print(f"[apify] HTTP error: {e}")
        return []
    except Exception as e:
        print(f"[apify] Unexpected error: {type(e).__name__}: {e}")
        return []


def run_linkedin_serp_search(keyword: str, location: str = "", max_results: int = 10) -> list[dict]:
    if not SERPAPI_KEY:
        print("[serp] No SerpAPI key configured")
        return []

    query = f"site:linkedin.com/in/ {keyword}"
    if location:
        query += f" {location}"

    params = {
        "q": query,
        "api_key": SERPAPI_KEY,
        "num": min(max_results, 10),
        "engine": "google",
        "hl": "en",
    }

    try:
        resp = requests.get(SERPAPI_BASE, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        organic = data.get("organic_results", [])
        results = []
        for item in organic[:max_results]:
            title = item.get("title", "")
            snippet = item.get("snippet", "")
            link = item.get("link", "")

            if "linkedin.com/in/" not in link:
                continue

            clean_title = title.replace(" - LinkedIn", "").replace(" - Profiles", "").strip() if title else "Unknown"
            # Google-indexed titles are usually "Name - Role - LinkedIn" or a full headline
            # like "Name - Role | Talks about ...". Only the first segment is ever a person's
            # name - never fall back to the whole headline string.
            segments = re.split(r"\s*[-|]\s*", clean_title)
            name = (segments[0].strip() if segments and segments[0].strip() else "Unknown")[:60]
            role = segments[1].strip() if len(segments) > 1 else ""

            location_found = location if location else ""
            snippet_lower = snippet.lower()
            for loc_word in ["karachi", "lahore", "islamabad", "rawalpindi", "pakistan"]:
                if loc_word in snippet_lower:
                    location_found = loc_word.capitalize()
                    break

            skills = snippet[:200] if snippet else ""

            results.append({
                "name": name,
                "role": role,
                "location": location_found,
                "skills": skills,
                "summary": snippet,
                "profile_url": link,
                "source": "LinkedIn (Google)",
            })
        print(f"[serp] Found {len(results)} LinkedIn profiles for '{keyword}'")
        return results
    except Exception as e:
        print(f"[serp] Error: {e}")
        return []


def normalize_serp_to_candidate(item: dict, job_description: str) -> dict:
    name = item.get("name", "Unknown Candidate")
    role = item.get("role", "Professional")
    location = item.get("location", "")
    skills = item.get("skills", "")
    summary = item.get("summary", "")
    profile_url = item.get("profile_url", "")

    exp_years = None
    nums = re.findall(r"\d+", summary)
    if nums:
        exp_years = int(nums[0]) if int(nums[0]) < 50 else None

    return {
        "name": name,
        "email": f"{name.lower().replace(' ', '.').replace('-', '')}@linkedin.com",
        "role": role,
        "department": "Engineering",
        "applied_date": "",
        "match_score": None,
        "status": "Screening",
        "current_stage": "Awaiting Ranking",
        "summary": summary[:500] if summary else f"LinkedIn profile: {profile_url}",
        "cv_text": json.dumps(item),
        "gender": None,
        "shift_preference": "Any",
        "age": None,
        "source_platform": "LinkedIn (Google)",
        "is_remote": None,
        "location": location,
        "skills": skills,
        "experience_years": exp_years,
        "phone": None,
        # No resume text is available for a SERP-sourced lead - only a headline/snippet.
        # Downstream scoring must treat this as low-confidence, not a fully-screened candidate.
        "has_cv": False,
        "confidence": "low",
    }


