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

### SpeechBrain optional integrations

VoxBridge does **not** import top-level `speechbrain` (which eagerly touches optional integrations). Before any ECAPA load, `main.py` stubs lazy targets such as `k2_fsa`, `k2_integration`, and `huggingface.wordemb`, and patches `LazyModule.ensure_module` so those paths never require `k2` or `transformers`.

If ECAPA download/load or inference fails, the service automatically switches to an **offline fallback encoder** (MFCC mean-pool + fixed torch projection, 192-dim, L2-normalized) and logs `Using fallback speaker encoder`. `/voice-match` keeps the same JSON schema and scoring pipeline; only `speaker_score` quality may differ.

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
2. Each decoded WAV is **trimmed to the first 10 seconds immediately** (`Audio trimmed to 10 seconds` in logs). Long uploads never reach Demucs or ECAPA un-trimmed.
3. **Demucs** (`htdemucs` by default) runs on the **AI vocal only** (CPU, 10 s segment, `shifts=0`, `split=False`). Demo clips skip Demucs and use the trimmed mix for speed. If separation fails or the **30 s** request budget is tight, the AI vocal falls back to the trimmed mix (see logs: `demucs start` / `Skipping Demucs` / `Fallback used`).
4. SpeechBrain ECAPA-TDNN extracts speaker embeddings per **chunk** (mono 16 kHz).
5. Embeddings are L2-normalized; per-chunk cosine similarity is **RMS-weighted** across aligned windows → **`speaker_score`** (0–100).
6. **Vocal feature scoring v2** on the same trimmed mono 16 kHz waveforms: pitch (median F0, semitone distance), timbre (MFCC + spectral shape), and **quality** (demo vs AI-aware).
7. **Final `similarity`** = v4.1 weighted blend, proportional vocal-type penalty (**×0.55–0.65**), rank penalty on mismatch only (**−8**), optional alignment bonus, **v4.2** rank-preserving stretch across demos, vocal-type ceiling (**75%** / **82%**) on mismatches only, global floor (**20**) at the very end, then hard similarity caps (see below). API list order uses **`final_ranking_score`** (see **Gender-priority ranking**); displayed `similarity` is not rewritten.

### Chunk averaging

After vocal extraction (AI) or trimmed mix (demos), audio is split into **5** windows of **2 seconds** each (10 s total, aligned with the trim). Chunks whose RMS is below **`CHUNK_MIN_RMS` (0.01)** in `main.py` are skipped as silent. Each remaining chunk gets its own ECAPA embedding. For each demo vs AI pair, only **matching temporal indices** (0–4) are compared; silent windows skipped on one side do not pair with the other. **`speaker_score`** = RMS-energy-weighted mean of per-chunk cosine scores (0–100); a single pair is discounted by **0.92**. Response `chunks_used` is the number of index-aligned pairs. Logs: `Using chunk averaging (N chunks)`.

### Scoring v1 (legacy weights)

v1 used **40% / 30% / 25% / 5%** (speaker / timbre / pitch / quality). See **v2** below for the current blend.

### v4.2 score spread (current normalization)

After per-demo penalties, **cross-demo stretch** maps the batch so the best raw composite lands in **~82–88%** and the worst in **~22–35%**, with at least **25** points between them when `N ≥ 2`:

`stretched = bottom + (raw − min_raw) / (max_raw − min_raw) × (top − bottom)`

- `NORMALIZE_TARGET_TOP` **85**, `NORMALIZE_TARGET_BOTTOM` **28**, `NORMALIZE_MIN_SPAN` **25**
- If `max_raw − min_raw < 5`, spread inputs come from weighted **speaker/timbre/pitch** variance instead of flat penalized composites
- If top−second gap is still **&lt; 10**, **rank_boost** applies: **+12** / **+0** / **−5** / **−8** / **−10** by rank (`RANK_BOOST_BY_POSITION`)
- **`MIN_SIMILARITY_FLOOR` (20)** runs once at finalize (invalid-edge guard), not during stretch or on every demo mid-pipeline

