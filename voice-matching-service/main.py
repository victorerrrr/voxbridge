import os

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
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
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
ECAPA_SAMPLE_RATE = 16000
MAX_AUDIO_SECONDS = 15
REQUEST_TIMEOUT_SEC = 10
# Rough CPU budget to attempt one Demucs pass on the AI vocal.
DEMUCS_MIN_REMAINING_SEC = 2.5
DEMUCS_MODEL_NAME = os.environ.get("DEMUCS_MODEL", "htdemucs")
# Chunk averaging: 5 x ~3 s windows within the 15 s trim (index-aligned pairs).
CHUNK_DURATION_SEC = 3.0
MAX_CHUNKS = 5
# Mono samples in [-1, 1]; segments below this RMS are treated as silent and skipped.
CHUNK_MIN_RMS = 0.01

_classifier: "EncoderClassifier | None" = None
_demucs_model: Any = None
_ml_loaded = False
torch: Any = None
torchaudio: Any = None
apply_model: Any = None
get_model: Any = None
EncoderClassifier: Any = None
LocalStrategy: Any = None


def _load_ml_stack() -> None:
    global _ml_loaded, torch, torchaudio, apply_model, get_model, EncoderClassifier, LocalStrategy
    if _ml_loaded:
        return
    _clear_proxy_env()
    import torch as _torch
    import torchaudio as _torchaudio
    from demucs.apply import apply_model as _apply_model
    from demucs.pretrained import get_model as _get_model
    from speechbrain.inference.speaker import EncoderClassifier as _EncoderClassifier
    from speechbrain.utils.fetching import LocalStrategy as _LocalStrategy

    torch = _torch
    torchaudio = _torchaudio
    apply_model = _apply_model
    get_model = _get_model
    EncoderClassifier = _EncoderClassifier
    LocalStrategy = _LocalStrategy
    _ml_loaded = True


def get_classifier() -> "EncoderClassifier":
    global _classifier
    if _classifier is None:
        _clear_proxy_env()
        _load_ml_stack()
        logger.info("Loading SpeechBrain model: %s", MODEL_SOURCE)
        _classifier = EncoderClassifier.from_hparams(
            source=MODEL_SOURCE,
            savedir=MODEL_SAVEDIR,
            run_opts={"device": "cpu"},
            local_strategy=LocalStrategy.COPY,
        )
    return _classifier


def get_demucs_model():
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
        logger.info("Voice matching model ready.")
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


