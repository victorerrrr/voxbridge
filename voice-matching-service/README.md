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
2. Each decoded WAV is **trimmed to the first 15 seconds immediately** (`Audio trimmed to 15 seconds` in logs). Long uploads never reach Demucs or ECAPA un-trimmed.
3. **Demucs** (`htdemucs` by default) runs on the **AI vocal only** (CPU, 15 s segment, `shifts=0`, `split=False`). Demo clips skip Demucs and use the trimmed mix for speed. If separation fails or the **10 s** request budget is tight, the AI vocal falls back to the trimmed mix (see logs: `demucs start` / `Skipping Demucs` / `Fallback used`).
4. SpeechBrain ECAPA-TDNN extracts speaker embeddings per **chunk** (mono 16 kHz).
5. Embeddings are L2-normalized; per-chunk cosine similarity is averaged → **`speaker_score`** (0–100).
6. **Vocal feature scoring v1** on the same trimmed mono 16 kHz waveforms: pitch (librosa `yin`), timbre (MFCC + spectral centroid/bandwidth), and a simple **quality** heuristic (RMS, clipping, SNR proxy).
7. **Final `similarity`** = weighted blend (see below). Results are sorted best-first; `reasons` are derived from the component breakdown.

### Chunk averaging

After vocal extraction (AI) or trimmed mix (demos), audio is split into **5** windows of **~3 seconds** each (15 s total, aligned with the trim). Chunks whose RMS is below **`CHUNK_MIN_RMS` (0.01)** in `main.py` are skipped as silent. Each remaining chunk gets its own ECAPA embedding. For each demo vs AI pair, only **matching temporal indices** (0–4) are compared; silent windows skipped on one side do not pair with the other. **`speaker_score`** = mean of those per-chunk cosine scores (0–100). Response `chunks_used` is the number of index-aligned pairs. Logs: `Using chunk averaging (N chunks)`.

### Scoring v1 (final similarity)

| Component | Weight | Field | Notes |
|-----------|--------|-------|--------|
| Speaker embedding | **40%** | `speaker_score` | Chunk-averaged ECAPA cosine |
| Timbre | **30%** | `timbre_score` | 50% mean MFCC cosine, 25% centroid proximity, 25% bandwidth proximity |
| Pitch | **25%** | `pitch_score` | 45% average F0 proximity, 35% voiced range overlap, 20% register band (low/mid/high) |
| Audio quality | **5%** | `quality_score` | Demo clip only: RMS, peak/clipping penalty, simple SNR heuristic |

**`similarity`** = `0.40×speaker + 0.30×timbre + 0.25×pitch + 0.05×quality` (rounded 0.1).

Pitch/timbre use the full 15 s mono waveform at 16 kHz (same path as embeddings). `reasons` are template strings from the breakdown (e.g. “similar pitch range”, “similar timbre”, “distinct voice character”).

### Performance limits (MVP)

- **15 s trim** — applied right after decode, before any ML step.
- **10 s request timeout** — `asyncio.wait_for` on the handler plus in-thread budget checks. Over limit returns **408** with `{"error": "...", "step": "timeout"}`.
- End of each request logs `processing elapsed X.Xs`.
- On CPU, **one Demucs pass + ECAPA embeddings + librosa pitch/timbre** per request is a best-effort fit under 10 s (typically 1 AI + a few demos). Each extra demo adds ~0.3–1 s for `yin` + spectral features; many demos or a slow machine may hit the timeout.

### Demucs (CPU)

- First request downloads the Demucs weights (in addition to SpeechBrain).
- AI vocal only: roughly **5–15+ seconds** for Demucs on CPU (15 s audio); demos skip separation.
- Override model via env: `DEMUCS_MODEL=htdemucs` (default).
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
    "similarity": 65.4,
    "chunks_used": 5,
    "speaker_score": 72.1,
    "timbre_score": 58.3,
    "pitch_score": 61.0,
    "quality_score": 80.0,
    "reasons": [
      "similar pitch range",
      "similar vocal brightness",
      "similar timbre"
    ]
  },
  {
    "filename": "demo2.mp3",
    "similarity": 41.2,
    "chunks_used": 4,
    "speaker_score": 38.5,
    "timbre_score": 45.0,
    "pitch_score": 42.0,
    "quality_score": 72.0,
    "reasons": [
      "distinct voice character",
      "limited vocal overlap"
    ]
  }
]
```

## Errors

| Status | Cause |
|--------|--------|
| 400 | Missing `ai_vocal`, missing `demos`, or unreadable/empty audio (`step`: `loading`, `embedding`, etc.) |
| 408 | Total processing exceeded **10 seconds** (`step`: `timeout`) |

Example timeout response:

```json
{
  "error": "Voice matching exceeded 10 second processing limit",
  "step": "timeout"
}
```

## CORS

Allows `http://localhost:3000` for the Next.js admin lab.

## Limitations (MVP)

- CPU-only inference; only the first **15 seconds** of each upload are analyzed; whole request capped at **10 seconds**
- Demucs runs on the AI reference only; demos use the trimmed mix (asymmetric but faster)
- Demucs quality depends on mix complexity; heavily processed or sparse vocals may separate poorly
- Speaker identity similarity on isolated vocals (not lyrics, genre, or full production style)
- No persistence or authentication
- Model download requires internet on first run
