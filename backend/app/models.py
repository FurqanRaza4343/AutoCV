import uuid
from sqlalchemy import Column, String, Integer, Boolean, DateTime, Text
from sqlalchemy.sql import func
from .database import Base


def gen_id():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_id)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    name = Column(String, nullable=False)
    role = Column(String, default="HR Recruiter")
    avatar_url = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Candidate(Base):
    __tablename__ = "candidates"

    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, nullable=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    role = Column(String, nullable=False)
    department = Column(String, nullable=False)
    applied_date = Column(String, nullable=False)
    match_score = Column(Integer, nullable=True)
    status = Column(String, default="Applied")
    current_stage = Column(String, default="Awaiting Parsing")
    summary = Column(Text, nullable=True)
    cv_file_url = Column(String, nullable=True)
    cv_text = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    gender = Column(String, nullable=True)
    shift_preference = Column(String, nullable=True)
    age = Column(Integer, nullable=True)
    source_platform = Column(String, nullable=True)
    is_remote = Column(Boolean, nullable=True)
    location = Column(String, nullable=True)
    skills = Column(Text, nullable=True)
    experience_years = Column(Integer, nullable=True)
    phone = Column(String, nullable=True)


class Agent(Base):
    __tablename__ = "agents"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    role = Column(String, nullable=False)
    description = Column(String, nullable=False)
    is_running = Column(Boolean, default=False)
    confidence_threshold = Column(Integer, default=75)
    channel = Column(String, default="webhook")
    auto_screen = Column(Boolean, default=False)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True, default=gen_id)
    message = Column(String, nullable=False)
    type = Column(String, default="info")
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class JobDescription(Base):
    __tablename__ = "job_descriptions"

    id = Column(String, primary_key=True, default=gen_id)
    title = Column(String, nullable=False)
    text = Column(Text, nullable=False)
    embedding = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class PipelineRun(Base):
    __tablename__ = "pipeline_runs"

    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, nullable=True, index=True)
    job_title = Column(String, default="")
    job_description = Column(Text, default="")
    status = Column(String, default="pending")
    progress = Column(Integer, default=0)
    current_agent = Column(String, nullable=True)
    total_candidates = Column(Integer, default=0)
    parsed_count = Column(Integer, default=0)
    screened_count = Column(Integer, default=0)
    ranked_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)


class PipelineResult(Base):
    __tablename__ = "pipeline_results"

    id = Column(String, primary_key=True, default=gen_id)
    run_id = Column(String, nullable=False)
    candidate_id = Column(String, nullable=False)
    candidate_name = Column(String, nullable=False)
    candidate_email = Column(String, nullable=True)
    role = Column(String, nullable=True)
    parsed_skills = Column(Text, nullable=True)
    parsed_experience = Column(Integer, nullable=True)
    parsed_location = Column(String, nullable=True)
    screened_score = Column(Integer, nullable=True)
    screened_summary = Column(Text, nullable=True)
    ranked_score = Column(Integer, nullable=True)
    ranked_analysis = Column(Text, nullable=True)
    rank_position = Column(Integer, nullable=True)
    final_verdict = Column(String, nullable=True)
    final_notes = Column(Text, nullable=True)
    is_best_match = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
