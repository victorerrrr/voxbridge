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

import logging
import shutil
import tempfile
import traceback
from contextlib import asynccontextmanager
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
DEMUCS_MAX_SECONDS = 15
DEMUCS_MODEL_NAME = os.environ.get("DEMUCS_MODEL", "htdemucs")

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
        return str(wav_path)
    except Exception as exc:
        errors.append(f"librosa: {exc}")
        if wav_path.exists():
            wav_path.unlink()

    reason = "; ".join(errors)
    raise ValueError(f"Could not decode audio: {label}: {reason}")


def _truncate_waveform(waveform: Any, sample_rate: int) -> Any:
    _load_ml_stack()
    max_samples = int(DEMUCS_MAX_SECONDS * sample_rate)
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


def _waveform_for_embedding(path: Path, step: list[str] | None = None) -> Any:
    label = path.name
    waveform, sample_rate = _load_waveform_tensor(path)

    if waveform.numel() == 0:
        raise ValueError(f"Audio file is empty: {label}")

    truncated = _truncate_waveform(waveform, sample_rate)

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


def _extract_embedding(
    classifier: "EncoderClassifier", path: Path, step: list[str] | None = None
) -> np.ndarray:
    _load_ml_stack()
    label = path.name
    if step is not None:
        step[0] = "embedding"
    logger.info("embedding start for %s", label)
    waveform = _waveform_for_embedding(path, step)
    with torch.no_grad():
        embedding = classifier.encode_batch(waveform)
    logger.info("embedding done for %s", label)
    vector = embedding.squeeze().cpu().numpy().astype(np.float64)
    norm = np.linalg.norm(vector)
    if norm == 0:
        raise ValueError(f"Could not extract embedding from: {path.name}")
    return vector / norm


def _cosine_similarity_percent(a: np.ndarray, b: np.ndarray) -> float:
    similarity = 1.0 - float(cosine(a, b))
    similarity = max(0.0, min(1.0, similarity))
    return round(similarity * 100.0, 1)


def _reasons_for_similarity(similarity: float) -> list[str]:
    if similarity >= 85:
        return [
            "Similar vocal tone",
            "Close pitch range",
            "Matching vocal texture",
        ]
    if similarity >= 70:
        return [
            "Similar tone",
            "Close pitch range",
            "Matching genre",
        ]
    if similarity >= 50:
        return [
            "Partial tonal overlap",
            "Some shared vocal character",
        ]
    return [
        "Low similarity",
        "Distinct voice character",
    ]


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/voice-match")
async def voice_match(
    ai_vocal: Annotated[UploadFile, File()],
    demos: Annotated[list[UploadFile], File()],
):
    logger.info("request received")
    temp_dir: str | None = None
    step_ref: list[str] = ["loading"]
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

        step_ref[0] = "loading"
        temp_dir = tempfile.mkdtemp(prefix="voxbridge-voice-match-")
        classifier = get_classifier()

        try:
            ai_path = _save_upload(ai_vocal, temp_dir)
            step_ref[0] = "loading"
            ai_wav = load_audio_to_wav(str(ai_path), temp_dir)
            ai_embedding = _extract_embedding(classifier, Path(ai_wav), step_ref)
        except ValueError as exc:
            return _json_error(400, str(exc), str(exc), step_ref[0])

        results: list[dict] = []
        for demo in demo_files:
            if not demo.filename:
                continue
            demo_path = _save_upload(demo, temp_dir)
            try:
                step_ref[0] = "loading"
                demo_wav = load_audio_to_wav(str(demo_path), temp_dir)
                step_ref[0] = "embedding"
                demo_embedding = _extract_embedding(classifier, Path(demo_wav), step_ref)
                step_ref[0] = "similarity"
                similarity = _cosine_similarity_percent(ai_embedding, demo_embedding)
                results.append(
                    {
                        "filename": demo.filename,
                        "similarity": similarity,
                        "reasons": _reasons_for_similarity(similarity),
                    }
                )
            except ValueError as exc:
                return _json_error(
                    400,
                    str(exc),
                    str(exc),
                    step_ref[0],
                )

        if not results:
            return _json_error(
                422,
                "No valid demo files were provided",
                "no_valid_demos",
            )

        results.sort(key=lambda row: row["similarity"], reverse=True)
        logger.info("voice-match complete: %d result(s)", len(results))
        return results
    except HTTPException:
        raise
    except Exception as exc:
        return _server_error_500(exc, step_ref[0])
    finally:
        if temp_dir:
            shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
