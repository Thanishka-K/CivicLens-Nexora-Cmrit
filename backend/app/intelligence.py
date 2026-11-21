"""Explainable offline-first complaint analysis and local demo knowledge retrieval."""
import re
from collections import Counter

CATEGORY_TERMS = {
    "Roads and Infrastructure": ["pothole", "road", "crater", "manhole", "pavement", "asphalt", " सड़क"],
    "Sanitation and Waste": ["garbage", "trash", "waste", "rubbish", "bin", "dump", "overflow", "smell", "litter"],
    "Water Supply": ["water leak", "leakage", "leaking pipe", "pipe is leaking", "pipe burst", "water pipe", "tap", "no water", "water supply"],
    "Electricity": ["wire", "wires", "cable", "cables", "electric", "electrical", "live wire", "exposed wire", "spark", "power line"],
    "Parks and Trees": ["tree", "fallen branch", "branch", "limb", "park", "uprooted"],
    "Drainage and Sewerage": ["drain", "sewer", "waterlogging", "water logged", "flood", "blocked", "clogged", "stormwater"],
}
DEPARTMENTS = {
    "Roads and Infrastructure": "Roads and Infrastructure", "Sanitation and Waste": "Sanitation",
    "Water Supply": "Water Supply", "Electricity": "Electricity",
    "Parks and Trees": "Parks and Trees", "Drainage and Sewerage": "Drainage",
}
DOCS = [
    ("department-responsibilities", "Department responsibilities", "Roads and Infrastructure handles road surfaces, potholes, and public road structures. Sanitation handles missed waste pickup, overflowing bins, and public litter. Water Supply handles leaking public pipes and water service reports. Electricity handles exposed electrical cables and power hazards. Parks and Trees handles fallen trees and branches. Drainage handles blocked storm drains, sewer reports, and waterlogging."),
    ("electrical-hazard", "Electrical hazard demonstration guidance", "DEMONSTRATION GUIDANCE: Keep people away from exposed or possibly live electrical wires. Do not touch or move a cable. Report the location to the Electricity department and escalate for prompt qualified review. This is general safety guidance, not an official municipal procedure."),
    ("road-maintenance", "Road maintenance demonstration guidance", "DEMONSTRATION GUIDANCE: Record the road location and describe the size or obstruction if known. Road and Infrastructure staff can inspect potholes, damaged surfaces, and missing road structures. Reports suggesting immediate danger should be flagged for urgent review. No response time is promised."),
    ("waste-collection", "Waste collection demonstration guidance", "DEMONSTRATION GUIDANCE: Include the affected collection point and whether waste is overflowing or repeatedly missed. Sanitation can review public waste pickup and bin overflow reports. Avoid unsupported claims about health impacts."),
    ("water-leakage", "Water leakage demonstration guidance", "DEMONSTRATION GUIDANCE: Provide the nearest address or landmark and whether water is actively flowing. Water Supply can review leaks from public pipes and taps. Do not assume the source or scale until inspected."),
    ("drainage-blockage", "Drainage demonstration guidance", "DEMONSTRATION GUIDANCE: Note the drain location, visible obstruction, and whether water is accumulating. Drainage staff can inspect blocked drains and waterlogging. Keep clear of unsafe flooded areas; this guidance is illustrative."),
    ("fallen-tree", "Fallen tree demonstration guidance", "DEMONSTRATION GUIDANCE: Note if a fallen tree blocks a road, path, or access route. Parks and Trees can review fallen tree reports; route-related obstruction may need coordination. Do not approach unstable branches."),
    ("category-definitions", "Complaint category definitions", "DEMONSTRATION TAXONOMY: Roads and Infrastructure covers road damage; Sanitation and Waste covers public waste; Water Supply covers leaks and water service; Electricity covers electrical hazards; Parks and Trees covers trees and park assets; Drainage and Sewerage covers drains, sewers, and waterlogging."),
]