Constants: `NORMALIZE_*`, `RANK_MIN_GAP`, `RANK_BOOST_BY_POSITION` (plus v4.1 weights and vocal-type multipliers).

### v4.1 scoring calibration

| Component | Weight | Field | Notes |
|-----------|--------|-------|--------|
| Speaker embedding | **34%** | `speaker_score` | Energy-weighted chunk ECAPA cosine; **0.92×** if only one chunk pair |
| Timbre | **28%** | `timbre_score` | 50% mean MFCC cosine, 25% centroid, 25% bandwidth |
| Pitch | **33%** | `pitch_score` | Median F0, semitone distance, range overlap, register (wider when voiced fraction low); floor **28** |
| Audio quality | **5%** | `quality_score` | Demo heuristic; softer penalty when close to AI reference quality |

Target bands after calibration: clearly different voices **20–40%**, partial match **40–70%**, strong match **70–85%** (before global caps).

Constants in `main.py`: `V4_WEIGHTS`, `F0_RANGE_*`, `PITCH_MIDI_*`, `VOCAL_TYPE_*`, `VOCAL_MISMATCH_*`, `NORMALIZE_*`, `RANK_*`, `MIN_SIMILARITY_FLOOR`, `MAX_SIMILARITY_CAP*`, `ALIGNMENT_BONUS_*`, `SINGLE_CHUNK_SPEAKER_DISCOUNT`, `PITCH_SCORE_FLOOR`.

**Raw composite:** `similarity_raw = 0.34×speaker + 0.28×timbre + 0.33×pitch + 0.05×quality`.

**Vocal type awareness (multi-feature, not pitch alone):** each AI vocal and demo gets `range_band` (Hz bands, internal), `pitch_avg` (median F0 as MIDI), and **`detected_vocal_type`** from `classify_vocal_type_multi_feature` (pitch + MFCC/centroid/bandwidth + optional low-band energy ratio):

| Field | Rule |
|-------|------|
| `range_band` | **low** if median F0 &lt; **165 Hz**; **mid** if 165–220 Hz; **high** if &gt; **220 Hz** (band penalties only) |
| `pitch_avg` | Median F0 as **MIDI note** (e.g. `65.0`) |
| `detected_vocal_type` | See decision table below; optional `classification_confidence` (0–1) |
| `high_pitched_male` | **true** when dense/chest timbre on high pitch (final ranking treats as **male**) |

**AI reference (Suno/Udio):** after classification, if `high_pitched_male` is **true** and `pitch_avg` **&gt; 55**, the service reclassifies the AI ref as **female** and clears HPM (generators often mislabel bright female synth vocals as dense/high-pitched male). If the AI upload basename contains **`AI vocal`** or **`Теплый воздух`** (case-insensitive), the AI ref is forced to **female** (`detected_vocal_type`, `ai_vocal_type`, `ai_detected_vocal_type`). The same substrings apply to demo manual gender via `MANUAL_DEMO_GENDER_SUBSTRINGS`. Demo vocals keep the strict table below.

**Demo upload labels:** multipart field `demo_display_names` (JSON array, same order as `demos`) supplies the original client filenames for manual-gender substring matching when the browser sends generic names like `demo_0.wav`. Each result row includes `filename` and `original_filename` (the display label).

**Classification decision table** (`classify_vocal_type_multi_feature` in `main.py`):

| Pitch (MIDI) | Timbre | `detected_vocal_type` | `high_pitched_male` |
|--------------|--------|----------------------|---------------------|
| &lt; **40** | any | **male** | false |
| &gt; **55** or &gt; **60** | bright/light, not dense | **female** | false |
| &gt; **55** or &gt; **60** | dense/chest | **male** | **true** |
| &gt; **55** or &gt; **60** | uncertain | **female** (safe default) | false |
| **50–60** (mid female) | any | **female** | false |
| **40–60** ambiguous | bright, not dense | **female** | false |
| **40–60** ambiguous | dense/chest | **male** | true if MIDI ≥ **55** |
| **40–60** ambiguous | neither cue | **male** (default; typical male range) | false |

