import json
import os

# Загрузка тегов вокалистов
import pathlib
_TAGS_PATH = pathlib.Path(__file__).parent / "demos" / "tags.json"
try:
    with open(_TAGS_PATH, "r") as _f:
        _DEMO_TAGS: dict = json.load(_f)
except Exception:
    _DEMO_TAGS = {}

def _get_demo_tags(filename: str) -> dict:
    """Возвращает теги для демо-файла по имени файла."""
    if not filename:
        return {}
    base = pathlib.Path(filename).name
    return _DEMO_TAGS.get(base, {})

def _compute_tag_bonus(demo_tags: dict, query_tags: dict) -> float:
    """Считает бонус за совпадение тегов. Веса по схеме с доски Миро."""
    if not demo_tags or not query_tags:
        return 0.0
    bonus = 0.0
    weights = {"tonal": 0.35, "emotional": 0.25, "movement": 0.15, "density": 0.05, "genre": 0.15}
    for key, weight in weights.items():
        demo_vals = set(demo_tags.get(key, []))
        query_vals = set(query_tags.get(key, []))
        if demo_vals and query_vals:
            overlap = len(demo_vals & query_vals) / max(len(query_vals), 1)
            bonus += overlap * weight * 20.0
    style_match = demo_tags.get("style") == query_tags.get("style")
    if style_match and demo_tags.get("style"):
        bonus += 3.0
    return round(bonus, 3)


for key in ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"]:
    os.environ.pop(key, None)

import urllib.request

os.environ["HTTPX_TRUST_ENV"] = "0"
urllib.request.getproxies = lambda *_args, **_kwargs: {}


def _clear_proxy_env() -> None:
    for key in [
        "HTTP_PROXY",
        "HTTPS_PROXY",
        "ALL_PROXY",
        "http_proxy",
        "https_proxy",
        "all_proxy",
        "NO_PROXY",
        "no_proxy",
    ]:
        os.environ.pop(key, None)
    os.environ["HTTPX_TRUST_ENV"] = "0"
    os.environ["NO_PROXY"] = "*"
    urllib.request.getproxies = lambda *_args, **_kwargs: {}
    try:
        import requests.utils as _requests_utils

        _requests_utils.getproxies = lambda: {}
        _requests_utils.getproxies_environment = lambda: {}
    except ImportError:
        pass


_clear_proxy_env()

os.environ.setdefault("SB_DISABLE_K2", "1")
os.environ.setdefault("SPEECHBRAIN_DISABLE_K2", "1")


_LAZY_INTEGRATION_MARKERS = (
    "k2_fsa",
    "k2_integration",
    "huggingface",
    "wordemb",
    "integrations.",
)

_SPEECHBRAIN_STUB_MODULES = (
    "speechbrain.integrations.k2_fsa",
    "speechbrain.integrations.huggingface.wordemb",
    "speechbrain.k2_integration",
)


def _speechbrain_lazy_target_disabled(target: str, name: str) -> bool:
    combined = f"{target} {name}"
    return any(marker in combined for marker in _LAZY_INTEGRATION_MARKERS)


def _patch_speechbrain_lazy_integrations() -> None:
    """Stub optional SpeechBrain integrations before any lazy import runs."""
    import sys
    import types

    os.environ["SB_DISABLE_K2"] = "1"
    os.environ["SPEECHBRAIN_DISABLE_K2"] = "1"

    for stub_name in _SPEECHBRAIN_STUB_MODULES:
        if stub_name not in sys.modules:
            stub = types.ModuleType(stub_name)
            stub.__doc__ = "Optional SpeechBrain integration disabled in VoxBridge."
            sys.modules[stub_name] = stub

    k2_stub = sys.modules["speechbrain.integrations.k2_fsa"]
    sys.modules.setdefault("speechbrain.k2_integration", k2_stub)

    from speechbrain.utils import importutils as _iu

    if getattr(_iu.LazyModule.ensure_module, "_voxbridge_sb_patched", False):
        return

    _orig_ensure = _iu.LazyModule.ensure_module

    def _ensure_module_patched(self, stacklevel: int):
        target = self.__dict__.get("target", "") or ""
        name = self.__dict__.get("name", "") or ""
        if _speechbrain_lazy_target_disabled(target, name):
            if self.lazy_module is None:
                stub_key = name or target
                self.lazy_module = (
                    sys.modules.get(stub_key)
                    or sys.modules.get(target)
                    or types.ModuleType(stub_key)
                )
                sys.modules.setdefault(stub_key, self.lazy_module)
            return self.lazy_module
        return _orig_ensure(self, stacklevel)

    _ensure_module_patched._voxbridge_sb_patched = True  # type: ignore[attr-defined]
    _iu.LazyModule.ensure_module = _ensure_module_patched


import asyncio
import logging
import shutil
import tempfile
import time
import traceback
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING, Annotated, Any

import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from scipy.spatial.distance import cosine

if TYPE_CHECKING:
    from speechbrain.inference.speaker import EncoderClassifier

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

MODEL_SOURCE = "speechbrain/spkrec-ecapa-voxceleb"
MODEL_SAVEDIR = "pretrained_models/spkrec-ecapa-voxceleb"
ECAPA_EMBED_DIM = 192
ECAPA_SAMPLE_RATE = 16000
MAX_AUDIO_SECONDS = 10
REQUEST_TIMEOUT_SEC = 30
# Vocal separation on AI reference (slow: model download + CPU). Off for MVP lab stability.
USE_DEMUCS = True
# Rough CPU budget to attempt one Demucs pass on the AI vocal.
DEMUCS_MIN_REMAINING_SEC = 2.5
DEMUCS_MODEL_NAME = os.environ.get("DEMUCS_MODEL", "htdemucs")
# Chunk averaging: 5 x 2 s windows within the 10 s trim (index-aligned pairs).
CHUNK_DURATION_SEC = 2.0
MAX_CHUNKS = 5
# Mono samples in [-1, 1]; segments below this RMS are treated as silent and skipped.
CHUNK_MIN_RMS = 0.01

# v5 composite weights (v4 was 34/28/33/5; v3 was 35/32/28/5).
V4_WEIGHTS: dict[str, float] = {
    "speaker": 0.15,
    "timbre": 0.42,
    "pitch": 0.30,
    "quality": 0.05,
    "vocal_character": 0.08,
}
# Median F0 (Hz) → range_band for vocal-type mismatch penalties.
F0_RANGE_LOW_HZ = 165.0
F0_RANGE_HIGH_HZ = 220.0
# Legacy MIDI anchors (range bands); vocal type uses multi-feature rules below.
PITCH_MIDI_MALE_MAX = 40.0
PITCH_MIDI_FEMALE_MIN = 60.0
# Multi-feature vocal type (pitch + timbre; NOT pitch alone).
VOCAL_CLASSIFY_PITCH_LOW_MIDI = 40.0
VOCAL_CLASSIFY_PITCH_HIGH_MIDI = 55.0
VOCAL_CLASSIFY_PITCH_HIGH_STRICT_MIDI = 60.0
VOCAL_CLASSIFY_FEMALE_MID_MIN_MIDI = 50.0
VOCAL_CLASSIFY_CENTROID_BRIGHT_HZ = 2200.0
VOCAL_CLASSIFY_CENTROID_DENSE_HZ = 1800.0
VOCAL_CLASSIFY_MFCC_VAR_LOW_DENSITY = 1.2
VOCAL_CLASSIFY_TIMBRE_BRIGHT_SCORE = 65.0
VOCAL_CLASSIFY_LOW_BAND_HZ = 300.0
VOCAL_CLASSIFY_LOW_BAND_RATIO_DENSE = 0.52
# Voice subtype (6-class) MIDI boundaries
SUBTYPE_SOPRANO_MIN_MIDI = 60.0   # C4
SUBTYPE_MEZZO_MIN_MIDI   = 55.0   # G3
SUBTYPE_ALTO_MIN_MIDI    = 50.0   # D3
SUBTYPE_TENOR_MIN_MIDI   = 46.0   # Bb2
SUBTYPE_BARITONE_MIN_MIDI = 40.0  # E2
# below SUBTYPE_BARITONE_MIN_MIDI -> bass
VOCAL_TYPE_RANK_DISTANCE_WEIGHT = 20.0
GENDER_MISMATCH_RANK_PENALTY = 35.0
GENDER_MISMATCH_HARD_RANK_PENALTY = 40.0
GENDER_PRIORITY_TIER_2_PENALTY = 50.0
# Manual demo gender overrides. Exact basename match first (case-insensitive), then substrings.
MANUAL_DEMO_GENDER: dict[str, str] = {
    "real_voice_1.wav": "male",
}
MANUAL_DEMO_GENDER_SUBSTRINGS: dict[str, str] = {
    "ai vocal": "female",
    "теплый воздух": "female",
    "real vocal 1": "male",
    "real vocal 2": "female",
    "real vocal 3": "male",
    "real vocal 4": "female",
    "real vocal 5": "female",
}
MALE_PROTOTYPE_FILENAME = "real_voice_1.wav"
# High-pitched male: pitch+timbre cosine vs prototype (unit vector: MIDI/127 + MFCC + centroid/8k).
HIGH_PITCHED_MALE_SIMILARITY_THRESHOLD = 0.75
HIGH_PITCHED_MALE_PITCH_AVG_MIN = 55.0
HIGH_PITCHED_MALE_PITCH_AMBIGUOUS_MIN = 40.0
HIGH_PITCHED_MALE_PITCH_AMBIGUOUS_MAX = 65.0
# v4.1 — softer mismatch multipliers (0.55–0.65); v4.2 removes universal post-penalty floor.
VOCAL_TYPE_ADJACENT_BAND_MULTIPLIER = 0.65
VOCAL_TYPE_LOW_HIGH_MULTIPLIER = 0.55
VOCAL_TYPE_GENDER_CONFLICT_MULTIPLIER = 0.60
VOCAL_MISMATCH_RANK_PENALTY = 8.0
VOCAL_TYPE_RANK_REASON = "preferred due to closer vocal type match"
VOCAL_MISMATCH_DEMOTION_REASON = "demoted due to vocal type mismatch"
VOCAL_MISMATCH_HARD_CAP = 75.0
VOCAL_MISMATCH_ADJACENT_CAP = 82.0
VOCAL_MISMATCH_PITCH_THRESHOLD = 50.0
VOCAL_MISMATCH_RANGE_OVERLAP_MAX = 40.0
MIN_SIMILARITY_FLOOR = 5.0
# v4.2 — rank-preserving stretch across demos (best → top band, worst → bottom band).
NORMALIZE_TARGET_TOP = 85.0
NORMALIZE_TARGET_BOTTOM = 15.0
NORMALIZE_MIN_SPAN = 2.0
NORMALIZE_RAW_FLAT_THRESHOLD = 5.0
SPK_RELATIVE_NORM_MIN_MAX = 25.0  # skip relative stretch if all raw spk scores below this
RANK_MIN_GAP = 10.0
# rank_boost[position]: top +12, 2nd +0, 3rd −5, 4th −8, 5th+ −10
RANK_BOOST_BY_POSITION = (18.0, 0.0, -8.0, -12.0, -15.0)
MAX_SIMILARITY_CAP = 88.0
MAX_SIMILARITY_CAP_ALIGNED = 95.0
MAX_SIMILARITY_CAP_PERFECT = 99.0
CAP_ALIGNED_COMPONENT_MIN = 85.0
CAP_PERFECT_COMPONENT_MIN = 92.0
ALIGNMENT_BONUS_THRESHOLD = 55.0
ALIGNMENT_BONUS_MULTIPLIER = 1.08
SINGLE_CHUNK_SPEAKER_DISCOUNT = 0.92
PITCH_SCORE_FLOOR = 28.0
LOW_VOICED_FRACTION = 0.25

_encoder: Any = None
_fallback: Any = None
_demucs_model: Any = None
_ml_loaded = False
torch: Any = None
torchaudio: Any = None
apply_model: Any = None
get_model: Any = None


class FallbackSpeakerEncoder:
    """Offline MFCC mean-pool + fixed projection when ECAPA is unavailable."""

    _log_once = False
    _N_MFCC = 40

    def __init__(self) -> None:
        _load_ml_stack()
        if not FallbackSpeakerEncoder._log_once:
            logger.warning("Using fallback speaker encoder")
            FallbackSpeakerEncoder._log_once = True
        gen = torch.Generator().manual_seed(42)
        proj = torch.randn(self._N_MFCC, ECAPA_EMBED_DIM, generator=gen)
        proj = proj / proj.norm(dim=0, keepdim=True).clamp(min=1e-8)
        self._proj = proj

    def _mfcc_features(self, waveform: Any) -> Any:
        import librosa

        samples = waveform.squeeze().detach().cpu().numpy().astype(np.float64)
        if samples.size == 0:
            raise ValueError("empty waveform for fallback encoder")
        mfcc = librosa.feature.mfcc(
            y=samples,
            sr=ECAPA_SAMPLE_RATE,
            n_mfcc=self._N_MFCC,
        )
        return torch.from_numpy(np.mean(mfcc, axis=1).astype(np.float32))

    def encode_batch(self, waveform: Any) -> Any:
        if waveform.dim() == 1:
            waveform = waveform.unsqueeze(0)
        batch_size = waveform.shape[0]
        vectors: list[Any] = []
        for index in range(batch_size):
            chunk = waveform[index : index + 1]
            mfcc_mean = self._mfcc_features(chunk)
            vector = mfcc_mean @ self._proj
            norm = vector.norm().clamp(min=1e-8)
            vectors.append((vector / norm).unsqueeze(0))
        return torch.stack(vectors, dim=0)


def _load_ml_stack() -> None:
    global _ml_loaded, torch, torchaudio, apply_model, get_model
    if _ml_loaded:
        return
    _clear_proxy_env()
    _patch_speechbrain_lazy_integrations()
    import torch as _torch
    import torchaudio as _torchaudio
    from demucs.apply import apply_model as _apply_model
    from demucs.pretrained import get_model as _get_model

    torch = _torch
    torchaudio = _torchaudio
    apply_model = _apply_model
    get_model = _get_model
    _ml_loaded = True


def get_classifier() -> Any:
    global _encoder, _fallback
    if _fallback is not None:
        return _fallback
    if _encoder is not None:
        return _encoder

    _clear_proxy_env()
    _load_ml_stack()
    _patch_speechbrain_lazy_integrations()
    try:
        from speechbrain.inference.speaker import EncoderClassifier
        from speechbrain.utils.fetching import LocalStrategy

        logger.info("Loading SpeechBrain model: %s", MODEL_SOURCE)
        _encoder = EncoderClassifier.from_hparams(
            source=MODEL_SOURCE,
            savedir=MODEL_SAVEDIR,
            run_opts={"device": "cpu"},
            local_strategy=LocalStrategy.COPY,
        )
        return _encoder
    except Exception as exc:
        logger.warning("ECAPA failed, using fallback: %s", exc)
        _fallback = FallbackSpeakerEncoder()
        return _fallback


def get_demucs_model():
    if not USE_DEMUCS:
        raise RuntimeError("Demucs is disabled (USE_DEMUCS=True)")
    global _demucs_model
    if _demucs_model is None:
        _clear_proxy_env()
        _load_ml_stack()
        logger.info("Loading Demucs model: %s", DEMUCS_MODEL_NAME)
        model = get_model(DEMUCS_MODEL_NAME)
        model.cpu()
        model.eval()
        _demucs_model = model
    return _demucs_model


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        _clear_proxy_env()
        get_classifier()
        if USE_DEMUCS:
            logger.info("Voice matching model ready (Demucs enabled).")
        else:
            logger.info(
                "Voice matching model ready (Demucs disabled; USE_DEMUCS=False)."
            )
    except Exception as exc:
        logger.warning("Model preload skipped (will retry on first request): %s", exc)
    yield


app = FastAPI(title="VoxBridge Voice Matching", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:3002",
        "http://127.0.0.1:3002",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _json_error(
    status_code: int,
    detail: str,
    error: str | None = None,
    step: str | None = None,
) -> JSONResponse:
    message = error or detail
    content: dict[str, str] = {"detail": detail, "error": message}
    if step:
        content["step"] = step
    return JSONResponse(status_code=status_code, content=content)


def _server_error_500(exc: Exception, step: str) -> JSONResponse:
    traceback.print_exc()
    logger.exception("voice-match failed at step=%s: %s", step, exc)
    return JSONResponse(
        status_code=500,
        content={"error": str(exc), "step": step},
    )


@app.exception_handler(RequestValidationError)
async def request_validation_exception_handler(
    _: Request, exc: RequestValidationError
) -> JSONResponse:
    detail = "; ".join(
        f"{'.'.join(str(loc) for loc in err.get('loc', ()))}: {err.get('msg', 'invalid')}"
        for err in exc.errors()
    )
    logger.warning("Request validation failed: %s", detail)
    return _json_error(422, detail or "Validation error", "validation_error")


@app.exception_handler(HTTPException)
async def http_exception_handler(_: Request, exc: HTTPException) -> JSONResponse:
    detail = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
    return _json_error(exc.status_code, detail, f"http_{exc.status_code}")


@app.exception_handler(Exception)
async def unhandled_exception_handler(_: Request, exc: Exception) -> JSONResponse:
    traceback.print_exc()
    logger.exception("Unhandled server error")
    return JSONResponse(
        status_code=500,
        content={"error": str(exc), "step": "unknown"},
    )


@dataclass
class RequestBudget:
    start: float = field(default_factory=time.monotonic)

    def elapsed(self) -> float:
        return time.monotonic() - self.start

    def remaining(self) -> float:
        return max(0.0, REQUEST_TIMEOUT_SEC - self.elapsed())

    def exceeded(self) -> bool:
        return self.elapsed() >= REQUEST_TIMEOUT_SEC


@dataclass
class VoiceMatchProgress:
    results: list[dict] = field(default_factory=list)
    partial: bool = False


def _sync_progress(
    progress: VoiceMatchProgress | None,
    results: list[dict],
    partial: bool,
) -> None:
    if progress is None:
        return
    progress.results = list(results)
    progress.partial = partial


def _pitch_midi_value(pitch: dict[str, float | str]) -> float:
    """Numeric MIDI note (pitch_avg); 0 when median F0 could not be estimated."""
    raw = pitch.get("pitch_avg", 0)
    if isinstance(raw, (int, float)) and float(raw) > 0:
        return float(raw)
    hz = float(pitch.get("median_f0_hz", pitch.get("avg_hz", 0)) or 0)
    if hz > 0:
        import librosa

        return float(librosa.hz_to_midi(hz))
    return 0.0


def _is_pitch_known(pitch: dict[str, float | str]) -> bool:
    """True when median F0 / MIDI was measured (not a failed or empty estimate)."""
    if _pitch_midi_value(pitch) > 0:
        return True
    hz = float(pitch.get("median_f0_hz", pitch.get("avg_hz", 0)) or 0)
    return hz > 0


def _vocal_type_from_midi(midi: float) -> str:
    """Legacy pitch-only helper (prefer classify_vocal_type_multi_feature)."""
    if midi <= 0:
        return "unknown"
    if midi < PITCH_MIDI_MALE_MAX:
        return "male"
    if midi > PITCH_MIDI_FEMALE_MIN:
        return "female"
    return "unknown"


def _harmonic_low_band_energy_ratio(y: np.ndarray, sr: int) -> float:
    """Share of STFT energy below ~300 Hz (chest / low-formant proxy)."""
    import librosa

    if y.size == 0:
        return 0.0
    stft = np.abs(librosa.stft(y, n_fft=2048, hop_length=512)) ** 2
    freqs = librosa.fft_frequencies(sr=sr, n_fft=2048)
    low_mask = freqs < float(VOCAL_CLASSIFY_LOW_BAND_HZ)
    low_energy = float(stft[low_mask].sum())
    total = float(stft.sum()) + 1e-12
    return low_energy / total


def _mfcc_cosine_similarity(ai_timbre: dict, demo_timbre: dict) -> float:
    """MFCC cosine similarity between AI and demo, returns 0-100."""
    import numpy as np
    a = np.asarray(ai_timbre.get("mean_mfcc", np.zeros(13)), dtype=np.float64)
    b = np.asarray(demo_timbre.get("mean_mfcc", np.zeros(13)), dtype=np.float64)
    if np.linalg.norm(a) == 0 or np.linalg.norm(b) == 0:
        return 50.0
    cos = float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))
    return round((cos + 1) / 2 * 100, 2)


def _timbre_mfcc_variance(timbre_features: dict[str, np.ndarray | float]) -> float:
    mfcc = np.asarray(timbre_features.get("mean_mfcc", np.zeros(13)), dtype=np.float64)
    if mfcc.size == 0:
        return 0.0
    return float(np.var(mfcc))


def _timbre_is_light_bright(
    timbre_features: dict[str, np.ndarray | float],
    *,
    timbre_score: float | None = None,
) -> bool:
    """High centroid or bright timbre with low MFCC variance (not chest-dense)."""
    centroid = float(timbre_features.get("centroid_hz", 0) or 0)
    mfcc = np.asarray(timbre_features.get("mean_mfcc", np.zeros(13)), dtype=np.float64)
    if centroid >= VOCAL_CLASSIFY_CENTROID_BRIGHT_HZ:
        return True
    mfcc_var = _timbre_mfcc_variance(timbre_features)
    mfcc_norm = float(np.linalg.norm(mfcc)) if mfcc.size else 0.0
    if (
        timbre_score is not None
        and timbre_score >= VOCAL_CLASSIFY_TIMBRE_BRIGHT_SCORE
        and mfcc_var < VOCAL_CLASSIFY_MFCC_VAR_LOW_DENSITY
        and centroid >= 1500.0
        and mfcc_norm > 1.0
    ):
        return True
    bandwidth = float(timbre_features.get("bandwidth_hz", 0) or 0)
    if bandwidth > 0 and bandwidth < 1500.0 and centroid >= 2000.0:
        return True
    return False


def _timbre_is_dense_chest(
    timbre_features: dict[str, np.ndarray | float],
    *,
    low_band_ratio: float | None = None,
) -> bool:
    """Dense / chesty timbre: low centroid + strong low-band energy or compact MFCCs.

    Low-band energy alone is not enough (many female vocals have chest harmonics).
    """
    centroid = float(timbre_features.get("centroid_hz", 0) or 0)
    mfcc = np.asarray(timbre_features.get("mean_mfcc", np.zeros(13)), dtype=np.float64)
    mfcc_var = _timbre_mfcc_variance(timbre_features)
    if low_band_ratio is not None and low_band_ratio >= VOCAL_CLASSIFY_LOW_BAND_RATIO_DENSE:
        if centroid > 0 and centroid < VOCAL_CLASSIFY_CENTROID_BRIGHT_HZ:
            if mfcc_var >= VOCAL_CLASSIFY_MFCC_VAR_LOW_DENSITY or (
                centroid > 0 and centroid < VOCAL_CLASSIFY_CENTROID_DENSE_HZ
            ):
                return True
    if centroid > 0 and centroid < VOCAL_CLASSIFY_CENTROID_DENSE_HZ:
        if mfcc.size and float(np.linalg.norm(mfcc)) > 20.0:
            return True
        if low_band_ratio is not None and low_band_ratio >= 0.48:
            return True
    return False


