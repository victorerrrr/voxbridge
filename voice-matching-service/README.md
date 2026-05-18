# VoxBridge Voice Matching Service

Python FastAPI service that compares an AI vocal reference against vocalist demo clips using SpeechBrain speaker embeddings (`speechbrain/spkrec-ecapa-voxceleb`).

## Requirements

- Python 3.10+ recommended
- Network access on first run (downloads the pretrained model from Hugging Face)

## Install

```bash
cd voice-matching-service
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
# source .venv/bin/activate

pip install -r requirements.txt
```

On Windows, use a normal venv (not elevated “Run as administrator”) so SpeechBrain can copy model files without symlink privileges (`WinError 1314`). Demucs weights download via PyTorch Hub on first separation (no symlinks required for typical installs).

First startup downloads the ECAPA-TDNN checkpoint into `pretrained_models/spkrec-ecapa-voxceleb/` (can take a few minutes).

## Run

```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

Health check:

```bash
curl http://localhost:8000/health
```

## How matching works

1. Uploads are saved to a temporary directory and loaded with `torchaudio`.
2. Each clip is **truncated to the first 15 seconds** (full tracks are not processed).
3. **Demucs** (`htdemucs` by default) separates vocals on CPU; the vocals stem is resampled to mono 16 kHz. If separation fails, the truncated original mix is used instead (check service logs for `Demucs applied` vs `Fallback used`).
4. SpeechBrain ECAPA-TDNN extracts a fixed-size speaker embedding from the vocals-only signal (AI vocal and every demo).
5. Embeddings are L2-normalized; cosine similarity is converted to a **0–100** percentage.
6. Results are sorted best-first. `reasons` are heuristic labels based on similarity bands.

### Demucs (CPU)

- First request downloads the Demucs weights (in addition to SpeechBrain).
- Expect roughly **10–30 seconds per file** on CPU for separation + embedding (15 s segment, `shifts=0`).
- Override model via env: `DEMUCS_MODEL=htdemucs` (default). Lighter/faster variants such as `mdx_extra` may trade quality for speed; `htdemucs` is the recommended default.
- GPU is not required; inference is pinned to CPU.

## Example request

```bash
curl -X POST http://localhost:8000/voice-match \
  -F "ai_vocal=@/path/to/ai-vocal.wav" \
  -F "demos=@/path/to/demo1.wav" \
  -F "demos=@/path/to/demo2.mp3"
```

## Example response

```json
[
  {
    "filename": "demo1.wav",
    "similarity": 92.4,
    "reasons": [
      "Similar vocal tone",
      "Close pitch range",
      "Matching vocal texture"
    ]
  },
  {
    "filename": "demo2.mp3",
    "similarity": 61.2,
    "reasons": [
      "Partial tonal overlap",
      "Some shared vocal character"
    ]
  }
]
```

## Errors

| Status | Cause |
|--------|--------|
| 400 | Missing `ai_vocal`, missing `demos`, or unreadable/empty audio |

## CORS

Allows `http://localhost:3000` for the Next.js admin lab.

## Limitations (MVP)

- CPU-only inference; only the first **15 seconds** of each upload are analyzed
- Demucs quality depends on mix complexity; heavily processed or sparse vocals may separate poorly
- Speaker identity similarity on isolated vocals (not lyrics, genre, or full production style)
- No persistence or authentication
- Model download requires internet on first run
