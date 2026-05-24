"""Smoke-test SpeechBrain lazy-integration patch and encoder load."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import main  # noqa: E402


def _touch_lazy_modules() -> None:
    import importlib

    for name in (
        "speechbrain.integrations.k2_fsa",
        "speechbrain.integrations.huggingface.wordemb",
        "speechbrain.k2_integration",
    ):
        mod = importlib.import_module(name)
        assert mod is not None


def main_entry() -> int:
    main._patch_speechbrain_lazy_integrations()
    _touch_lazy_modules()
    clf = main.get_classifier()
    kind = "fallback" if isinstance(clf, main.FallbackSpeakerEncoder) else "ecapa"
    print(f"encoder={kind} class={type(clf).__name__}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main_entry())