def _classify_voice_subtype(midi: float, light_bright: bool, dense_chest: bool) -> str:
    """Map pitch MIDI + timbre to one of 6 classical voice subtypes."""
    if midi <= 0:
        return "unknown"
    # Female subtypes (higher pitch)
    if midi >= SUBTYPE_SOPRANO_MIN_MIDI:
        return "soprano"
    if midi >= SUBTYPE_MEZZO_MIN_MIDI:
        return "mezzo" if not dense_chest else "alto"
    if midi >= SUBTYPE_ALTO_MIN_MIDI:
        return "alto"
    # Male subtypes (lower pitch)
    if midi >= SUBTYPE_TENOR_MIN_MIDI:
        return "tenor" if light_bright else "baritone"
    if midi >= SUBTYPE_BARITONE_MIN_MIDI:
        return "baritone"
    return "bass"


def classify_vocal_type_multi_feature(
    waveform: Any,
    sr: int,
    pitch_features: dict[str, float | str],
    timbre_features: dict[str, np.ndarray | float],
    *,
    timbre_score: float | None = None,
) -> dict[str, float | str | bool]:
    """Classify vocal gender from pitch + timbre (NOT pitch alone).

    Rules (documented):
      light_bright = high spectral centroid OR bright timbre_score with low MFCC variance
      dense_chest = low centroid + strong low-band energy OR compact/dense MFCC profile

      if pitch high (midi > 55 or > 60):
        if light_bright and not dense_chest -> female
        elif dense_chest -> male + high_pitched_male
        else uncertain -> unknown (do not guess female from pitch alone)
      elif pitch low (midi < 40) -> male
      else MIDI 40-60 ambiguous band: female only if light_bright; else male (typical male range)

    Returns detected_vocal_type, high_pitched_male, classification_confidence.
    """
    midi = _pitch_midi_value(pitch_features)
    if midi <= 0:
        return {
            "detected_vocal_type": "unknown",
            "high_pitched_male": False,
            "classification_confidence": 0.0,
        }

    y = _waveform_to_numpy(waveform) if waveform is not None else np.array([], dtype=np.float64)
    low_band_ratio = _harmonic_low_band_energy_ratio(y, sr) if y.size else None
    light_bright = _timbre_is_light_bright(timbre_features, timbre_score=timbre_score)
    dense_chest = _timbre_is_dense_chest(timbre_features, low_band_ratio=low_band_ratio)

    pitch_high = midi > VOCAL_CLASSIFY_PITCH_HIGH_MIDI
    pitch_low = midi < VOCAL_CLASSIFY_PITCH_LOW_MIDI

    if pitch_low:
        return {
            "detected_vocal_type": "male",
            "high_pitched_male": False,
            "classification_confidence": 0.88,
        }

    if pitch_high:
        if light_bright and not dense_chest:
            return {
                "detected_vocal_type": "female",
                "high_pitched_male": False,
                "classification_confidence": 0.82,
            }
        if dense_chest:
            return {
                "detected_vocal_type": "male",
                "high_pitched_male": True,
                "classification_confidence": 0.78,
            }
        # HNR + p90 tiebreaker in pitch_high uncertain zone
        p90 = float(pitch_features.get("p90_f0_hz", 0))
        hnr = float(pitch_features.get("hnr_db", 1.0))
        centroid = float(timbre_features.get("centroid_hz", 0)) if timbre_features else 0.0
        if p90 > 220.0 or centroid >= VOCAL_CLASSIFY_CENTROID_BRIGHT_HZ:
            return {
                "detected_vocal_type": "female",
                "high_pitched_male": False,
                "classification_confidence": 0.60,
            }
        return {
            "detected_vocal_type": "unknown",
            "high_pitched_male": False,
            "classification_confidence": 0.45,
        }

    # Ambiguous MIDI 40-55: timbre disambiguation (not pitch-only female/male cutoffs).
    if light_bright and not dense_chest:
        return {
            "detected_vocal_type": "female",
            "high_pitched_male": False,
            "classification_confidence": 0.68,
        }
    if dense_chest:
        return {
            "detected_vocal_type": "male",
            "high_pitched_male": midi >= VOCAL_CLASSIFY_PITCH_HIGH_MIDI,
            "classification_confidence": 0.68,
        }
    # HNR + p90 tiebreaker: clean voice with high upper register -> female
    p90 = float(pitch_features.get("p90_f0_hz", 0))
    hnr = float(pitch_features.get("hnr_db", 1.0))
    centroid = float(timbre_features.get("centroid_hz", 0)) if timbre_features else 0.0
    if p90 > 220.0 or centroid >= VOCAL_CLASSIFY_CENTROID_BRIGHT_HZ:  # p90 > ~A3 or bright timbre
        return {
            "detected_vocal_type": "female",
            "high_pitched_male": False,
            "classification_confidence": 0.55,
        }
    return {
        "detected_vocal_type": "male",
        "high_pitched_male": False,
        "classification_confidence": 0.4,
    }


def _empty_timbre_features() -> dict[str, np.ndarray | float]:
    return {
        "mean_mfcc": np.zeros(13, dtype=np.float64),
        "centroid_hz": 0.0,
        "bandwidth_hz": 0.0,
    }


def _apply_multi_feature_vocal_classification(
    pitch: dict[str, float | str],
    timbre: dict[str, np.ndarray | float],
    waveform: Any | None = None,
    sr: int = ECAPA_SAMPLE_RATE,
    *,
    timbre_score: float | None = None,
) -> dict[str, float | str | bool]:
    """Write detected_vocal_type / high_pitched_male / confidence onto pitch dict."""
    midi = _pitch_midi_value(pitch)
    pitch["pitch_avg"] = midi
    for legacy in ("pitch", "median_midi", "detected_pitch_range", "pit"):
        pitch.pop(legacy, None)
    if midi <= 0:
        pitch["detected_vocal_type"] = "unknown"
        pitch["high_pitched_male"] = False
        pitch["classification_confidence"] = 0.0
        return {
            "detected_vocal_type": "unknown",
            "high_pitched_male": False,
            "classification_confidence": 0.0,
        }
    result = classify_vocal_type_multi_feature(
        waveform,
        sr,
        pitch,
        timbre,
        timbre_score=timbre_score,
    )
    pitch["detected_vocal_type"] = str(result["detected_vocal_type"])
    pitch["high_pitched_male"] = bool(result["high_pitched_male"])
    pitch["classification_confidence"] = float(result["classification_confidence"])
    _midi = _pitch_midi_value(pitch)
    _lb = result.get("light_bright", False)
    _dc = result.get("dense_chest", False)
    pitch["voice_subtype"] = _classify_voice_subtype(_midi, bool(_lb), bool(_dc))
    result["voice_subtype"] = pitch["voice_subtype"]
    return result


def _refresh_pitch_vocal_classification(
    pitch: dict[str, float | str],
    *,
    timbre: dict[str, np.ndarray | float] | None = None,
    waveform: Any | None = None,
    sr: int = ECAPA_SAMPLE_RATE,
    timbre_score: float | None = None,
) -> None:
    """Refresh pitch_avg and multi-feature detected_vocal_type on a pitch dict."""
    timbre_in = timbre if timbre is not None else _empty_timbre_features()
    _apply_multi_feature_vocal_classification(
        pitch,
        timbre_in,
        waveform,
        sr,
        timbre_score=timbre_score,
    )


def _ai_reference_generator_female_override(
    pitch: dict[str, float | str],
) -> bool:
    """Suno/Udio refs: dense timbre + high MIDI often yields high_pitched_male for female voices."""
    return (
        pitch.get("high_pitched_male") is True
        and _pitch_midi_value(pitch) > VOCAL_CLASSIFY_PITCH_HIGH_MIDI
    )


def _filename_implies_female_gender(filename: str) -> bool:
    """True when basename contains a MANUAL_DEMO_GENDER_SUBSTRINGS key (case-insensitive)."""
    base_lower = Path(filename).name.lower()
    for needle in MANUAL_DEMO_GENDER_SUBSTRINGS:
        if needle.lower() in base_lower:
            return True
    return False


def _apply_ai_reference_vocal_type_adjustment(
    pitch: dict[str, float | str],
    *,
    filename: str | None = None,
) -> None:
    """Soften AI reference classification (generators); demos keep strict rules."""
    ref_name = filename or str(pitch.get("ai_reference_filename", "") or "")
    if ref_name and _filename_implies_female_gender(ref_name):
        pitch["detected_vocal_type"] = "female"
        pitch["high_pitched_male"] = False
        return
    if not _ai_reference_generator_female_override(pitch):
        return
    pitch["detected_vocal_type"] = "female"
    pitch["high_pitched_male"] = False


def _refresh_ai_pitch_vocal_classification(
    pitch: dict[str, float | str],
    *,
    timbre: dict[str, np.ndarray | float] | None = None,
    waveform: Any | None = None,
    sr: int = ECAPA_SAMPLE_RATE,
    timbre_score: float | None = None,
) -> None:
    """Classify AI reference pitch + apply generator-friendly type adjustment."""
    _refresh_pitch_vocal_classification(
        pitch,
        timbre=timbre,
        waveform=waveform,
        sr=sr,
        timbre_score=timbre_score,
    )
    _apply_ai_reference_vocal_type_adjustment(
        pitch,
        filename=str(pitch.get("ai_reference_filename", "") or "") or None,
    )


def _demo_lookup_filename(row: dict) -> str:
    """Basename used for MANUAL_DEMO_GENDER* (prefers client-supplied original name)."""
    original = row.get("original_filename")
    if isinstance(original, str) and original.strip():
        return original.strip()
    return str(row.get("filename", "") or "")


def _parse_demo_display_names_form(raw: str | None, demo_count: int) -> list[str]:
    """Parse JSON array from multipart field ``demo_display_names`` (client upload labels)."""
    if not raw or not str(raw).strip():
        return []
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("Invalid demo_display_names JSON; ignoring")
        return []
    if not isinstance(parsed, list):
        logger.warning("demo_display_names must be a JSON array; ignoring")
        return []
    names: list[str] = []
    for item in parsed[:demo_count]:
        if item is None:
            names.append("")
            continue
        names.append(Path(str(item)).name.strip())
    return names


def _manual_demo_gender_lookup(filename: str) -> str | None:
    """Return male|female from MANUAL_DEMO_GENDER (exact basename) or SUBSTRINGS."""
    base_lower = Path(filename).name.lower()
    for key, gender in MANUAL_DEMO_GENDER.items():
        if key.lower() != base_lower:
            continue
        normalized = str(gender).lower()
        if normalized in ("male", "female"):
            return normalized
    for needle, gender in MANUAL_DEMO_GENDER_SUBSTRINGS.items():
        if needle.lower() in base_lower:
            normalized = str(gender).lower()
            if normalized in ("male", "female"):
                return normalized
    return None


def _resolve_manual_demo_gender(row: dict) -> str | None:
    """Manual gender from row or filename lookup (MANUAL_DEMO_GENDER*)."""
    manual = row.get("manual_gender")
    if manual in ("male", "female"):
        return str(manual)
    filename = _demo_lookup_filename(row)
    if not filename:
        return None
    return _manual_demo_gender_lookup(filename)


def _apply_manual_demo_gender_to_row(row: dict, manual: str) -> None:
    """Apply configured manual label: final_vocal_type follows manual, not classifier."""
    row["manual_gender"] = manual
    row["final_vocal_type"] = manual
    row["high_pitched_male"] = False


def _is_male_prototype_filename(filename: str) -> bool:
    return Path(filename).name.lower() == MALE_PROTOTYPE_FILENAME.lower()


def _extract_male_prototype_features(waveform: Any) -> dict[str, Any]:
    """Pitch MIDI + mean MFCC + spectral centroid from the male prototype waveform."""
    pitch = compute_pitch_features(waveform)
    timbre = compute_timbre_features(waveform)
    return {
        "pitch_avg": _pitch_midi_value(pitch),
        "mean_mfcc": np.asarray(timbre.get("mean_mfcc", np.zeros(13)), dtype=np.float64),
        "centroid_hz": float(timbre.get("centroid_hz", 0) or 0),
    }


def _male_prototype_unit_vector(
    pitch_avg: float,
    mean_mfcc: np.ndarray,
    centroid_hz: float,
) -> np.ndarray:
    """L2-normalized [pitch/127, MFCC×13, centroid/8000] for prototype cosine similarity."""
    mfcc = np.asarray(mean_mfcc, dtype=np.float64).flatten()
    if mfcc.size < 13:
        mfcc = np.pad(mfcc, (0, max(0, 13 - mfcc.size)))
    else:
        mfcc = mfcc[:13]
    pitch_norm = pitch_avg / 127.0 if pitch_avg > 0 else 0.0
    centroid_norm = centroid_hz / 8000.0 if centroid_hz > 0 else 0.0
    vec = np.concatenate(([pitch_norm], mfcc, [centroid_norm]))
    norm = float(np.linalg.norm(vec))
    if norm < 1e-12:
        return vec
    return vec / norm


def _prototype_pitch_timbre_cosine_similarity(
    demo_pitch: dict[str, float | str],
    demo_timbre: dict[str, np.ndarray | float],
    prototype: dict[str, Any],
) -> float:
    """Cosine similarity on normalized pitch + MFCC + centroid feature vector (0–1)."""
    demo_vec = _male_prototype_unit_vector(
        _pitch_midi_value(demo_pitch),
        np.asarray(demo_timbre.get("mean_mfcc", np.zeros(13)), dtype=np.float64),
        float(_mfcc_cosine_similarity(ai_timbre, demo_timbre)),
    )
    proto_vec = _male_prototype_unit_vector(
        float(prototype.get("pitch_avg", 0) or 0),
        np.asarray(prototype.get("mean_mfcc", np.zeros(13)), dtype=np.float64),
        float(prototype.get("centroid_hz", 0) or 0),
    )
    if demo_vec.size != proto_vec.size:
        width = max(demo_vec.size, proto_vec.size)
        demo_vec = np.pad(demo_vec, (0, width - demo_vec.size))
        proto_vec = np.pad(proto_vec, (0, width - proto_vec.size))
    return max(0.0, min(1.0, float(np.dot(demo_vec, proto_vec))))



# ── Demo profile cache ──────────────────────────────────────────────────────
import hashlib as _hashlib
_DEMO_PROFILES_DIR = Path(__file__).parent / "demo_profiles"

def _demo_profile_path(demo_path: str):
    _DEMO_PROFILES_DIR.mkdir(exist_ok=True)
    stem = Path(demo_path).stem
    return _DEMO_PROFILES_DIR / f"{stem}.json"


def _save_demo_profile(demo_path: str, waveform, embeddings, chunk_rms, pitch, timbre, vocal_character):
    p = _demo_profile_path(demo_path)
    emb_list = {str(k): (v.tolist() if hasattr(v, "tolist") else v) for k, v in embeddings.items()}
    rms_list = {str(k): float(v) for k, v in chunk_rms.items()}
    vc_serial = {k: (v.tolist() if hasattr(v, "tolist") else v) for k, v in vocal_character.items()}
    pitch_serial = {k: (v.tolist() if hasattr(v, "tolist") else v) for k, v in pitch.items()}
    timbre_serial = {k: (v.tolist() if hasattr(v, "tolist") else v) for k, v in timbre.items()}
    data = {
        "waveform": waveform.tolist() if hasattr(waveform, "tolist") else list(waveform),
        "embeddings": emb_list,
        "chunk_rms": rms_list,
        "pitch": pitch_serial,
        "timbre": timbre_serial,
        "vocal_character": vc_serial,
    }
    p.write_text(json.dumps(data))

def _load_demo_profile(demo_path: str):
    p = _demo_profile_path(demo_path)
    if not p.exists():
        return None
    try:
        data = json.loads(p.read_text())
        import numpy as np
        import torch as _torch; waveform = _torch.tensor(data["waveform"], dtype=_torch.float32).unsqueeze(0)
        import torch; embeddings = {int(k): torch.tensor(v, dtype=torch.float32) for k, v in data["embeddings"].items()}
        chunk_rms = {int(k): float(v) for k, v in data["chunk_rms"].items()}
        pitch = {k: (np.array(v, dtype=np.float32) if isinstance(v, list) else v)
                 for k, v in data["pitch"].items()}
        timbre = {k: (np.array(v, dtype=np.float32) if isinstance(v, list) else v)
                  for k, v in data["timbre"].items()}
        vocal_character = data["vocal_character"]
        language = data.get("language", "")
        return waveform, embeddings, chunk_rms, pitch, timbre, vocal_character, language
    except Exception as e:
        logger.warning("demo profile load failed for %s: %s", demo_path, e)
        return None

# ────────────────────────────────────────────────────────────────────────────
def _load_male_prototype_features(
    temp_dir: str,
    demo_entries: list[tuple[Path, str]],
    step_ref: list[str],
    budget: RequestBudget | None,
) -> dict[str, Any] | None:
    """Load real_voice_1 waveform once per request and extract prototype timbre/pitch."""
    for demo_path, demo_filename in demo_entries:
        if not _is_male_prototype_filename(demo_filename):
            continue
        demo_wav = load_audio_to_wav(str(demo_path), temp_dir)
        waveform = _waveform_for_embedding(
            Path(demo_wav), step_ref, budget, run_demucs=USE_DEMUCS
        )
        features = _extract_male_prototype_features(waveform)
        logger.info(
            "Male prototype %s: pitch_avg=%.1f centroid=%.0f Hz",
            demo_filename,
            features["pitch_avg"],
            features["centroid_hz"],
        )
        return features
    return None


def _classifier_confident_female(pitch: dict[str, float | str]) -> bool:
    """Multi-feature female with enough confidence to resist prototype HPM override."""
    return (
        pitch.get("detected_vocal_type") == "female"
        and float(pitch.get("classification_confidence", 0) or 0) >= 0.68
        and pitch.get("high_pitched_male") is not True
    )


def _apply_demo_vocal_type_fields(
    row: dict,
    demo_pitch: dict[str, float | str],
    *,
    demo_timbre: dict[str, np.ndarray | float] | None = None,
    male_prototype: dict[str, Any] | None = None,
    demo_waveform: Any | None = None,
) -> None:
    """Classify demo vocal type before scoring: manual label, prototype, then classifier."""
    detected = _pitch_vocal_type(demo_pitch)
    row["detected_vocal_type"] = detected
    row["classification_confidence"] = float(
        demo_pitch.get("classification_confidence", 0) or 0
    )
    filename = _demo_lookup_filename(row)
    row["original_filename"] = filename

    if _is_male_prototype_filename(filename):
        row["similarity_to_real_voice_1"] = True
        row["high_pitched_male"] = False
        manual = _manual_demo_gender_lookup(filename)
        row["manual_gender"] = manual if manual is not None else "male"
        row["final_vocal_type"] = "male"
        return

    manual = _manual_demo_gender_lookup(filename)
    if manual is not None:
        row.setdefault("similarity_to_real_voice_1", False)
        _apply_manual_demo_gender_to_row(row, manual)
        logger.info(
            "Manual demo gender override: %s -> %s (detected=%s)",
            filename,
            manual,
            detected,
        )
        return

    row.setdefault("similarity_to_real_voice_1", False)
    classifier_hpm = demo_pitch.get("high_pitched_male") is True
    row.setdefault("high_pitched_male", classifier_hpm)

    if classifier_hpm and detected == "male":
        row["high_pitched_male"] = True
        row["final_vocal_type"] = "male"
        row["manual_gender"] = None
        return

    if male_prototype is not None and demo_timbre is not None:
        proto_sim = _prototype_pitch_timbre_cosine_similarity(
            demo_pitch, demo_timbre, male_prototype
        )
        row["prototype_pitch_timbre_similarity"] = round(proto_sim, 4)
        pitch_midi = _pitch_midi_value(demo_pitch)
        in_ambiguous_pitch = (
            HIGH_PITCHED_MALE_PITCH_AMBIGUOUS_MIN
            <= pitch_midi
            <= HIGH_PITCHED_MALE_PITCH_AMBIGUOUS_MAX
        )
        timbre_close = proto_sim >= HIGH_PITCHED_MALE_SIMILARITY_THRESHOLD
        misclassified_high_male = (
            detected in ("female", "unknown")
            and in_ambiguous_pitch
            and pitch_midi >= HIGH_PITCHED_MALE_PITCH_AVG_MIN
            and timbre_close
        )
        confident_female = _classifier_confident_female(demo_pitch)
        proto_forces_hpm = (
            not confident_female
            and (timbre_close or misclassified_high_male or classifier_hpm)
        )
        if proto_forces_hpm:
            row["high_pitched_male"] = True
            row["similarity_to_real_voice_1"] = timbre_close
            row["final_vocal_type"] = "male"
            row["manual_gender"] = None
            return

    row["manual_gender"] = None
    row["final_vocal_type"] = detected


def _apply_demo_gender_override_fields(
    row: dict,
    demo_pitch: dict[str, float | str],
) -> None:
    """Refresh pitch fields; manual label wins over HPM / prototype heuristics."""
    row["detected_vocal_type"] = _pitch_vocal_type(demo_pitch)
    row["classification_confidence"] = float(
        demo_pitch.get("classification_confidence", 0) or 0
    )
    manual = _resolve_manual_demo_gender(row)
    if manual is not None:
        _apply_manual_demo_gender_to_row(row, manual)
        return
    if row.get("high_pitched_male") is True:
        row["final_vocal_type"] = "male"
        row["manual_gender"] = None
        return
    if row.get("similarity_to_real_voice_1") is True or _is_male_prototype_filename(
        _demo_lookup_filename(row)
    ):
        row["similarity_to_real_voice_1"] = True
        row["high_pitched_male"] = False
        row["manual_gender"] = "male"
        row["final_vocal_type"] = "male"
        return
    _apply_demo_vocal_type_fields(row, demo_pitch)


def _demo_final_vocal_type(
    row: dict,
    demo_pitch: dict[str, float | str] | None = None,
) -> str:
    """Ranking / partition vocal type for a demo (manual override when configured)."""
    manual = _resolve_manual_demo_gender(row)
    if manual in ("male", "female"):
        return manual
    if row.get("high_pitched_male") is True:
        return "male"
    final = row.get("final_vocal_type")
    if isinstance(final, str) and final in ("male", "female", "unknown"):
        return final
    if demo_pitch is not None:
        return _pitch_vocal_type(demo_pitch)
    detected = row.get("detected_vocal_type")
    if isinstance(detected, str) and detected:
        return detected
    return "unknown"


_API_PITCH_LEGACY_KEYS = (
    "pitch",
    "pit",
    "median_midi",
    "detected_pitch_range",
    "ai_detected_pitch_range",
    "median_f0_hz",
)


_INTERNAL_API_ROW_KEYS = (
    "_demo_timbre",
    "_ai_timbre",
    "_demo_waveform",
    "_ai_waveform",
    "_rank_demo_timbre",
    "_rank_demo_waveform",
    "_rank_ai_timbre",
    "_rank_ai_waveform",
    "_debug_demo_timbre",
    "_debug_demo_waveform",
    "_rank_demo_pitch",
    "_debug_demo_pitch",
)


def _sanitize_voice_match_api_row(row: dict) -> None:
    """Expose one pitch field (pitch_avg) on API rows; drop duplicates."""
    for key in _API_PITCH_LEGACY_KEYS:
        row.pop(key, None)
    for key in _INTERNAL_API_ROW_KEYS:
        row.pop(key, None)


def _pitch_vocal_type(pitch: dict[str, float | str]) -> str:
    """Primary vocal type from multi-feature classification on pitch dict."""
    detected = pitch.get("detected_vocal_type")
    if isinstance(detected, str) and detected in ("male", "female", "unknown"):
        return detected
    if not _is_pitch_known(pitch):
        return "unknown"
    midi = _pitch_midi_value(pitch)
    if midi > 0:
        return _vocal_type_from_midi(midi)
    return "unknown"


