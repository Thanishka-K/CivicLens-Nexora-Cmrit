from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import AIAnalysis, Complaint, ComplaintHistory, Department, User, utc_now


DEPARTMENT_SEEDS = [
    ("dept-roads", "Roads and Infrastructure", ["Road Potholes", "Roads", "Public Infrastructure"]),
    ("dept-sanitation", "Sanitation", ["Garbage Overflow", "Waste", "Sanitation"]),
    ("dept-water", "Water Supply", ["Water Leakage", "Water Supply", "Water Quality"]),
    ("dept-electricity", "Electricity", ["Exposed Electrical Wires", "Street Lighting", "Electrical Hazard"]),
    ("dept-parks", "Parks and Trees", ["Fallen Trees", "Parks", "Tree Maintenance"]),
    ("dept-drainage", "Drainage", ["Blocked Drainage", "Waterlogging", "Flooding"]),
]

# day offset, title, category, location, severity, status, department id, lat offset, lon offset
COMPLAINT_SEEDS = [
    (0, "Deep pothole at the main junction", "Road Potholes", "Central Ward · Sector 4", "High", "New", "dept-roads", 0.000, 0.000),
    (0, "Overflowing bins beside the market", "Garbage Overflow", "South Ward · Market Lane", "Medium", "In Progress", "dept-sanitation", .012, .009),
    (1, "Water leaking from a roadside pipe", "Water Leakage", "East Ward · Lake View", "High", "New", "dept-water", -.009, .016),
    (1, "Exposed wire hanging near a bus stop", "Exposed Electrical Wires", "North Ward · Ring Road", "Critical", "In Progress", "dept-electricity", .018, -.012),
    (2, "Large tree fell across the footpath", "Fallen Trees", "West Ward · Garden Road", "High", "New", "dept-parks", -.015, -.013),
    (2, "Drain is blocked with construction debris", "Blocked Drainage", "Central Ward · Block B", "Medium", "Resolved", "dept-drainage", .005, -.007),
    (3, "Water pooling under the railway overpass", "Waterlogging", "Central Ward · Station Road", "Critical", "In Progress", "dept-drainage", -.006, .005),
    (3, "Missed waste pickup for two days", "Garbage Overflow", "South Ward · Rose Colony", "Medium", "New", "dept-sanitation", .021, .004),
    (4, "Pothole widening near the school crossing", "Road Potholes", "North Ward · Hill Street", "High", "On Hold", "dept-roads", .019, .016),
    (4, "Continuous leak from a public tap", "Water Leakage", "East Ward · Park Circle", "Low", "Resolved", "dept-water", -.020, .013),
    (5, "Electric cable exposed after pavement work", "Exposed Electrical Wires", "West Ward · Depot Road", "Critical", "New", "dept-electricity", -.014, .021),
    (5, "Fallen branches blocking the cycle lane", "Fallen Trees", "East Ward · Riverside Walk", "Medium", "In Progress", "dept-parks", .013, -.017),
    (6, "Storm drain cover is missing", "Blocked Drainage", "South Ward · Canal Street", "High", "New", "dept-drainage", -.022, -.004),
    (6, "Street waterlogging after light rain", "Waterlogging", "North Ward · Civic Square", "Medium", "Resolved", "dept-drainage", .023, .002),
    (7, "Garbage spill attracting stray animals", "Garbage Overflow", "Central Ward · Old Town", "High", "In Progress", "dept-sanitation", .006, .018),
    (8, "Road surface collapsed around a manhole", "Road Potholes", "West Ward · Mill Road", "Critical", "New", "dept-roads", -.025, -.016),
    (9, "Water main seepage flooding the footpath", "Water Leakage", "South Ward · Lake Road", "High", "Resolved", "dept-water", .025, -.009),
    (10, "Low hanging live wire near apartments", "Exposed Electrical Wires", "East Ward · Sunrise Enclave", "Critical", "In Progress", "dept-electricity", -.006, -.023),
    (11, "Tree trunk obstructing a local road", "Fallen Trees", "North Ward · Maple Avenue", "High", "Resolved", "dept-parks", .003, .024),
    (12, "Drainage grate clogged with leaves", "Blocked Drainage", "Central Ward · Civic Square", "Low", "New", "dept-drainage", -.012, .007),
    (13, "Rainwater entering ground-floor homes", "Waterlogging", "South Ward · Canal Street", "Critical", "New", "dept-drainage", .015, -.019),
    (14, "Waste container has been overflowing since yesterday", "Garbage Overflow", "West Ward · Depot Road", "Medium", "Resolved", "dept-sanitation", -.004, -.025),
    (16, "Loose paving and pothole at the turn", "Road Potholes", "East Ward · Lake View", "Medium", "In Progress", "dept-roads", .027, .011),
    (18, "Small leak at the neighborhood valve", "Water Leakage", "North Ward · Hill Street", "Low", "Resolved", "dept-water", -.018, -.005),
]


def seed_database(db: Session) -> None:
    for department_id, name, categories in DEPARTMENT_SEEDS:
        existing = db.get(Department, department_id)
        if existing is None:
            db.add(Department(id=department_id, name=name, responsible_categories=categories, demo=True))

    for user_id, name, email, role in [
        ("user-admin-demo", "Arjun Sharma", "arjun@metro.demo", "officer"),
        ("user-citizen-demo", "Demo Citizen", "citizen@metro.demo", "citizen"),
    ]:
        if db.get(User, user_id) is None:
            db.add(User(id=user_id, name=name, email=email, role=role))
    db.flush()

    now = utc_now()
    for index, item in enumerate(COMPLAINT_SEEDS, start=1):
        day_offset, title, category, location, severity, status, department_id, lat_offset, lon_offset = item
        demo_key = f"phase03-complaint-{index:02d}"
        existing = db.scalar(select(Complaint).where(Complaint.demo_key == demo_key))
        if existing:
            if not existing.analyses:
                db.add(AIAnalysis(
                    complaint_id=existing.id,
                    predicted_category=existing.category,
                    severity=existing.severity,
                    explanation="Synthetic seed assessment based on the curated demonstration record. It is not a live AI prediction and requires officer review.",
                    confidence=0.68,
                    source="demo-seed-rule",
                ))
            continue
        submitted = now - timedelta(days=day_offset, hours=(index * 3) % 19, minutes=(index * 11) % 60)
        complaint_id = f"CL-{3000 + index}"
        complaint = Complaint(
            id=complaint_id,
            title=title[:180],
            demo_key=demo_key,
            description=title + ". Please inspect and make the area safe for residents.",
            language="English",
            category=category,
            location=location,
            latitude=17.3850 + lat_offset,
            longitude=78.4867 + lon_offset,
            severity=severity,
            priority=severity if severity != "Low" else "Medium",
            status=status,
            department_id=department_id,
            submitted_at=submitted,
            demo=True,
        )
        db.add(complaint)
        db.flush()
        db.add(ComplaintHistory(
            complaint_id=complaint_id,
            previous_status="Submitted",
            new_status=status,
            changed_at=submitted + timedelta(minutes=3),
            changed_by="Demo seed",
        ))
        db.add(AIAnalysis(
            complaint_id=complaint_id,
            predicted_category=category,
            severity=severity,
            explanation="Synthetic seed assessment based on the curated demonstration record. It is not a live AI prediction and requires officer review.",
            confidence=0.68,
            source="demo-seed-rule",
            analysis_at=submitted + timedelta(minutes=2),
        ))
    db.commit()