def retrieve(query: str, limit: int = 3) -> list[dict]:
    tokens = set(re.findall(r"[a-z0-9]+", query.lower()))
    scored = []
    for ref, title, text in DOCS:
        words = re.findall(r"[a-z0-9]+", (title + " " + text).lower())
        counts = Counter(words)
        score = sum(min(counts[t], 2) for t in tokens) / max(1, len(tokens))
        if score:
            scored.append((score, ref, title, text))
    scored.sort(reverse=True)
    return [{"id": ref, "title": title, "excerpt": text[:360], "score": round(score, 3)} for score, ref, title, text in scored[:limit]]

def analyze(text: str) -> dict:
    normalized = re.sub(r"[^a-z0-9 ]", " ", text.lower())
    scores = {category: sum(normalized.count(term) for term in terms) for category, terms in CATEGORY_TERMS.items()}
    def first_match(category: str) -> int:
        positions = [normalized.find(term) for term in CATEGORY_TERMS[category] if normalized.find(term) >= 0]
        return min(positions) if positions else 10**9
    category = max(scores, key=lambda item: (scores[item], -first_match(item)))
    top, second = scores[category], sorted(scores.values(), reverse=True)[1]
    if top == 0:
        category, confidence = "Drainage and Sewerage", 0.35
    else:
        confidence = min(.96, .55 + .1 * top + (.12 if top > second else 0))
    danger = any(term in normalized for term in ["live wire", "exposed wire", "exposed electrical", "sparking wire", "electrocution"])
    active_flood = any(term in normalized for term in ["water entering homes", "flooding homes", "road submerged", "trapped in flood"])
    accident = any(term in normalized for term in ["accident", "crash", "injured", "collapse", "collapsed"])
    severe_context = any(term in normalized for term in ["major", "large", "deep", "multiple", "school", "hospital", "busy road", "blocking road"])
    tree_obstruction = category == "Parks and Trees" and any(term in normalized for term in ["fallen tree", "fallen branch", "uprooted"]) and any(term in normalized for term in ["block", "road", "path", "footpath"])
    if danger:
        severity, score, urgency, reason = "Critical", 95, "Immediate qualified safety review", "Possible live electrical hazard; keep clear and route for immediate qualified review."
    elif active_flood:
        severity, score, urgency, reason = "Critical", 90, "Urgent safety review", "Active flooding affecting homes is described; urgent review is recommended."
    elif accident or tree_obstruction or (category == "Roads and Infrastructure" and severe_context):
        severity, score, urgency, reason = "High", 78, "Expedited officer review", "The description indicates a potentially hazardous obstruction or damage."
    elif category in ("Sanitation and Waste", "Water Supply", "Drainage and Sewerage") or severe_context:
        severity, score, urgency, reason = "Medium", 52, "Prioritize in routine triage", "The report may affect shared civic infrastructure; verify extent during inspection."
    else:
        severity, score, urgency, reason = "Low", 28, "Review during normal triage", "No explicit immediate hazard was detected in the description."
    if any(term in normalized for term in ["multiple", "many homes", "school", "hospital", "market"]): score = min(100, score + 5)
    if any(term in normalized for term in ["active", "right now", "currently", "still flowing"]): score = min(100, score + 3)
    refs = retrieve(text + " " + category)
    guidance = refs[0]["excerpt"] if refs else "No matching demonstration guidance found."
    return {"predicted_category": category, "severity": severity, "priority_score": score,
            "explanation": f"{reason} Category matched from complaint wording; this recommendation needs officer review.",
            "confidence": round(confidence, 2), "department_name": DEPARTMENTS[category], "urgency": urgency,
            "knowledge_references": refs, "source": "hybrid-rules-tfidf-demo", "model_version": "civiclens-hybrid-v1",
            "response_guidance": guidance}

def answer(question: str) -> dict:
    refs = retrieve(question)
    if not refs:
        return {"answer": "I could not find relevant material in the local demonstration knowledge base. Please consult an authorized municipal officer.", "references": [], "demo_guidance": True}
    return {"answer": "Based on the local demonstration guidance: " + refs[0]["excerpt"], "references": refs, "demo_guidance": True}
