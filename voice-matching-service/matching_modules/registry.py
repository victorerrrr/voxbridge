"""Registry of specialists — swap an implementation without rewriting scoring.

`impl` = what runs today.
`swap_hint` = where to look when a better open-source model appears.
"""

from __future__ import annotations

SPECIALIST_REGISTRY: dict[str, dict[str, str]] = {
    "embedding": {
        "role": "Digital voice fingerprint (speaker embedding similarity)",
        "impl": "speechbrain/spkrec-ecapa-voxceleb via main.average_chunk_similarity",
        "swap_hint": "WavLM / FACodec / singing-voice embedding checkpoint",
        "status": "active",
    },
    "pitch": {
        "role": "Range, tessitura, pitch proximity",
        "impl": "librosa pitch features via main.pitch_similarity",
        "swap_hint": "singing-specific F0 / melody models",
        "status": "active",
    },
    "timbre": {
        "role": "Tone colour / spectral shape",
        "impl": "MFCC + centroid + bandwidth via main.timbre_similarity",
        "swap_hint": "vTAD-style timbre attributes, formant module",
        "status": "active",
    },
    "style": {
        "role": "Delivery / vocal character (soft, aggressive, breathy…)",
        "impl": "main._vocal_character_similarity (partial)",
        "swap_hint": "dedicated singing-style classifier when available",
        "status": "active_partial",
    },
    "recording_quality": {
        "role": "Noise, clipping, SNR — NOT 'bad voice'",
        "impl": "main.quality_score / demo_quality_score",
        "swap_hint": "keep weight low; never equate to vocal talent",
        "status": "active",
    },
    "language": {
        "role": "Language / accent cues",
        "impl": "profile / filename metadata; auto lang-id deferred (weak on singing)",
        "swap_hint": "singing-domain lang model or questionnaire only",
        "status": "deferred",
    },
    "scoring": {
        "role": "Combine specialist scores into Match (VoxBridge IP)",
        "impl": "matching_modules.scoring + main.combine_scores / genre weights / feedback",
        "swap_hint": "retrain weights from human pairwise + Yes/No calibration",
        "status": "active",
    },
}


def list_specialists() -> list[dict[str, str]]:
    return [{"id": key, **meta} for key, meta in SPECIALIST_REGISTRY.items()]