def _timeout_response(step: str = "timeout") -> JSONResponse:
    return JSONResponse(
        status_code=408,
        content={
            "error": (
                f"Voice matching exceeded {REQUEST_TIMEOUT_SEC} second processing limit"
            ),
            "step": step,
        },
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
    logger.info("Audio trimmed to 15 seconds")


def _save_upload(upload: UploadFile, directory: str) -> Path:
    safe_name = Path(upload.filename or "audio").name
    dest = Path(directory) / safe_name
    with dest.open("wb") as out:
        shutil.copyfileobj(upload.file, out)
    return dest


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

    use_demucs = run_demucs
    if use_demucs and budget is not None:
        if budget.exceeded() or budget.remaining() < DEMUCS_MIN_REMAINING_SEC:
            use_demucs = False
            logger.warning("Skipping Demucs for %s (time budget)", label)

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


def embedding_for_chunks(
    classifier: "EncoderClassifier",
    chunks: list[tuple[int, Any]],
) -> dict[int, np.ndarray]:
    embeddings: dict[int, np.ndarray] = {}
    for index, chunk in chunks:
        with torch.no_grad():
            embedding = classifier.encode_batch(chunk)
        embeddings[index] = _normalize_embedding_vector(embedding)
    return embeddings


def average_chunk_similarity(
    ai_embs: dict[int, np.ndarray],
    demo_embs: dict[int, np.ndarray],
) -> tuple[float, int]:
    """Average cosine similarity for chunk indices present in both tracks."""
    shared_indices = sorted(set(ai_embs) & set(demo_embs))
    if not shared_indices:
        raise ValueError("No chunk pairs for similarity (all silent or empty)")
    scores = [
        _cosine_similarity_percent(ai_embs[i], demo_embs[i]) for i in shared_indices
    ]
    return round(sum(scores) / len(scores), 1), len(shared_indices)


def _extract_chunk_embeddings(
    classifier: "EncoderClassifier",
    path: Path,
    step: list[str] | None = None,
    budget: RequestBudget | None = None,
    run_demucs: bool = True,
) -> tuple[Any, dict[int, np.ndarray]]:
    """Mono 16 kHz waveform (15 s) and per-chunk ECAPA embeddings."""
    _load_ml_stack()
    label = path.name
    if step is not None:
        step[0] = "embedding"
    logger.info("embedding start for %s", label)
    waveform = _waveform_for_embedding(path, step, budget, run_demucs)
    chunks = split_into_chunks(waveform, ECAPA_SAMPLE_RATE)
    if not chunks:
        raise ValueError(f"No non-silent chunks in: {label}")
    embeddings = embedding_for_chunks(classifier, chunks)
    logger.info("embedding done for %s (%d chunk(s))", label, len(embeddings))
    return waveform, embeddings


def _cosine_similarity_percent(a: np.ndarray, b: np.ndarray) -> float:
    similarity = 1.0 - float(cosine(a, b))
    similarity = max(0.0, min(1.0, similarity))
    return round(similarity * 100.0, 1)


def _waveform_to_numpy(waveform: Any) -> np.ndarray:
    _load_ml_stack()
    return waveform.squeeze().cpu().numpy().astype(np.float64)


def _round_score(value: float) -> float:
    return round(max(0.0, min(100.0, value)), 1)


def compute_pitch_features(waveform: Any, sr: int = ECAPA_SAMPLE_RATE) -> dict[str, float | str]:
    """Average pitch, voiced range, and coarse register band from mono waveform."""
    import librosa

    y = _waveform_to_numpy(waveform)
    if y.size == 0:
        return {
            "avg_hz": 0.0,
            "min_hz": 0.0,
            "max_hz": 0.0,
            "register": "unknown",
        }

    f0 = librosa.yin(
        y,
        fmin=librosa.note_to_hz("C2"),
        fmax=librosa.note_to_hz("C7"),
        sr=sr,
    )
    voiced = f0[np.isfinite(f0) & (f0 > 0)]
    if voiced.size == 0:
        return {
            "avg_hz": 0.0,
            "min_hz": 0.0,
            "max_hz": 0.0,
            "register": "unknown",
        }

    avg_hz = float(np.mean(voiced))
    min_hz = float(np.min(voiced))
    max_hz = float(np.max(voiced))
    if avg_hz < 165.0:
        register = "low"
    elif avg_hz < 330.0:
        register = "mid"
    else:
        register = "high"
    return {
        "avg_hz": avg_hz,
        "min_hz": min_hz,
        "max_hz": max_hz,
        "register": register,
    }


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


def _range_overlap_percent(a_min: float, a_max: float, b_min: float, b_max: float) -> float:
    if a_max <= a_min or b_max <= b_min:
        return 0.0
    overlap = max(0.0, min(a_max, b_max) - max(a_min, b_min))
    union = max(a_max, b_max) - min(a_min, b_min)
    if union <= 0:
        return 0.0
    return _round_score(100.0 * overlap / union)


def _register_match_score(ai_register: str, demo_register: str) -> float:
    order = {"low": 0, "mid": 1, "high": 2, "unknown": -1}
    ai_i = order.get(ai_register, -1)
    demo_i = order.get(demo_register, -1)
    if ai_i < 0 or demo_i < 0:
        return 50.0
    distance = abs(ai_i - demo_i)
    if distance == 0:
        return 100.0
    if distance == 1:
        return 55.0
    return 20.0


def pitch_similarity(ai: dict[str, float | str], demo: dict[str, float | str]) -> float:
    """0–100 pitch/register similarity between two tracks."""
    ai_avg = float(ai.get("avg_hz", 0) or 0)
    demo_avg = float(demo.get("avg_hz", 0) or 0)
    if ai_avg <= 0 or demo_avg <= 0:
        return 50.0

    avg_dist = abs(ai_avg - demo_avg)
    avg_score = _round_score(100.0 * max(0.0, 1.0 - avg_dist / 180.0))
    range_score = _range_overlap_percent(
        float(ai.get("min_hz", 0) or 0),
        float(ai.get("max_hz", 0) or 0),
        float(demo.get("min_hz", 0) or 0),
        float(demo.get("max_hz", 0) or 0),
    )
    register_score = _register_match_score(
        str(ai.get("register", "unknown")),
        str(demo.get("register", "unknown")),
    )
    return _round_score(0.45 * avg_score + 0.35 * range_score + 0.20 * register_score)


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


def combine_scores(
    speaker: float,
    timbre: float,
    pitch: float,
    quality: float,
) -> float:
    """Weighted final similarity (0–100)."""
    return _round_score(
        0.40 * speaker + 0.30 * timbre + 0.25 * pitch + 0.05 * quality
    )


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
) -> list[dict] | JSONResponse:
    budget = RequestBudget()
    step_ref: list[str] = ["loading"]
    classifier = get_classifier()

    try:
        if budget.exceeded():
            return _timeout_response(step_ref[0])

        step_ref[0] = "loading"
        ai_wav = load_audio_to_wav(str(ai_path), temp_dir)
        if budget.exceeded():
            return _timeout_response(step_ref[0])

        ai_waveform, ai_embeddings = _extract_chunk_embeddings(
            classifier,
            Path(ai_wav),
            step_ref,
            budget,
            run_demucs=True,
        )
        if budget.exceeded():
            return _timeout_response(step_ref[0])

        step_ref[0] = "features"
        ai_pitch = compute_pitch_features(ai_waveform)
        ai_timbre = compute_timbre_features(ai_waveform)
        ai_quality = quality_score(ai_waveform)
        logger.info(
            "AI vocal features: pitch_avg=%.1fHz register=%s quality=%.1f",
            float(ai_pitch.get("avg_hz", 0) or 0),
            ai_pitch.get("register"),
            ai_quality,
        )
    except ValueError as exc:
        return _json_error(400, str(exc), str(exc), step_ref[0])

    results: list[dict] = []
    for demo_path, demo_filename in demo_entries:
        if budget.exceeded():
            return _timeout_response(step_ref[0])

        try:
            step_ref[0] = "loading"
            demo_wav = load_audio_to_wav(str(demo_path), temp_dir)
            if budget.exceeded():
                return _timeout_response(step_ref[0])

            step_ref[0] = "embedding"
            demo_waveform, demo_embeddings = _extract_chunk_embeddings(
                classifier,
                Path(demo_wav),
                step_ref,
                budget,
                run_demucs=False,
            )
            if budget.exceeded():
                return _timeout_response(step_ref[0])

            step_ref[0] = "similarity"
            speaker_score, chunks_used = average_chunk_similarity(
                ai_embeddings, demo_embeddings
            )
            logger.info(
                "Using chunk averaging (%d chunks) for %s",
                chunks_used,
                demo_filename,
            )

            step_ref[0] = "features"
            demo_pitch = compute_pitch_features(demo_waveform)
            demo_timbre = compute_timbre_features(demo_waveform)
            demo_quality = quality_score(demo_waveform)
            pitch_sc = pitch_similarity(ai_pitch, demo_pitch)
            timbre_sc = timbre_similarity(ai_timbre, demo_timbre)
            quality_sc = demo_quality
            similarity = combine_scores(speaker_score, timbre_sc, pitch_sc, quality_sc)
            reasons = _reasons_from_breakdown(
                speaker_score,
                timbre_sc,
                pitch_sc,
                quality_sc,
                ai_pitch,
                demo_pitch,
            )
            logger.info(
                "%s scores: final=%.1f speaker=%.1f timbre=%.1f pitch=%.1f quality=%.1f",
                demo_filename,
                similarity,
                speaker_score,
                timbre_sc,
                pitch_sc,
                quality_sc,
            )
            results.append(
                {
                    "filename": demo_filename,
                    "similarity": similarity,
                    "chunks_used": chunks_used,
                    "speaker_score": speaker_score,
                    "timbre_score": timbre_sc,
                    "pitch_score": pitch_sc,
                    "quality_score": quality_sc,
                    "reasons": reasons,
                }
            )
        except ValueError as exc:
            return _json_error(400, str(exc), str(exc), step_ref[0])

    if not results:
        return _json_error(
            422,
            "No valid demo files were provided",
            "no_valid_demos",
        )

    results.sort(key=lambda row: row["similarity"], reverse=True)
    logger.info("voice-match complete: %d result(s)", len(results))
    return results