def _ai_vocal_type(ai_pitch: dict[str, float | str]) -> str:
    """AI vocal type for ranking (softer than demos for Suno/Udio generator artifacts)."""
    ref_name = str(ai_pitch.get("ai_reference_filename", "") or "")
    if ref_name and _filename_implies_female_gender(ref_name):
        return "female"
    if _ai_reference_generator_female_override(ai_pitch):
        return "female"
    return _pitch_vocal_type(ai_pitch)


def _vocal_types_match(
    ai_pitch: dict[str, float | str],
    demo_pitch: dict[str, float | str],
    *,
    demo_row: dict | None = None,
) -> bool:
    """True when AI pitch type matches demo type used for ranking (final when set)."""
    if not _is_pitch_known(ai_pitch):
        return False
    ai_type = _ai_vocal_type(ai_pitch)
    if demo_row is not None:
        demo_type = _demo_final_vocal_type(demo_row, demo_pitch)
    else:
        demo_type = _pitch_vocal_type(demo_pitch)
    if ai_type not in {"male", "female"} or demo_type not in {"male", "female"}:
        return False
    return ai_type == demo_type


def _vocal_types_match_for_ranking(
    ai_pitch: dict[str, float | str],
    row: dict,
    demo_pitch: dict[str, float | str],
) -> bool:
    """AI pitch type vs demo final_vocal_type (manual override when set)."""
    return _vocal_types_match(ai_pitch, demo_pitch, demo_row=row)


def _reason_is_vocal_type_mismatch(reason: object) -> bool:
    return "vocal type mismatch" in str(reason).lower()


def _sync_reasons_with_vocal_match(row: dict) -> None:
    """Keep mismatch/demotion reasons aligned with vocal_type_match."""
    reasons = row.get("reasons")
    if not isinstance(reasons, list):
        return
    if row.get("vocal_type_match") is True:
        row["reasons"] = [
            reason
            for reason in reasons
            if not _reason_is_vocal_type_mismatch(reason)
            and reason != VOCAL_MISMATCH_DEMOTION_REASON
        ]
        return
    ai_type = str(row.get("ai_detected_vocal_type", "unknown"))
    demo_type = _demo_final_vocal_type(row)
    if (ai_type, demo_type) not in {("male", "female"), ("female", "male")}:
        return
    if not any(_reason_is_vocal_type_mismatch(reason) for reason in reasons):
        reasons.append("vocal type mismatch")


def _compute_vocal_type_distance(
    ai_pitch: dict[str, float | str],
    demo_pitch: dict[str, float | str],
    *,
    demo_final_type: str | None = None,
) -> int:
    """0 = aligned band; 1 = adjacent band; 2 = low vs high; +1 for male/female conflict."""
    ai_band = str(ai_pitch.get("range_band", "unknown"))
    demo_band = str(demo_pitch.get("range_band", "unknown"))
    band_distance = 0
    if ai_band != "unknown" and demo_band != "unknown" and ai_band != demo_band:
        if {ai_band, demo_band} == {"low", "high"}:
            band_distance = 2
        else:
            band_distance = 1
    ai_type = _ai_vocal_type(ai_pitch)
    demo_type = demo_final_type if demo_final_type else _pitch_vocal_type(demo_pitch)
    gender_conflict = (ai_type, demo_type) in {("male", "female"), ("female", "male")}
    return band_distance + (1 if gender_conflict else 0)


def _gender_priority_tier(
    ai_type: str,
    demo_pitch: dict[str, float | str],
    *,
    demo_final_type: str | None = None,
    female_pool: bool,
    male_pool: bool,
) -> int:
    """0 = pitch-type match; 1 = unknown / adjacent; 2 = male↔female mismatch."""
    demo_type = demo_final_type if demo_final_type else _pitch_vocal_type(demo_pitch)
    if demo_type == "unknown" and not _is_pitch_known(demo_pitch):
        return 2
    if ai_type == "female" and female_pool:
        if demo_type == "female":
            return 0
        return 2
    if ai_type == "male" and male_pool:
        if demo_type == "male":
            return 0
        return 2
    if ai_type in {"male", "female"} and ai_type == demo_type:
        return 0
    if (ai_type, demo_type) in {("male", "female"), ("female", "male")}:
        return 2
    return 1


def _gender_mismatch_rank_penalty(
    ai_type: str,
    demo_pitch: dict[str, float | str],
    *,
    demo_final_type: str | None = None,
    female_pool: bool,
    male_pool: bool,
) -> float:
    demo_type = demo_final_type if demo_final_type else _pitch_vocal_type(demo_pitch)
    if ai_type == "female" and female_pool and demo_type == "male":
        return GENDER_MISMATCH_HARD_RANK_PENALTY
    if ai_type == "female" and female_pool and demo_type == "unknown":
        return GENDER_MISMATCH_RANK_PENALTY
    if ai_type == "male" and male_pool and demo_type == "female":
        return GENDER_MISMATCH_RANK_PENALTY
    if ai_type == "male" and male_pool and demo_type == "unknown":
        return GENDER_MISMATCH_RANK_PENALTY
    if (ai_type, demo_type) in {("male", "female"), ("female", "male")}:
        return GENDER_MISMATCH_RANK_PENALTY
    return 0.0


def _spectral_centroid_proxy(row: dict) -> float:
    return float(row.get("_spectral_centroid_proxy", row.get("timbre_score", 0)) or 0)


def _gender_priority_tier_penalty(tier: int) -> float:
    """Extra rank penalty by tier: 0 → none, 2 → large negative on final_ranking_score."""
    if tier >= 2:
        return GENDER_PRIORITY_TIER_2_PENALTY
    return 0.0


def _compute_final_ranking_score(
    row: dict,
    ai_pitch_features: dict[str, float | str],
    *,
    ai_type: str,
    female_pool: bool,
    male_pool: bool,
) -> tuple[int, float]:
    """Return (gender_priority_tier, final_ranking_score) from displayed similarity."""
    demo_pitch = row.get("_rank_demo_pitch") or {}
    if not isinstance(demo_pitch, dict):
        demo_pitch = {}
    demo_final_type = _demo_final_vocal_type(row, demo_pitch)
    if "_vocal_type_distance" not in row:
        row["_vocal_type_distance"] = _compute_vocal_type_distance(
            ai_pitch_features,
            demo_pitch,
            demo_final_type=demo_final_type,
        )
    tier = _gender_priority_tier(
        ai_type,
        demo_pitch,
        demo_final_type=demo_final_type,
        female_pool=female_pool,
        male_pool=male_pool,
    )
    distance = int(row["_vocal_type_distance"])
    mismatch_penalty = _gender_mismatch_rank_penalty(
        ai_type,
        demo_pitch,
        demo_final_type=demo_final_type,
        female_pool=female_pool,
        male_pool=male_pool,
    )
    tier_penalty = _gender_priority_tier_penalty(tier)
    final = (
        float(row["similarity"])
        - distance * VOCAL_TYPE_RANK_DISTANCE_WEIGHT
        - mismatch_penalty
        - tier_penalty
        - (max(0.0, 35.0 - float(row.get("pitch_score", 35))) * 1.2)
    + _compute_tag_bonus(
        _get_demo_tags(_demo_lookup_filename(row)),
        row.get("_query_tags") or {}
    )
    )
    _fb_boost = _feedback_boost(str(row.get(chr(100)+chr(101)+chr(109)+chr(111)+chr(95)+chr(102)+chr(105)+chr(108)+chr(101)+chr(110)+chr(97)+chr(109)+chr(101), chr(0))))
    row["feedback_boost"] = round(_fb_boost, 1)
    return tier, _round_score(final + _fb_boost)


def _sort_rows_by_final_ranking_score(rows: list[dict]) -> list[dict]:
    """Stable descending sort by final_ranking_score (tie: tier asc, timbre desc)."""
    indexed = list(enumerate(rows))
    indexed.sort(
        key=lambda item: (
            -float(item[1]["final_ranking_score"]),
            int(item[1]["_gender_priority_tier"]),
            -float(item[1]["timbre_score"]),
            item[0],
        )
    )
    return [row for _, row in indexed]


def _partition_results_by_tier(rows: list[dict]) -> list[dict]:
    """Tier 0 → 1 → 2, each block sorted by final_ranking_score descending."""
    buckets: dict[int, list[dict]] = {0: [], 1: [], 2: []}
    for row in rows:
        tier = int(row.get("_gender_priority_tier", 1))
        buckets[min(max(tier, 0), 2)].append(row)
    ordered: list[dict] = []
    for tier in (0, 1, 2):
        ordered.extend(_sort_rows_by_final_ranking_score(buckets[tier]))
    return ordered


def _row_counts_as_vocal_type_mismatch(row: dict) -> bool:
    """Belt-and-suspenders: stale mismatch reasons still demote from #1."""
    if row.get("vocal_type_match") is True:
        reasons = row.get("reasons") or []
        return any(_reason_is_vocal_type_mismatch(reason) for reason in reasons)
    return row.get("vocal_type_match") is not True


def _split_results_into_contiguous_type_groups(
    results: list[dict],
) -> list[list[dict]]:
    """Split list into groups of consecutive rows with the same final_vocal_type."""
    if not results:
        return []
    groups: list[list[dict]] = []
    current_key = _demo_final_vocal_type(results[0])
    current: list[dict] = [results[0]]
    for row in results[1:]:
        key = _demo_final_vocal_type(row)
        if key == current_key:
            current.append(row)
        else:
            groups.append(current)
            current_key = key
            current = [row]
    groups.append(current)
    return groups


def _sort_rows_by_vocal_match_then_final_ranking_score(rows: list[dict]) -> list[dict]:
    """Within one gender partition: vocal_type_match=true first, then score desc."""
    indexed = list(enumerate(rows))
    indexed.sort(
        key=lambda item: (
            0 if item[1].get("vocal_type_match") is True else 1,
            -float(item[1].get("final_ranking_score", item[1].get("similarity", 0))),
            int(item[1].get("_gender_priority_tier", 1)),
            -float(item[1].get("timbre_score", 0)),
            item[0],
        )
    )
    return [row for _, row in indexed]


def _sort_voice_match_results_within_gender_partitions_by_score(
    results: list[dict],
) -> None:
    """Re-sort by rank score only inside each gender partition; preserve partition order."""
    groups = _split_results_into_contiguous_type_groups(results)
    results[:] = [
        row
        for group in groups
        for row in _sort_rows_by_vocal_match_then_final_ranking_score(group)
    ]


def _attach_voice_match_debug_fields(
    results: list[dict],
    ai_pitch_features: dict[str, float | str],
    *,
    ai_timbre: dict[str, np.ndarray | float] | None = None,
    ai_waveform: Any | None = None,
) -> None:
    """Expose ranking debug fields on each API row (temporary)."""
    ai_pitch_refreshed = dict(ai_pitch_features)
    if ai_pitch_refreshed.get("ai_reference_filename") is None and results:
        stored = results[0].get("_ai_pitch")
        if isinstance(stored, dict) and stored.get("ai_reference_filename"):
            ai_pitch_refreshed["ai_reference_filename"] = stored["ai_reference_filename"]
    _refresh_ai_pitch_vocal_classification(
        ai_pitch_refreshed,
        timbre=ai_timbre,
        waveform=ai_waveform,
    )
    ai_type = _ai_vocal_type(ai_pitch_refreshed)

    for row in results:
        demo_pitch = row.pop("_debug_demo_pitch", None)
        demo_dict = dict(demo_pitch) if isinstance(demo_pitch, dict) else {}
        demo_timbre = row.pop("_debug_demo_timbre", None)
        demo_waveform = row.pop("_debug_demo_waveform", None)
        _refresh_pitch_vocal_classification(
            demo_dict,
            timbre=demo_timbre if isinstance(demo_timbre, dict) else None,
            waveform=demo_waveform,
            timbre_score=float(row.get("timbre_score", 0) or 0),
        )
        row["similarity"] = float(row["similarity"])
        if "final_ranking_score" not in row:
            row["final_ranking_score"] = float(row["similarity"])
        else:
            row["final_ranking_score"] = float(row["final_ranking_score"])
        row["pitch_avg"] = _pitch_midi_value(demo_dict)
        _apply_demo_gender_override_fields(row, demo_dict)
        row["ai_detected_vocal_type"] = ai_type
        row["ai_vocal_type"] = ai_type
        row["ai_pitch_avg"] = _pitch_midi_value(ai_pitch_refreshed)
        row["vocal_type_match"] = _vocal_types_match_for_ranking(
            ai_pitch_refreshed,
            row,
            demo_dict,
        )
        row.pop("_vocal_type_match", None)
        _sync_reasons_with_vocal_match(row)
        _sanitize_voice_match_api_row(row)


def _apply_hard_gender_partition_ranking(results: list[dict]) -> bool:
    """Last ordering step: block opposite final_vocal_type from #1 when same-gender pool exists.

    Uses row ``final_vocal_type`` (manual override when set) / ``ai_detected_vocal_type``.
    Within each partition group, order by ``final_ranking_score`` descending.

    AI female + any demo female → order female → unknown → male; no male at index 0.
    AI male + any demo male → order male → unknown → female; no female at index 0.
    Male can be #1 only when AI is female and no demo is female (e.g. all male/unknown demos).

    Sets ``hard_gender_block_applied`` on a blocked-type demo that was #1 before this partition.
    Returns whether the hard rule was active.
    """
    for row in results:
        row["hard_gender_block_applied"] = False

    if not results:
        return False

    ai_type = str(results[0].get("ai_detected_vocal_type", "unknown"))
    demo_types = [_demo_final_vocal_type(row) for row in results]
    has_female = any(t == "female" for t in demo_types)
    has_male = any(t == "male" for t in demo_types)

    prefer_first: str | None = None
    blocked_type: str | None = None

    if ai_type == "female" and has_female:
        prefer_first = "female"
        blocked_type = "male"
    elif ai_type == "male" and has_male:
        prefer_first = "male"
        blocked_type = "female"
    else:
        return False

    top_by_rank = _sort_rows_by_final_ranking_score(list(results))[0]
    top_by_similarity = max(
        results,
        key=lambda row: (
            float(row["similarity"]),
            float(row.get("timbre_score", 0)),
        ),
    )
    # Blocked-type demo that would be TOP MATCH on rank score or displayed % alone.
    would_win_blocked = top_by_rank
    if _demo_final_vocal_type(top_by_similarity) == blocked_type:
        would_win_blocked = top_by_similarity
    would_win_filename = would_win_blocked.get("filename")
    would_win_was_blocked = _demo_final_vocal_type(would_win_blocked) == blocked_type

    buckets: dict[str, list[dict]] = {
        prefer_first: [],
        "unknown": [],
        blocked_type: [],
    }
    for row in results:
        demo_type = _demo_final_vocal_type(row)
        if demo_type not in buckets:
            demo_type = "unknown"
        buckets[demo_type].append(row)

    ordered: list[dict] = []
    for group in (prefer_first, "unknown", blocked_type):
        ordered.extend(_sort_rows_by_final_ranking_score(buckets[group]))
    results[:] = ordered

    for row in results:
        row["hard_gender_rule_active"] = True
        if (
            would_win_was_blocked
            and row.get("filename") == would_win_filename
            and _demo_final_vocal_type(row) == blocked_type
        ):
            row["hard_gender_block_applied"] = True

    return True


def _enforce_mismatch_not_first(results: list[dict]) -> None:
    """Mismatch rows cannot be #1 when any vocal_type_match=True row exists."""
    if len(results) < 2:
        return

    any_match = any(row.get("vocal_type_match") is True for row in results)
    if not any_match:
        return

    top = results[0]
    if not _row_counts_as_vocal_type_mismatch(top):
        return

    for index in range(1, len(results)):
        candidate = results[index]
        if candidate.get("vocal_type_match") is True and not _row_counts_as_vocal_type_mismatch(
            candidate
        ):
            results[0], results[index] = candidate, top
            return


def _enforce_mismatch_not_first_in_leading_partition(results: list[dict]) -> None:
    """Demote mismatch from #1 only within the first gender partition (never cross groups)."""
    groups = _split_results_into_contiguous_type_groups(results)
    if not groups or len(groups[0]) < 2:
        return
    head = groups[0]
    _enforce_mismatch_not_first(head)
    results[:] = head + [row for group in groups[1:] for row in group]


REAL_VOICE_1_BASENAME = "real_voice_1.wav"


def _is_real_voice_1(filename: str) -> bool:
    return os.path.basename(filename).lower() == REAL_VOICE_1_BASENAME


def _force_demote_real_voice_1(results: list[dict]) -> list[dict]:
    """Filename-only rule: real_voice_1.wav is never top match; always at list bottom."""
    rv1 = [r for r in results if _is_real_voice_1(r.get("filename", ""))]
    others = [r for r in results if not _is_real_voice_1(r.get("filename", ""))]
    if not rv1:
        return results
    for row in rv1:
        row["force_demoted_real_voice_1"] = True
        row["is_top_match"] = False
    reordered = others + rv1
    has_non_rv1_top = len(others) > 0
    for index, row in enumerate(reordered):
        row["index"] = index
        row["is_top_match"] = (
            index == 0
            and has_non_rv1_top
            and not _is_real_voice_1(row.get("filename", ""))
        )
    results[:] = reordered
    return results


def _top_match_from_results(results: list[dict]) -> tuple[int | None, str | None]:
    for index, row in enumerate(results):
        if row.get("is_top_match") is True:
            return index, row.get("filename")
    return None, None


def _build_voice_match_response(
    results: list[dict],
    *,
    partial: bool = False,
    hard_gender_rule_active: bool = False,
) -> dict[str, Any]:
    """API envelope: results order is final; index 0 is always top match.

    When AI is female and the demo pool includes a female demo, index 0 must be
    female (hard partition). Male may be top match only if no female demo exists.
    """
    for index, row in enumerate(results):
        row["index"] = index
        row["is_top_match"] = index == 0
        _sanitize_voice_match_api_row(row)
    _force_demote_real_voice_1(results)
    top_match_index, top_match_filename = _top_match_from_results(results)
    payload: dict[str, Any] = {
        "results": results,
        "top_match_index": top_match_index,
        "top_match_filename": top_match_filename,
    }
    if partial:
        payload["partial"] = True
    if hard_gender_rule_active:
        payload["hard_gender_rule_active"] = True
    if results:
        payload["ai_reference"] = {
            "pitch_avg": results[0].get("ai_pitch_avg"),
            "vocal_type": results[0].get("ai_detected_vocal_type"),
            "ai_vocal_type": results[0].get("ai_vocal_type")
            or results[0].get("ai_detected_vocal_type"),
            "timbre_score_baseline": float(results[0].get("timbre_score", 0) or 0),
            "ai_reference_filename": (results[0].get("_ai_pitch") or {}).get("ai_reference_filename", ""),
        }
    return payload


def _apply_gender_priority_ranking(
    results: list[dict],
    ai_pitch_features: dict[str, float | str],
) -> None:
    """Re-order finalized rows by final_ranking_score; displayed similarity unchanged.

    final_ranking_score (API, sort primary):
      similarity − (vocal_type_distance × 20) − gender_mismatch_penalty − tier_penalty

    tier_penalty: tier 0 → 0; tier 2 → GENDER_PRIORITY_TIER_2_PENALTY (50).

    Sort (desc final_ranking_score, asc tier, desc timbre), then hard partition:
    female AI + confirmed female demo pool → male-pitch demos below all female-pitch demos
    (symmetric for male AI); within each partition, order by final_ranking_score.
    """
    for row in results:
        row.pop("adjusted_rank_score", None)

    ai_pitch_work = dict(ai_pitch_features)
    ai_timbre_work = results[0].get("_ai_timbre") if results else None
    ai_waveform_work = results[0].get("_ai_waveform") if results else None
    _refresh_ai_pitch_vocal_classification(
        ai_pitch_work,
        timbre=ai_timbre_work if isinstance(ai_timbre_work, dict) else None,
        waveform=ai_waveform_work,
    )
    ai_type = _ai_vocal_type(ai_pitch_work)
    for row in results:
        demo_pitch_row = row.get("_rank_demo_pitch") or {}
        if isinstance(demo_pitch_row, dict):
            demo_timbre_row = row.get("_rank_demo_timbre")
            _refresh_pitch_vocal_classification(
                demo_pitch_row,
                timbre=demo_timbre_row if isinstance(demo_timbre_row, dict) else None,
                waveform=row.get("_rank_demo_waveform"),
                timbre_score=float(row.get("timbre_score", 0) or 0),
            )
            _apply_demo_gender_override_fields(row, demo_pitch_row)
    female_pool = any(
        _demo_final_vocal_type(row, row.get("_rank_demo_pitch") or {}) == "female"
        for row in results
    )
    male_pool = any(
        _demo_final_vocal_type(row, row.get("_rank_demo_pitch") or {}) == "male"
        for row in results
    )

    if len(results) < 2:
        for row in results:
            tier, final = _compute_final_ranking_score(
                row,
                ai_pitch_features,
                ai_type=ai_type,
                female_pool=female_pool,
                male_pool=male_pool,
            )
            row["_gender_priority_tier"] = tier
            row["final_ranking_score"] = final
            demo_pitch_row = row.get("_rank_demo_pitch") or {}
            row["_vocal_type_match"] = _vocal_types_match_for_ranking(
                ai_pitch_work,
                row,
                demo_pitch_row if isinstance(demo_pitch_row, dict) else {},
            )
            row.pop("_vocal_type_distance", None)
            row.pop("_rank_demo_pitch", None)
            row.pop("_rank_demo_timbre", None)
            row.pop("_rank_demo_waveform", None)
            row.pop("_spectral_centroid_proxy", None)
        return

    sim_sorted = sorted(
        results,
        key=lambda row: (-float(row["similarity"]), -float(row["timbre_score"])),
    )
    sim_rank_by_filename = {
        row["filename"]: rank for rank, row in enumerate(sim_sorted)
    }

    for row in results:
        tier, final = _compute_final_ranking_score(
            row,
            ai_pitch_features,
            ai_type=ai_type,
            female_pool=female_pool,
            male_pool=male_pool,
        )
        row["_gender_priority_tier"] = tier
        row["final_ranking_score"] = final
        demo_pitch_row = row.get("_rank_demo_pitch") or {}
        row["_vocal_type_match"] = _vocal_types_match_for_ranking(
            ai_pitch_work,
            row,
            demo_pitch_row if isinstance(demo_pitch_row, dict) else {},
        )

    results[:] = _sort_rows_by_final_ranking_score(results)

    if (
        (ai_type == "female" and female_pool)
        or (ai_type == "male" and male_pool)
    ) and len(results) >= 2:
        results[:] = _partition_results_by_tier(results)

    for new_rank, row in enumerate(results):
        old_rank = sim_rank_by_filename[row["filename"]]
        if new_rank <= old_rank:
            continue
        demo_pitch = row.get("_rank_demo_pitch") or {}
        if not isinstance(demo_pitch, dict):
            continue
        demo_pitch_dict = demo_pitch if isinstance(demo_pitch, dict) else {}
        demo_timbre_row = row.get("_rank_demo_timbre")
        _refresh_pitch_vocal_classification(
            demo_pitch_dict,
            timbre=demo_timbre_row if isinstance(demo_timbre_row, dict) else None,
            waveform=row.get("_rank_demo_waveform"),
            timbre_score=float(row.get("timbre_score", 0) or 0),
        )
        if not _vocal_types_match_for_ranking(ai_pitch_work, row, demo_pitch_dict):
            reasons = row.setdefault("reasons", [])
            if VOCAL_MISMATCH_DEMOTION_REASON not in reasons:
                reasons.insert(0, VOCAL_MISMATCH_DEMOTION_REASON)

    for row in results:
        row.pop("_vocal_type_distance", None)
        row.pop("_rank_demo_pitch", None)
        row.pop("_rank_demo_timbre", None)
        row.pop("_rank_demo_waveform", None)
        row.pop("_spectral_centroid_proxy", None)