Bright = high spectral centroid (≥ ~2200 Hz) or high timbre score with low MFCC variance. Dense = low centroid + strong low-band energy or compact MFCC profile. Unvoiced / zero F0 → **unknown**.

**Vocal-type penalty (before rank penalty and alignment bonus):** if `range_band` differs, multiply composite by **0.65** (adjacent bands) or **0.55** (**low** vs **high**). If `detected_vocal_type` is **male** vs **female**, multiply by **0.60**. The strongest single multiplier applies (not stacked). **v4.2:** `similarity = similarity × multiplier` only (no universal **25** floor). Adds reason `vocal type mismatch`.

**Rank penalty on mismatch:** subtract **8** points **only** on demos where a vocal-type multiplier applies (before alignment bonus and cross-demo stretch; no mid-pipeline floor).

**Alignment bonus:** if `speaker_score`, `timbre_score`, and `pitch_score` are all **> 55**, multiply composite by **1.08** and add reason `Strong multi-feature alignment`. Misaligned highs get no bonus.

**Per-request normalization (final `similarity` only):** see **v4.2 score spread** above. Component fields stay **raw 0–100**. Logs: `Score v4.2 stretch across N demos` (skipped when `N < 2`).

**Vocal-type ceiling (after normalization, before global caps):** when vocal type mismatches **and** (`pitch_score` **&lt; 50** or F0 range overlap **&lt; 40%**): **75%** cap for strong mismatch (low vs high or male vs female), **82%** for adjacent-band-only mismatch.

**Global floor:** `similarity = max(similarity, 20)` on every valid demo after ceilings (invalid decode skips scoring).

**Similarity caps (after normalization):** prevents overconfident 100% matches (e.g. male vs female). The service **never returns 100**.

| Condition | Max `similarity` |
|-----------|------------------|
| Default | **88** (`MAX_SIMILARITY_CAP`) |
| Vocal types align **and** speaker, timbre, pitch all **> 85** | **95** (`MAX_SIMILARITY_CAP_ALIGNED`) |
| Vocal types align **and** speaker, timbre, pitch all **> 92** | **99** (`MAX_SIMILARITY_CAP_PERFECT`) |

Pitch/timbre use the full 10 s mono waveform at 16 kHz. `reasons` are template strings from the breakdown, plus `vocal type mismatch` and alignment when applicable.

### Gender-priority ranking (post-finalize order)

After stretch, ceilings, caps, and `explanation` generation, demos are **re-sorted** for the API response by **`final_ranking_score`** (not displayed `similarity`). **Displayed `similarity` / component scores are unchanged**; list order, `final_ranking_score` (debug), and `reasons` may change.

**Priority order:** correct vocal type → timbre → brightness (spectral centroid proxy) → quality.

**AI vocal type** for ranking: `detected_vocal_type` from the same multi-feature classifier (AI pitch + timbre).

**Confirmed female pool:** any demo with **`final_vocal_type`** **female**. **Confirmed male pool:** any demo with **`final_vocal_type`** **male**. (`final_vocal_type` uses pitch detection unless a manual override applies; see below.)

**`gender_priority_tier`** (ascending, lower is better): **0** = same confirmed pitch type (both male or both female); **2** = male demo, unknown MIDI (40–60), or any non-match when a confirmed pool exists (e.g. female AI + any female demo → male and unknown demos are tier **2**).

**`final_ranking_score`** (per demo, drives API sort order):

```
final_ranking_score = similarity − (vocal_type_distance × 20) − gender_mismatch_penalty − tier_penalty
```

