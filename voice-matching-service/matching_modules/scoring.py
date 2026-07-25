"""VoxBridge Scoring Engine — the only place that combines specialists.

Specialists stay independent. This module owns weights and Match Score.
"""

from __future__ import annotations

from matching_modules.contracts import MatchBreakdown, SpecialistScore

# Default weights mirror current singing-balanced v5 in main.V4_WEIGHTS.
# Keep in sync when changing genre weights in main._genre_weights.
DEFAULT_WEIGHTS: dict[str, float] = {
    "embedding": 0.30,
    "timbre": 0.24,
    "pitch": 0.35,
    "recording_quality": 0.02,
    "style": 0.09,
}


def _normalize_weights(weights: dict[str, float]) -> dict[str, float]:
    total = sum(weights.values()) or 1.0
    return {k: v / total for k, v in weights.items()}


def assemble_match_score(
    *,
    embedding: float,
    pitch: float,
    timbre: float,
    style: float = 50.0,
    recording_quality: float,
    weights: dict[str, float] | None = None,
) -> float:
    """Weighted Match Score 0–100 from independent specialist scores."""
    w = _normalize_weights(weights or DEFAULT_WEIGHTS)
    raw = (
        w.get("embedding", 0) * float(embedding)
        + w.get("timbre", 0) * float(timbre)
        + w.get("pitch", 0) * float(pitch)
        + w.get("recording_quality", 0) * float(recording_quality)
        + w.get("style", 0) * float(style)
    )
    return round(max(0.0, min(100.0, raw)), 1)


def build_match_breakdown(
    *,
    embedding: float,
    pitch: float,
    timbre: float,
    style: float = 50.0,
    recording_quality: float,
    weights: dict[str, float] | None = None,
) -> MatchBreakdown:
    """Explainable breakdown for API / UI."""
    w = _normalize_weights(weights or DEFAULT_WEIGHTS)
    match = assemble_match_score(
        embedding=embedding,
        pitch=pitch,
        timbre=timbre,
        style=style,
        recording_quality=recording_quality,
        weights=w,
    )
    specialists = (
        SpecialistScore("embedding", float(embedding)),
        SpecialistScore("pitch", float(pitch)),
        SpecialistScore("timbre", float(timbre)),
        SpecialistScore("style", float(style)),
        SpecialistScore("recording_quality", float(recording_quality)),
    )
    return MatchBreakdown(
        embedding=float(embedding),
        pitch=float(pitch),
        timbre=float(timbre),
        style=float(style),
        recording_quality=float(recording_quality),
        match_score=match,
        weights=w,
        specialists=specialists,
    )


def weights_from_main_genre_weights(main_weights: dict[str, float]) -> dict[str, float]:
    """Map main.py keys (speaker/quality/vocal_character) → specialist ids."""
    return {
        "embedding": float(main_weights.get("speaker", 0.30)),
        "timbre": float(main_weights.get("timbre", 0.22)),
        "pitch": float(main_weights.get("pitch", 0.35)),
        "recording_quality": float(main_weights.get("quality", 0.05)),
        "style": float(main_weights.get("vocal_character", 0.08)),
    }