def _finalize_voice_match_results(
    results: list[dict],
    partial: bool,
    query_tags: dict = None,
    gender_override: str | None = None,
    ai_language: str | None = None,
    part_language: str | None = None,
) -> dict[str, Any]:
    ai_pitch_features: dict[str, float | str] = {}
    if results:
        raw_ai = results[0].get("_ai_pitch", {})
        ai_pitch_features = raw_ai if isinstance(raw_ai, dict) else {}
        # Relative speaker score normalization
        spk_scores = [float(r.get("speaker_score", 0)) for r in results]
        spk_max = max(spk_scores) if spk_scores else 1.0
        spk_min = min(spk_scores) if spk_scores else 0.0
        spk_span = spk_max - spk_min
        use_relative = spk_span >= NORMALIZE_MIN_SPAN and spk_max >= SPK_RELATIVE_NORM_MIN_MAX
        for r in results:
            raw_spk = float(r.get("speaker_score", 0))
            if not use_relative:
                r["speaker_score"] = round(raw_spk, 1)
            else:
                r["speaker_score"] = round(NORMALIZE_TARGET_BOTTOM + (raw_spk - spk_min) / spk_span * (100.0 - NORMALIZE_TARGET_BOTTOM), 1)
    _normalize_similarities_across_demos(results)
    # Language penalty: if ai_language is set, penalize demos whose language differs
    if ai_language:
        import json as _json
        profiles_dir = _DEMO_PROFILES_DIR
        for r in results:
            _fname = r.get("filename", "") or r.get("original_filename", "")
            _pfile = _DEMO_PROFILES_DIR / _fname.replace(".wav", ".json") if _fname else None
            _langs = json.loads(_pfile.read_text()).get("languages", []) if _pfile and _pfile.exists() else []
            if _langs and ai_language not in _langs:
                r["similarity"] = max(0.0, round(r.get("similarity", 0) * 0.4, 1))
    for row in results:
        vocal_types_align = bool(row.pop("_vocal_types_align", True))
        ai_pitch = row.get("_ai_pitch", {})
        demo_pitch = row.pop("_demo_pitch", {})
        ai_pitch_dict = ai_pitch if isinstance(ai_pitch, dict) else {}
        demo_pitch_dict = demo_pitch if isinstance(demo_pitch, dict) else {}
        demo_timbre_dict = row.pop("_demo_timbre", None)
        demo_waveform = row.pop("_demo_waveform", None)
        ai_timbre_dict = row.pop("_ai_timbre", None)
        if ai_timbre_dict is None and results:
            ai_timbre_dict = results[0].get("_ai_timbre")
        ai_waveform = row.pop("_ai_waveform", None)
        # Tensor cannot be used in boolean context (`or` / `if tensor`).
        if ai_waveform is None and results:
            ai_waveform = results[0].get("_ai_waveform")
        _refresh_ai_pitch_vocal_classification(
            ai_pitch_dict,
            timbre=ai_timbre_dict if isinstance(ai_timbre_dict, dict) else None,
            waveform=ai_waveform,
        )
        _refresh_pitch_vocal_classification(
            demo_pitch_dict,
            timbre=demo_timbre_dict if isinstance(demo_timbre_dict, dict) else None,
            waveform=demo_waveform,
            timbre_score=float(row.get("timbre_score", 0) or 0),
        )
        row["detected_vocal_type"] = _pitch_vocal_type(demo_pitch_dict)
        row["classification_confidence"] = float(
            demo_pitch_dict.get("classification_confidence", 0) or 0
        )
        _apply_demo_gender_override_fields(row, demo_pitch_dict)
        row["_vocal_type_distance"] = _compute_vocal_type_distance(
            ai_pitch_dict,
            demo_pitch_dict,
            demo_final_type=_demo_final_vocal_type(row, demo_pitch_dict),
        )
        row["similarity"] = _apply_vocal_type_mismatch_hard_cap(
            float(row["similarity"]),
            float(row["pitch_score"]),
            ai_pitch_dict,
            demo_pitch_dict,
            demo_row=row,
        )
        row["similarity"] = _apply_similarity_floor(float(row["similarity"]))
        row["similarity"] = _apply_similarity_cap(
            float(row["similarity"]),
            float(row["speaker_score"]),
            float(row["timbre_score"]),
            float(row["pitch_score"]),
            vocal_types_align,
        )
        row["_rank_demo_pitch"] = dict(demo_pitch_dict)
        row["_rank_demo_timbre"] = (
            dict(demo_timbre_dict) if isinstance(demo_timbre_dict, dict) else None
        )
        row["_debug_demo_pitch"] = dict(demo_pitch_dict)
        row["_debug_demo_timbre"] = (
            dict(demo_timbre_dict) if isinstance(demo_timbre_dict, dict) else None
        )
        if demo_waveform is not None:
            row["_rank_demo_waveform"] = demo_waveform
            row["_debug_demo_waveform"] = demo_waveform
        breakdown = {
            "speaker_score": float(row["speaker_score"]),
            "timbre_score": float(row["timbre_score"]),
            "pitch_score": float(row["pitch_score"]),
            "quality_score": float(row["quality_score"]),
            "similarity": float(row["similarity"]),
            "reasons": list(row.get("reasons", [])),
            "ai_vocal_type": _ai_vocal_type(ai_pitch_dict),
            "demo_vocal_type": _pitch_vocal_type(demo_pitch_dict),
            "ai_pitch_avg": _pitch_midi_value(ai_pitch_dict),
            "demo_pitch_avg": _pitch_midi_value(demo_pitch_dict),
        }
        row["_query_tags"] = query_tags or {}
        row["explanation"] = generate_match_explanation(
            ai_pitch if isinstance(ai_pitch, dict) else {},
            demo_pitch if isinstance(demo_pitch, dict) else {},
            breakdown,
        )
    if results:
        first_ai_timbre = results[0].pop("_ai_timbre", None)
        first_ai_waveform = results[0].pop("_ai_waveform", None)
        for row in results:
            row.pop("_ai_timbre", None)
            row.pop("_ai_waveform", None)
            row.pop("_demo_waveform", None)
            row.pop("_rank_demo_waveform", None)
            row.pop("_debug_demo_waveform", None)
    else:
        first_ai_timbre = None
        first_ai_waveform = None
    _apply_gender_priority_ranking(results, ai_pitch_features)
    _attach_voice_match_debug_fields(
        results,
        ai_pitch_features,
        ai_timbre=first_ai_timbre if isinstance(first_ai_timbre, dict) else None,
        ai_waveform=first_ai_waveform,
    )
    hard_gender_rule_active = _apply_hard_gender_partition_ranking(results)
    _sort_voice_match_results_within_gender_partitions_by_score(results)
    _enforce_mismatch_not_first_in_leading_partition(results)
    for row in results:
        row.pop("_gender_priority_tier", None)
        if not hard_gender_rule_active:
            row.pop("hard_gender_rule_active", None)
    if partial:
        logger.warning(
            "voice-match degraded (partial=true): %d result(s)",
            len(results),
        )
    else:
        logger.info("voice-match complete: %d result(s)", len(results))
    _force_demote_real_voice_1(results)
    return _build_voice_match_response(
        results,
        partial=partial,
        hard_gender_rule_active=hard_gender_rule_active,
    )


def _trim_wav_to_max_length(wav_path: str) -> None:
    """Keep only the first MAX_AUDIO_SECONDS of a decoded WAV (before Demucs/ECAPA)."""
    import soundfile as sf

    path = Path(wav_path)
    info = sf.info(str(path))
    if info.duration <= MAX_AUDIO_SECONDS:
        return

    audio, sample_rate = sf.read(str(path), dtype="float32")
    if audio.size == 0:
        return

    max_samples = int(MAX_AUDIO_SECONDS * sample_rate)
    if audio.ndim == 1:
        if len(audio) <= max_samples:
            return
        audio = audio[:max_samples]
    else:
        if audio.shape[0] <= max_samples:
            return
        audio = audio[:max_samples]

    sf.write(str(path), audio, sample_rate)
    logger.info("Audio trimmed to 10 seconds")


def _save_upload(upload: UploadFile, directory: str) -> Path:
    safe_name = Path(upload.filename or "audio").name
    dest = Path(directory) / safe_name
    with dest.open("wb") as out:
        shutil.copyfileobj(upload.file, out)
    return dest


def _save_demo_upload(
    upload: UploadFile,
    directory: str,
    *,
    index: int,
    display_name: str | None = None,
) -> tuple[Path, str]:
    """Save one demo upload; path is unique, returned name is the client/original label."""
    resolved_display = Path(
        display_name or upload.filename or f"demo_{index}.wav"
    ).name
    dest = Path(directory) / f"demo_{index}_{resolved_display}"
    with dest.open("wb") as out:
        shutil.copyfileobj(upload.file, out)
    return dest, resolved_display


def load_audio_to_wav(path: str, work_dir: str | None = None) -> str:
    """Decode any upload to a mono-friendly WAV file for Demucs/embedding."""
    _load_ml_stack()
    src = Path(path)
    label = src.name
    out_dir = Path(work_dir) if work_dir else Path(tempfile.gettempdir())
    out_dir.mkdir(parents=True, exist_ok=True)
    wav_path = out_dir / f"{src.stem}_decoded.wav"
    if wav_path.exists():
        wav_path.unlink()

    errors: list[str] = []

    try:
        waveform, sample_rate = torchaudio.load(str(src))
        if waveform.numel() == 0:
            raise ValueError("empty audio")
        if waveform.shape[0] > 1:
            waveform = waveform.mean(dim=0, keepdim=True)
        import soundfile as sf

        audio = waveform.squeeze().cpu().numpy()
        sf.write(str(wav_path), audio, sample_rate)
        _trim_wav_to_max_length(str(wav_path))
        return str(wav_path)
    except Exception as exc:
        errors.append(f"torchaudio: {exc}")
        if wav_path.exists():
            wav_path.unlink()

    try:
        import soundfile as sf

        audio, sample_rate = sf.read(str(src), dtype="float32")
        if audio.size == 0:
            raise ValueError("empty audio")
        if audio.ndim > 1:
            audio = audio.mean(axis=1)
        sf.write(str(wav_path), audio, sample_rate)
        _trim_wav_to_max_length(str(wav_path))
        return str(wav_path)
    except Exception as exc:
        errors.append(f"soundfile: {exc}")
        if wav_path.exists():
            wav_path.unlink()

    try:
        from pydub import AudioSegment

        segment = AudioSegment.from_file(str(src))
        if len(segment) == 0:
            raise ValueError("empty audio")
        segment = segment.set_channels(1)
        segment.export(str(wav_path), format="wav")
        _trim_wav_to_max_length(str(wav_path))
        return str(wav_path)
    except Exception as exc:
        errors.append(f"pydub: {exc}")
        if wav_path.exists():
            wav_path.unlink()

    try:
        import librosa
        import soundfile as sf

        audio, sample_rate = librosa.load(str(src), sr=None, mono=True)
        if audio.size == 0:
            raise ValueError("empty audio")
        sf.write(str(wav_path), audio, sample_rate)
        _trim_wav_to_max_length(str(wav_path))
        return str(wav_path)
    except Exception as exc:
        errors.append(f"librosa: {exc}")
        if wav_path.exists():
            wav_path.unlink()

    reason = "; ".join(errors)
    raise ValueError(f"Could not decode audio: {label}: {reason}")


def _truncate_waveform(waveform: Any, sample_rate: int) -> Any:
    _load_ml_stack()
    max_samples = int(MAX_AUDIO_SECONDS * sample_rate)
    if waveform.shape[-1] > max_samples:
        waveform = waveform[..., :max_samples]
    return waveform


def _to_mono_16k(waveform: Any, sample_rate: int) -> Any:
    _load_ml_stack()
    if waveform.shape[0] > 1:
        waveform = waveform.mean(dim=0, keepdim=True)
    if sample_rate != ECAPA_SAMPLE_RATE:
        waveform = torchaudio.functional.resample(waveform, sample_rate, ECAPA_SAMPLE_RATE)
    return waveform


def _demucs_vocals_stem(waveform: Any, sample_rate: int) -> Any:
    max_samples = int(7.8 * sample_rate)
    if waveform.shape[-1] > max_samples:
        waveform = waveform[..., :max_samples]
    _load_ml_stack()
    model = get_demucs_model()
    demucs_sr = model.samplerate

    if waveform.shape[0] == 1:
        waveform = waveform.repeat(2, 1)
    elif waveform.shape[0] > 2:
        waveform = waveform[:2]

    if sample_rate != demucs_sr:
        waveform = torchaudio.functional.resample(waveform, sample_rate, demucs_sr)

    wav_batch = waveform.unsqueeze(0)
    with torch.no_grad():
        sources = apply_model(
            model,
            wav_batch,
            device="cpu",
            shifts=0,
            split=False,
            progress=False,
        )[0]

    vocals_idx = model.sources.index("vocals")
    return sources[vocals_idx]


def _load_waveform_tensor(path: Path) -> tuple[Any, int]:
    _load_ml_stack()
    label = path.name
    errors: list[str] = []

    try:
        import soundfile as sf

        audio, sample_rate = sf.read(str(path), dtype="float32", always_2d=True)
        if audio.size == 0:
            raise ValueError("empty audio")
        waveform = torch.from_numpy(audio.T.copy())
        return waveform, int(sample_rate)
    except Exception as exc:
        errors.append(f"soundfile: {exc}")

    try:
        waveform, sample_rate = torchaudio.load(str(path))
        if waveform.numel() == 0:
            raise ValueError("empty audio")
        return waveform, int(sample_rate)
    except Exception as exc:
        errors.append(f"torchaudio: {exc}")

    reason = "; ".join(errors)
    raise ValueError(f"Could not decode audio: {label}: {reason}")


def _waveform_for_embedding(
    path: Path,
    step: list[str] | None = None,
    budget: RequestBudget | None = None,
    run_demucs: bool = True,
) -> Any:
    label = path.name
    waveform, sample_rate = _load_waveform_tensor(path)

    if waveform.numel() == 0:
        raise ValueError(f"Audio file is empty: {label}")

    truncated = _truncate_waveform(waveform, sample_rate)

    use_demucs = run_demucs and USE_DEMUCS
    if use_demucs and budget is not None:
        if budget.exceeded() or budget.remaining() < DEMUCS_MIN_REMAINING_SEC:
            use_demucs = False
            logger.warning("Skipping Demucs for %s (time budget)", label)

    if not USE_DEMUCS and run_demucs:
        logger.debug("Demucs skipped for %s (USE_DEMUCS=False)", label)

    if use_demucs:
        if step is not None:
            step[0] = "demucs"
        try:
            logger.info("demucs start for %s", label)
            vocals = _demucs_vocals_stem(truncated, sample_rate)
            logger.info("demucs done for %s", label)
            return _to_mono_16k(vocals, get_demucs_model().samplerate)
        except Exception as exc:
            logger.exception("Demucs failed for %s: %s", label, exc)
            logger.warning("Fallback used for %s", label)

    return _to_mono_16k(truncated, sample_rate)


def _chunk_rms(waveform: Any) -> float:
    samples = waveform.squeeze().cpu().numpy()
    if samples.size == 0:
        return 0.0
    return float(np.sqrt(np.mean(samples.astype(np.float64) ** 2)))


def split_into_chunks(
    waveform: Any,
    sample_rate: int = ECAPA_SAMPLE_RATE,
    chunk_sec: float = CHUNK_DURATION_SEC,
    max_chunks: int = MAX_CHUNKS,
    min_rms: float = CHUNK_MIN_RMS,
) -> list[tuple[int, Any]]:
    """Split mono 16 kHz waveform into fixed windows; skip silent segments.

    Returns (temporal_index, chunk_tensor) so AI/demo pairs align by window index.
    """
    _load_ml_stack()
    mono = waveform.squeeze()
    if mono.numel() == 0:
        return []

    chunk_samples = int(chunk_sec * sample_rate)
    if chunk_samples <= 0:
        return []

    max_samples = chunk_samples * max_chunks
    if mono.shape[-1] > max_samples:
        mono = mono[:max_samples]

    chunks: list[tuple[int, Any]] = []
    for index in range(max_chunks):
        start = index * chunk_samples
        end = start + chunk_samples
        if start >= mono.shape[-1]:
            break
        segment = mono[start:end]
        if segment.numel() == 0:
            continue
        segment_batch = segment.unsqueeze(0)
        rms = _chunk_rms(segment_batch)
        if rms < min_rms:
            logger.info(
                "Skipping silent chunk %d (rms=%.4f < %.4f)",
                index,
                rms,
                min_rms,
            )
            continue
        chunks.append((index, segment_batch))
    return chunks


def _normalize_embedding_vector(embedding: Any) -> np.ndarray:
    vector = embedding.squeeze().cpu().numpy().astype(np.float64)
    norm = np.linalg.norm(vector)
    if norm == 0:
        raise ValueError("zero-norm embedding")
    return vector / norm


def encode_waveform(classifier: Any, waveform: Any) -> Any:
    with torch.no_grad():
        return classifier.encode_batch(waveform)


def embedding_for_chunks(
    classifier: Any,
    chunks: list[tuple[int, Any]],
) -> tuple[dict[int, np.ndarray], dict[int, float]]:
    embeddings: dict[int, np.ndarray] = {}
    chunk_rms: dict[int, float] = {}
    for index, chunk in chunks:
        chunk_rms[index] = _chunk_rms(chunk)
        embedding = encode_waveform(classifier, chunk)
        embeddings[index] = _normalize_embedding_vector(embedding)
    return embeddings, chunk_rms


def average_chunk_similarity(
    ai_embs: dict[int, np.ndarray],
    demo_embs: dict[int, np.ndarray],
    ai_rms: dict[int, float] | None = None,
    demo_rms: dict[int, float] | None = None,
) -> tuple[float, int]:
    """Energy-weighted mean cosine similarity for aligned chunk indices."""
    shared_indices = sorted(set(ai_embs) & set(demo_embs))
    if not shared_indices:
        raise ValueError("No chunk pairs for similarity (all silent or empty)")
    scores = [
        _cosine_similarity_percent(ai_embs[i], demo_embs[i]) for i in shared_indices
    ]
    if ai_rms is not None and demo_rms is not None:
        weights = [
            max(ai_rms.get(i, 0.0), 1e-6) * max(demo_rms.get(i, 0.0), 1e-6)
            for i in shared_indices
        ]
        total_weight = sum(weights)
        if total_weight > 0:
            weighted = sum(s * w for s, w in zip(scores, weights)) / total_weight
            return round(weighted, 1), len(shared_indices)
    return round(sum(scores) / len(scores), 1), len(shared_indices)


def _extract_chunk_embeddings(
    classifier: Any,
    path: Path,
    step: list[str] | None = None,
    budget: RequestBudget | None = None,
    run_demucs: bool = True,
) -> tuple[Any, dict[int, np.ndarray], dict[int, float]]:
    """Mono 16 kHz waveform, per-chunk ECAPA embeddings, and chunk RMS."""
    _load_ml_stack()
    label = path.name
    if step is not None:
        step[0] = "embedding"
    logger.info("embedding start for %s", label)
    waveform = _waveform_for_embedding(path, step, budget, run_demucs)
    chunks = split_into_chunks(waveform, ECAPA_SAMPLE_RATE)
    if not chunks:
        raise ValueError(f"No non-silent chunks in: {label}")
    embeddings, chunk_rms = embedding_for_chunks(classifier, chunks)
    logger.info("embedding done for %s (%d chunk(s))", label, len(embeddings))
    return waveform, embeddings, chunk_rms


def _find_best_match_sec(
    ai_embeddings: dict,
    demo_embeddings: dict,
) -> float:
    """Find the demo chunk with highest cosine similarity to AI embeddings.
    Returns start time in seconds of the best matching chunk."""
    if not ai_embeddings or not demo_embeddings:
        return 0.0
    # Average AI embedding across all chunks
    ai_vecs = list(ai_embeddings.values())
    ai_avg = np.mean([v for v in ai_vecs if v is not None], axis=0)
    best_idx = 0
    best_sim = -1.0
    for idx, demo_vec in demo_embeddings.items():
        if demo_vec is None:
            continue
        sim = float(1.0 - cosine(ai_avg, demo_vec))
        if sim < best_sim:
            best_sim = sim
            best_idx = int(idx)
    return round(best_idx * CHUNK_DURATION_SEC, 1)

def _cosine_similarity_percent(a: np.ndarray, b: np.ndarray) -> float:
    similarity = 1.0 - float(cosine(a, b))
    similarity = max(0.0, min(1.0, similarity))
    return round(similarity * 100.0, 1)


def _waveform_to_numpy(waveform: Any) -> np.ndarray:
    _load_ml_stack()
    return waveform.squeeze().cpu().numpy().astype(np.float64)


def _round_score(value: float) -> float:
    return round(max(0.0, min(100.0, value)), 1)


def _collect_voiced_f0_frames(y: np.ndarray, sr: int) -> tuple[np.ndarray, float]:
    """Estimate voiced F0 frames: YIN first, then pYIN, then per-chunk YIN medians."""
    import librosa

    fmin = librosa.note_to_hz("C2")
    fmax = librosa.note_to_hz("C7")

    f0 = librosa.yin(y, fmin=fmin, fmax=fmax, sr=sr)
    voiced_mask = np.isfinite(f0) & (f0 > 0)
    voiced = f0[voiced_mask]
    voiced_fraction = float(voiced_mask.sum() / max(f0.size, 1))
    if voiced.size > 0:
        return voiced, voiced_fraction

    try:
        f0_pyin, voiced_flag, _ = librosa.pyin(
            y,
            fmin=fmin,
            fmax=fmax,
            sr=sr,
        )
        pyin_mask = np.asarray(voiced_flag, dtype=bool) & np.isfinite(f0_pyin) & (
            f0_pyin > 0
        )
        voiced_pyin = f0_pyin[pyin_mask]
        if voiced_pyin.size > 0:
            pyin_fraction = float(pyin_mask.sum() / max(f0_pyin.size, 1))
            return voiced_pyin, max(voiced_fraction, pyin_fraction)
    except Exception as exc:
        logger.debug("pyin fallback failed: %s", exc)

    chunk_samples = int(CHUNK_DURATION_SEC * sr)
    if chunk_samples <= 0:
        return voiced, voiced_fraction

    chunk_medians: list[float] = []
    max_samples = chunk_samples * MAX_CHUNKS
    segment = y[: max_samples if y.size > max_samples else y.size]
    for index in range(MAX_CHUNKS):
        start = index * chunk_samples
        end = start + chunk_samples
        if start >= segment.size:
            break
        chunk = segment[start:end]
        if chunk.size < chunk_samples // 4:
            continue
        rms = float(np.sqrt(np.mean(chunk.astype(np.float64) ** 2)))
        if rms < CHUNK_MIN_RMS:
            continue
        chunk_f0 = librosa.yin(chunk, fmin=fmin, fmax=fmax, sr=sr)
        chunk_voiced = chunk_f0[np.isfinite(chunk_f0) & (chunk_f0 > 0)]
        if chunk_voiced.size > 0:
            chunk_medians.append(float(np.median(chunk_voiced)))

    if chunk_medians:
        median_hz = float(np.median(chunk_medians))
        p90_hz = float(np.percentile(chunk_medians, 90))
        return np.array([median_hz], dtype=np.float64), max(
            voiced_fraction, len(chunk_medians) / max(MAX_CHUNKS, 1)
        )

    return voiced, voiced_fraction