@app.post("/voice-match")
async def voice_match(
    ai_vocal: Annotated[UploadFile, File()],
    demos: Annotated[list[UploadFile], File()],
):
    logger.info("request received")
    temp_dir: str | None = None
    step_ref: list[str] = ["loading"]
    budget = RequestBudget()
    try:
        demo_files = demos if isinstance(demos, list) else [demos]

        ai_name = Path(ai_vocal.filename or "").name or "(unnamed)"
        demo_names = [
            Path(d.filename or "").name or "(unnamed)"
            for d in demo_files
            if d.filename
        ]
        logger.info("ai_vocal filename: %s", ai_name)
        logger.info("demos count: %d", len(demo_names))

        if not ai_vocal.filename:
            return _json_error(422, "Missing required field: ai_vocal", "missing_ai_vocal")

        if len(demo_files) == 0 or not demo_names:
            return _json_error(
                422,
                "Missing required field: demos (at least one file)",
                "missing_demos",
            )

        temp_dir = tempfile.mkdtemp(prefix="voxbridge-voice-match-")
        ai_path = _save_upload(ai_vocal, temp_dir)
        demo_entries: list[tuple[Path, str]] = []
        for demo in demo_files:
            if not demo.filename:
                continue
            demo_entries.append((_save_upload(demo, temp_dir), demo.filename))

        if not demo_entries:
            return _json_error(
                422,
                "No valid demo files were provided",
                "no_valid_demos",
            )

        outcome = await asyncio.wait_for(
            asyncio.to_thread(_run_voice_match, temp_dir, ai_path, demo_entries),
            timeout=REQUEST_TIMEOUT_SEC,
        )
        if isinstance(outcome, JSONResponse):
            return outcome
        return outcome
    except asyncio.TimeoutError:
        return _timeout_response("timeout")
    except HTTPException:
        raise
    except Exception as exc:
        return _server_error_500(exc, step_ref[0])
    finally:
        logger.info("processing elapsed %.1fs", budget.elapsed())
        if temp_dir:
            shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