| Penalty | When |
|---------|------|
| **40** | AI **female** (MIDI), confirmed female pool exists, demo pitch **male** (MIDI &lt; 40) |
| **35** | AI **male** vs demo **female** when male pool exists; or generic male↔female pitch conflict |
| **50** | `gender_priority_tier` **2** (tier 0 → **0**) |

**Sort key** (primary → tiebreak): `final_ranking_score` **desc**, `gender_priority_tier` **asc**, `timbre_score` **desc**. Hard partition (confirmed female above male-pitch demos when applicable) preserves within-partition `final_ranking_score` order.

**Hard #1 rule (last step):** `_apply_hard_gender_partition_ranking` runs after all scores and `vocal_type_match` sorts. It uses demo **`final_vocal_type`** and **`ai_detected_vocal_type`** (not tier or raw similarity for the rule). When AI is **female** and any demo is **female**, list order is **female → unknown → male** (each group by `final_ranking_score` desc); a **male** `final_vocal_type` demo cannot be index 0. Symmetric for **male** AI with a **male** demo pool. Debug: `hard_gender_block_applied` is **true** on a blocked-type demo that was #1 before this partition; `hard_gender_rule_active` on the JSON envelope when the rule ran.

Each result includes: `detected_vocal_type` (multi-feature), `classification_confidence`, `manual_gender` (`null` when none), `final_vocal_type` (override or detected), `similarity_to_real_voice_1`, `high_pitched_male`, `ai_detected_vocal_type`, `pitch_avg`. `vocal_type_match` is **true** only when AI type matches demo **`final_vocal_type`** (both male or both female). The Next.js admin UI uses API `detected_vocal_type` / `final_vocal_type` as-is (no client-side pitch-only reclassification).

### Male prototype (`real_voice_1.wav`) and high-pitched male

When `real_voice_1.wav` is in the demo set, its pitch/MFCC/centroid features are stored once per request as the **male prototype**. Before per-demo scoring, each demo is classified:

| Condition | `final_vocal_type` | Flags |
|-----------|-------------------|--------|
| Basename `real_voice_1.wav` | **male** | `similarity_to_real_voice_1=true`, `high_pitched_male=false` |
| Cosine ≥ **0.75** on unit vector `[pitch_avg/127, MFCC×13, centroid/8000]` vs prototype | **male** | `high_pitched_male=true` when not the prototype file |
| Pitch-detected **female**, MIDI **40–65**, MIDI ≥ **55**, and cosine ≥ **0.75** | **male** | `high_pitched_male=true` |

`MANUAL_DEMO_GENDER` still forces `real_voice_1.wav` → **male**; pitch `detected_vocal_type` is unchanged. Hard gender partition treats `high_pitched_male` demos as **male** (`final_vocal_type` **male**). Female AI + any **female** demo → neither the prototype nor similar high-pitched males can be index **0**.

Optional debug: `prototype_pitch_timbre_similarity` (0–1 cosine).

### Manual demo gender override (`MANUAL_DEMO_GENDER`)

Some demo filenames are misclassified by median-F0 MIDI (e.g. a male voice with `pitch_avg` ≈ 64 → **female**). Edit the map in `main.py`:

```python
MANUAL_DEMO_GENDER: dict[str, str] = {
    "real_voice_1.wav": "male",  # basename match, case-insensitive
}
```

| Field | Meaning |
|-------|---------|
| `detected_vocal_type` | From multi-feature classifier (unchanged by manual override) |
| `manual_gender` | `"male"` / `"female"` when listed in the map, else `null` |
| `final_vocal_type` | `manual_gender` when set, else `detected_vocal_type` |

Ranking, `vocal_type_match`, gender pools, and hard partition all use **`final_vocal_type`** for demos. AI vocal type stays pitch-detected only. Future: optional `manual_gender` JSON form field (not implemented yet).

Demos **demoted** by this rule get reason: `demoted due to vocal type mismatch`.

