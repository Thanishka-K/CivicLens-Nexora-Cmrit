"""Local duplicate candidate scoring. Matches are suggestions, never deletions."""
import math
import re
from difflib import SequenceMatcher


def category_of(complaint) -> str:
    analyses = getattr(complaint, "analyses", [])
    return max(analyses, key=lambda a: a.analysis_at).predicted_category if analyses else complaint.category


def distance_m(a, b) -> float | None:
    if a.latitude is None or a.longitude is None or b.latitude is None or b.longitude is None:
        return None
    radius = 6_371_000
    lat1, lat2 = math.radians(a.latitude), math.radians(b.latitude)
    dlat = lat2 - lat1
    dlon = math.radians(b.longitude - a.longitude)
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return radius * 2 * math.asin(math.sqrt(h))


def pair_similarity(a, b) -> tuple[float, bool, list[str]]:
    left = re.sub(r"[^a-z0-9 ]", " ", f"{a.title} {a.description}".lower())
    right = re.sub(r"[^a-z0-9 ]", " ", f"{b.title} {b.description}".lower())
    words_a, words_b = set(left.split()), set(right.split())
    overlap = len(words_a & words_b) / max(1, len(words_a | words_b))
    text_score = .55 * overlap + .45 * SequenceMatcher(None, left, right).ratio()
    cat_a, cat_b = category_of(a), category_of(b)
    category_match = cat_a == cat_b
    proximity = distance_m(a, b)
    same_place = re.sub(r"[^a-z0-9]", "", a.location.lower()) == re.sub(r"[^a-z0-9]", "", b.location.lower())
    time_gap = abs((a.submitted_at - b.submitted_at).total_seconds()) / 3600
    reasons = []
    if category_match: reasons.append("same predicted category")
    if proximity is not None and proximity <= 500: reasons.append(f"within {round(proximity)} m")
    elif same_place: reasons.append("same reported location")
    if time_gap <= 72: reasons.append("reported within 72 hours")
    geo_ok = proximity <= 750 if proximity is not None else same_place
    candidate = category_match and text_score >= .22 and geo_ok and time_gap <= 24 * 14
    if not category_match and geo_ok and text_score >= .18 and time_gap <= 72:
        reasons.append("possible cross-category relationship; cause unverified")
    score = .62 * text_score + .23 * float(category_match) + .10 * (1 if proximity is not None and proximity <= 500 or same_place else 0) + .05 * max(0, 1 - time_gap / (24 * 14))
    return round(min(1, score), 3), candidate, reasons
