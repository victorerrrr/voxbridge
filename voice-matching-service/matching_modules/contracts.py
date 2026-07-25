"""Contracts for independent voice-analysis specialists."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class SpecialistScore:
    """One specialist's answer. Other specialists must not depend on this object."""

    name: str
    score: float  # 0–100 similarity / quality contribution
    details: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class MatchBreakdown:
    """Explainable Match Score — what the producer sees as separate bars."""

    embedding: float
    pitch: float
    timbre: float
    style: float
    recording_quality: float
    match_score: float
    weights: dict[str, float] = field(default_factory=dict)
    specialists: tuple[SpecialistScore, ...] = ()
