"""VoxBridge Matching Engine — specialist modules (thin boundaries).

Each specialist answers one question. Scoring combines answers into Match Score.
Implementations today still live in main.py; this package is the swap point.

See docs/MATCHING_ENGINE_PHILOSOPHY.md and matching_modules/README.md.
"""

from matching_modules.contracts import SpecialistScore, MatchBreakdown
from matching_modules.registry import SPECIALIST_REGISTRY, list_specialists
from matching_modules.scoring import assemble_match_score, build_match_breakdown

__all__ = [
    "SpecialistScore",
    "MatchBreakdown",
    "SPECIALIST_REGISTRY",
    "list_specialists",
    "assemble_match_score",
    "build_match_breakdown",
]
