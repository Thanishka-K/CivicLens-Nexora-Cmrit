import os
import hashlib
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from PIL import Image, UnidentifiedImageError
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session, joinedload, selectinload

from .database import Base, SessionLocal, engine, get_db
from .models import AIAnalysis, Complaint, ComplaintHistory, Department, Incident, IncidentComplaint, utc_now
from .schemas import (
    AskRequest,
    ComplaintCreate,
    ComplaintHistoryOut,
    ComplaintListOut,
    ComplaintOut,
    ComplaintPatch,
    DashboardStatsOut,
    DepartmentOut,
    IncidentDecision,
    IncidentDetailOut,
    IncidentOut,
)
from .seed import seed_database
from .intelligence import analyze as analyze_complaint, answer as answer_question
from .incident_intelligence import category_of, pair_similarity


UPLOAD_DIRECTORY = os.path.abspath(os.getenv("UPLOAD_DIRECTORY", os.path.join(os.path.dirname(__file__), "..", "uploads")))
MAX_IMAGE_BYTES = 5 * 1024 * 1024
ALLOWED_LANGUAGES = {"English", "Kannada", "Hindi", "Telugu"}
ALLOWED_CATEGORIES = {
    "Roads and Infrastructure": "dept-roads",
    "Sanitation and Waste": "dept-sanitation",
    "Water Supply": "dept-water",
    "Electricity": "dept-electricity",
    "Parks and Trees": "dept-parks",
    "Drainage and Sewerage": "dept-drainage",
}


def initialize_database() -> None:
    Base.metadata.create_all(bind=engine)
    if engine.dialect.name == "sqlite":
        from sqlalchemy import inspect
        columns = {column["name"] for column in inspect(engine).get_columns("complaints")}
        with engine.begin() as connection:
            if "title" not in columns:
                connection.exec_driver_sql("ALTER TABLE complaints ADD COLUMN title VARCHAR(180) NOT NULL DEFAULT ''")
                connection.exec_driver_sql("UPDATE complaints SET title = substr(description, 1, 180) WHERE title = ''")
            if "language" not in columns:
                connection.exec_driver_sql("ALTER TABLE complaints ADD COLUMN language VARCHAR(40) NOT NULL DEFAULT 'English'")
        analysis_columns = {column["name"] for column in inspect(engine).get_columns("ai_analyses")}
        with engine.begin() as connection:
            for name, definition in {
                "priority_score": "INTEGER NOT NULL DEFAULT 50",
                "department_name": "VARCHAR(140)",
                "urgency": "VARCHAR(100) NOT NULL DEFAULT 'Review during normal triage'",
                "knowledge_references": "JSON NOT NULL DEFAULT '[]'",
                "model_version": "VARCHAR(80) NOT NULL DEFAULT 'civiclens-hybrid-v1'",
            }.items():
                if name not in analysis_columns:
                    connection.exec_driver_sql(f"ALTER TABLE ai_analyses ADD COLUMN {name} {definition}")
        incident_columns = {column["name"] for column in inspect(engine).get_columns("incidents")}
        if "possible_relationships" not in incident_columns:
            with engine.begin() as connection:
                connection.exec_driver_sql("ALTER TABLE incidents ADD COLUMN possible_relationships JSON NOT NULL DEFAULT '[]'")
    with SessionLocal() as db:
        seed_database(db)


@asynccontextmanager
async def lifespan(_: FastAPI):
    initialize_database()
    yield


app = FastAPI(title="CivicLens API", version="0.3.0", lifespan=lifespan)
allowed_origins = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "http://127.0.0.1:5173,http://localhost:5173").split(",") if origin.strip()]
os.makedirs(UPLOAD_DIRECTORY, exist_ok=True)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Content-Type"],
)
app.mount("/media", StaticFiles(directory=UPLOAD_DIRECTORY), name="media")


