import os
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models
from .candidates import has_real_cv
from .auth import get_current_user

router = APIRouter(prefix="/queue", tags=["queue"])


@router.get("")
def get_processing_queue(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    candidates = db.query(models.Candidate).filter(
        models.Candidate.user_id == current_user.id,
        models.Candidate.current_stage.in_(["Awaiting Parsing", "Awaiting Ranking", "Ready for Outreach"])
    ).order_by(models.Candidate.created_at.asc()).all()

    items = []
    for c in candidates:
        ext = ""
        if c.cv_file_url:
            ext = os.path.splitext(c.cv_file_url)[1].replace(".", "").upper()
        has_cv = has_real_cv(c.cv_text)
        if not ext:
            # A sourced lead with no real resume must never be labeled as a PDF -
            # there's no file to download, only a headline/snippet.
            ext = "PDF" if has_cv else "LEAD"
        items.append({
            "id": c.id,
            "candidate_name": c.name,
            "email": c.email,
            "file_name": f"resume_{c.name.lower().replace(' ', '_')}.{ext.lower()}" if has_cv else None,
            "file_type": ext,
            "stage": c.current_stage,
            "score": c.match_score,
        })
    return items