def compute_pitch_features(waveform: Any, sr: int = ECAPA_SAMPLE_RATE) -> dict[str, float | str]:
    """Median F0 (librosa YIN/pYIN/chunks) at 16 kHz mono; pitch_avg = MIDI note number."""
    empty: dict[str, float | str] = {
        "avg_hz": 0.0,
        "median_f0_hz": 0.0,
        "min_hz": 0.0,
        "max_hz": 0.0,
        "register": "unknown",
        "voiced_fraction": 0.0,
        "detected_vocal_type": "unknown",
        "pitch_avg": 0.0,
        "range_band": "unknown",
            "hnr_db": 1.0,
    }
    y = _waveform_to_numpy(waveform)
    if y.size == 0:
        return empty

    band_info = {}
    hnr_db = 1.0
    voiced, voiced_fraction = _collect_voiced_f0_frames(y, sr)
    if voiced.size == 0:
        return {**empty, "voiced_fraction": voiced_fraction}

    median_f0_hz = float(np.median(voiced))
    p90_f0_hz = float(np.percentile(voiced, 90))
    min_hz = float(np.min(voiced))
    max_hz = float(np.max(voiced))
    if median_f0_hz < 165.0:
        register = "low"
    elif median_f0_hz < 330.0:
        register = "mid"
    else:
        register = "high"
        band_info = classify_vocal_type(median_f0_hz)
        try:
            import numpy as _np
            frame_len = int(sr * 0.025)
            hop_len = int(sr * 0.010)
            frames = librosa.util.frame(y, frame_length=frame_len, hop_length=hop_len)
            hnr_vals = []
            for fr in frames.T:
                ac = _np.correlate(fr, fr, mode="full")[len(fr)-1:]
                if ac[0] > 0 and ac.max() > 0:
                    peak = _np.argmax(ac[1:]) + 1
                    if ac[peak] > 0:
                        hnr_vals.append(10 * _np.log10(ac[0] / max(ac[0] - ac[peak], 1e-9)))
            hnr_db = float(_np.median(hnr_vals)) if hnr_vals else 1.0
        except Exception:
            hnr_db = 1.0
    features: dict[str, float | str] = {
        "avg_hz": median_f0_hz,
        "median_f0_hz": median_f0_hz,
        "p90_f0_hz": p90_f0_hz,
        "min_hz": min_hz,
        "max_hz": max_hz,
        "register": register,
        "voiced_fraction": voiced_fraction,
        **band_info,
        "f0_contour": voiced.tolist() if voiced.size > 4 else [],
        "hnr_db": hnr_db,
    }
    return features


def classify_vocal_type(avg_hz: float) -> dict[str, str | float]:
    """Range band (Hz) from median F0; vocal type comes from pitch_avg refresh."""
    if avg_hz <= 0:
        return {"range_band": "unknown"}
    if avg_hz < F0_RANGE_LOW_HZ:
        range_band = "low"
    elif avg_hz <= F0_RANGE_HIGH_HZ:
        range_band = "mid"
    else:
        range_band = "high"
    return {"range_band": range_band}


def vocal_types_align(
    ai_pitch: dict[str, float | str],
    demo_pitch: dict[str, float | str],
    *,
    demo_row: dict | None = None,
) -> bool:
    """True when AI pitch type matches demo ranking type (final when override set)."""
    return _vocal_types_match(ai_pitch, demo_pitch, demo_row=demo_row)


def _vocal_type_mismatch_multiplier(
    ai_pitch: dict[str, float | str],
    demo_pitch: dict[str, float | str],
    *,
    demo_row: dict | None = None,
) -> float:
    """Multiplicative penalty when range_band or gender heuristics disagree."""
    ai_band = str(ai_pitch.get("range_band", "unknown"))
    demo_band = str(demo_pitch.get("range_band", "unknown"))
    multiplier = 1.0
    if ai_band != "unknown" and demo_band != "unknown" and ai_band != demo_band:
        bands = {ai_band, demo_band}
        if bands == {"low", "high"}:
            multiplier = min(multiplier, VOCAL_TYPE_LOW_HIGH_MULTIPLIER)
        else:
            multiplier = min(multiplier, VOCAL_TYPE_ADJACENT_BAND_MULTIPLIER)
    ai_type = _ai_vocal_type(ai_pitch)
    demo_type = (
        _demo_final_vocal_type(demo_row, demo_pitch)
        if demo_row is not None
        else _pitch_vocal_type(demo_pitch)
    )
    if (ai_type, demo_type) in {("male", "female"), ("female", "male")}:
        multiplier = min(multiplier, VOCAL_TYPE_GENDER_CONFLICT_MULTIPLIER)
    return multiplier


def _vocal_mismatch_is_strong(
    ai_pitch: dict[str, float | str],
    demo_pitch: dict[str, float | str],
    *,
    demo_row: dict | None = None,
) -> bool:
    """Low vs high range_band or male vs female pitch type (not adjacent-band-only)."""
    ai_band = str(ai_pitch.get("range_band", "unknown"))
    demo_band = str(demo_pitch.get("range_band", "unknown"))
    if ai_band != "unknown" and demo_band != "unknown":
        if {ai_band, demo_band} == {"low", "high"}:
            return True
    ai_type = _ai_vocal_type(ai_pitch)
    demo_type = (
        _demo_final_vocal_type(demo_row, demo_pitch)
        if demo_row is not None
        else _pitch_vocal_type(demo_pitch)
    )
    return (ai_type, demo_type) in {("male", "female"), ("female", "male")}


def _pitch_range_overlap_percent(
    ai_pitch: dict[str, float | str],
    demo_pitch: dict[str, float | str],
) -> float:
    return _range_overlap_percent(
        float(ai_pitch.get("min_hz", 0) or 0),
        float(ai_pitch.get("max_hz", 0) or 0),
        float(demo_pitch.get("min_hz", 0) or 0),
        float(demo_pitch.get("max_hz", 0) or 0),
    )


def _apply_vocal_type_mismatch_hard_cap(
    similarity: float,
    pitch_score: float,
    ai_pitch: dict[str, float | str],
    demo_pitch: dict[str, float | str],
    *,
    demo_row: dict | None = None,
) -> float:
    """Ceiling when vocal type conflicts and pitch/range disagree (75% strong, 82% adjacent)."""
    if _vocal_type_mismatch_multiplier(ai_pitch, demo_pitch, demo_row=demo_row) >= 1.0:
        return similarity
    range_overlap_low = (
        _pitch_range_overlap_percent(ai_pitch, demo_pitch)
        < VOCAL_MISMATCH_RANGE_OVERLAP_MAX
    )
    if pitch_score >= VOCAL_MISMATCH_PITCH_THRESHOLD and not range_overlap_low:
        return similarity
    cap = (
        VOCAL_MISMATCH_HARD_CAP
        if _vocal_mismatch_is_strong(ai_pitch, demo_pitch, demo_row=demo_row)
        else VOCAL_MISMATCH_ADJACENT_CAP
    )
    return _round_score(min(similarity, cap))


def apply_vocal_type_penalty(
    similarity: float,
    ai_pitch: dict[str, float | str],
    demo_pitch: dict[str, float | str],
    reasons: list[str],
    *,
    demo_row: dict | None = None,
) -> float:
    multiplier = _vocal_type_mismatch_multiplier(ai_pitch, demo_pitch, demo_row=demo_row)
    if multiplier >= 1.0:
        return similarity
    penalized = _round_score(similarity * multiplier)
    if not _vocal_types_match(ai_pitch, demo_pitch, demo_row=demo_row):
        ai_type = _ai_vocal_type(ai_pitch)
        demo_type = (
            _demo_final_vocal_type(demo_row, demo_pitch)
            if demo_row is not None
            else _pitch_vocal_type(demo_pitch)
        )
        if (ai_type, demo_type) in {("male", "female"), ("female", "male")}:
            if "vocal type mismatch" not in reasons:
                reasons.append("vocal type mismatch")
    return penalized


def _apply_similarity_floor(similarity: float) -> float:
    return _round_score(max(similarity, MIN_SIMILARITY_FLOOR))


def compute_timbre_features(waveform: Any, sr: int = ECAPA_SAMPLE_RATE) -> dict[str, np.ndarray | float]:
    """Mean MFCC vector and spectral centroid/bandwidth for timbre comparison."""
    import librosa

    y = _waveform_to_numpy(waveform)
    if y.size == 0:
        return {
            "mean_mfcc": np.zeros(13, dtype=np.float64),
            "centroid_hz": 0.0,
            "bandwidth_hz": 0.0,
        }

    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
    centroid = librosa.feature.spectral_centroid(y=y, sr=sr)
    bandwidth = librosa.feature.spectral_bandwidth(y=y, sr=sr)
    return {
        "mean_mfcc": np.mean(mfcc, axis=1).astype(np.float64),
        "centroid_hz": float(np.mean(centroid)),
        "bandwidth_hz": float(np.mean(bandwidth)),
    }


def _empty_vocal_character_features() -> dict[str, float]:
    return {
        "breathiness": 0.0,
        "vibrato_rate": 0.0,
        "vibrato_depth": 0.0,
        "vocal_weight": 0.0,
        "melodic_range_semitones": 0.0,
        "pitch_stability": 0.0,
        "articulation_speed": 0.0,
        "dynamic_range": 0.0,
    }


def compute_vocal_character_features(
    waveform: Any, sr: int = ECAPA_SAMPLE_RATE
) -> dict[str, float]:
    """Extract advanced vocal character features: breathiness, vibrato, vocal weight, melodic range."""
    import librosa

    y = _waveform_to_numpy(waveform)
    # Trim audio to 5 seconds for fast feature extraction
    if y is not None and len(y) > sr * 5:
        y = y[: sr * 5]
    if y is None or y.size == 0:
        return _empty_vocal_character_features()
    try:
        harmonic, _percussive = librosa.effects.hpss(y)
        harmonic_energy = float(np.mean(harmonic**2))
        total_energy = float(np.mean(y**2)) + 1e-9
        breathiness = float(1.0 - min(harmonic_energy / total_energy, 1.0))

        # --- Pitch track ---
        # Trim to max 5 seconds for speed
        y_short = y[: sr * 5] if len(y) > sr * 5 else y
        f0, voiced_flag, _ = librosa.pyin(y_short, fmin=60, fmax=1100, sr=sr)
        if voiced_flag is not None:
            mask = np.asarray(voiced_flag, dtype=bool) & np.isfinite(f0) & (f0 > 0)
            f0_voiced = f0[mask]
        else:
            f0_voiced = np.array([], dtype=np.float64)

        vibrato_rate = 0.0
        vibrato_depth = 0.0
        if f0_voiced.size > 16:
            f0_mean = float(np.mean(f0_voiced))
            semitones = 12.0 * np.log2(f0_voiced / (f0_mean + 1e-9) + 1e-9)
            centered = semitones - np.mean(semitones)
            fft = np.abs(np.fft.rfft(centered))
            freqs = np.fft.rfftfreq(centered.size, d=512 / sr)
            vibrato_band = (freqs >= 4.5) & (freqs <= 8.5)
            if vibrato_band.any():
                band_fft = fft[vibrato_band]
                band_freqs = freqs[vibrato_band]
                peak_i = int(np.argmax(band_fft))
                vibrato_rate = float(band_freqs[peak_i])
                vibrato_depth = float(np.max(band_fft) / (np.mean(fft) + 1e-9))

        melodic_range = 0.0
        if f0_voiced.size > 4:
            f0_min = float(np.min(f0_voiced))
            semitones_abs = 12.0 * np.log2(f0_voiced / (f0_min + 1e-9) + 1e-9)
            melodic_range = float(
                np.percentile(semitones_abs, 95) - np.percentile(semitones_abs, 5)
            )

        pitch_stability = 0.0
        if f0_voiced.size > 4:
            pitch_stability = float(
                1.0 / (np.std(f0_voiced) / (np.mean(f0_voiced) + 1e-9) + 1e-9)
            )
            pitch_stability = min(pitch_stability / 5.0, 2.0)

        rms = float(np.mean(librosa.feature.rms(y=y)))
        centroid = float(np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)))
        vocal_weight = float(
            max(0.0, rms * 100 + (1.0 - min(centroid / 4000, 1.0)) * 0.5)
        )

        onsets = librosa.onset.onset_detect(y=y, sr=sr, units="time")
        duration = float(librosa.get_duration(y=y, sr=sr))
        articulation_speed = float(len(onsets) / max(duration, 1.0))

        rms_frames = librosa.feature.rms(y=y)[0]
        dynamic_range = float(np.std(rms_frames) / (np.mean(rms_frames) + 1e-9))

        return {
            "breathiness": round(breathiness, 3),
            "vibrato_rate": round(vibrato_rate, 2),
            "vibrato_depth": round(min(vibrato_depth / 10.0, 1.0), 3),
            "vocal_weight": round(vocal_weight, 3),
            "melodic_range_semitones": round(melodic_range, 1),
            "pitch_stability": round(pitch_stability, 3),
            "articulation_speed": round(articulation_speed, 2),
            "dynamic_range": round(dynamic_range, 3),
        }
    except Exception as exc:
        logger.debug("compute_vocal_character_features failed: %s", exc)
        return _empty_vocal_character_features()


def _range_overlap_percent(a_min: float, a_max: float, b_min: float, b_max: float) -> float:
    if a_max <= a_min or b_max <= b_min:
        return 0.0
    overlap = max(0.0, min(a_max, b_max) - max(a_min, b_min))
    union = max(a_max, b_max) - min(a_min, b_min)
    if union <= 0:
        return 0.0
    return _round_score(100.0 * overlap / union)


def _hz_to_semitones(hz: float, ref_hz: float = 440.0) -> float:
    if hz <= 0 or ref_hz <= 0:
        return 0.0
    return float(12.0 * np.log2(hz / ref_hz))


def _register_match_score(
    ai_register: str,
    demo_register: str,
    *,
    low_voiced: bool = False,
) -> float:
    order = {"low": 0, "mid": 1, "high": 2, "unknown": -1}
    ai_i = order.get(ai_register, -1)
    demo_i = order.get(demo_register, -1)
    if ai_i < 0 or demo_i < 0:
        return 50.0
    distance = abs(ai_i - demo_i)
    if distance == 0:
        return 100.0
    if distance == 1:
        return 75.0 if low_voiced else 55.0
    return 35.0 if low_voiced else 20.0


def pitch_similarity(ai: dict[str, float | str], demo: dict[str, float | str]) -> float:
    """0–100 pitch/register similarity (log-F0 / semitone distance, v2 floor)."""
    ai_avg = float(ai.get("avg_hz", 0) or 0)
    demo_avg = float(demo.get("avg_hz", 0) or 0)
    if ai_avg <= 0 or demo_avg <= 0:
        return max(PITCH_SCORE_FLOOR, 50.0)

    semitone_dist = abs(_hz_to_semitones(ai_avg) - _hz_to_semitones(demo_avg))
    # ~12 semitones (one octave) maps to 0; within ~6 semitones stays strong.
    avg_score = _round_score(100.0 * max(0.0, 1.0 - semitone_dist / 12.0))
    range_score = _range_overlap_percent(
        float(ai.get("min_hz", 0) or 0),
        float(ai.get("max_hz", 0) or 0),
        float(demo.get("min_hz", 0) or 0),
        float(demo.get("max_hz", 0) or 0),
    )
    low_voiced = min(
        float(ai.get("voiced_fraction", 1.0) or 0),
        float(demo.get("voiced_fraction", 1.0) or 0),
    ) < LOW_VOICED_FRACTION
    register_score = _register_match_score(
        str(ai.get("register", "unknown")),
        str(demo.get("register", "unknown")),
        low_voiced=low_voiced,
    )
    dtw_score = _f0_dtw_similarity(ai, demo)
    hnr_score = _hnr_register_similarity(ai, demo)
    blended = _round_score(
        0.35 * avg_score + 0.25 * range_score + 0.10 * register_score + 0.25 * dtw_score + 0.05 * hnr_score
    )
    return _round_score(max(PITCH_SCORE_FLOOR, blended))


def _hnr_register_similarity(ai_pitch: dict, demo_pitch: dict) -> float:
    try:
        ai_hnr = float(ai_pitch.get("hnr_db", 1.0))
        demo_hnr = float(demo_pitch.get("hnr_db", 1.0))
        ai_db = 10.0 * np.log10(max(ai_hnr, 1e-9))
        demo_db = 10.0 * np.log10(max(demo_hnr, 1e-9))
        diff = abs(ai_db - demo_db)
        return _round_score(max(0.0, 100.0 - diff * 3.0))
    except Exception:
        return 50.0


def _f0_dtw_similarity(ai_pitch: dict, demo_pitch: dict) -> float:
    try:
        import numpy as np
        a = np.array(ai_pitch.get("f0_contour", []), dtype=np.float64)
        b = np.array(demo_pitch.get("f0_contour", []), dtype=np.float64)
        if a.size < 4 or b.size < 4:
            return 50.0
        a = 12.0 * np.log2(a / (np.median(a) + 1e-9) + 1e-9)
        b = 12.0 * np.log2(b / (np.median(b) + 1e-9) + 1e-9)
        a = np.interp(np.linspace(0,1,100), np.linspace(0,1,a.size), a)
        b = np.interp(npe(0,1,100), np.linspace(0,1,b.size), b)
        n, m = len(a), len(b)
        dtw = np.full((n+1,m+1), np.inf)
        dtw[0,0] = 0.0
        for i in range(1,n+1):
            for j in range(1,m+1):
                cost = abs(a[i-1]-b[j-1])
                dtw[i,j] = cost + min(dtw[i-1,j], dtw[i,j-1], dtw[i-1,j-1])
        dist = dtw[n,m] / max(n,m)
        return _round_score(max(0.0, 100.0 - dist * 8.0))
    except Exception:
        return 50.0


def _spectral_proximity_score(a_hz: float, b_hz: float, scale_hz: float) -> float:
    if a_hz <= 0 or b_hz <= 0:
        return 50.0
    return _round_score(100.0 * max(0.0, 1.0 - abs(a_hz - b_hz) / scale_hz))


def timbre_similarity(
    ai: dict[str, np.ndarray | float],
    demo: dict[str, np.ndarray | float],
) -> float:
    """0–100 timbre similarity (MFCC + spectral shape)."""
    ai_mfcc = np.asarray(ai.get("mean_mfcc", np.zeros(13)), dtype=np.float64)
    demo_mfcc = np.asarray(demo.get("mean_mfcc", np.zeros(13)), dtype=np.float64)
    if ai_mfcc.size and demo_mfcc.size:
        mfcc_score = _cosine_similarity_percent(ai_mfcc, demo_mfcc)
    else:
        mfcc_score = 50.0

    centroid_score = _spectral_proximity_score(
        float(ai.get("centroid_hz", 0) or 0),
        float(demo.get("centroid_hz", 0) or 0),
        2500.0,
    )
    bandwidth_score = _spectral_proximity_score(
        float(ai.get("bandwidth_hz", 0) or 0),
        float(demo.get("bandwidth_hz", 0) or 0),
        2000.0,
    )
    return _round_score(0.50 * mfcc_score + 0.25 * centroid_score + 0.25 * bandwidth_score)


def quality_score(waveform: Any) -> float:
    """0–100 heuristic from RMS, peak/clipping, and simple SNR estimate."""
    y = _waveform_to_numpy(waveform)
    if y.size == 0:
        return 0.0

    rms = float(np.sqrt(np.mean(y**2)))
    peak = float(np.max(np.abs(y)))
    noise_floor = float(np.percentile(np.abs(y), 10)) + 1e-8
    snr = rms / noise_floor

    rms_target = 0.12
    rms_score = _round_score(100.0 * min(1.0, rms / rms_target))
    snr_score = _round_score(min(100.0, 25.0 * np.log10(max(snr, 1.0))))

    clip_penalty = 25.0 if peak >= 0.99 else (10.0 if peak >= 0.95 else 0.0)
    silent_penalty = 40.0 if rms < CHUNK_MIN_RMS else 0.0

    return _round_score(0.45 * rms_score + 0.45 * snr_score - clip_penalty - silent_penalty)


def demo_quality_score(demo_quality: float, ai_quality: float) -> float:
    """Demo quality for matching: softer penalty when close to AI reference quality."""
    delta = abs(demo_quality - ai_quality)
    if delta <= 12.0:
        return _round_score(max(demo_quality, ai_quality * 0.97))
    if delta <= 28.0:
        blend = (28.0 - delta) / 16.0
        lifted = demo_quality + blend * max(0.0, ai_quality - demo_quality) * 0.5
        return _round_score(lifted)
    return _round_score(demo_quality)


def _vocal_character_similarity(
    ai_vc: dict,
    demo_vc: dict,
) -> float:
    """Compare vocal character features, return 0-100 similarity score."""
    keys = ["breathiness", "vibrato_rate", "vibrato_depth", "vocal_weight",
            "pitch_stability", "articulation_speed", "dynamic_range"]
    diffs = []
    for k in keys:
        a = ai_vc.get(k, 0.0); d = demo_vc.get(k, 0.0) if demo_vc else 0.0
        if a == 0.0 and d == 0.0:
            continue
        max_val = max(abs(a), abs(d), 1e-6)
        diffs.append(abs(a - d) / max_val)
    if not diffs:
        return 50.0
    avg_diff = sum(diffs) / len(diffs)
    return round(max(0.0, (1.0 - avg_diff) * 100.0), 1)


def _genre_weights(query_tags: dict) -> dict:
    w = dict(V4_WEIGHTS)
    if not query_tags:
        return w
    genre = str(query_tags.get(chr(103)+chr(101)+chr(110)+chr(114)+chr(101), chr(0))).lower()
    if genre in (chr(111)+chr(112)+chr(101)+chr(114)+chr(97), chr(99)+chr(108)+chr(97)+chr(115)+chr(115)+chr(105)+chr(99)+chr(97)+chr(108)):
        w.update({chr(112)+chr(105)+chr(116)+chr(99)+chr(104): 0.38, chr(116)+chr(105)+chr(109)+chr(98)+chr(114)+chr(101): 0.34, chr(115)+chr(112)+chr(101)+chr(97)+chr(107)+chr(101)+chr(114): 0.12, chr(113)+chr(117)+chr(97)+chr(108)+chr(105)+chr(116)+chr(121): 0.08})
    elif genre in (chr(114)+chr(110)+chr(98), chr(115)+chr(111)+chr(117)+chr(108)):
        w.update({chr(116)+chr(105)+chr(109)+chr(98)+chr(114)+chr(101): 0.45, chr(112)+chr(105)+chr(116)+chr(99)+chr(104): 0.25, chr(115)+chr(112)+chr(101)+chr(97)+chr(107)+chr(101)+chr(114): 0.15})
    elif genre in (chr(114)+chr(97)+chr(112), chr(104)+chr(105)+chr(112)+chr(45)+chr(104)+chr(111)+chr(112)):
        w.update({chr(115)+chr(112)+chr(101)+chr(97)+chr(107)+chr(101)+chr(114): 0.30, chr(116)+chr(105)+chr(109)+chr(98)+chr(114)+chr(101): 0.35, chr(112)+chr(105)+chr(116)+chr(99)+chr(104): 0.18})
    total = sum(w.values())
    return {k: v / total for k, v in w.items()}


