# Matching modules (specialists)

Thin boundaries for the Matching Engine. **Do not rewrite main.py wholesale.**

## Idea

Each specialist answers one question. Only `scoring.py` combines answers.

```
embedding / pitch / timbre / style / recording_quality
                    ↓
              scoring.py  →  Match Score
```

## Today

Real DSP still runs in `main.py` (ECAPA, librosa, …).  
This package:

- documents who does what (`registry.py`);
- owns the combine formula API (`scoring.py`);
- lets us swap one specialist later without touching the others.

`main.combine_scores` calls into `assemble_match_score` so there is one formula path.

## How to swap a specialist later

1. Add `matching_modules/embedding_v2.py` (or similar) with the new model.  
2. Point the call site in `main.py` (or a thin adapter) at v2.  
3. Update `registry.py` `impl` string.  
4. Re-run calibration (Yes/No + pairwise) — do not assume the new model is better.

## Philosophy

See `docs/MATCHING_ENGINE_PHILOSOPHY.md`.