def serialize_complaint(complaint: Complaint, include_analysis: bool = False) -> ComplaintOut:
    latest_analysis = max(complaint.analyses, key=lambda analysis: analysis.analysis_at) if include_analysis and complaint.analyses else None
    return ComplaintOut(
        id=complaint.id,
        title=complaint.title,
        description=complaint.description,
        language=complaint.language,
        category=complaint.category,
        location=complaint.location,
        latitude=complaint.latitude,
        longitude=complaint.longitude,
        image_reference=complaint.image_reference,
        severity=complaint.severity,
        priority=complaint.priority,
        status=complaint.status,
        department_id=complaint.department_id,
        department_name=complaint.department.name if complaint.department else None,
        submitted_at=complaint.submitted_at,
        demo=complaint.demo,
        ai_analysis=latest_analysis,
    )


def department_for_category(db: Session, category: str) -> Department | None:
    category_key = category.strip().casefold()
    departments = db.scalars(select(Department)).all()
    for department in departments:
        if any(category_key == item.casefold() for item in department.responsible_categories):
            return department
    aliases = {
        "roads and infrastructure": "dept-roads",
        "sanitation and waste": "dept-sanitation",
        "parks and trees": "dept-parks",
        "water supply": "dept-water",
        "drainage and sewerage": "dept-drainage",
        "road pothole": "dept-roads", "pothole": "dept-roads", "roads": "dept-roads",
        "garbage": "dept-sanitation", "waste": "dept-sanitation",
        "water": "dept-water", "water leak": "dept-water",
        "electrical": "dept-electricity", "electricity": "dept-electricity",
        "tree": "dept-parks", "parks": "dept-parks",
        "drainage": "dept-drainage", "flooding": "dept-drainage",
    }
    for alias, department_id in aliases.items():
        if alias in category_key:
            return db.get(Department, department_id)
    return None


@app.get("/health")
def health(db: Session = Depends(get_db)) -> dict[str, str | int]:
    db.execute(select(1))
    return {"status": "ok", "service": "civiclens-api", "database": "connected"}


def save_analysis(db: Session, complaint: Complaint) -> AIAnalysis:
    """Persist deterministic analysis separately from the citizen's original text."""
    result = analyze_complaint(f"{complaint.title}. {complaint.description}")
    department = department_for_category(db, result["predicted_category"])
    record = AIAnalysis(complaint_id=complaint.id, severity=result["severity"],
        predicted_category=result["predicted_category"], priority_score=result["priority_score"],
        explanation=result["explanation"], confidence=result["confidence"], source=result["source"],
        department_name=department.name if department else result["department_name"], urgency=result["urgency"],
        knowledge_references=result["knowledge_references"], model_version=result["model_version"])
    db.add(record)
    complaint.severity = result["severity"]
    complaint.priority = "Critical" if result["priority_score"] >= 85 else "High" if result["priority_score"] >= 65 else "Medium" if result["priority_score"] >= 40 else "Low"
    if department:
        complaint.department = department
    return record


@app.post("/api/ai/analyze/{complaint_id}")
def run_complaint_analysis(complaint_id: str, db: Session = Depends(get_db)) -> dict:
    complaint = db.scalar(select(Complaint).options(joinedload(Complaint.department), selectinload(Complaint.analyses)).where(Complaint.id == complaint_id))
    if complaint is None:
        raise HTTPException(status_code=404, detail="Complaint not found")
    if complaint.analyses and max(complaint.analyses, key=lambda item: item.analysis_at).source == "hybrid-rules-tfidf-demo":
        return analysis_payload(max(complaint.analyses, key=lambda item: item.analysis_at))
    record = save_analysis(db, complaint)
    db.commit()
    db.refresh(record)
    return analysis_payload(record)


def analysis_payload(record: AIAnalysis) -> dict:
    return {"complaint_id": record.complaint_id, "predicted_category": record.predicted_category,
        "severity": record.severity, "priority_score": record.priority_score, "explanation": record.explanation,
        "confidence": record.confidence, "department_name": record.department_name, "urgency": record.urgency,
        "knowledge_references": record.knowledge_references, "analysis_at": record.analysis_at,
        "source": record.source, "model_version": record.model_version}


