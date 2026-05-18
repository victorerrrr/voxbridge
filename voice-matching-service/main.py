import logging
import os
import shutil
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated

import numpy as np
import torch
import torchaudio
from demucs.apply import apply_model
from demucs.pretrained import get_model
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from scipy.spatial.distance import cosine
from speechbrain.inference.speaker import EncoderClassifier

logger = logging.getLogger(__name__)

MODEL_SOURCE = "speechbrain/spkrec-ecapa-voxceleb"
MODEL_SAVEDIR = "pretrained_models/spkrec-ecapa-voxceleb"
ECAPA_SAMPLE_RATE = 16000
DEMUCS_MAX_SECONDS = 15
DEMUCS_MODEL_NAME = os.environ.get("DEMUCS_MODEL", "htdemucs")

_classifier: EncoderClassifier | None = None
_demucs_model = None


def get_classifier() -> EncoderClassifier:
    global _classifier
    if _classifier is None:
        logger.info("Loading SpeechBrain model: %s", MODEL_SOURCE)
        _classifier = EncoderClassifier.from_hparams(
            source=MODEL_SOURCE,
            savedir=MODEL_SAVEDIR,
            run_opts={"device": "cpu"},
        )
    return _classifier


def get_demucs_model():
    global _demucs_model
    if _demucs_model is None:
        logger.info("Loading Demucs model: %s", DEMUCS_MODEL_NAME)
        model = get_model(DEMUCS_MODEL_NAME)
        model.cpu()
        model.eval()
        _demucs_model = model
    return _demucs_model


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
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
    expose_headers=["*"],
)


def _save_upload(upload: UploadFile, directory: str) -> Path:
    safe_name = Path(upload.filename or "audio").name
    dest = Path(directory) / safe_name
    with dest.open("wb") as out:
        shutil.copyfileobj(upload.file, out)
    return dest


def _truncate_waveform(waveform: torch.Tensor, sample_rate: int) -> torch.Tensor:
    max_samples = int(DEMUCS_MAX_SECONDS * sample_rate)
    if waveform.shape[-1] > max_samples:
        waveform = waveform[..., :max_samples]
    return waveform


def _to_mono_16k(waveform: torch.Tensor, sample_rate: int) -> torch.Tensor:
    if waveform.shape[0] > 1:
        waveform = waveform.mean(dim=0, keepdim=True)
    if sample_rate != ECAPA_SAMPLE_RATE:
        waveform = torchaudio.functional.resample(waveform, sample_rate, ECAPA_SAMPLE_RATE)
    return waveform


def _demucs_vocals_stem(waveform: torch.Tensor, sample_rate: int) -> torch.Tensor:
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


def _waveform_for_embedding(path: Path) -> torch.Tensor:
    label = path.name
    try:
        waveform, sample_rate = torchaudio.load(str(path))
    except Exception as exc:
        raise ValueError(f"Could not decode audio: {label}") from exc

    if waveform.numel() == 0:
        raise ValueError(f"Audio file is empty: {label}")

    truncated = _truncate_waveform(waveform, sample_rate)

    try:
        vocals = _demucs_vocals_stem(truncated, sample_rate)
        logger.info("Demucs applied for %s", label)
        return _to_mono_16k(vocals, get_demucs_model().samplerate)
    except Exception as exc:
        logger.error("Demucs failed for %s: %s", label, exc, exc_info=True)
        logger.warning("Fallback used for %s", label)
        return _to_mono_16k(truncated, sample_rate)


def _extract_embedding(classifier: EncoderClassifier, path: Path) -> np.ndarray:
    waveform = _waveform_for_embedding(path)
    with torch.no_grad():
        embedding = classifier.encode_batch(waveform)
    vector = embedding.squeeze().cpu().numpy().astype(np.float64)
    norm = np.linalg.norm(vector)
    if norm == 0:
        raise ValueError(f"Could not extract embedding from: {path.name}")
    return vector / norm


def _cosine_similarity_percent(a: np.ndarray, b: np.ndarray) -> float:
    # Embeddings are L2-normalized; cosine distance in [0, 2] for opposite vectors.
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
    if not ai_vocal.filename:
        raise HTTPException(status_code=400, detail="Missing required field: ai_vocal")

    demo_files = demos
    if len(demo_files) == 0:
        raise HTTPException(status_code=400, detail="Missing required field: demos (at least one file)")

    temp_dir = tempfile.mkdtemp(prefix="voxbridge-voice-match-")
    try:
        classifier = get_classifier()

        try:
            ai_path = _save_upload(ai_vocal, temp_dir)
            ai_embedding = _extract_embedding(classifier, ai_path)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=f"Invalid AI vocal audio: {exc}") from exc

        results: list[dict] = []
        for demo in demo_files:
            if not demo.filename:
                continue
            demo_path = _save_upload(demo, temp_dir)
            try:
                demo_embedding = _extract_embedding(classifier, demo_path)
                similarity = _cosine_similarity_percent(ai_embedding, demo_embedding)
                results.append(
                    {
                        "filename": demo.filename,
                        "similarity": similarity,
                        "reasons": _reasons_for_similarity(similarity),
                    }
                )
            except ValueError as exc:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid demo audio ({demo.filename}): {exc}",
                ) from exc

        if not results:
            raise HTTPException(status_code=400, detail="No valid demo files were provided")

        results.sort(key=lambda row: row["similarity"], reverse=True)
        return results
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
