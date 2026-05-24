"""HTTP smoke tests for voice-matching-service (run while server is up)."""
from __future__ import annotations

import json
import struct
import sys
import urllib.error
import urllib.request
import wave
from pathlib import Path

BASE = "http://127.0.0.1:8000"


def _get(path: str) -> tuple[int, dict | list]:
    with urllib.request.urlopen(f"{BASE}{path}", timeout=30) as resp:
        return resp.status, json.loads(resp.read().decode())


def _post_voice_match_missing_files() -> tuple[int, dict]:
    req = urllib.request.Request(
        f"{BASE}/voice-match",
        data=b"",
        method="POST",
        headers={"Content-Type": "multipart/form-data; boundary=----vox"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as exc:
        body = exc.read().decode()
        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            payload = {"raw": body}
        return exc.code, payload


def _write_tiny_wav(path: Path) -> None:
    import math

    sample_rate = 16000
    seconds = 3.0
    n = int(sample_rate * seconds)
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        for i in range(n):
            t = i / sample_rate
            value = int(28000 * math.sin(2 * math.pi * 220.0 * t))
            wf.writeframes(struct.pack("<h", value))


def _post_voice_match_with_wavs(ai: Path, demo: Path) -> tuple[int, dict | list]:
    boundary = "----voxbridge"
    parts: list[bytes] = []

    def add_file(field: str, file_path: Path) -> None:
        data = file_path.read_bytes()
        parts.append(
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="{field}"; filename="{file_path.name}"\r\n'
            f"Content-Type: audio/wav\r\n\r\n".encode()
        )
        parts.append(data)
        parts.append(b"\r\n")

    add_file("ai_vocal", ai)
    add_file("demos", demo)
    parts.append(f"--{boundary}--\r\n".encode())
    body = b"".join(parts)
    req = urllib.request.Request(
        f"{BASE}/voice-match",
        data=body,
        method="POST",
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as exc:
        body_bytes = exc.read().decode()
        try:
            payload = json.loads(body_bytes)
        except json.JSONDecodeError:
            payload = {"raw": body_bytes}
        return exc.code, payload


def main() -> int:
    health_status, health = _get("/health")
    print(f"GET /health -> {health_status} {health}")
    if health_status != 200:
        return 1

    code, payload = _post_voice_match_missing_files()
    print(f"POST /voice-match (no files) -> {code} {payload}")
    if code != 422:
        return 1
    if not isinstance(payload, dict) or "error" not in payload:
        return 1

    tmp = Path(__file__).resolve().parent / "_verify_tmp"
    tmp.mkdir(exist_ok=True)
    ai = tmp / "ai.wav"
    demo = tmp / "demo.wav"
    _write_tiny_wav(ai)
    _write_tiny_wav(demo)
    match_code, match_payload = _post_voice_match_with_wavs(ai, demo)
    print(f"POST /voice-match (tiny wav) -> {match_code}")
    print(json.dumps(match_payload, indent=2)[:800])
    if match_code not in (200, 400):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