@app.get("/api/ai/analysis/{complaint_id}")
def get_complaint_analysis(complaint_id: str, db: Session = Depends(get_db)) -> dict:
    records = db.scalars(select(AIAnalysis).where(AIAnalysis.complaint_id == complaint_id).order_by(AIAnalysis.analysis_at.desc())).all()
    if not records:
        if db.get(Complaint, complaint_id) is None:
            raise HTTPException(status_code=404, detail="Complaint not found")
        raise HTTPException(status_code=404, detail="No analysis is available")
    return analysis_payload(records[0])


@app.post("/api/ai/ask")
def ask_civic_knowledge(payload: AskRequest) -> dict:
    return answer_question(payload.question)


def severity_rank(value: str) -> int:
    return {"Low": 1, "Medium": 2, "High": 3, "Critical": 4}.get(value, 1)


def incident_complaints(db: Session, incident_id: str) -> list[Complaint]:
    links = db.scalars(select(IncidentComplaint).where(IncidentComplaint.incident_id == incident_id, IncidentComplaint.link_status != "Rejected").order_by(IncidentComplaint.linked_at)).all()
    ids = [link.complaint_id for link in links]
    if not ids:
        return []
    rows = db.scalars(select(Complaint).options(joinedload(Complaint.department), selectinload(Complaint.analyses)).where(Complaint.id.in_(ids))).all()
    by_id = {row.id: row for row in rows}
    return [by_id[item] for item in ids if item in by_id]


def incident_payload(db: Session, incident: Incident, detailed: bool = False) -> dict:
    reports = incident_complaints(db, incident.id)
    links = db.scalars(select(IncidentComplaint).where(IncidentComplaint.incident_id == incident.id, IncidentComplaint.link_status != "Rejected")).all()
    categories: dict[str, int] = {}
    for report in reports:
        category = category_of(report)
        categories[category] = categories.get(category, 0) + 1
    dominant = max(categories, key=categories.get) if categories else incident.dominant_category
    severity = max((report.severity for report in reports), key=severity_rank) if reports else incident.severity
    statuses = {report.status for report in reports}
    current_status = "Resolved" if reports and statuses == {"Resolved"} else "In Progress" if "In Progress" in statuses else "Open"
    dates = [report.submitted_at for report in reports]
    coords = [(report.latitude, report.longitude) for report in reports if report.latitude is not None and report.longitude is not None]
    latitude = sum(point[0] for point in coords) / len(coords) if coords else None
    longitude = sum(point[1] for point in coords) / len(coords) if coords else None
    fictional_coords = bool(reports) and all(report.demo for report in reports)
    if not coords and fictional_coords:
        seed = int(hashlib.sha256(incident.id.encode()).hexdigest()[:8], 16)
        latitude, longitude = 20.5937 + ((seed % 31) - 15) / 100, 78.9629 + (((seed >> 4) % 37) - 18) / 100
    score = max((link.similarity_score for link in links), default=0.0)
    result = {"id": incident.id, "title": incident.title, "complaint_ids": [report.id for report in reports],
        "complaint_count": len(reports), "location": incident.location, "dominant_category": dominant,
        "severity": severity, "status": current_status, "review_status": incident.review_status,
        "first_reported_at": min(dates) if dates else incident.first_reported_at,
        "latest_reported_at": max(dates) if dates else incident.latest_reported_at,
        "demo": incident.demo, "similarity_score": score,
        "possible_relationships": incident.possible_relationships or [],
        "departments": sorted({report.department.name for report in reports if report.department}),
        "latitude": latitude, "longitude": longitude,
        "coordinates_are_fictional": fictional_coords}
    if detailed:
        result["complaints"] = [serialize_complaint(report, include_analysis=True).model_dump(mode="json") for report in reports]
        result["timeline"] = [{"complaint_id": report.id, "title": report.title, "reported_at": report.submitted_at, "status": report.status} for report in sorted(reports, key=lambda row: row.submitted_at)]
    return result


