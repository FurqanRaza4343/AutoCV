from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class CandidateBase(BaseModel):
    name: str
    email: str
    role: str
    department: str
    applied_date: str
    match_score: Optional[int] = None
    status: str = "Applied"
    current_stage: str = "Awaiting Parsing"
    summary: Optional[str] = None


class CandidateCreate(CandidateBase):
    pass


class CandidateOut(CandidateBase):
    id: str
    cv_file_url: Optional[str] = None
    gender: Optional[str] = None
    shift_preference: Optional[str] = None
    age: Optional[int] = None
    source_platform: Optional[str] = None
    is_remote: Optional[bool] = None
    location: Optional[str] = None
    skills: Optional[str] = None
    experience_years: Optional[int] = None
    phone: Optional[str] = None

    class Config:
        from_attributes = True


class CandidateStageUpdate(BaseModel):
    current_stage: str


class CandidateStatusUpdate(BaseModel):
    status: str


class AgentOut(BaseModel):
    id: str
    name: str
    role: str
    description: str
    is_running: bool

    class Config:
        from_attributes = True


class AgentToggle(BaseModel):
    is_running: bool


class JobDescriptionCreate(BaseModel):
    title: str
    text: str


class JobDescriptionOut(JobDescriptionCreate):
    id: str
    embedding: Optional[str] = None
    created_at: Optional[str] = None

    class Config:
        from_attributes = True

    @classmethod
    def from_orm(cls, obj):
        return cls(
            id=obj.id,
            title=obj.title,
            text=obj.text,
            embedding=obj.embedding,
            created_at=obj.created_at.isoformat() if obj.created_at else None,
        )


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    role: str
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True


class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str
    role: str = "HR Recruiter"


class LoginRequest(BaseModel):
    email: str
    password: str


class GoogleAuthRequest(BaseModel):
    credential: str


class AuthOut(BaseModel):
    token: str
    user: UserOut


class AgentConfigUpdate(BaseModel):
    confidence_threshold: Optional[int] = None
    channel: Optional[str] = None
    auto_screen: Optional[bool] = None


class AgentOutWithConfig(AgentOut):
    confidence_threshold: int = 75
    channel: str = "webhook"
    auto_screen: bool = False


class NotificationOut(BaseModel):
    id: str
    message: str
    type: str
    is_read: bool
    created_at: str

    class Config:
        from_attributes = True

    @classmethod
    def from_orm(cls, obj):
        return cls(
            id=obj.id,
            message=obj.message,
            type=obj.type,
            is_read=obj.is_read,
            created_at=obj.created_at.isoformat() if obj.created_at else "",
        )


class QueueItemOut(BaseModel):
    id: str
    candidate_name: str
    email: str
    file_name: str
    file_type: str
    stage: str
    score: Optional[int] = None

    class Config:
        from_attributes = True


class DiagnosticResult(BaseModel):
    status: str
    agents_responsive: int
    database_connected: bool
    api_latency_ms: int
    message: str


class FetchFilters(BaseModel):
    gender: Optional[str] = None
    shift: Optional[str] = None
    remote: Optional[bool] = None
    age_min: Optional[int] = None
    age_max: Optional[int] = None
    location: Optional[str] = None
    experience_min: Optional[int] = None
    experience_max: Optional[int] = None
    platforms: Optional[list[str]] = None


class FetchRequest(BaseModel):
    job_title: str = ""
    job_description: str
    filters: FetchFilters = FetchFilters()
    max_results_per_source: int = 10


class FetchedCandidateOut(CandidateOut):
    gender: Optional[str] = None
    shift_preference: Optional[str] = None
    age: Optional[int] = None
    source_platform: Optional[str] = None
    is_remote: Optional[bool] = None
    location: Optional[str] = None
    skills: Optional[str] = None
    experience_years: Optional[int] = None


class FetchResponse(BaseModel):
    candidates: list[FetchedCandidateOut]
    total_fetched: int
    platform_breakdown: dict[str, int]
    fetch_time_ms: int


class FetchStatusResponse(BaseModel):
    fetch_id: str
    status: str  # "processing" | "completed" | "error"
    progress: int = 0
    message: str = ""
    candidates: list[FetchedCandidateOut] = []
    total_fetched: int = 0
    platform_breakdown: dict[str, int] = {}
    fetch_time_ms: int = 0


class PipelineRunCreate(BaseModel):
    job_title: str = ""
    job_description: str = ""
    candidate_ids: list[str] = []


class PipelineRunOut(BaseModel):
    id: str
    job_title: str
    job_description: str
    status: str
    progress: int
    current_agent: Optional[str] = None
    total_candidates: int
    parsed_count: int
    screened_count: int
    ranked_count: int
    created_at: datetime
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None

    class Config:
        from_attributes = True


class PipelineResultOut(BaseModel):
    id: str
    run_id: str
    candidate_id: str
    candidate_name: str
    candidate_email: Optional[str] = None
    role: Optional[str] = None
    parsed_skills: Optional[str] = None
    parsed_experience: Optional[int] = None
    parsed_location: Optional[str] = None
    screened_score: Optional[int] = None
    screened_summary: Optional[str] = None
    ranked_score: Optional[int] = None
    ranked_analysis: Optional[str] = None
    rank_position: Optional[int] = None
    final_verdict: Optional[str] = None
    final_notes: Optional[str] = None
    is_best_match: bool = False

    class Config:
        from_attributes = True


class PipelineFullOut(BaseModel):
    run: PipelineRunOut
    results: list[PipelineResultOut]


class CVAnalysisOut(BaseModel):
    id: Optional[str] = None
    name: str
    email: str
    role: str
    score: int
    summary: str
    skills: str
    experience_years: Optional[int] = None
    gender: Optional[str] = None
    shift_preference: Optional[str] = None
    is_remote: Optional[bool] = None
    age: Optional[int] = None
    location: Optional[str] = None
    strengths: list[str] = []
    areas_for_improvement: list[str] = []
    detailed_assessment: str = ""
    overall_verdict: str = ""


class BatchAnalyzeResponse(BaseModel):
    candidates: list[CVAnalysisOut]
    total_processed: int


class BulkDeleteRequest(BaseModel):
    ids: list[str]
