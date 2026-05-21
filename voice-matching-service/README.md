# VoxBridge Voice Matching Service

Python FastAPI service that compares an AI vocal reference against vocalist demo clips using SpeechBrain speaker embeddings (`speechbrain/spkrec-ecapa-voxceleb`).

## Requirements

- Python 3.10+ recommended
- Network access on first run (downloads the pretrained model from Hugging Face)
- **ffmpeg** on `PATH` — required for pydub MP3/other fallbacks; also required by **torchcodec** on Windows (install a [full-shared FFmpeg build](https://www.gyan.dev/ffmpeg/builds/) and ensure `ffmpeg` is on `PATH`)
- **torchcodec** (in `requirements.txt`) for native `torchaudio` MP3 decoding when FFmpeg shared libraries are available

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

Clear SOCKS/HTTP proxy environment variables before starting. A local VPN or proxy client often sets `ALL_PROXY=socks4://127.0.0.1:...`, which breaks Hugging Face / httpx model downloads (`Unknown scheme for proxy URL`).

**Recommended (Windows):**

```powershell
.\scripts\run-server.ps1
```

**Recommended (macOS / Linux):**

```bash
chmod +x scripts/run-server.sh
./scripts/run-server.sh
```

**Manual start with proxies cleared (PowerShell):**

```powershell
$env:HTTP_PROXY=""; $env:HTTPS_PROXY=""; $env:ALL_PROXY=""
$env:http_proxy=""; $env:https_proxy=""; $env:all_proxy=""
Remove-Item Env:HTTP_PROXY, Env:HTTPS_PROXY, Env:ALL_PROXY -ErrorAction SilentlyContinue
Remove-Item Env:http_proxy, Env:https_proxy, Env:all_proxy -ErrorAction SilentlyContinue
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Manual start (bash):**

```bash
export HTTP_PROXY="" HTTPS_PROXY="" ALL_PROXY=""
export http_proxy="" https_proxy="" all_proxy=""
unset HTTP_PROXY HTTPS_PROXY ALL_PROXY http_proxy https_proxy all_proxy
uvicorn main:app --host 0.0.0.0 --port 8000
```

The service also clears proxy vars at import time and before lazy model loads (`main.py`), disables `HTTPX_TRUST_ENV`, and neutralizes Windows `urllib.request.getproxies()` (VPN clients often set a system SOCKS proxy that breaks httpx even when shell env vars are empty). Starting via the scripts above avoids inheriting bad proxy settings in the shell process.

Health check:

```bash
curl http://localhost:8000/health
```

## Audio decoding

Every upload (AI vocal and demos) is converted to a temporary mono-friendly WAV before Demucs/embedding:

1. Save the original file (keeps extension: `.mp3`, `.wav`, etc.)
2. Try `torchaudio.load` (uses **torchcodec** for many formats when FFmpeg DLLs are available)
3. On failure, try **soundfile** (WAV/FLAC/OGG via libsndfile)
4. On failure, try **pydub** + **ffmpeg** (`AudioSegment.from_file` → WAV export; needs `audioop-lts` on Python 3.13+)
5. On failure, try **librosa** + **soundfile** as a last resort

Decoded WAVs are loaded with **soundfile** for Demucs/embedding (avoids torchcodec on the hot path).

If all methods fail, the API returns `400` with `{"error": "Could not decode audio: <filename>: <reason>", "step": "loading"}`.

**Manual MP3 test:**

```bash
curl -X POST http://localhost:8000/voice-match \
  -F "ai_vocal=@/path/to/ai_song.mp3" \
  -F "demos=@/path/to/demo.mp3"
```

## How matching works

1. Uploads are saved to a temporary directory and decoded to WAV (see above).
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
| 400 | Missing `ai_vocal`, missing `demos`, or unreadable/empty audio (`step`: `loading`, `embedding`, etc.) |

## CORS

Allows `http://localhost:3000` for the Next.js admin lab.

## Limitations (MVP)

- CPU-only inference; only the first **15 seconds** of each upload are analyzed
- Demucs quality depends on mix complexity; heavily processed or sparse vocals may separate poorly
- Speaker identity similarity on isolated vocals (not lyrics, genre, or full production style)
- No persistence or authentication
- Model download requires internet on first run