@app.get("/api/incidents", response_model=list[IncidentOut])
def list_incidents(db: Session = Depends(get_db)) -> list[dict]:
    incidents = db.scalars(select(Incident).where(Incident.review_status != "Rejected").order_by(Incident.latest_reported_at.desc())).all()
    return [payload for item in incidents if len(payload := incident_payload(db, item)) > 0 and payload["complaint_count"] >= 2]


@app.get("/api/incidents/{incident_id}", response_model=IncidentDetailOut)
def get_incident(incident_id: str, db: Session = Depends(get_db)) -> dict:
    incident = db.get(Incident, incident_id)
    if incident is None or incident.review_status == "Rejected":
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident_payload(db, incident, detailed=True)


@app.get("/api/incidents/{incident_id}/complaints", response_model=list[ComplaintOut])
def list_incident_complaints(incident_id: str, db: Session = Depends(get_db)) -> list[ComplaintOut]:
    if db.get(Incident, incident_id) is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    return [serialize_complaint(item, include_analysis=True) for item in incident_complaints(db, incident_id)]


@app.post("/api/incidents/{incident_id}/confirm", response_model=IncidentOut)
def decide_incident(incident_id: str, payload: IncidentDecision, db: Session = Depends(get_db)) -> dict:
    incident = db.get(Incident, incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    links = db.scalars(select(IncidentComplaint).where(IncidentComplaint.incident_id == incident_id)).all()
    if payload.confirmed:
        incident.review_status = "Confirmed"
        for link in links:
            if link.link_status != "Rejected": link.link_status = "Confirmed"
    else:
        incident.review_status = "Rejected"
        for link in links: link.link_status = "Rejected"
    db.commit()
    return incident_payload(db, incident)


@app.post("/api/incidents/detect-duplicates")
def detect_duplicate_incidents(db: Session = Depends(get_db)) -> dict:
    reports = db.scalars(select(Complaint).options(selectinload(Complaint.analyses)).order_by(Complaint.submitted_at)).all()
    rejected_ids = db.scalars(select(Incident.id).where(Incident.review_status == "Rejected")).all()
    rejected_pairs: set[frozenset[str]] = set()
    for rejected_id in rejected_ids:
        linked = db.scalars(select(IncidentComplaint.complaint_id).where(IncidentComplaint.incident_id == rejected_id)).all()
        for i, left_id in enumerate(linked):
            for right_id in linked[i + 1:]: rejected_pairs.add(frozenset((left_id, right_id)))
    pairs: list[tuple[int, int, float, list[str]]] = []
    related: list[dict] = []
    for i, left in enumerate(reports):
        for j in range(i + 1, len(reports)):
            right = reports[j]
            score, candidate, reasons = pair_similarity(left, right)
            if frozenset((left.id, right.id)) in rejected_pairs:
                candidate = False
            if candidate:
                pairs.append((i, j, score, reasons))
            elif reasons and any("possible cross-category" in item for item in reasons):
                related.append({"complaint_ids": [left.id, right.id], "label": "Possible relationship; cause unverified", "reasons": reasons})
    parent = list(range(len(reports)))
    def find(idx: int) -> int:
        while parent[idx] != idx:
            parent[idx] = parent[parent[idx]]; idx = parent[idx]
        return idx
    for i, j, _, _ in pairs:
        parent[find(i)] = find(j)
    groups: dict[int, set[int]] = {}
    for i, j, _, _ in pairs:
        groups.setdefault(find(i), set()).update((i, j))
    made = 0
    for members in groups.values():
        if len(members) < 2: continue
        member_ids = {reports[index].id for index in members}
        old_links = db.scalars(select(IncidentComplaint).where(IncidentComplaint.complaint_id.in_(member_ids), IncidentComplaint.link_status != "Rejected")).all()
        old_incidents = {link.incident_id for link in old_links}
        incident = db.get(Incident, next(iter(old_incidents))) if old_incidents else None
        member_reports = [reports[index] for index in sorted(members)]
        if incident is None:
            anchor = member_reports[0]
            incident = Incident(id=f"INC-{uuid4().hex[:12].upper()}", title=anchor.title or f"{category_of(anchor)} reports", location=anchor.location,
                dominant_category=category_of(anchor), severity=max((row.severity for row in member_reports), key=severity_rank),
                status="Open", review_status="Suggested", first_reported_at=min(row.submitted_at for row in member_reports),
                latest_reported_at=max(row.submitted_at for row in member_reports), demo=any(row.demo for row in member_reports))
            db.add(incident); db.flush(); made += 1
        existing_ids = {link.complaint_id for link in db.scalars(select(IncidentComplaint).where(IncidentComplaint.incident_id == incident.id)).all()}
        for row in member_reports:
            if row.id in existing_ids: continue
            score = max((score for i, j, score, _ in pairs if reports[i].id == row.id or reports[j].id == row.id), default=.5)
            db.add(IncidentComplaint(incident_id=incident.id, complaint_id=row.id, similarity_score=score, link_status="Suggested"))
        pair_reasons = [reason for i, j, _, reasons in pairs if reports[i].id in member_ids and reports[j].id in member_ids for reason in reasons if "cause unverified" in reason]
        incident.possible_relationships = list(dict.fromkeys(pair_reasons))
        incident.latest_reported_at = max(row.submitted_at for row in member_reports)
    db.commit()
    summaries = list_incidents(db)
    return {"incidents_created": made, "incident_count": len(summaries), "incidents": summaries, "possible_relationships": related,
        "complaints_preserved": len(reports), "message": "Suggested groups require officer confirmation; no complaint records were deleted."}


@app.get("/api/departments", response_model=list[DepartmentOut])
def list_departments(db: Session = Depends(get_db)) -> list[DepartmentOut]:
    departments = db.scalars(select(Department).order_by(Department.name)).all()
    counts = db.execute(
        select(Complaint.department_id, func.count(Complaint.id), func.sum(case((Complaint.status != "Resolved", 1), else_=0)))
        .group_by(Complaint.department_id)
    ).all()
    count_map = {department_id: (total or 0, open_total or 0) for department_id, total, open_total in counts}
    return [
        DepartmentOut(
            id=department.id,
            name=department.name,
            responsible_categories=department.responsible_categories,
            demo=department.demo,
            complaint_count=count_map.get(department.id, (0, 0))[0],
            open_count=count_map.get(department.id, (0, 0))[1],
        )
        for department in departments
    ]


@app.get("/api/complaints", response_model=ComplaintListOut)
def list_complaints(
    category: str | None = None,
    severity: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    department: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, ge=1, le=200),
    db: Session = Depends(get_db),
) -> ComplaintListOut:
    query = select(Complaint).options(joinedload(Complaint.department)).order_by(Complaint.submitted_at.desc())
    filters = []
    if category:
        filters.append(Complaint.category.ilike(f"%{category.strip()}%"))
    if severity:
        filters.append(Complaint.severity == severity)
    if status_filter:
        filters.append(Complaint.status == status_filter)
    if department:
        filters.append((Complaint.department_id == department) | Complaint.department.has(Department.name.ilike(f"%{department}%")))
    if filters:
        query = query.where(*filters)
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    complaints = db.scalars(query.offset((page - 1) * page_size).limit(page_size)).all()
    return ComplaintListOut(items=[serialize_complaint(item) for item in complaints], total=total, page=page, page_size=page_size)