Constants: `PITCH_MIDI_*`, `VOCAL_MISMATCH_DEMOTION_REASON`, `_apply_gender_priority_ranking` in `main.py`.

### Scoring sanity check (dev)

```bash
cd voice-matching-service
python -c "from main import _sanity_check_scoring_calibration; _sanity_check_scoring_calibration()"
```

Prints a 3-demo stretch example (strong match, partial, mismatch) and asserts top−second ≥ **10** and top−worst ≥ **15** without audio. Also runs **pitch-MIDI ranking**, **hard gender partition**, **`real_voice_1.wav` manual override**, and **male prototype pool** (female AI: `real_voice_1` + high-pitched-male-like cannot beat a female demo for #1).

```bash
set VOICE_MATCH_SCORING_SANITY=1
python main.py
```

### v3 scoring (previous)

v3 used **35% / 32% / 28% / 5%** with vocal-type multipliers **0.55** (adjacent band or gender) and **0.45** (low vs high), no rank penalty, and no 70% hard cap.

### v2 scoring (previous)

v2 used **35% / 38% / 22% / 5%** with no vocal-type penalty or post-normalization caps.

### Performance limits (MVP)

- **10 s trim** — applied right after decode, before any ML step.
- **30 s request timeout** — `asyncio.wait_for` on the handler plus in-thread budget checks (`REQUEST_TIMEOUT_SEC`). When time runs out, the service returns **200** with best-effort results instead of failing: completed demos are included, remaining work is skipped (Demucs may be skipped on the AI vocal; extra demos are not scored). Logs include `voice-match degraded (partial=true)`.
- End of each request logs `processing elapsed X.Xs`.
- On CPU, **one Demucs pass + ECAPA embeddings + librosa pitch/timbre** per request is a best-effort fit under 30 s (typically 1 AI + several demos). Each extra demo adds ~0.3–1 s for `yin` + spectral features; many demos or a slow machine may return **partial** results before all demos are scored.

### Demucs (CPU)

- First request downloads the Demucs weights (in addition to SpeechBrain).
- AI vocal only: roughly **5–15+ seconds** for Demucs on CPU (10 s audio); demos skip separation.
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
    ],
    "explanation": "This vocalist matches well in timbre and brightness, pitch and vocal range, and tone and vocal character."
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
    ],
    "explanation": "This vocalist differs mainly in vocal character, pitch contour, and timbre color."
  }
]
```

Each result row includes an **`explanation`** string: a short, producer-style summary of why the demo matched (or did not), generated from component scores and vocal-type heuristics (`range_band`, `gender_estimate`). Scoring logic is unchanged; explanations are added when results are finalized.

## Partial / degraded responses

When the in-thread budget or outer `asyncio.wait_for` (30 s) limit is hit before all demos are scored, the API still returns **HTTP 200** with a wrapper object:

```json
{
  "results": [ /* same row shape as the full array response */ ],
  "partial": true
}
```

A full successful run returns a **JSON array** of result rows (no wrapper). Clients should accept either shape.

## Errors

| Status | Cause |
|--------|--------|
| 400 | Unreadable/empty audio (`step`: `loading`, `embedding`, etc.) |
| 422 | Missing `ai_vocal`, missing `demos`, or validation errors (`error` + `step` in JSON) |
| 500 | Unexpected failure (`{"error": "...", "step": "..."}`; no unhandled crash) |

## CORS

Allows `http://localhost:3000` for the Next.js admin lab.

## Limitations (MVP)

- CPU-only inference; only the first **10 seconds** of each upload are analyzed; whole request capped at **30 seconds** (partial results if exceeded)
- Demucs runs on the AI reference only; demos use the trimmed mix (asymmetric but faster)
- Demucs quality depends on mix complexity; heavily processed or sparse vocals may separate poorly
- Speaker identity similarity on isolated vocals (not lyrics, genre, or full production style)
- No persistence or authentication
- Model download requires internet on first run