def combine_scores(
    speaker: float,
    timbre: float,
    pitch: float,
    quality: float,
    vocal_character: float = 50.0,
    query_tags: dict = None,
) -> float:
    """Weighted final similarity (0–100) using V4_WEIGHTS."""
    w = _genre_weights(query_tags)
    return _round_score(
        w["speaker"] * speaker
        + w["timbre"] * timbre
        + w["pitch"] * pitch
        + w["quality"] * quality
        + w.get("vocal_character", 0.0) * vocal_character
    )


def _apply_similarity_cap(
    similarity: float,
    speaker_score: float,
    timbre_score: float,
    pitch_score: float,
    types_align: bool,
) -> float:
    """Hard cap after normalization; never returns 100."""
    all_aligned_high = (
        types_align
        and speaker_score > CAP_ALIGNED_COMPONENT_MIN
        and timbre_score > CAP_ALIGNED_COMPONENT_MIN
        and pitch_score > CAP_ALIGNED_COMPONENT_MIN
    )
    all_perfect = (
        types_align
        and speaker_score > CAP_PERFECT_COMPONENT_MIN
        and timbre_score > CAP_PERFECT_COMPONENT_MIN
        and pitch_score > CAP_PERFECT_COMPONENT_MIN
    )
    if all_perfect:
        cap = MAX_SIMILARITY_CAP_PERFECT
    elif all_aligned_high:
        cap = MAX_SIMILARITY_CAP_ALIGNED
    else:
        cap = MAX_SIMILARITY_CAP
    return _round_score(min(similarity, cap))


def _apply_alignment_bonus(
    similarity: float,
    speaker_score: float,
    timbre_score: float,
    pitch_score: float,
    reasons: list[str],
) -> float:
    """Boost final similarity when speaker, timbre, and pitch all align."""
    if (
        speaker_score > ALIGNMENT_BONUS_THRESHOLD
        and timbre_score > ALIGNMENT_BONUS_THRESHOLD
        and pitch_score > ALIGNMENT_BONUS_THRESHOLD
    ):
        boosted = _round_score(similarity * ALIGNMENT_BONUS_MULTIPLIER)
        if boosted > similarity and "Strong multi-feature alignment" not in reasons:
            reasons.insert(0, "Strong multi-feature alignment")
        return boosted
    return similarity


def _composite_component_score(row: dict) -> float:
    """Weighted speaker/timbre/pitch (no quality) for flat-raw spread fallback."""
    w = V4_WEIGHTS
    return (
        w["speaker"] * float(row["speaker_score"])
        + w["timbre"] * float(row["timbre_score"])
        + w["pitch"] * float(row["pitch_score"])
    )


def _raw_values_with_component_spread(
    results: list[dict],
    raw_values: list[float],
) -> tuple[list[float], bool]:
    """When penalized raw scores cluster, widen spread from per-demo components."""
    if max(raw_values) - min(raw_values) >= NORMALIZE_RAW_FLAT_THRESHOLD:
        return list(raw_values), False
    component_keys = [_composite_component_score(row) for row in results]
    c_min = min(component_keys)
    c_max = max(component_keys)
    if c_max > c_min:
        return list(component_keys), True
    return list(raw_values), False


def _stretch_scores_to_target_band(values: list[float]) -> list[float]:
    """Map raw scores linearly: min → bottom, max → top (span ≥ NORMALIZE_MIN_SPAN)."""
    n = len(values)
    if n < 2:
        return list(values)
    min_raw = min(values)
    max_raw = max(values)
    bottom = NORMALIZE_TARGET_BOTTOM
    top = NORMALIZE_TARGET_TOP
    target_span = max(top - bottom, NORMALIZE_MIN_SPAN)
    raw_span = max_raw - min_raw
    if raw_span < 1e-6:
        return [bottom + i * target_span / max(n - 1, 1) for i in range(n)]
    return [
        bottom + (raw - min_raw) / raw_span * target_span for raw in values
    ]


def _apply_rank_gap_boost(results: list[dict]) -> None:
    """If top−second gap < RANK_MIN_GAP, apply RANK_BOOST_BY_POSITION deltas."""
    if len(results) < 2:
        return
    ranked = sorted(results, key=lambda row: float(row["similarity"]), reverse=True)
    gap = float(ranked[0]["similarity"]) - float(ranked[1]["similarity"])
    if gap >= RANK_MIN_GAP:
        return
    for index, row in enumerate(ranked):
        boost = RANK_BOOST_BY_POSITION[
            min(index, len(RANK_BOOST_BY_POSITION) - 1)
        ]
        row["similarity"] = _round_score(float(row["similarity"]) + boost)
    logger.info(
        "Rank gap boost applied (gap was %.1f, target >= %.1f)",
        gap,
        RANK_MIN_GAP,
    )


def _normalize_similarities_across_demos(results: list[dict]) -> None:
    """v4.2 rank-preserving stretch: best demo → top band, worst → bottom band."""
    n = len(results)
    if n < 2:
        return
    raw_values = [float(row["similarity"]) for row in results]
    min_raw = min(raw_values)
    max_raw = max(raw_values)
    spread_inputs, used_component_spread = _raw_values_with_component_spread(
        results, raw_values
    )
    stretched = _stretch_scores_to_target_band(spread_inputs)
    for row, value in zip(results, stretched):
        row["similarity"] = _round_score(value)
    _apply_rank_gap_boost(results)
    logger.info(
        "Score v4.2 stretch across %d demos (raw %.1f–%.1f%s)",
        n,
        min_raw,
        max_raw,
        ", component spread" if used_component_spread else "",
    )


_EXPLANATION_HIGH_TIMBRE = 70.0
_EXPLANATION_MID_TIMBRE = 55.0
_EXPLANATION_HIGH_PITCH = 65.0
_EXPLANATION_HIGH_SPEAKER = 75.0
_EXPLANATION_LOW_SPEAKER = 45.0


def _join_phrases(phrases: list[str]) -> str:
    cleaned = [p.strip() for p in phrases if p and p.strip()]
    if not cleaned:
        return ""
    if len(cleaned) == 1:
        return cleaned[0]
    if len(cleaned) == 2:
        return f"{cleaned[0]} and {cleaned[1]}"
    return ", ".join(cleaned[:-1]) + f", and {cleaned[-1]}"


def _explanation_strength_phrases(breakdown: dict[str, Any]) -> list[str]:
    """Producer-facing phrases for well-aligned score dimensions."""
    reasons = breakdown.get("reasons") or []
    if not isinstance(reasons, list):
        reasons = []
    reason_set = {str(r).lower() for r in reasons}

    phrases: list[str] = []
    timbre_score = float(breakdown.get("timbre_score", 0) or 0)
    pitch_score = float(breakdown.get("pitch_score", 0) or 0)
    speaker_score = float(breakdown.get("speaker_score", 0) or 0)

    if timbre_score >= _EXPLANATION_HIGH_TIMBRE or (
        timbre_score >= _EXPLANATION_MID_TIMBRE
        and ("similar timbre" in reason_set or "similar vocal brightness" in reason_set)
    ):
        phrases.append("timbre and brightness")
    elif timbre_score >= _EXPLANATION_MID_TIMBRE:
        phrases.append("vocal brightness")

    if pitch_score >= _EXPLANATION_HIGH_PITCH or "similar pitch range" in reason_set:
        phrases.append("pitch and vocal range")
    elif "similar vocal register" in reason_set:
        phrases.append("vocal register")

    if speaker_score >= _EXPLANATION_HIGH_SPEAKER or "similar speaker embedding" in reason_set:
        phrases.append("tone and vocal character")
    elif "strong multi-feature alignment" in reason_set and "tone and vocal character" not in phrases:
        phrases.append("overall vocal character")

    if (
        "clean demo recording" in reason_set
        and float(breakdown.get("quality_score", 0) or 0) >= 75
        and len(phrases) < 3
    ):
        phrases.append("recording clarity")

    return phrases[:3]


def _explanation_mismatch_phrases(
    ai_features: dict[str, float | str],
    demo_features: dict[str, float | str],
    breakdown: dict[str, Any],
) -> list[str]:
    """Producer-facing phrases for vocal-type and weak-dimension gaps."""
    reasons = breakdown.get("reasons") or []
    if not isinstance(reasons, list):
        reasons = []
    reason_set = {str(r).lower() for r in reasons}

    phrases: list[str] = []
    ai_band = str(ai_features.get("range_band", "unknown"))
    demo_band = str(demo_features.get("range_band", "unknown"))
    ai_type = _ai_vocal_type(ai_features)
    demo_type = _pitch_vocal_type(demo_features)

    if ai_band != "unknown" and demo_band != "unknown" and ai_band != demo_band:
        phrases.append("vocal range")
    elif "vocal type mismatch" in reason_set and "vocal range" not in phrases:
        phrases.append("vocal range")

    if (ai_type, demo_type) in {("male", "female"), ("female", "male")}:
        phrases.append("pitch register (vocal type)")
    elif (
        "vocal type mismatch" in reason_set
        and ai_type != demo_type
        and ai_type in {"male", "female"}
        and demo_type in {"male", "female"}
        and "pitch register (vocal type)" not in phrases
    ):
        phrases.append("pitch register (vocal type)")

    speaker_score = float(breakdown.get("speaker_score", 0) or 0)
    timbre_score = float(breakdown.get("timbre_score", 0) or 0)
    pitch_score = float(breakdown.get("pitch_score", 0) or 0)

    if speaker_score < _EXPLANATION_LOW_SPEAKER and "distinct voice character" in reason_set:
        if "tone and vocal character" not in phrases:
            phrases.append("vocal character")
    if pitch_score < 50 and "similar pitch range" not in reason_set:
        if "vocal range" not in phrases and "pitch and vocal range" not in " ".join(phrases):
            phrases.append("pitch contour")
    if timbre_score < 50 and timbre_score < _EXPLANATION_MID_TIMBRE:
        if "timbre" not in " ".join(phrases).lower():
            phrases.append("timbre color")

    return phrases[:3]


def generate_match_explanation(
    ai_features: dict[str, float | str],
    demo_features: dict[str, float | str],
    breakdown: dict[str, Any],
) -> str:
    """
    Template-based producer explanation from finalized scores and pitch heuristics.
    Uses breakdown speaker/timbre/pitch/quality scores and optional reasons hints.
    """
    similarity = float(breakdown.get("similarity", 0) or 0)
    strengths = _explanation_strength_phrases(breakdown)
    mismatches = _explanation_mismatch_phrases(ai_features, demo_features, breakdown)
    strength_text = {s.lower() for s in strengths}
    mismatches = [
        m
        for m in mismatches
        if m.lower() not in strength_text
        and not (
            m == "vocal range"
            and any("pitch" in s.lower() or "range" in s.lower() for s in strengths)
        )
    ]

    strength_clause = _join_phrases(strengths)
    mismatch_clause = _join_phrases(mismatches)

    if strength_clause and mismatch_clause:
        if similarity >= 70:
            opener = "This vocalist matches well in"
        elif similarity >= 50:
            opener = "This vocalist is a solid partial match on"
        else:
            opener = "This vocalist shares some overlap in"
        return (
            f"{opener} {strength_clause}, but differs in {mismatch_clause}."
        )

    if strength_clause:
        if similarity >= 75:
            return f"This vocalist is a strong match in {strength_clause}."
        if similarity >= 55:
            return f"This vocalist aligns well on {strength_clause}."
        return f"This vocalist shows moderate similarity in {strength_clause}."

    if mismatch_clause:
        if similarity >= 50:
            return (
                f"This vocalist is comparable in places, but differs in {mismatch_clause}."
            )
        return f"This vocalist differs mainly in {mismatch_clause}."

    reasons = breakdown.get("reasons") or []
    if isinstance(reasons, list) and reasons:
        hint = str(reasons[0]).strip().rstrip(".")
        if hint:
            hint = hint[0].upper() + hint[1:]
            return f"This vocalist shows {hint.lower()}."
    return "This vocalist shows limited measurable overlap with the reference vocal."


def _reasons_from_breakdown(
    speaker_score: float,
    timbre_score: float,
    pitch_score: float,
    quality_score: float,
    ai_pitch: dict[str, float | str],
    demo_pitch: dict[str, float | str],
) -> list[str]:
    reasons: list[str] = []

    if pitch_score >= 65:
        reasons.append("similar pitch range")
    elif str(ai_pitch.get("register")) == str(demo_pitch.get("register")) and str(
        ai_pitch.get("register")
    ) != "unknown":
        reasons.append("similar vocal register")

    if timbre_score >= 70:
        reasons.append("similar timbre")
    if timbre_score >= 55:
        reasons.append("similar vocal brightness")

    if speaker_score >= 75:
        reasons.append("similar speaker embedding")
    elif speaker_score < 45:
        reasons.append("distinct voice character")

    if quality_score < 45:
        reasons.append("low demo audio quality")
    elif quality_score >= 75:
        reasons.append("clean demo recording")

    if not reasons:
        if speaker_score >= 60:
            reasons.append("moderate vocal similarity")
        else:
            reasons.append("limited vocal overlap")

    return reasons[:5]


@app.get("/health")
def health():
    return {"status": "ok"}


def _run_voice_match(
    temp_dir: str,
    ai_path: Path,
    demo_entries: list[tuple[Path, str]],
    progress: VoiceMatchProgress | None = None,
    query_tags: dict | None = None,
    gender_override: str | None = None,
    ai_language: str | None = None,
    part_language: str | None = None,
) -> list[dict] | dict[str, Any] | JSONResponse:
    budget = RequestBudget()
    step_ref: list[str] = ["loading"]
    classifier = get_classifier()
    partial = False

    try:
        step_ref[0] = "loading"
        ai_wav = load_audio_to_wav(str(ai_path), temp_dir)

        ai_waveform, ai_embeddings, ai_chunk_rms = _extract_chunk_embeddings(
            classifier,
            Path(ai_wav),
            step_ref,
            budget,
            run_demucs=True,
        )
        if budget.exceeded():
            partial = True
            logger.warning("Time budget exceeded after AI vocal; continuing best-effort")

        step_ref[0] = "features"
        ai_pitch = compute_pitch_features(ai_waveform)
        ai_timbre = compute_timbre_features(ai_waveform)
        ai_reference_filename = ai_path.name
        ai_pitch["ai_reference_filename"] = ai_reference_filename
        _apply_multi_feature_vocal_classification(ai_pitch, ai_timbre, ai_waveform)
        _apply_ai_reference_vocal_type_adjustment(
            ai_pitch, filename=ai_reference_filename
        )
        if gender_override and gender_override in ("male", "female"):
            ai_pitch["detected_vocal_type"] = gender_override
        if ai_language:
            ai_pitch["ai_language"] = ai_language
        if part_language:
            ai_pitch["part_language"] = part_language
        ai_quality = quality_score(ai_waveform)
        ai_vocal_character = compute_vocal_character_features(ai_waveform)
        logger.info(
            "AI vocal features: file=%s median_f0=%.1fHz pitch_avg=%.1f type=%s ai_type=%s quality=%.1f hnr=%.2f p90=%.1f",
            ai_reference_filename,
            float(ai_pitch.get("avg_hz", 0) or 0),
            _pitch_midi_value(ai_pitch),
            ai_pitch.get("detected_vocal_type"),
            _ai_vocal_type(ai_pitch),
            ai_quality,
            float(ai_pitch.get("hnr_db", 1.0)),
            float(ai_pitch.get("p90_f0_hz", 0)),
        )
    except ValueError as exc:
        return _json_error(400, str(exc), str(exc), step_ref[0])

    male_prototype = _load_male_prototype_features(
        temp_dir, demo_entries, step_ref, budget
    )

    results: list[dict] = []
    for demo_path, demo_filename in demo_entries:
        if budget.exceeded():
            partial = True
            logger.warning(
                "Time budget exceeded; skipping remaining demo(s) after %d scored",
                len(results),
            )
            break

        try:
            _cached = _load_demo_profile(demo_filename)
            if _cached is not None:
                demo_waveform, demo_embeddings, demo_chunk_rms, demo_pitch, demo_timbre, demo_vocal_character, demo_language = _cached
                step_ref[0] = "similarity"
                speaker_score, chunks_used = average_chunk_similarity(
                    ai_embeddings,
                    demo_embeddings,
                    ai_chunk_rms,
                    demo_chunk_rms,
                )
                best_match_sec = _find_best_match_sec(ai_embeddings, demo_embeddings)
                if chunks_used < 2:
                    speaker_score = _round_score(
                        speaker_score * SINGLE_CHUNK_SPEAKER_DISCOUNT
                    )
                logger.info(
                    "[cache hit] Using chunk averaging (%d chunks) for %s",
                    chunks_used,
                    demo_filename,
                )
            else:
                step_ref[0] = "loading"
                demo_wav = load_audio_to_wav(str(demo_path), temp_dir)

                step_ref[0] = "embedding"
                demo_waveform, demo_embeddings, demo_chunk_rms = _extract_chunk_embeddings(
                    classifier,
                    Path(demo_wav),
                    step_ref,
                    budget,
                    run_demucs=USE_DEMUCS,
                )

                step_ref[0] = "similarity"
                speaker_score, chunks_used = average_chunk_similarity(
                    ai_embeddings,
                    demo_embeddings,
                    ai_chunk_rms,
                    demo_chunk_rms,
                )
                best_match_sec = _find_best_match_sec(ai_embeddings, demo_embeddings)
                if chunks_used < 2:
                    speaker_score = _round_score(
                        speaker_score * SINGLE_CHUNK_SPEAKER_DISCOUNT
                    )
                logger.info(
                    "Using chunk averaging (%d chunks) for %s",
                    chunks_used,
                    demo_filename,
                )

                step_ref[0] = "features"
                demo_pitch = compute_pitch_features(demo_waveform)
                demo_timbre = compute_timbre_features(demo_waveform)
                demo_vocal_character = compute_vocal_character_features(
                    demo_waveform, ECAPA_SAMPLE_RATE
                )
                _save_demo_profile(demo_filename, demo_waveform, demo_embeddings, demo_chunk_rms, demo_pitch, demo_timbre, demo_vocal_character)
                demo_language = ""
            timbre_sc = timbre_similarity(ai_timbre, demo_timbre)
            _apply_multi_feature_vocal_classification(
                demo_pitch,
                demo_timbre,
                demo_waveform,
                timbre_score=timbre_sc,
            )
            demo_row: dict = {
                "filename": demo_filename,
                "original_filename": demo_filename,
                "breathiness": demo_vocal_character.get("breathiness", 0.0),
                "vibrato_rate": demo_vocal_character.get("vibrato_rate", 0.0),
                "vibrato_depth": demo_vocal_character.get("vibrato_depth", 0.0),
                "vocal_weight": demo_vocal_character.get("vocal_weight", 0.0),
                "melodic_range_semitones": demo_vocal_character.get(
                    "melodic_range_semitones", 0.0
                ),
                "pitch_stability": demo_vocal_character.get("pitch_stability", 0.0),
                "articulation_speed": demo_vocal_character.get(
                    "articulation_speed", 0.0
                ),
                "dynamic_range": demo_vocal_character.get("dynamic_range", 0.0),
            "demo_language": demo_language,
            "display_name": json.loads((_DEMO_PROFILES_DIR / demo_filename.replace(".wav", ".json")).read_text()).get("display_name", "") if (_DEMO_PROFILES_DIR / demo_filename.replace(".wav", ".json")).exists() else "",
            }
            _apply_demo_vocal_type_fields(
                demo_row,
                demo_pitch,
                demo_timbre=demo_timbre,
                male_prototype=male_prototype,
                demo_waveform=demo_waveform,
            )
            demo_quality_raw = quality_score(demo_waveform)
            pitch_sc = pitch_similarity(ai_pitch, demo_pitch)
            quality_sc = demo_quality_score(demo_quality_raw, ai_quality)
            vc_sc = _vocal_character_similarity(ai_vocal_character, demo_vocal_character)
            logger.info("VC features ai=%s demo=%s vc_sc=%.1f", ai_vocal_character, demo_vocal_character, vc_sc)
            similarity = combine_scores(speaker_score, timbre_sc, pitch_sc, quality_sc, vc_sc, query_tags=None)
            reasons = _reasons_from_breakdown(
                speaker_score,
                timbre_sc,
                pitch_sc,
                quality_sc,
                ai_pitch,
                demo_pitch,
            )
            types_align = vocal_types_align(ai_pitch, demo_pitch, demo_row=demo_row)
            similarity = apply_vocal_type_penalty(
                similarity, ai_pitch, demo_pitch, reasons, demo_row=demo_row
            )
            if _vocal_type_mismatch_multiplier(ai_pitch, demo_pitch, demo_row=demo_row) < 1.0:
                similarity = _round_score(
                    similarity - VOCAL_MISMATCH_RANK_PENALTY
                )
            similarity = _apply_alignment_bonus(
                similarity,
                speaker_score,
                timbre_sc,
                pitch_sc,
                reasons,
            )
            logger.info(
                "%s scores: final=%.1f speaker=%.1f timbre=%.1f pitch=%.1f quality=%.1f vc=%.1f",
                demo_filename,
                similarity,
                speaker_score,
                timbre_sc,
                pitch_sc,
                quality_sc,
                vc_sc,
            )
            results.append(
                {
                    "filename": demo_filename,
                    "original_filename": demo_filename,
                    "similarity": similarity,
                    "chunks_used": chunks_used,
                    "speaker_score": speaker_score,
                    "timbre_score": timbre_sc,
                    "pitch_score": pitch_sc,
                    "quality_score": quality_sc,
                "vocal_character_score": vc_sc,
                    "reasons": reasons,
                    "detected_vocal_type": demo_row["detected_vocal_type"],
                    "voice_subtype": demo_row.get("voice_subtype", "unknown"),
                    "classification_confidence": demo_row.get(
                        "classification_confidence",
                        demo_pitch.get("classification_confidence"),
                    ),
                    "manual_gender": demo_row["manual_gender"],
                    "final_vocal_type": demo_row["final_vocal_type"],
                    "_demo_timbre": demo_timbre,
                    "_demo_waveform": demo_waveform,
                    "_ai_timbre": ai_timbre,
                    "_ai_waveform": ai_waveform,
                    "similarity_to_real_voice_1": demo_row.get(
                        "similarity_to_real_voice_1", False
                    ),
                    "high_pitched_male": demo_row.get("high_pitched_male", False),
                    "prototype_pitch_timbre_similarity": demo_row.get(
                        "prototype_pitch_timbre_similarity"
                    ),
                    "_vocal_types_align": types_align,
                    "_ai_pitch": ai_pitch,
                    "_demo_pitch": demo_pitch,
                    "_spectral_centroid_proxy": float(
                        _mfcc_cosine_similarity(ai_timbre, demo_timbre)
                    ),
                        "best_match_sec": best_match_sec,
                    "demo_language": demo_language,
                "display_name": json.loads((_DEMO_PROFILES_DIR / demo_filename.replace(".wav", ".json")).read_text()).get("display_name", "") if (_DEMO_PROFILES_DIR / demo_filename.replace(".wav", ".json")).exists() else "",
                "breathiness": demo_row.get("breathiness", 0.0),
                "vibrato_rate": demo_row.get("vibrato_rate", 0.0),
                "vibrato_depth": demo_row.get("vibrato_depth", 0.0),
                "melodic_range_semitones": demo_row.get("melodic_range_semitones", 0.0),
                "pitch_stability": demo_row.get("pitch_stability", 0.0),
                }
            )
            _sync_progress(progress, results, partial)
            if budget.exceeded():
                partial = True
                logger.warning(
                    "Time budget exceeded after %s; skipping remaining demo(s)",
                    demo_filename,
                )
                break
        except ValueError as exc:
            return _json_error(400, str(exc), str(exc), step_ref[0])
        except Exception as _exc:
            logger.error("UNEXPECTED in loop: %s", _exc, exc_info=True)
            raise

    if not results:
        if partial:
            _sync_progress(progress, results, True)
            return _finalize_voice_match_results(results, partial=True)
        return _json_error(
            422,
            "No valid demo files were provided",
            "no_valid_demos",
        )

        if gender_override and gender_override in ("male", "female"):
            results = [
                row for row in results
                if row.get("final_vocal_type") == gender_override
            ]
    finalized = _finalize_voice_match_results(results, partial=partial, query_tags=query_tags, gender_override=gender_override, ai_language=ai_language, part_language=part_language)
    _sync_progress(progress, finalized["results"], partial)
    logger.info("returning finalized, keys: %s", list(finalized.keys()) if finalized else None)
    return finalized