@app.post("/api/complaints", response_model=ComplaintOut, status_code=status.HTTP_201_CREATED)
def create_complaint(payload: ComplaintCreate, db: Session = Depends(get_db)) -> ComplaintOut:
    department = db.get(Department, payload.department_id) if payload.department_id else department_for_category(db, payload.category)
    if payload.department_id and department is None:
        raise HTTPException(status_code=422, detail="Department was not found")
    complaint_id = f"CL-{uuid4().hex.upper()}"
    while db.get(Complaint, complaint_id) is not None:
        complaint_id = f"CL-{uuid4().hex.upper()}"
    complaint = Complaint(
        id=complaint_id,
        title=(payload.description.strip()[:180] if payload.title.strip() == "Civic report" else payload.title.strip()),
        description=payload.description.strip(),
        language=payload.language,
        category=payload.category.strip(),
        location=payload.location.strip(),
        latitude=payload.latitude,
        longitude=payload.longitude,
        image_reference=payload.image_reference,
        severity=payload.severity,
        priority=payload.severity if payload.severity != "Low" else "Medium",
        status="Submitted",
        department=department,
        submitted_at=utc_now(),
        demo=False,
    )
    db.add(complaint)
    db.flush()
    save_analysis(db, complaint)
    db.add(ComplaintHistory(
        complaint_id=complaint_id,
        previous_status="Not submitted",
        new_status="Submitted",
        changed_by="Citizen submission",
    ))
    db.commit()
    db.refresh(complaint)
    return serialize_complaint(complaint)


