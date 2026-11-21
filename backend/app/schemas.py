from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


Severity = Literal["Low", "Medium", "High", "Critical"]
Priority = Literal["Low", "Medium", "High", "Critical"]
ComplaintStatus = Literal["New", "In Progress", "On Hold", "Resolved"]


class DepartmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    responsible_categories: list[str]
    demo: bool
    complaint_count: int = 0
    open_count: int = 0


class ComplaintCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(default="Civic report", min_length=4, max_length=180)
    description: str = Field(min_length=8, max_length=4000)
    category: str = Field(min_length=2, max_length=100)
    location: str = Field(min_length=2, max_length=240)
    language: str = Field(default="English", min_length=2, max_length=40)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    image_reference: str | None = Field(default=None, max_length=500)
    severity: Severity = "Medium"
    department_id: str | None = None


class ComplaintPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    description: str | None = Field(default=None, min_length=8, max_length=4000)
    category: str | None = Field(default=None, min_length=2, max_length=100)
    location: str | None = Field(default=None, min_length=2, max_length=240)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    image_reference: str | None = Field(default=None, max_length=500)
    severity: Severity | None = None
    priority: Priority | None = None
    status: ComplaintStatus | None = None
    department_id: str | None = None
    changed_by: str = Field(default="Officer (demo)", max_length=120)


class AIAnalysisOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    predicted_category: str
    severity: str
    explanation: str
    confidence: float
    analysis_at: datetime
    source: str
    priority_score: int = 50
    department_name: str | None = None
    urgency: str = "Review during normal triage"
    knowledge_references: list[dict] = Field(default_factory=list)
    model_version: str = "civiclens-hybrid-v1"


class AskRequest(BaseModel):
    question: str = Field(min_length=4, max_length=2000)


class IncidentDecision(BaseModel):
    confirmed: bool


class IncidentOut(BaseModel):
    id: str
    title: str
    complaint_ids: list[str]
    complaint_count: int
    location: str
    dominant_category: str
    severity: str
    status: str
    review_status: str
    first_reported_at: datetime
    latest_reported_at: datetime
    demo: bool
    similarity_score: float
    possible_relationships: list[str] = Field(default_factory=list)
    departments: list[str] = Field(default_factory=list)
    latitude: float | None = None
    longitude: float | None = None
    coordinates_are_fictional: bool = False


class IncidentDetailOut(IncidentOut):
    complaints: list[dict] = Field(default_factory=list)
    timeline: list[dict] = Field(default_factory=list)


class ComplaintOut(BaseModel):
    id: str
    title: str
    description: str
    language: str
    category: str
    location: str
    latitude: float | None
    longitude: float | None
    image_reference: str | None
    severity: str
    priority: str
    status: str
    department_id: str | None
    department_name: str | None
    submitted_at: datetime
    demo: bool
    ai_analysis: AIAnalysisOut | None = None


class ComplaintListOut(BaseModel):
    items: list[ComplaintOut]
    total: int
    page: int
    page_size: int


class ComplaintHistoryOut(BaseModel):
    id: int
    complaint_id: str
    previous_status: str
    new_status: str
    changed_at: datetime
    changed_by: str


class CategoryCount(BaseModel):
    category: str
    count: int
    percent: float


class TrendDay(BaseModel):
    day: str
    received: int
    resolved: int


class DashboardStatsOut(BaseModel):
    total_complaints: int
    unresolved_complaints: int
    critical_incidents: int
    resolved_this_week: int
    average_resolution_days: float | None
    complaints_by_category: list[CategoryCount]
    trend_7_days: list[TrendDay]
    trend_30_days: list[TrendDay]
    demo: bool