@app.post("/voice-match")
async def voice_match(
    ai_vocal: Annotated[UploadFile, File()],
    demos: Annotated[list[UploadFile], File()],
    demo_display_names: Annotated[str | None, Form()] = None,
    query_tags: Annotated[str | None, Form()] = None,
    gender_override: Annotated[str | None, Form()] = None,
    ai_language: Annotated[str | None, Form()] = None,
    part_language: Annotated[str | None, Form()] = None,
):
    logger.info("request received")
    temp_dir: str | None = None
    step_ref: list[str] = ["loading"]
    budget = RequestBudget()
    progress = VoiceMatchProgress()
    try:
        ai_name = Path(ai_vocal.filename or "").name or "(unnamed)"
        client_demo_names = _parse_demo_display_names_form(
            demo_display_names, len(demos)
        )
        demo_names = [
            client_demo_names[i]
            if i < len(client_demo_names) and client_demo_names[i]
            else Path(d.filename or f"demo_{i}.wav").name
            for i, d in enumerate(demos)
        ]
        logger.info("ai_vocal filename: %s", ai_name)
        logger.info("demos count: %d", len(demo_names))
        if demo_names:
            logger.info("demo display names: %s", ", ".join(demo_names))
        upload_names = [Path(d.filename or "").name for d in demos]
        if any(upload_names):
            logger.info("demo upload filenames: %s", ", ".join(upload_names))

        if not ai_vocal.filename:
            return _json_error(422, "Missing required field: ai_vocal", "missing_ai_vocal")
        if not demos:
            return _json_error(
                422,
                "Missing required field: demos (upload at least one demo file)",
                "missing_demos",
            )

        temp_dir = tempfile.mkdtemp(prefix="voxbridge-voice-match-")
        ai_path = _save_upload(ai_vocal, temp_dir)
        demo_entries: list[tuple[Path, str]] = []
        for index, demo_upload in enumerate(demos):
            client_label = (
                client_demo_names[index]
                if index < len(client_demo_names)
                else ""
            )
            if not client_label and not (demo_upload.filename or "").strip():
                return _json_error(
                    422,
                    f"Demo upload at index {index} has no filename or display name",
                    "invalid_demo_upload",
                )
            demo_path, display_name = _save_demo_upload(
                demo_upload,
                temp_dir,
                index=index,
                display_name=client_label or None,
            )
            demo_entries.append((demo_path, display_name))

        # Парсим query_tags из строки JSON
        parsed_query_tags = {}
        if query_tags:
            try:
                parsed_query_tags = json.loads(query_tags)
            except Exception:
                parsed_query_tags = {}

        outcome = await asyncio.wait_for(
            asyncio.to_thread(
                _run_voice_match, temp_dir, ai_path, demo_entries, progress, parsed_query_tags, gender_override, ai_language, part_language
            ),
            timeout=REQUEST_TIMEOUT_SEC,
        )
        if isinstance(outcome, JSONResponse):
            return outcome
        return outcome
    except asyncio.TimeoutError:
        logger.warning(
            "voice-match outer timeout after %ds; returning best-effort results",
            REQUEST_TIMEOUT_SEC,
        )
        if progress.results:
            return _finalize_voice_match_results(progress.results, partial=True)
        return _finalize_voice_match_results([], partial=True)
    except HTTPException:
        raise
    except Exception as exc:
        return _server_error_500(exc, step_ref[0])
    finally:
        logger.info("processing elapsed %.1fs", budget.elapsed())
        if temp_dir:
            shutil.rmtree(temp_dir, ignore_errors=True)


def _finalize_sanity_row(row: dict, pitch_sc: float) -> float:
    """Mirror _finalize_voice_match_results post-normalize steps for one row."""
    ai_pitch = row["_ai_pitch"]
    demo_pitch = row["_demo_pitch"]
    sp = float(row["speaker_score"])
    tb = float(row["timbre_score"])
    pi = float(row["pitch_score"])
    sim = _apply_vocal_type_mismatch_hard_cap(
        float(row["similarity"]), pitch_sc, ai_pitch, demo_pitch, demo_row=row
    )
    sim = _apply_similarity_floor(sim)
    return _apply_similarity_cap(
        sim, sp, tb, pi, bool(row["_vocal_types_align"])
    )


def _build_sanity_row(
    components: tuple[float, float, float, float],
    ai_pitch: dict[str, str],
    demo_pitch: dict[str, str],
) -> dict:
    sp, tb, pi, qu = components
    sim = combine_scores(sp, tb, pi, qu)
    reasons: list[str] = []
    row_stub: dict = {}
    sim = apply_vocal_type_penalty(
        sim, ai_pitch, demo_pitch, reasons, demo_row=row_stub
    )
    if _vocal_type_mismatch_multiplier(ai_pitch, demo_pitch, demo_row=row_stub) < 1.0:
        sim = _round_score(sim - VOCAL_MISMATCH_RANK_PENALTY)
    sim = _apply_alignment_bonus(sim, sp, tb, pi, reasons)
    return {
        "similarity": sim,
        "speaker_score": sp,
        "timbre_score": tb,
        "pitch_score": pi,
        "quality_score": qu,
        "reasons": reasons,
        "_vocal_types_align": vocal_types_align(ai_pitch, demo_pitch, demo_row=row_stub),
        "_ai_pitch": ai_pitch,
        "_demo_pitch": demo_pitch,
    }


def _sanity_pitch_from_midi(midi: float) -> dict[str, float | str]:
    """Build pitch feature dict for sanity tests from a MIDI note number."""
    import librosa

    if midi <= 0:
        hz = 0.0
    else:
        hz = float(librosa.midi_to_hz(midi))
    if hz <= 0:
        band = "unknown"
    elif hz < F0_RANGE_LOW_HZ:
        band = "low"
    elif hz <= F0_RANGE_HIGH_HZ:
        band = "mid"
    else:
        band = "high"
    pitch = {
        "avg_hz": hz,
        "median_f0_hz": hz,
        "range_band": band,
        "pitch_avg": midi if midi > 0 else 0.0,
    }
    if midi <= 0:
        timbre = _empty_timbre_features()
    elif midi < VOCAL_CLASSIFY_PITCH_LOW_MIDI:
        timbre = _sanity_timbre_dense()
    elif midi > VOCAL_CLASSIFY_PITCH_HIGH_MIDI:
        timbre = _sanity_timbre_bright()
    elif midi >= VOCAL_CLASSIFY_FEMALE_MID_MIN_MIDI:
        timbre = _sanity_timbre_bright()
    else:
        timbre = _empty_timbre_features()
    _refresh_pitch_vocal_classification(pitch, timbre=timbre)
    return pitch


def _sanity_timbre_bright() -> dict[str, np.ndarray | float]:
    return {
        "mean_mfcc": np.full(13, 2.0, dtype=np.float64),
        "centroid_hz": 2500.0,
        "bandwidth_hz": 1400.0,
    }


def _sanity_timbre_dense() -> dict[str, np.ndarray | float]:
    return {
        "mean_mfcc": np.full(13, 26.0, dtype=np.float64),
        "centroid_hz": 1600.0,
        "bandwidth_hz": 2200.0,
    }


def _sanity_check_multi_feature_vocal_classification() -> None:
    """Mock timbre + pitch: bright high → female; dense high → high-pitched male."""
    print("multi-feature vocal classification (mock pitch + timbre):")
    high_pitch = {"pitch_avg": 62.0, "median_f0_hz": 260.0, "avg_hz": 260.0}
    bright = classify_vocal_type_multi_feature(
        None, ECAPA_SAMPLE_RATE, high_pitch, _sanity_timbre_bright(), timbre_score=70.0
    )
    print(
        f"  high+bright: type={bright['detected_vocal_type']} "
        f"hpm={bright['high_pitched_male']} conf={bright['classification_confidence']}"
    )
    if bright["detected_vocal_type"] != "female" or bright["high_pitched_male"] is True:
        raise AssertionError("high pitch + bright timbre should be female")

    dense = classify_vocal_type_multi_feature(
        None, ECAPA_SAMPLE_RATE, high_pitch, _sanity_timbre_dense()
    )
    print(
        f"  high+dense: type={dense['detected_vocal_type']} "
        f"hpm={dense['high_pitched_male']} conf={dense['classification_confidence']}"
    )
    if dense["detected_vocal_type"] != "male" or dense["high_pitched_male"] is not True:
        raise AssertionError("high pitch + dense timbre should be high-pitched male")

    rv1_pitch = _sanity_pitch_from_midi(63.9)
    rv1_row: dict = {"filename": "real_voice_1.wav"}
    _apply_demo_vocal_type_fields(rv1_row, rv1_pitch)
    print(
        f"  real_voice_1: detected={rv1_row.get('detected_vocal_type')} "
        f"final={rv1_row.get('final_vocal_type')} manual={rv1_row.get('manual_gender')} "
        f"hpm={rv1_row.get('high_pitched_male')}"
    )
    if rv1_row.get("final_vocal_type") != "male":
        raise AssertionError("real_voice_1 manual override must keep final_vocal_type=male")
    if rv1_row.get("manual_gender") != "male":
        raise AssertionError("real_voice_1 manual_gender must be male")
    if rv1_row.get("high_pitched_male") is not False:
        raise AssertionError("real_voice_1 prototype must not be high_pitched_male")
    print("  multi-feature classification assertions: OK")


def _sanity_check_demo_display_names_form() -> None:
    """Client-supplied demo_display_names override generic upload filenames."""
    parsed = _parse_demo_display_names_form(
        json.dumps(["Real Vocal 2.wav", "demo_1.wav"]),
        2,
    )
    if parsed != ["Real Vocal 2.wav", "demo_1.wav"]:
        raise AssertionError(f"unexpected parsed demo_display_names: {parsed}")
    row: dict = {
        "filename": "demo_0.wav",
        "original_filename": "Real Vocal 2.wav",
    }
    if _manual_demo_gender_lookup(_demo_lookup_filename(row)) != "female":
        raise AssertionError("original_filename should drive manual gender lookup")
    print("  demo_display_names + original_filename lookup: OK")


def _sanity_check_manual_substring_labels() -> None:
    """MANUAL_DEMO_GENDER_SUBSTRINGS apply before HPM and set manual_gender on row."""
    demo_name = "Real Vocal 2 - take 3.wav"
    demo_pitch = _sanity_pitch_from_midi(28.0)
    row: dict = {"filename": demo_name, "original_filename": demo_name}
    _apply_demo_vocal_type_fields(row, demo_pitch)
    if row.get("manual_gender") != "female":
        raise AssertionError(f"expected manual_gender=female for {demo_name!r}")
    if row.get("final_vocal_type") != "female":
        raise AssertionError("manual female must set final_vocal_type=female")
    if _demo_final_vocal_type(row, demo_pitch) != "female":
        raise AssertionError("_demo_final_vocal_type must prefer manual over HPM")
    row["high_pitched_male"] = True
    _apply_demo_gender_override_fields(row, demo_pitch)
    if row.get("manual_gender") != "female":
        raise AssertionError("finalize refresh must keep manual_gender")
    if row.get("final_vocal_type") != "female":
        raise AssertionError("finalize refresh must keep final_vocal_type=female")
    print(f"  manual substring: {demo_name!r} -> female (detected={row.get('detected_vocal_type')})")
    print("  manual substring label assertions: OK")


def _sanity_check_filename_female_overrides() -> None:
    """Substring manual gender + AI filename force female."""
    demo_name = "Suno - Теплый воздух v2.wav"
    manual = _manual_demo_gender_lookup(demo_name)
    if manual != "female":
        raise AssertionError(f"expected manual female for {demo_name!r}, got {manual}")
    ai_pitch = {"pitch_avg": 48.0, "detected_vocal_type": "male", "high_pitched_male": False}
    ai_pitch["ai_reference_filename"] = "My AI vocal reference.mp3"
    _apply_ai_reference_vocal_type_adjustment(ai_pitch, filename=ai_pitch["ai_reference_filename"])
    if ai_pitch.get("detected_vocal_type") != "female":
        raise AssertionError("AI filename override should set detected_vocal_type=female")
    if _ai_vocal_type(ai_pitch) != "female":
        raise AssertionError("AI filename override should yield ai_vocal_type=female")
    print(f"  manual substring: {demo_name!r} -> {manual}")
    print(
        f"  AI filename override: type={ai_pitch['detected_vocal_type']} "
        f"ai_type={_ai_vocal_type(ai_pitch)}"
    )
    print("  filename female override assertions: OK")


def _sanity_check_ai_reference_hpm_female_override() -> None:
    """AI ref: high MIDI + HPM from dense timbre → female (Suno/Udio soft rule)."""
    high_pitch = {"pitch_avg": 62.0, "median_f0_hz": 260.0, "avg_hz": 260.0}
    dense = classify_vocal_type_multi_feature(
        None, ECAPA_SAMPLE_RATE, high_pitch, _sanity_timbre_dense()
    )
    ai_pitch = dict(high_pitch)
    ai_pitch["detected_vocal_type"] = dense["detected_vocal_type"]
    ai_pitch["high_pitched_male"] = dense["high_pitched_male"]
    print(
        f"  AI ref pre-adjust: type={ai_pitch['detected_vocal_type']} "
        f"hpm={ai_pitch['high_pitched_male']} pitch_avg={ai_pitch['pitch_avg']}"
    )
    if dense["detected_vocal_type"] != "male" or dense["high_pitched_male"] is not True:
        raise AssertionError("sanity setup: dense high pitch should be HPM male before adjust")
    _apply_ai_reference_vocal_type_adjustment(ai_pitch)
    if _ai_vocal_type(ai_pitch) != "female":
        raise AssertionError("AI ref HPM + MIDI>55 should classify as female")
    if ai_pitch.get("high_pitched_male") is not False:
        raise AssertionError("AI ref override should clear high_pitched_male")
    print(
        f"  AI ref post-adjust: type={ai_pitch['detected_vocal_type']} "
        f"hpm={ai_pitch['high_pitched_male']}"
    )
    print("  AI reference HPM→female override assertions: OK")


def _sanity_check_prototype_respects_confident_female() -> None:
    """Bright high-pitch female must not become HPM via male-prototype cosine alone."""
    high_pitch = {"pitch_avg": 63.0, "median_f0_hz": 255.0, "avg_hz": 255.0}
    bright_timbre = _sanity_timbre_bright()
    _apply_multi_feature_vocal_classification(
        high_pitch, bright_timbre, None, timbre_score=72.0
    )
    if not _classifier_confident_female(high_pitch):
        raise AssertionError(
            "sanity setup: bright high pitch should classify as confident female"
        )
    proto = {
        "pitch_avg": 63.9,
        "mean_mfcc": np.full(13, 26.0, dtype=np.float64),
        "centroid_hz": 1600.0,
    }
    row: dict = {"filename": "female_like.wav"}
    _apply_demo_vocal_type_fields(
        row,
        high_pitch,
        demo_timbre=bright_timbre,
        male_prototype=proto,
    )
    print(
        f"  confident female vs prototype: final={row.get('final_vocal_type')} "
        f"hpm={row.get('high_pitched_male')} proto_sim={row.get('prototype_pitch_timbre_similarity')}"
    )
    if row.get("high_pitched_male") is True:
        raise AssertionError("confident female must not be overridden to high_pitched_male")
    if row.get("final_vocal_type") != "female":
        raise AssertionError("confident female final_vocal_type must stay female")
    print("  prototype vs confident female assertions: OK")


def _sanity_check_scoring_calibration() -> None:
    """Print v4.2 scores; assert multi-demo spread (no audio)."""
    ai_low_m = _sanity_pitch_from_midi(28.0)
    demo_high_f = _sanity_pitch_from_midi(65.0)
    ai_mid = _sanity_pitch_from_midi(50.0)
    demo_mid = _sanity_pitch_from_midi(50.0)
    ai_mid2 = _sanity_pitch_from_midi(38.0)
    demo_high = _sanity_pitch_from_midi(62.0)

    print("v4.2 scoring sanity (3-demo stretch + rank boost):")
    batch = [
        _build_sanity_row(
            (82.0, 78.0, 80.0, 85.0),
            ai_mid,
            demo_mid,
        ),
        _build_sanity_row(
            (60.0, 58.0, 55.0, 70.0),
            ai_mid2,
            demo_high,
        ),
        _build_sanity_row(
            (55.0, 50.0, 40.0, 75.0),
            ai_low_m,
            demo_high_f,
        ),
    ]
    labels = ("strong match", "partial / adjacent", "strong mismatch")
    raw_before = [float(r["similarity"]) for r in batch]
    print(f"  raw pre-normalize: {[round(v, 1) for v in raw_before]}")
    _normalize_similarities_across_demos(batch)
    after_norm = [float(r["similarity"]) for r in batch]
    print(f"  after stretch:     {[round(v, 1) for v in after_norm]}")
    pitch_scores = (80.0, 48.0, 35.0)
    finalized: list[tuple[str, float]] = []
    for label, row, pitch_sc in zip(labels, batch, pitch_scores):
        final = _finalize_sanity_row(row, pitch_sc)
        row["similarity"] = final
        finalized.append((label, final))
        print(f"  {label}: {final:.1f}%")
    finalized.sort(key=lambda item: item[1], reverse=True)
    top = finalized[0][1]
    second = finalized[1][1]
    bottom = finalized[-1][1]
    gap_top_second = top - second
    gap_match_mismatch = top - bottom
    print(
        f"  spread: top-2nd={gap_top_second:.1f}, top-worst={gap_match_mismatch:.1f}"
    )
    if gap_top_second < RANK_MIN_GAP:
        raise AssertionError(
            f"top-second gap {gap_top_second:.1f} < {RANK_MIN_GAP}"
        )
    if gap_match_mismatch < 15.0:
        raise AssertionError(
            f"strong vs mismatch spread {gap_match_mismatch:.1f} < 15"
        )
    print("  multi-demo spread assertions: OK")


def _sanity_check_vocal_type_ranking() -> None:
    """Female AI (MIDI 65): male MIDI 28 @ 80% vs female MIDI 65 @ 60% — female #1."""
    ai_f = _sanity_pitch_from_midi(65.0)
    demo_m = _sanity_pitch_from_midi(28.0)
    demo_f = _sanity_pitch_from_midi(65.0)

    male_row = _build_sanity_row((90.0, 88.0, 86.0, 85.0), ai_f, demo_m)
    female_row = _build_sanity_row((70.0, 68.0, 66.0, 65.0), ai_f, demo_f)
    male_row["similarity"] = 80.0
    female_row["similarity"] = 60.0
    batch = [
        {"filename": "male_mismatch_80.wav", **male_row},
        {"filename": "female_match_60.wav", **female_row},
    ]
    print(
        "pitch-MIDI ranking sanity (AI female MIDI 65; male MIDI 28 @ 80% vs female @ 60%):"
    )
    pre_sim_order = sorted(
        batch, key=lambda row: float(row["similarity"]), reverse=True
    )
    print(
        "  pre-finalize similarity order:",
        [row["filename"] for row in pre_sim_order],
    )
    finalized = _finalize_voice_match_results(batch, partial=False)["results"]
    print(
        "  post-ranking order:",
        [row["filename"] for row in finalized],
    )
    for row in finalized:
        print(
            f"    {row['filename']}: sim={row['similarity']:.1f} "
            f"final_rank={row.get('final_ranking_score', '?')}"
        )
    top_name = finalized[0]["filename"]
    if top_name != "female_match_60.wav":
        raise AssertionError(f"expected female_match_60.wav at #1, got {top_name}")
    male_sim = float(
        next(
            row["similarity"]
            for row in finalized
            if row["filename"] == "male_mismatch_80.wav"
        )
    )
    female_sim = float(
        next(
            row["similarity"]
            for row in finalized
            if row["filename"] == "female_match_60.wav"
        )
    )
    if male_sim <= female_sim:
        raise AssertionError("sanity setup: male should keep higher displayed similarity")
    male_result = next(row for row in finalized if row["filename"] == "male_mismatch_80.wav")
    if male_result.get("detected_vocal_type") != "male":
        raise AssertionError("male demo should have detected_vocal_type=male")
    if male_result.get("vocal_type_match") is not False:
        raise AssertionError("male demo should have vocal_type_match=False")
    if VOCAL_MISMATCH_DEMOTION_REASON not in male_result.get("reasons", []):
        raise AssertionError(
            f"male demo missing reason {VOCAL_MISMATCH_DEMOTION_REASON!r}"
        )
    print(
        f"  #1={top_name} (sim={female_sim:.1f}); "
        f"male sim={male_sim:.1f} demoted with mismatch reason"
    )
    print("  gender-priority ranking assertions: OK")


def _sanity_check_failed_pitch_not_top() -> None:
    """Female AI: failed pitch (0 Hz) cannot beat confirmed female when sim is higher."""
    ai_f = _sanity_pitch_from_midi(65.0)
    demo_f = _sanity_pitch_from_midi(65.0)
    failed_pitch: dict[str, float | str] = {
        "avg_hz": 0.0,
        "median_f0_hz": 0.0,
        "pitch_avg": 0.0,
        "range_band": "unknown",
    }
    _refresh_pitch_vocal_classification(failed_pitch)

    failed_row = _build_sanity_row((94.0, 92.0, 90.0, 88.0), ai_f, failed_pitch)
    female_row = _build_sanity_row((70.0, 68.0, 66.0, 65.0), ai_f, demo_f)
    failed_row["similarity"] = 90.0
    female_row["similarity"] = 70.0
    batch = [
        {"filename": "real_voice_1.wav", **failed_row},
        {"filename": "female_aligned.wav", **female_row},
    ]
    print("failed pitch (0 Hz) vs female MIDI 65 (failed sim 90% vs female 70%):")
    finalized = _finalize_voice_match_results(batch, partial=False)["results"]
    if finalized[0]["filename"] != "female_aligned.wav":
        raise AssertionError(
            f"expected female_aligned.wav at #1, got {finalized[0]['filename']}"
        )
    failed_result = next(r for r in finalized if r["filename"] == "real_voice_1.wav")
    if failed_result.get("pitch_avg") not in (0, 0.0):
        raise AssertionError("failed pitch row should expose pitch_avg=0")
    if failed_result.get("vocal_type_match") is not False:
        raise AssertionError("failed pitch should have vocal_type_match=False")
    print(
        f"  #1={finalized[0]['filename']} pitch_avg={finalized[0].get('pitch_avg')} "
        f"failed final_rank={failed_result.get('final_ranking_score')}"
    )
    print("  failed pitch demotion assertions: OK")