def get_image_extension(content_type: str, data: bytes) -> str | None:
    if content_type == "image/jpeg" and data.startswith(b"\xff\xd8\xff"):
        return ".jpg"
    if content_type == "image/png" and data.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if content_type == "image/webp" and len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return ".webp"
    return None


@app.post("/api/complaints/intake", response_model=ComplaintOut, status_code=status.HTTP_201_CREATED)
async def submit_citizen_complaint(
    title: str = Form(..., min_length=4, max_length=180),
    description: str = Form(..., min_length=8, max_length=4000),
    category: str = Form(..., min_length=2, max_length=100),
    location: str = Form(..., min_length=2, max_length=240),
    language: str = Form("English", min_length=2, max_length=40),
    latitude: float | None = Form(default=None, ge=-90, le=90),
    longitude: float | None = Form(default=None, ge=-180, le=180),
    severity: str = Form("Medium"),
    image: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
) -> ComplaintOut:
    title = title.strip()
    description = description.strip()
    location = location.strip()
    if not title or not description or not location:
        raise HTTPException(status_code=422, detail="Title, description, and location are required.")
    if language not in ALLOWED_LANGUAGES:
        raise HTTPException(status_code=422, detail="Choose English, Kannada, Hindi, or Telugu.")
    if category not in ALLOWED_CATEGORIES:
        raise HTTPException(status_code=422, detail="Choose one of the listed civic categories.")
    if severity not in {"Low", "Medium", "High", "Critical"}:
        raise HTTPException(status_code=422, detail="Choose a valid severity.")
    department = db.get(Department, ALLOWED_CATEGORIES[category])
    if department is None:
        raise HTTPException(status_code=503, detail="Complaint routing departments are not initialized.")

    stored_reference = None
    saved_path = None
    if image and image.filename:
        data = await image.read(MAX_IMAGE_BYTES + 1)
        if len(data) > MAX_IMAGE_BYTES:
            raise HTTPException(status_code=413, detail="Images must be 5 MB or smaller.")
        extension = get_image_extension(image.content_type or "", data)
        if extension is None:
            raise HTTPException(status_code=415, detail="Upload a valid JPEG, PNG, or WebP image.")
        try:
            from io import BytesIO
            with Image.open(BytesIO(data)) as uploaded_image:
                if uploaded_image.format not in {"JPEG", "PNG", "WEBP"}:
                    raise HTTPException(status_code=415, detail="Upload a valid JPEG, PNG, or WebP image.")
                if uploaded_image.width * uploaded_image.height > 20_000_000:
                    raise HTTPException(status_code=413, detail="Image dimensions must be 20 megapixels or smaller.")
                uploaded_image.verify()
        except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
            raise HTTPException(status_code=415, detail="The selected image could not be decoded.") from exc
        stored_name = f"{uuid4().hex}{extension}"
        saved_path = os.path.join(UPLOAD_DIRECTORY, stored_name)
        with open(saved_path, "xb") as image_file:
            image_file.write(data)
        stored_reference = f"/media/{stored_name}"

    complaint_id = f"CL-{uuid4().hex.upper()}"
    complaint = Complaint(
        id=complaint_id,
        title=title,
        description=description,
        language=language,
        category=category,
        location=location,
        latitude=latitude,
        longitude=longitude,
        image_reference=stored_reference,
        severity=severity,
        priority=severity if severity != "Low" else "Medium",
        status="Submitted",
        department=department,
        submitted_at=utc_now(),
        demo=False,
    )
    db.add(complaint)
    db.flush()
    save_analysis(db, complaint)
    db.add(ComplaintHistory(
        complaint_id=complaint_id,
        previous_status="Not submitted",
        new_status="Submitted",
        changed_by="Citizen submission",
    ))
    try:
        db.commit()
        db.refresh(complaint)
    except Exception:
        db.rollback()
        if saved_path and os.path.exists(saved_path):
            os.remove(saved_path)
        raise
    return serialize_complaint(complaint)


