from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(180), unique=True, index=True, nullable=False)
    role: Mapped[str] = mapped_column(String(40), nullable=False, default="citizen")


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    name: Mapped[str] = mapped_column(String(140), unique=True, nullable=False)
    responsible_categories: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    demo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    complaints: Mapped[list["Complaint"]] = relationship(back_populates="department")


class Complaint(Base):
    __tablename__ = "complaints"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    title: Mapped[str] = mapped_column(String(180), nullable=False, default="")
    description: Mapped[str] = mapped_column(Text, nullable=False)
    language: Mapped[str] = mapped_column(String(40), nullable=False, default="English")
    category: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    location: Mapped[str] = mapped_column(String(240), nullable=False)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    image_reference: Mapped[str | None] = mapped_column(String(500), nullable=True)
    severity: Mapped[str] = mapped_column(String(24), nullable=False, index=True)
    priority: Mapped[str] = mapped_column(String(24), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(40), nullable=False, default="New", index=True)
    department_id: Mapped[str | None] = mapped_column(ForeignKey("departments.id"), nullable=True, index=True)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)
    demo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    demo_key: Mapped[str | None] = mapped_column(String(80), unique=True, nullable=True)

    department: Mapped[Department | None] = relationship(back_populates="complaints")
    analyses: Mapped[list["AIAnalysis"]] = relationship(back_populates="complaint", cascade="all, delete-orphan")
    history: Mapped[list["ComplaintHistory"]] = relationship(back_populates="complaint", cascade="all, delete-orphan")
    incident_links: Mapped[list["IncidentComplaint"]] = relationship(back_populates="complaint", cascade="all, delete-orphan")


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[str] = mapped_column(String(48), primary_key=True)
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    location: Mapped[str] = mapped_column(String(240), nullable=False)
    dominant_category: Mapped[str] = mapped_column(String(100), nullable=False)
    severity: Mapped[str] = mapped_column(String(24), nullable=False)
    status: Mapped[str] = mapped_column(String(40), nullable=False, default="Open")
    review_status: Mapped[str] = mapped_column(String(20), nullable=False, default="Suggested")
    first_reported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    latest_reported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    demo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    possible_relationships: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    links: Mapped[list["IncidentComplaint"]] = relationship(back_populates="incident", cascade="all, delete-orphan")


class IncidentComplaint(Base):
    __tablename__ = "incident_complaints"
    __table_args__ = (UniqueConstraint("incident_id", "complaint_id", name="uq_incident_complaint"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    incident_id: Mapped[str] = mapped_column(ForeignKey("incidents.id", ondelete="CASCADE"), index=True, nullable=False)
    complaint_id: Mapped[str] = mapped_column(ForeignKey("complaints.id", ondelete="CASCADE"), index=True, nullable=False)
    similarity_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    link_status: Mapped[str] = mapped_column(String(20), nullable=False, default="Suggested")
    linked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    incident: Mapped[Incident] = relationship(back_populates="links")
    complaint: Mapped[Complaint] = relationship(back_populates="incident_links")


class AIAnalysis(Base):
    __tablename__ = "ai_analyses"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    complaint_id: Mapped[str] = mapped_column(ForeignKey("complaints.id", ondelete="CASCADE"), index=True, nullable=False)
    predicted_category: Mapped[str] = mapped_column(String(100), nullable=False)
    severity: Mapped[str] = mapped_column(String(24), nullable=False)
    explanation: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    analysis_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    source: Mapped[str] = mapped_column(String(40), nullable=False, default="demo-rule")
    priority_score: Mapped[int] = mapped_column(default=50, nullable=False)
    department_name: Mapped[str | None] = mapped_column(String(140), nullable=True)
    urgency: Mapped[str] = mapped_column(String(100), nullable=False, default="Review during normal triage")
    knowledge_references: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    model_version: Mapped[str] = mapped_column(String(80), nullable=False, default="civiclens-hybrid-v1")

    complaint: Mapped[Complaint] = relationship(back_populates="analyses")


class ComplaintHistory(Base):
    __tablename__ = "complaint_history"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    complaint_id: Mapped[str] = mapped_column(ForeignKey("complaints.id", ondelete="CASCADE"), index=True, nullable=False)
    previous_status: Mapped[str] = mapped_column(String(40), nullable=False)
    new_status: Mapped[str] = mapped_column(String(40), nullable=False)
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    changed_by: Mapped[str] = mapped_column(String(120), nullable=False, default="Officer (demo)")

    complaint: Mapped[Complaint] = relationship(back_populates="history")