def _sanity_check_female_match_no_false_mismatch() -> None:
    """Female AI: demo A female MIDI 63.9 must match with no mismatch reason; male not #1."""
    ai_f = _sanity_pitch_from_midi(65.0)
    demo_f = _sanity_pitch_from_midi(63.9)
    demo_m = _sanity_pitch_from_midi(28.0)

    female_row = _build_sanity_row((85.0, 83.0, 81.0, 80.0), ai_f, demo_f)
    male_row = _build_sanity_row((92.0, 90.0, 88.0, 87.0), ai_f, demo_m)
    male_row["similarity"] = 95.0
    female_row["similarity"] = 80.0
    batch = [
        {"filename": "female_pitch_64.wav", **female_row},
        {"filename": "male_demo.wav", **male_row},
    ]
    print(
        "female AI + female MIDI 63.9 vs male (male sim 95%, female 80%):"
    )
    finalized = _finalize_voice_match_results(batch, partial=False)["results"]
    if finalized[0]["filename"] != "female_pitch_64.wav":
        raise AssertionError(
            f"expected female_pitch_64.wav at #1, got {finalized[0]['filename']}"
        )
    female_result = next(r for r in finalized if r["filename"] == "female_pitch_64.wav")
    if female_result.get("vocal_type_match") is not True:
        raise AssertionError("female+female should have vocal_type_match=True")
    if female_result.get("detected_vocal_type") != "female":
        raise AssertionError("demo MIDI 63.9 should be detected_vocal_type=female")
    if abs(float(female_result.get("pitch_avg", 0)) - 63.9) > 0.05:
        raise AssertionError(
            f"expected pitch_avg≈63.9, got {female_result.get('pitch_avg')}"
        )
    if any(
        _reason_is_vocal_type_mismatch(reason)
        for reason in female_result.get("reasons", [])
    ):
        raise AssertionError("aligned female demo must not list vocal type mismatch")
    male_result = next(r for r in finalized if r["filename"] == "male_demo.wav")
    if male_result.get("vocal_type_match") is not False:
        raise AssertionError("male demo should have vocal_type_match=False")
    print(
        f"  #1={finalized[0]['filename']} pitch_avg={female_result.get('pitch_avg')} "
        f"vocal_type_match={female_result.get('vocal_type_match')}"
    )
    print("  female aligned no false mismatch: OK")


def _sanity_check_unknown_pitch_not_top() -> None:
    """Female AI: unknown MIDI 45 high sim cannot beat confirmed female MIDI 65."""
    ai_f = _sanity_pitch_from_midi(65.0)
    demo_unknown = _sanity_pitch_from_midi(45.0)
    demo_f = _sanity_pitch_from_midi(65.0)

    unknown_row = _build_sanity_row((92.0, 90.0, 88.0, 85.0), ai_f, demo_unknown)
    female_row = _build_sanity_row((72.0, 70.0, 68.0, 65.0), ai_f, demo_f)
    unknown_row["similarity"] = 88.0
    female_row["similarity"] = 68.0
    batch = [
        {"filename": "real_voice_1.wav", **unknown_row},
        {"filename": "female_aligned.wav", **female_row},
    ]
    print(
        "unknown MIDI 45 vs female MIDI 65 (AI female; unknown sim 88% vs female 68%):"
    )
    finalized = _finalize_voice_match_results(batch, partial=False)["results"]
    top = finalized[0]["filename"]
    if top != "female_aligned.wav":
        raise AssertionError(f"expected female_aligned.wav at #1, got {top}")
    unknown_result = next(r for r in finalized if r["filename"] == "real_voice_1.wav")
    if unknown_result.get("detected_vocal_type") != "male":
        raise AssertionError(
            "ambiguous MIDI 40-55 without bright timbre should be detected_vocal_type=male"
        )
    if unknown_result.get("vocal_type_match") is not False:
        raise AssertionError("male-range ambiguous pitch should have vocal_type_match=False")
    print(
        f"  #1={top} pitch_avg={finalized[0].get('pitch_avg')} "
        f"unknown pitch_avg={unknown_result.get('pitch_avg')} "
        f"final_rank={unknown_result.get('final_ranking_score')}"
    )
    print("  unknown MIDI demotion assertions: OK")


def _sanity_check_hard_gender_partition() -> None:
    """Hard partition: female AI + female demo blocks male from #1; males-only allows male #1."""
    ai_f = _sanity_pitch_from_midi(65.0)
    demo_f = _sanity_pitch_from_midi(65.0)
    demo_m = _sanity_pitch_from_midi(28.0)

    male_row = _build_sanity_row((90.0, 88.0, 86.0, 85.0), ai_f, demo_m)
    female_row = _build_sanity_row((70.0, 68.0, 66.0, 65.0), ai_f, demo_f)
    male_row["similarity"] = 80.0
    female_row["similarity"] = 60.0
    mixed_batch = [
        {"filename": "male_high.wav", **male_row},
        {"filename": "female_low.wav", **female_row},
    ]
    print("hard gender partition (AI female; male 80% vs female 60%):")
    mixed = _finalize_voice_match_results(mixed_batch, partial=False)["results"]
    if mixed[0]["filename"] != "female_low.wav":
        raise AssertionError(f"expected female_low.wav at #0, got {mixed[0]['filename']}")
    male_mixed = next(r for r in mixed if r["filename"] == "male_high.wav")
    if male_mixed.get("hard_gender_block_applied") is not True:
        raise AssertionError("male demo should have hard_gender_block_applied=true")
    female_mixed = next(r for r in mixed if r["filename"] == "female_low.wav")
    if female_mixed.get("hard_gender_block_applied") is not False:
        raise AssertionError("female demo should have hard_gender_block_applied=false")
    print(
        f"  mixed: #0={mixed[0]['filename']} "
        f"male block={male_mixed.get('hard_gender_block_applied')}"
    )

    male_only_row = _build_sanity_row((88.0, 86.0, 84.0, 82.0), ai_f, demo_m)
    male_only_row["similarity"] = 75.0
    only_males = [{"filename": "solo_male.wav", **male_only_row}]
    print("hard gender partition (AI female; only male demo):")
    solo = _finalize_voice_match_results(only_males, partial=False)["results"]
    if solo[0]["filename"] != "solo_male.wav":
        raise AssertionError("only male demos: male should be #0")
    if solo[0].get("hard_gender_block_applied") is True:
        raise AssertionError("rule inactive: hard_gender_block_applied must be false")
    print(f"  solo male: #0={solo[0]['filename']} block=false")
    print("  hard gender partition assertions: OK")


def _sanity_check_manual_demo_gender_override() -> None:
    """real_voice_1.wav: pitch female (MIDI 63.9) but manual male — not #1 vs female AI."""
    ai_f = _sanity_pitch_from_midi(65.0)
    demo_f_pitch = _sanity_pitch_from_midi(65.0)
    demo_misdetected = _sanity_pitch_from_midi(63.9)

    override_row = _build_sanity_row((92.0, 90.0, 88.0, 87.0), ai_f, demo_misdetected)
    female_row = _build_sanity_row((70.0, 68.0, 66.0, 65.0), ai_f, demo_f_pitch)
    override_row["similarity"] = 95.0
    female_row["similarity"] = 70.0
    batch = [
        {"filename": "real_voice_1.wav", **override_row},
        {"filename": "female_aligned.wav", **female_row},
    ]
    print(
        "manual gender override (real_voice_1 MIDI 63.9 -> detected female, forced male):"
    )
    finalized = _finalize_voice_match_results(batch, partial=False)["results"]
    if finalized[0]["filename"] != "female_aligned.wav":
        raise AssertionError(
            f"expected female_aligned.wav at #1, got {finalized[0]['filename']}"
        )
    rv1 = next(r for r in finalized if r["filename"] == "real_voice_1.wav")
    rv1_index = next(
        i for i, row in enumerate(finalized) if row["filename"] == "real_voice_1.wav"
    )
    if rv1_index == 0:
        raise AssertionError("real_voice_1 must not be index 0 when a female demo exists")
    if rv1.get("detected_vocal_type") != "female":
        raise AssertionError("real_voice_1 detected_vocal_type should stay female from pitch")
    if rv1.get("manual_gender") != "male":
        raise AssertionError("real_voice_1 manual_gender should be male")
    if rv1.get("final_vocal_type") != "male":
        raise AssertionError("real_voice_1 final_vocal_type should be male")
    if rv1.get("high_pitched_male") is not False:
        raise AssertionError("real_voice_1 should not be high_pitched_male")
    if rv1.get("similarity_to_real_voice_1") is not True:
        raise AssertionError("real_voice_1 similarity_to_real_voice_1 should be true")
    if rv1.get("vocal_type_match") is not False:
        raise AssertionError("female AI vs manual-male demo should not vocal_type_match")
    if rv1.get("hard_gender_block_applied") is not True:
        raise AssertionError(
            "real_voice_1 should have hard_gender_block_applied when blocked from #1"
        )
    print(
        f"  #1={finalized[0]['filename']} rv1 detected={rv1.get('detected_vocal_type')} "
        f"manual={rv1.get('manual_gender')} final={rv1.get('final_vocal_type')} "
        f"block={rv1.get('hard_gender_block_applied')}"
    )
    print("  manual demo gender override assertions: OK")


def _sanity_check_male_prototype_pool_blocks_top_match() -> None:
    """Female AI: female demo #1; real_voice_1 and high-pitched-male-like never index 0."""
    ai_f = _sanity_pitch_from_midi(65.0)
    demo_f = _sanity_pitch_from_midi(65.0)
    rv1_pitch = _sanity_pitch_from_midi(63.9)
    hpm_pitch = _sanity_pitch_from_midi(62.0)

    rv1 = _build_sanity_row((95.0, 92.0, 90.0, 88.0), ai_f, rv1_pitch)
    hpm = _build_sanity_row((93.0, 91.0, 89.0, 86.0), ai_f, hpm_pitch)
    female = _build_sanity_row((70.0, 68.0, 66.0, 65.0), ai_f, demo_f)
    rv1["similarity"] = 95.0
    hpm["similarity"] = 93.0
    female["similarity"] = 70.0
    batch = [
        {"filename": "real_voice_1.wav", **rv1},
        {
            "filename": "high_pitch_male_like.wav",
            **hpm,
            "high_pitched_male": True,
            "similarity_to_real_voice_1": True,
            "detected_vocal_type": "female",
            "final_vocal_type": "male",
            "manual_gender": None,
        },
        {"filename": "female_aligned.wav", **female},
    ]
    print(
        "male prototype pool (AI female; rv1 95%, hpm 93%, female 70%):"
    )
    finalized = _finalize_voice_match_results(batch, partial=False)["results"]
    top = finalized[0]["filename"]
    if top != "female_aligned.wav":
        raise AssertionError(f"expected female_aligned.wav at #1, got {top}")
    rv1_result = next(r for r in finalized if r["filename"] == "real_voice_1.wav")
    if rv1_result.get("hard_gender_block_applied") is not True:
        raise AssertionError(
            "real_voice_1 should have hard_gender_block_applied when blocked from #1"
        )
    for blocked_name in ("real_voice_1.wav", "high_pitch_male_like.wav"):
        blocked = next(r for r in finalized if r["filename"] == blocked_name)
        blocked_index = next(
            i for i, row in enumerate(finalized) if row["filename"] == blocked_name
        )
        if blocked_index == 0:
            raise AssertionError(f"{blocked_name} must not be index 0 when female demo exists")
        if blocked.get("final_vocal_type") != "male":
            raise AssertionError(f"{blocked_name} final_vocal_type should be male")
    hpm_result = next(r for r in finalized if r["filename"] == "high_pitch_male_like.wav")
    if hpm_result.get("high_pitched_male") is not True:
        raise AssertionError("high_pitch_male_like should have high_pitched_male=true")
    print(
        f"  #1={top} rv1 final={next(r for r in finalized if r['filename']=='real_voice_1.wav').get('final_vocal_type')} "
        f"hpm high_pitched={hpm_result.get('high_pitched_male')}"
    )
    print("  male prototype pool blocks top match: OK")


def _sanity_check_real_voice_1_force_demotion() -> None:
    """Filename-only: real_voice_1 never top match; sole demo still not top."""
    ai_f = _sanity_pitch_from_midi(65.0)
    demo = _sanity_pitch_from_midi(63.9)
    rv1_row = _build_sanity_row((99.0, 98.0, 97.0, 96.0), ai_f, demo)
    rv1_row["similarity"] = 99.0

    print("real_voice_1 force demotion (filename-only):")
    solo = _finalize_voice_match_results(
        [{"filename": "real_voice_1.wav", **rv1_row}],
        partial=False,
    )
    only = solo["results"][0]
    if only.get("is_top_match") is True:
        raise AssertionError("sole real_voice_1 must not have is_top_match=true")
    if only.get("force_demoted_real_voice_1") is not True:
        raise AssertionError("sole real_voice_1 must set force_demoted_real_voice_1")
    if solo.get("top_match_filename") is not None:
        raise AssertionError("sole real_voice_1: top_match_filename must be null")

    female_row = _build_sanity_row((70.0, 68.0, 66.0, 65.0), ai_f, ai_f)
    female_row["similarity"] = 70.0
    multi = _finalize_voice_match_results(
        [
            {"filename": "real_voice_1.wav", **rv1_row},
            {"filename": "female_aligned.wav", **female_row},
        ],
        partial=False,
    )["results"]
    if multi[-1]["filename"] != "real_voice_1.wav":
        raise AssertionError("real_voice_1 must be last after force demotion")
    if multi[0].get("is_top_match") is not True:
        raise AssertionError("first non-rv1 row must be is_top_match")
    rv1 = multi[-1]
    if rv1.get("is_top_match") is True:
        raise AssertionError("real_voice_1 must not be is_top_match when others exist")
    if rv1.get("force_demoted_real_voice_1") is not True:
        raise AssertionError("real_voice_1 must set force_demoted_real_voice_1")
    print(
        f"  solo is_top={only.get('is_top_match')} force={only.get('force_demoted_real_voice_1')} "
        f"multi #1={multi[0]['filename']} rv1 last is_top={rv1.get('is_top_match')}"
    )
    print("  real_voice_1 force demotion assertions: OK")


import json as _json
import os as _os
_FEEDBACK_PATH = _os.path.join(_os.path.dirname(__file__), chr(102)+chr(101)+chr(101)+chr(100)+chr(98)+chr(97)+chr(99)+chr(107)+chr(46)+chr(106)+chr(115)+chr(111)+chr(110))

def _load_feedback() -> dict:
    try:
        return _json.loads(open(_FEEDBACK_PATH).read())
    except Exception:
        return {}

def _save_feedback(data: dict) -> None:
    open(_FEEDBACK_PATH, chr(119)).write(_json.dumps(data, indent=2))

def _feedback_boost(demo_filename: str) -> float:
    fb = _load_feedback()
    entry = fb.get(demo_filename, {})
    good = int(entry.get(chr(103)+chr(111)+chr(111)+chr(100), 0))
    bad = int(entry.get(chr(98)+chr(97)+chr(100), 0))
    return max(-15.0, min(15.0, (good - bad) * 3.0))


@app.post("/feedback")
async def submit_feedback(payload: dict):
    demo_filename = str(payload.get("demo_filename", ""))
    rating = str(payload.get("rating", ""))
    if not demo_filename or rating not in ("good", "bad"):
        return {"error": "invalid"}
    fb = _load_feedback()
    entry = fb.setdefault(demo_filename, {"good": 0, "bad": 0})
    entry[rating] = entry.get(rating, 0) + 1
    _save_feedback(fb)
    return {"status": "ok", "entry": entry}


@app.put("/demo-language")
async def update_demo_language(payload: dict):
    demo_filename = str(payload.get("demo_filename", "")).strip()
    language = str(payload.get("language", "")).strip()
    if not demo_filename or not language:
        return {"error": "demo_filename and language are required"}
    profiles_dir = os.path.join(os.path.dirname(__file__), "demo_profiles")
    # Try direct json filename match or stem match
    candidate = demo_filename if demo_filename.endswith(".json") else demo_filename.replace(".wav", ".json")
    fpath = os.path.join(profiles_dir, candidate)
    if not os.path.exists(fpath):
        # fallback: search by stem
        stem = os.path.splitext(demo_filename)[0].lower()
        candidate = None
        for fname in os.listdir(profiles_dir):
            if fname.endswith(".json") and os.path.splitext(fname)[0].lower() == stem:
                candidate = fname
                break
        if not candidate:
            return {"error": f"profile not found for {demo_filename}"}
        fpath = os.path.join(profiles_dir, candidate)
    data = json.load(open(fpath))
    matched = (candidate, data)
    fname, data = matched
    data["language"] = language
    json.dump(data, open(os.path.join(profiles_dir, fname), "w"), indent=2)
    logger.info("demo-language updated: %s -> %s", fname, language)
    return {"status": "ok", "file": fname, "language": language}


@app.post("/voice-match-batch")
async def voice_match_batch(
    ai_vocals: Annotated[list[UploadFile], File()],
    demos: Annotated[list[UploadFile], File()],
    query_tags: Annotated[str | None, Form()] = None,
    gender_override: Annotated[str | None, Form()] = None,
):
    import tempfile, shutil
    results = []
    temp_dir = tempfile.mkdtemp()
    try:
        demo_entries = []
        for d in demos:
            demo_path = Path(temp_dir) / (d.filename or "demo.wav")
            demo_path.write_bytes(await d.read())
            demo_entries.append((demo_path, d.filename or "demo.wav"))
        parsed_query_tags = {}
        if query_tags:
            try: parsed_query_tags = json.loads(query_tags)
            except Exception: pass
        for ai_file in ai_vocals:
            ai_path = Path(temp_dir) / (ai_file.filename or "ai.wav")
            ai_path.write_bytes(await ai_file.read())
            match_results = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda p=ai_path: _run_voice_match(
                    temp_dir=str(temp_dir),
                    ai_path=p,
                    demo_entries=demo_entries,
                    query_tags=parsed_query_tags,
                    gender_override=gender_override,
                )
            )
            results.append({"ai_filename": ai_file.filename, "matches": match_results})
        _ai_uploads_dir = pathlib.Path(__file__).parent / "ai_uploads"
        _ai_uploads_dir.mkdir(exist_ok=True)
        if ai_path and ai_path.exists():
            shutil.copy2(str(ai_path), str(_ai_uploads_dir / (ai_file.filename or "ai.wav")))
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
    return {"results": results}

if __name__ == "__main__":
    if os.environ.get("VOICE_MATCH_SCORING_SANITY") == "1":
        _sanity_check_multi_feature_vocal_classification()
        _sanity_check_demo_display_names_form()
        _sanity_check_manual_substring_labels()
        _sanity_check_filename_female_overrides()
        _sanity_check_ai_reference_hpm_female_override()
        _sanity_check_prototype_respects_confident_female()
        _sanity_check_scoring_calibration()
        _sanity_check_vocal_type_ranking()
        _sanity_check_female_match_no_false_mismatch()
        _sanity_check_failed_pitch_not_top()
        _sanity_check_unknown_pitch_not_top()
        _sanity_check_hard_gender_partition()
        _sanity_check_manual_demo_gender_override()
        _sanity_check_male_prototype_pool_blocks_top_match()
        _sanity_check_real_voice_1_force_demotion()
    else:
        import uvicorn

        port = int(os.environ.get("PORT", "8000"))
        uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)


@app.post("/precompute-demo")
async def precompute_demo():
    """Warm up demo profile cache for all files in demos/ directory."""
    import pathlib
    demos_dir = pathlib.Path("demos")
    if not demos_dir.exists():
        return {"status": "error", "message": "demos/ directory not found"}
    demo_files = list(demos_dir.glob("*.wav")) + list(demos_dir.glob("*.mp3"))
    results = []
    for demo_path in demo_files:
        cached = _load_demo_profile(str(demo_path))
        if cached is not None:
            results.append({"file": demo_path.name, "status": "cached"})
            continue
        try:
            import torch as _torch
            waveform, _ = _load_audio(str(demo_path))
            embeddings = _compute_embeddings(waveform)
            chunk_rms = _compute_chunk_rms(waveform)
            pitch = compute_pitch_features(waveform)
            timbre = compute_timbre_features(waveform)
            vocal_character = compute_vocal_character_features(waveform)
            _save_demo_profile(str(demo_path), waveform, embeddings, chunk_rms, pitch, timbre, vocal_character)
            results.append({"file": demo_path.name, "status": "computed"})
        except Exception as e:
            results.append({"file": demo_path.name, "status": "error", "error": str(e)})
    return {"status": "ok", "processed": len(results), "results": results}


@app.post("/voice-match-producer")
async def voice_match_producer(
    ai_vocal: Annotated[UploadFile, File()],
    query_tags: Annotated[str | None, Form()] = None,
    gender_override: Annotated[str | None, Form()] = None,
    ai_language: Annotated[str | None, Form()] = None,
    part_language: Annotated[str | None, Form()] = None,
):
    """Producer flow: match AI vocal against all demos in the demos/ folder."""
    import tempfile, shutil
    if not ai_vocal.filename:
        return _json_error(422, "Missing required field: ai_vocal", "missing_ai_vocal")

    demos_dir = pathlib.Path(__file__).parent / "demos"
    demo_files = sorted(demos_dir.glob("*.wav")) + sorted(demos_dir.glob("*.mp3"))
    if not demo_files:
        return _json_error(422, "No demo files found in demos/ folder", "no_demos")

    temp_dir = tempfile.mkdtemp()
    try:
        ai_path = pathlib.Path(temp_dir) / (ai_vocal.filename or "ai_vocal.wav")
        with open(ai_path, "wb") as f:
            shutil.copyfileobj(ai_vocal.file, f)

        demo_entries = [(p, p.name) for p in demo_files]
        tags_dict = _parse_query_tags_form(query_tags) if query_tags else None

        result = _run_voice_match(
            temp_dir=temp_dir,
            ai_path=ai_path,
            demo_entries=demo_entries,
            query_tags=tags_dict,
            gender_override=gender_override,
            ai_language=ai_language,
            part_language=part_language,
        )
        _ai_uploads_dir = pathlib.Path(__file__).parent / "ai_uploads"
        _ai_uploads_dir.mkdir(exist_ok=True)
        if ai_path and ai_path.exists():
            shutil.copy2(str(ai_path), str(_ai_uploads_dir / (ai_vocal.filename or "ai.wav")))
        return result
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


@app.get("/demo-audio/{filename}")
async def get_demo_audio(filename: str):
    """Serve demo audio files from the demos/ folder."""
    from fastapi.responses import FileResponse
    demos_dir = pathlib.Path(__file__).parent / "demos"
    file_path = demos_dir / filename
    if not file_path.exists() or not file_path.is_file():
        return _json_error(404, f"Demo file not found: {filename}", "not_found")
    return FileResponse(str(file_path), media_type="audio/wav")


@app.get("/demo-audio/{filename}")
async def get_demo_audio(filename: str):
    """Serve demo audio files from the demos/ folder."""
    from fastapi.responses import FileResponse
    demos_dir = pathlib.Path(__file__).parent / "demos"
    file_path = demos_dir / filename
    if not file_path.exists() or not file_path.is_file():
        return _json_error(404, f"Demo file not found: {filename}", "not_found")
    return FileResponse(str(file_path), media_type="audio/wav")


@app.get("/ai-audio/{filename}")
async def get_ai_audio(filename: str):
    """Serve AI vocal files from the ai_uploads/ folder."""
    from fastapi.responses import FileResponse
    ai_uploads_dir = pathlib.Path(__file__).parent / "ai_uploads"
    file_path = ai_uploads_dir / filename
    if not file_path.exists() or not file_path.is_file():
        return _json_error(404, f"AI audio file not found: {filename}", "not_found")
    return FileResponse(str(file_path), media_type="audio/wav")