@app.get("/api/complaints/{complaint_id}", response_model=ComplaintOut)
def get_complaint(complaint_id: str, db: Session = Depends(get_db)) -> ComplaintOut:
    complaint = db.scalar(
        select(Complaint).options(joinedload(Complaint.department), selectinload(Complaint.analyses)).where(Complaint.id == complaint_id)
    )
    if complaint is None:
        raise HTTPException(status_code=404, detail="Complaint not found")
    return serialize_complaint(complaint, include_analysis=True)


@app.patch("/api/complaints/{complaint_id}", response_model=ComplaintOut)
def patch_complaint(complaint_id: str, payload: ComplaintPatch, db: Session = Depends(get_db)) -> ComplaintOut:
    complaint = db.scalar(select(Complaint).options(joinedload(Complaint.department)).where(Complaint.id == complaint_id))
    if complaint is None:
        raise HTTPException(status_code=404, detail="Complaint not found")
    changes = payload.model_dump(exclude_unset=True)
    changed_by = changes.pop("changed_by", "Officer (demo)")
    if "department_id" in changes and changes["department_id"] is not None:
        department = db.get(Department, changes["department_id"])
        if department is None:
            raise HTTPException(status_code=422, detail="Department was not found")
        complaint.department = department
        changes.pop("department_id")
    previous_status = complaint.status
    for field, value in changes.items():
        if field == "priority" and value is None:
            raise HTTPException(status_code=422, detail="Priority cannot be empty")
        setattr(complaint, field, value)
    if "severity" in changes and changes["severity"] is not None and "priority" not in changes:
        complaint.priority = changes["severity"] if changes["severity"] != "Low" else "Medium"
    if complaint.status != previous_status:
        db.add(ComplaintHistory(
            complaint_id=complaint.id,
            previous_status=previous_status,
            new_status=complaint.status,
            changed_by=changed_by,
        ))
    db.commit()
    db.refresh(complaint)
    return serialize_complaint(complaint)


@app.get("/api/complaints/{complaint_id}/history", response_model=list[ComplaintHistoryOut])
def complaint_history(complaint_id: str, db: Session = Depends(get_db)) -> list[ComplaintHistoryOut]:
    if db.get(Complaint, complaint_id) is None:
        raise HTTPException(status_code=404, detail="Complaint not found")
    return db.scalars(
        select(ComplaintHistory).where(ComplaintHistory.complaint_id == complaint_id).order_by(ComplaintHistory.changed_at)
    ).all()


@app.get("/api/dashboard/stats", response_model=DashboardStatsOut)
def dashboard_stats(db: Session = Depends(get_db)) -> DashboardStatsOut:
    complaints = db.scalars(select(Complaint)).all()
    total = len(complaints)
    unresolved = sum(item.status != "Resolved" for item in complaints)
    critical = sum(item.severity == "Critical" for item in complaints if item.status != "Resolved")
    now = utc_now()
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)
    all_resolved_events = db.scalars(
        select(ComplaintHistory).where(ComplaintHistory.new_status == "Resolved", ComplaintHistory.changed_at >= month_ago)
    ).all()
    resolved_events = [event for event in all_resolved_events if (event.changed_at.replace(tzinfo=timezone.utc) if event.changed_at.tzinfo is None else event.changed_at) >= week_ago]
    resolved_ids = {event.complaint_id for event in resolved_events}
    resolution_durations: list[float] = []
    for complaint in complaints:
        resolved_event = next((event for event in complaint.history if event.new_status == "Resolved"), None)
        if resolved_event:
            submitted = complaint.submitted_at
            if submitted.tzinfo is None:
                submitted = submitted.replace(tzinfo=timezone.utc)
            resolved_at = resolved_event.changed_at
            if resolved_at.tzinfo is None:
                resolved_at = resolved_at.replace(tzinfo=timezone.utc)
            resolution_durations.append(max(0.0, (resolved_at - submitted).total_seconds() / 86400))

    category_counts: dict[str, int] = {}
    for item in complaints:
        category_counts[item.category] = category_counts.get(item.category, 0) + 1
    categories = [
        {"category": category, "count": count, "percent": round(count * 100 / total, 1) if total else 0}
        for category, count in sorted(category_counts.items(), key=lambda pair: pair[1], reverse=True)
    ]

    trend = []
    for days_ago in reversed(range(7)):
        day_start = (now - timedelta(days=days_ago)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        received = 0
        for item in complaints:
            submitted = item.submitted_at if item.submitted_at.tzinfo else item.submitted_at.replace(tzinfo=timezone.utc)
            received += day_start <= submitted < day_end
        resolved_on_day = sum(
            1 for event in all_resolved_events
            if day_start <= (event.changed_at if event.changed_at.tzinfo else event.changed_at.replace(tzinfo=timezone.utc)) < day_end
        )
        trend.append({"day": day_start.strftime("%a"), "received": received, "resolved": resolved_on_day})

    trend_30 = []
    for start_day, end_day, label in [(29, 24, "1–6"), (23, 18, "7–12"), (17, 12, "13–18"), (11, 6, "19–24"), (5, 0, "25–30")]:
        start = (now - timedelta(days=start_day)).replace(hour=0, minute=0, second=0, microsecond=0)
        end = (now - timedelta(days=end_day - 1)).replace(hour=0, minute=0, second=0, microsecond=0) if end_day > 0 else now + timedelta(microseconds=1)
        received = 0
        for item in complaints:
            submitted = item.submitted_at if item.submitted_at.tzinfo else item.submitted_at.replace(tzinfo=timezone.utc)
            received += start <= submitted < end
        resolved_count = sum(
            1 for event in resolved_events
            if start <= (event.changed_at if event.changed_at.tzinfo else event.changed_at.replace(tzinfo=timezone.utc)) < end
        )
        trend_30.append({"day": label, "received": received, "resolved": resolved_count})

    return DashboardStatsOut(
        total_complaints=total,
        unresolved_complaints=unresolved,
        critical_incidents=critical,
        resolved_this_week=len(resolved_ids),
        average_resolution_days=round(sum(resolution_durations) / len(resolution_durations), 1) if resolution_durations else None,
        complaints_by_category=categories,
        trend_7_days=trend,
        trend_30_days=trend_30,
        demo=any(item.demo for item in complaints) if complaints else True,
    )
