"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { InternalPageShell } from "@/components/internal-page-shell";
import { AnimatedButton } from "@/components/animated-button";
import { UploadContextBanner } from "@/components/upload-context-banner";
import { useUploadContext } from "@/lib/hooks/use-upload-context";
import { AiVoiceMatchResult, resolveMatchConfidenceLevel, formatMatchConfidenceLabel } from "@/lib/admin-ai-voice-matching";
import { VoiceRadarChart } from "@/components/admin/voice-radar-chart";

const CONFIDENCE_COLORS: Record<string, string> = {
  "very-strong": "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  good: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  partial: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  weak: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
};

const GENRE_WEIGHT_PERCENTS: Record<string, { speaker: number; timbre: number; pitch: number; quality: number; vocalCharacter: number }> = {
  singing: { speaker: 30.0, timbre: 24.0, pitch: 35.0, quality: 2.0, vocalCharacter: 9.0 },
  rap: { speaker: 31.2, timbre: 36.5, pitch: 18.8, quality: 5.2, vocalCharacter: 8.3 },
  "hip-hop": { speaker: 31.2, timbre: 36.5, pitch: 18.8, quality: 5.2, vocalCharacter: 8.3 },
  rnb: { speaker: 15.3, timbre: 45.9, pitch: 25.5, quality: 5.1, vocalCharacter: 8.2 },
  soul: { speaker: 15.3, timbre: 45.9, pitch: 25.5, quality: 5.1, vocalCharacter: 8.2 },
  opera: { speaker: 12.0, timbre: 34.0, pitch: 38.0, quality: 8.0, vocalCharacter: 8.0 },
  classical: { speaker: 12.0, timbre: 34.0, pitch: 38.0, quality: 8.0, vocalCharacter: 8.0 },
};

const CONFIDENCE_EXPLANATIONS: Record<string, string> = {
  "very-strong": "Very strong match: this vocalist's voice is acoustically very close to your reference.",
  good: "Good match: this vocalist's voice is acoustically close to your reference.",
  partial: "Partial match: acoustically related, but not a guaranteed fit — worth a listen.",
  weak: "Weak match: acoustically distant from your reference — listen before deciding.",
};

function ConfidenceBadge({ row }: { row: AiVoiceMatchResult }) {
  const level = resolveMatchConfidenceLevel(row);
  const label = formatMatchConfidenceLabel(level);
  const cls = CONFIDENCE_COLORS[level] ?? CONFIDENCE_COLORS.weak;
  const explanation = CONFIDENCE_EXPLANATIONS[level] ?? CONFIDENCE_EXPLANATIONS.weak;
  return (
    <span
      title={explanation}
      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {label}
    </span>
  );
}

let _globalAudio: HTMLAudioElement | null = null;
let _globalStop: (() => void) | null = null;
let _globalUrl: string | null = null;

function PlayerBar({ url, startAt = 0, label, color = "bg-purple-500" }: { url: string; startAt?: number; label: string; color?: string }) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!url) return;
    const meta = new Audio();
    meta.preload = "metadata";
    meta.src = url;
    const onMeta = () => {
      if (Number.isFinite(meta.duration) && meta.duration > 0) {
        setDuration(meta.duration);
      }
    };
    meta.addEventListener("loadedmetadata", onMeta);
    return () => {
      meta.removeEventListener("loadedmetadata", onMeta);
      meta.src = "";
    };
  }, [url]);

  if (!url) return null;

  function bindAudio(a: HTMLAudioElement) {
    _globalAudio = a;
    _globalUrl = url;
    _globalStop = () => {
      a.pause();
      setPlaying(false);
      if (_globalAudio === a) {
        _globalAudio = null;
        _globalUrl = null;
        _globalStop = null;
      }
    };
    a.addEventListener("loadedmetadata", () => {
      if (Number.isFinite(a.duration) && a.duration > 0) setDuration(a.duration);
    });
    a.addEventListener("timeupdate", () => setCurrentTime(a.currentTime));
    a.addEventListener("ended", () => {
      setPlaying(false);
      setCurrentTime(0);
      if (_globalAudio === a) {
        _globalAudio = null;
        _globalUrl = null;
        _globalStop = null;
      }
    });
  }

  function playFrom(seconds: number) {
    const target = Math.max(0, seconds);
    if (_globalUrl === url && _globalAudio) {
      _globalAudio.currentTime = target;
      void _globalAudio.play();
      setPlaying(true);
      setCurrentTime(target);
      return;
    }
    if (_globalStop) _globalStop();
    const a = new Audio(url);
    bindAudio(a);
    const start = () => {
      a.currentTime = Math.min(target, Number.isFinite(a.duration) ? a.duration : target);
      void a.play();
      setPlaying(true);
      setCurrentTime(a.currentTime);
    };
    if (a.readyState >= 1) {
      start();
    } else {
      a.addEventListener("loadedmetadata", start, { once: true });
      a.load();
    }
  }

  function toggle() {
    if (playing && _globalUrl === url && _globalAudio) {
      _globalAudio.pause();
      setPlaying(false);
      return;
    }
    playFrom(playing ? currentTime : startAt);
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const fraction = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const dur =
      duration > 0
        ? duration
        : _globalUrl === url && _globalAudio && Number.isFinite(_globalAudio.duration)
          ? _globalAudio.duration
          : 0;
    if (dur > 0) {
      playFrom(fraction * dur);
      return;
    }
    // Duration not ready yet — start audio, then jump to fraction.
    if (_globalStop && _globalUrl !== url) _globalStop();
    const a = _globalUrl === url && _globalAudio ? _globalAudio : new Audio(url);
    if (_globalUrl !== url || !_globalAudio) {
      if (_globalStop) _globalStop();
      bindAudio(a);
    }
    const jump = () => {
      const d = a.duration;
      if (!Number.isFinite(d) || d <= 0) return;
      setDuration(d);
      playFrom(fraction * d);
    };
    if (a.readyState >= 1) jump();
    else a.addEventListener("loadedmetadata", jump, { once: true });
    void a.play().catch(() => undefined);
  }

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const fmt = (s: number) =>
    String(Math.floor(s / 60)) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
  return (
    <div className="flex flex-col gap-1 w-full">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          className="shrink-0 inline-flex items-center gap-1 rounded-md border border-white/10 bg-zinc-800 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-zinc-700"
        >
          {playing ? "⏸" : "▶"} {label}
        </button>
        <span className="shrink-0 tabular-nums text-xs text-white/40">
          {fmt(currentTime)}
          {duration > 0 ? " / " + fmt(duration) : ""}
        </span>
      </div>
      <div
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration) || 100}
        aria-valuenow={Math.round(currentTime)}
        tabIndex={0}
        className="relative h-2.5 w-full cursor-pointer overflow-hidden rounded-full bg-white/10"
        onClick={seek}
      >
        <div className={"h-full rounded-full transition-none " + color} style={{ width: pct + "%" }} />
      </div>
    </div>
  );
}

function AiVocalButton({ row }: { row: AiVoiceMatchResult }) {
  if (!row.aiReferenceUrl) return null;
  return <PlayerBar url={row.aiReferenceUrl as string} label="AI Vocal" color="bg-purple-500" />;
}

function BestMatchButton({ row }: { row: AiVoiceMatchResult }) {
  if (!row.demoAudioUrl) return null;
  const sec = row.best_match_sec ?? 0;
  const label = sec > 0 ? "Best match" : "Play demo";
  return <PlayerBar url={row.demoAudioUrl as string} startAt={sec} label={label} color="bg-zinc-400" />;
}

function MatchFeedbackButtons({ filename }: { filename?: string }) {
  const [status, setStatus] = useState<"idle" | "good" | "bad" | "error" | "reset">("idle");
  const [good, setGood] = useState(0);
  const [bad, setBad] = useState(0);

  const refreshCounts = async () => {
    if (!filename) return;
    try {
      const res = await fetch(
        `http://localhost:8000/feedback/demo/${encodeURIComponent(filename)}`
      );
      if (!res.ok) return;
      const data = (await res.json()) as { good?: number; bad?: number };
      setGood(Number(data.good ?? 0));
      setBad(Number(data.bad ?? 0));
    } catch {
      /* API optional while browsing */
    }
  };

  useEffect(() => {
    void refreshCounts();
  }, [filename]);

  if (!filename) return null;

  const send = async (rating: "good" | "bad") => {
    try {
      const res = await fetch("http://localhost:8000/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ demo_filename: filename, rating }),
      });
      if (!res.ok) throw new Error("feedback failed");
      const data = (await res.json()) as { entry?: { good?: number; bad?: number } };
      if (data.entry) {
        setGood(Number(data.entry.good ?? 0));
        setBad(Number(data.entry.bad ?? 0));
      } else {
        await refreshCounts();
      }
      setStatus(rating);
    } catch {
      setStatus("error");
    }
  };

  const reset = async () => {
    try {
      const res = await fetch("http://localhost:8000/feedback/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ demo_filename: filename }),
      });
      if (!res.ok) throw new Error("reset failed");
      setGood(0);
      setBad(0);
      setStatus("reset");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="mt-2 border-t border-white/10 pt-2">
      <p className="mb-1.5 text-[10px] uppercase tracking-wide text-zinc-500">
        Похоже на AI-вокал? (да / нет)
      </p>
      <p className="mb-1.5 text-[10px] text-zinc-500">
        Накоплено: <span className="text-emerald-300/90">Да {good}</span>
        {" · "}
        <span className="text-rose-300/90">Нет {bad}</span>
        {good - bad !== 0 ? (
          <span className="text-zinc-600">
            {" "}
            (итог {good - bad > 0 ? "+" : ""}
            {good - bad})
          </span>
        ) : null}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void send("good")}
          className={`rounded-md border px-2.5 py-1 text-xs transition ${
            status === "good"
              ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-200"
              : "border-white/10 text-zinc-400 hover:border-emerald-400/40"
          }`}
        >
          Да
        </button>
        <button
          type="button"
          onClick={() => void send("bad")}
          className={`rounded-md border px-2.5 py-1 text-xs transition ${
            status === "bad"
              ? "border-rose-400/50 bg-rose-500/20 text-rose-200"
              : "border-white/10 text-zinc-400 hover:border-rose-400/40"
          }`}
        >
          Нет
        </button>
        {(good > 0 || bad > 0) && (
          <button
            type="button"
            onClick={() => void reset()}
            className="rounded-md border border-white/10 px-2.5 py-1 text-xs text-zinc-500 hover:border-amber-400/40 hover:text-amber-200/90"
            title="Обнулить Да/Нет по этому демо — можно передумать"
          >
            Сбросить
          </button>
        )}
      </div>
      {status === "error" ? (
        <p className="mt-1 text-[10px] text-rose-300">Не сохранилось — Python API запущен?</p>
      ) : status === "reset" ? (
        <p className="mt-1 text-[10px] text-amber-200/90">
          Счётчики обнулены. Поставьте новую оценку и сделайте Match заново.
        </p>
      ) : status === "good" || status === "bad" ? (
        <p className="mt-1 text-[10px] text-emerald-200/90">
          Сохранено. Учтётся при <strong>следующем</strong> матче.
        </p>
      ) : null}
    </div>
  );
}

type DuelCandidate = {
  filename: string;
  label: string;
  demoAudioUrl?: string;
  matchPercent?: number;
};

type DuelPair = { a: DuelCandidate; b: DuelCandidate };

/** Adjacent ranks + a few top-vs-mid pairs — enough signal, not every-vs-every. */
function buildDuelQueue(candidates: DuelCandidate[]): DuelPair[] {
  if (candidates.length < 2) return [];
  const pairs: DuelPair[] = [];
  const seen = new Set<string>();
  const push = (a: DuelCandidate, b: DuelCandidate) => {
    const key = [a.filename, b.filename].sort().join("||");
    if (seen.has(key) || a.filename === b.filename) return;
    seen.add(key);
    pairs.push({ a, b });
  };
  for (let i = 0; i < candidates.length - 1; i++) {
    push(candidates[i], candidates[i + 1]);
  }
  if (candidates.length >= 5) {
    push(candidates[0], candidates[Math.floor(candidates.length / 2)]);
    push(candidates[1], candidates[candidates.length - 1]);
  }
  return pairs;
}

function CalibrationDuel({
  candidates,
  aiReferenceFilename,
  aiReferenceUrl,
}: {
  candidates: DuelCandidate[];
  aiReferenceFilename: string;
  aiReferenceUrl?: string;
}) {
  const queue = buildDuelQueue(candidates);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"idle" | "ok" | "error" | "skip">("idle");
  const [savedCount, setSavedCount] = useState(0);
  const [done, setDone] = useState(false);

  const pair = !done && index < queue.length ? queue[index] : null;

  const advance = () => {
    setStatus("idle");
    if (index + 1 >= queue.length) {
      setDone(true);
      return;
    }
    setIndex((i) => i + 1);
  };

  const submitCloser = async (closer: string, farther: string) => {
    if (busy) return;
    setBusy(true);
    setStatus("idle");
    try {
      const res = await fetch("http://localhost:8000/feedback/pairwise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ai_reference: aiReferenceFilename,
          closer,
          farther,
        }),
      });
      if (!res.ok) throw new Error("pairwise failed");
      setSavedCount((n) => n + 1);
      setStatus("ok");
      setTimeout(advance, 350);
    } catch {
      setStatus("error");
    } finally {
      setBusy(false);
    }
  };

  if (candidates.length < 2) return null;

  return (
    <section className="mb-6 rounded-2xl border border-amber-500/25 bg-amber-500/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-amber-200/90">
            Дуэль 1×1 (калибровка)
          </p>
          <p className="mt-1 max-w-xl text-sm text-zinc-300">
            Слушаете только AI и <strong>двух</strong> вокалистов. Выберите, кто ближе к AI по тембру.
            Сомневаетесь — «Не уверен». Это не экзамен: пропуск лучше ошибочного клика.
          </p>
        </div>
        <p className="text-xs tabular-nums text-zinc-500">
          {done ? "готово" : `${index + 1} / ${queue.length}`}
          {savedCount > 0 ? ` · сохранено ${savedCount}` : ""}
        </p>
      </div>

      {aiReferenceUrl ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-zinc-950/50 p-3">
          <p className="mb-2 text-[10px] uppercase tracking-wide text-zinc-500">AI-референс</p>
          <PlayerBar url={aiReferenceUrl} label="AI Vocal" color="bg-purple-500" />
          <p className="mt-1 text-[11px] text-zinc-500">{aiReferenceFilename || "—"}</p>
        </div>
      ) : null}

      {done ? (
        <p className="mt-4 text-sm text-emerald-200/90">
          Очередь дуэлей закончена ({savedCount} пар). Можно листать карточки ниже и ставить Да/Нет
          только на очевидные случаи — или загрузить другой AI-вокал.
        </p>
      ) : pair ? (
        <>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {([pair.a, pair.b] as const).map((side, sideIdx) => (
              <div
                key={side.filename}
                className="rounded-xl border border-white/10 bg-zinc-950/60 p-4"
              >
                <p className="text-[10px] uppercase tracking-wide text-zinc-500">
                  {sideIdx === 0 ? "Вариант A" : "Вариант B"}
                </p>
                <h3 className="mt-1 text-sm font-semibold text-white">{side.label}</h3>
                {side.matchPercent != null ? (
                  <p className="text-xs text-zinc-500">Сейчас в списке: {side.matchPercent}%</p>
                ) : null}
                {side.demoAudioUrl ? (
                  <div className="mt-3">
                    <PlayerBar url={side.demoAudioUrl} label="Play" color="bg-zinc-400" />
                  </div>
                ) : null}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void submitCloser(
                      side.filename,
                      sideIdx === 0 ? pair.b.filename : pair.a.filename
                    )
                  }
                  className="mt-3 w-full rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-sm font-medium text-emerald-100 transition hover:bg-emerald-500/25 disabled:opacity-40"
                >
                  Этот ближе к AI
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setStatus("skip");
                advance();
              }}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-zinc-300 hover:border-white/30"
            >
              Не уверен — пропустить
            </button>
            <button
              type="button"
              disabled={busy || index + 1 >= queue.length}
              onClick={advance}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-500 hover:border-white/25"
            >
              Следующая пара →
            </button>
          </div>
          {status === "ok" ? (
            <p className="mt-2 text-xs text-emerald-200/90">Сохранено.</p>
          ) : status === "error" ? (
            <p className="mt-2 text-xs text-rose-300">Не сохранилось — Python API на :8000 запущен?</p>
          ) : status === "skip" ? (
            <p className="mt-2 text-xs text-zinc-500">Пропущено — ок.</p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function ResultCard({
  row,
  rank,
  genreUsed,
}: {
  row: AiVoiceMatchResult;
  rank: number;
  genreUsed?: string | null;
}) {
  const isTop = rank === 0;
  return (
    <article className={`rounded-2xl border p-5 shadow-sm transition ${isTop ? "border-purple-500/40 bg-zinc-900/80" : "border-white/10 bg-zinc-950/60"}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-indigo-700 text-base font-semibold text-white shadow">
            {row.vocalistName?.slice(0, 2).toUpperCase() ?? "??"}
          </div>
          <div>
            <h2 className="text-base font-semibold text-white leading-tight">{row.vocalistName}</h2>
            <p className="text-xs text-zinc-400">{row.displayVocalType}{(row as any).demo_language ? " · " + (row as any).demo_language : ""}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-2xl font-bold text-white">{row.matchPercent}%</span>
          <ConfidenceBadge row={row} />
        </div>
      </div>

      <div className="mb-3 h-1.5 w-full rounded-full bg-zinc-800">
        <div
          className="h-1.5 rounded-full bg-gradient-to-r from-purple-500 to-indigo-400 transition-all"
          style={{ width: `${row.matchPercent}%` }}
        />
      </div>

        {row.breakdown && (
          <div className="flex items-start gap-3 mb-3">
            <div className="shrink-0">
              <VoiceRadarChart
                speakerScore={row.breakdown.speakerScore ?? 0}
                timbreScore={row.breakdown.timbreScore ?? 0}
                pitchScore={row.breakdown.pitchScore ?? 0}
                qualityScore={row.breakdown.qualityScore ?? 0}
                vocalCharacterScore={(row as any).vocalCharacterScore ?? 0}
                size={120}
              />
            </div>
            <div className="flex flex-col gap-1.5 flex-1 justify-center py-2">
              {[
                { label: "Тембр", val: row.breakdown.timbreScore, weightKey: "timbre" as const },
                { label: "Питч", val: row.breakdown.pitchScore, weightKey: "pitch" as const },
                { label: "Стиль", val: (row as any).vocalCharacterScore, weightKey: "vocalCharacter" as const },
                { label: "Запись", val: row.breakdown.qualityScore, weightKey: "quality" as const },
                { label: "Голос", val: row.breakdown.speakerScore, weightKey: "speaker" as const },
              ].map(({ label, val, weightKey }) => {
                const weights = genreUsed ? GENRE_WEIGHT_PERCENTS[genreUsed] : undefined;
                const weightPct = weights ? weights[weightKey] : undefined;
                return (
                <div key={label} className="flex items-center gap-1.5" title={label === "Запись" ? "Качество записи (шум/клип), не «плохой голос»" : undefined}>
                  <span className="text-xs text-white/50 w-16 shrink-0">
                    {label}
                    {weightPct !== undefined && (
                      <span className="text-white/30"> ({weightPct}%)</span>
                    )}
                  </span>
                  <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500/70 rounded-full" style={{ width: (val ?? 0) + "%" }} />
                  </div>
                  <span className="text-xs text-white/40 w-7 text-right">{Math.round(val ?? 0)}</span>
                </div>
              );
              })}
              {(() => {
                const r = row as any;
                const tags: string[] = [];
                if (r.breathiness > 0.18) tags.push("Breathy");
                if (r.vibrato_rate > 4.5 && r.vibrato_depth > 0.08) tags.push("Vibrato");
                if (r.melodic_range_semitones > 14) tags.push(Math.round(r.melodic_range_semitones) + " st");
                if (r.pitch_stability < 1.0) tags.push("Stable pitch");
                if (!tags.length) return null;
                return (
                  <div className="flex flex-wrap gap-1.5 mt-10 mb-1">
                    {tags.map(t => (
                      <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/50">{t}</span>
                    ))}
                  </div>
                );
              })()} 
            </div>
          </div>
        )}

      {row.matchFeatureTags && row.matchFeatureTags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {row.matchFeatureTags.slice(0, 4).map((tag) => (
            <span key={tag} className="rounded-full bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 text-xs text-purple-300">
              {tag}
            </span>
          ))}
        </div>
      )}

        <div className="flex flex-col gap-3 mt-3">
          <BestMatchButton row={row} />
          <AiVocalButton row={row} />
        <AnimatedButton
          href={`/vocalists/${row.id}`}
          variant="primary"
          className="inline-flex items-center justify-center rounded-lg px-4 py-1.5 text-xs font-medium"
        >
          View Profile
        </AnimatedButton>
        <MatchFeedbackButtons filename={row.filename} />
      </div>
    </article>
  );
}

export default function ResultsPage() {
  const router = useRouter();
  const uploadContext = useUploadContext();
  const [results, setResults] = useState<AiVoiceMatchResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [genreUsed, setGenreUsed] = useState<string | null>(null);
  const [aiReferenceFilename, setAiReferenceFilename] = useState("");
  const [aiReferenceUrl, setAiReferenceUrl] = useState("");

  useEffect(() => {
    if (uploadContext === undefined) return;
    if (uploadContext === null) {
      router.replace("/search");
      return;
    }
    try {
      const raw = sessionStorage.getItem("voxbridge_match_results");
      if (!raw) {
        setError("No match results found. Please run matching again.");
        return;
      }
      const data = JSON.parse(raw);
      const rawRows = Array.isArray(data) ? data : data.results ?? [];
    setGenreUsed(typeof data?.genre_used === "string" ? data.genre_used : null);
    const aiRefFilename: string = data?.ai_reference?.ai_reference_filename ?? "";
      setAiReferenceFilename(aiRefFilename);
      setAiReferenceUrl(
        aiRefFilename
          ? `http://localhost:8000/ai-audio/${encodeURIComponent(aiRefFilename)}`
          : ""
      );
      const rows: AiVoiceMatchResult[] = rawRows.map((r: Record<string, unknown>, i: number) => ({
        ...r,
        id: r.id as string ?? r.filename as string ?? String(i),
        vocalistName:
          (r.display_name as string) ||
          (r.vocalistName as string) ||
          (r.filename as string) ||
          "Vocalist " + (i + 1),
        matchPercent: r.matchPercent as number ?? r.similarity as number ?? 0,
        finalRankingScore: r.finalRankingScore as number ?? r.final_ranking_score as number ?? 0,
        displayVocalType: r.displayVocalType as string ?? r.final_vocal_type as string ?? r.detected_vocal_type as string ?? "",
        demoAudioUrl: r.demoAudioUrl as string ?? (r.filename ? `http://localhost:8000/demo-audio/${encodeURIComponent(r.filename as string)}` : ""),
          aiReferenceUrl: aiRefFilename ? `http://localhost:8000/ai-audio/${encodeURIComponent(aiRefFilename)}` : undefined,
        best_match_sec: r.best_match_sec as number ?? 0,
        confidence: r.confidence as number ?? r.similarity as number ?? 0,
        similarity: r.similarity as number ?? 0,
        index: r.index as number ?? i,
        isTopMatch: r.isTopMatch as boolean ?? r.is_top_match as boolean ?? false,
        filename: r.filename as string ?? "",
        featureTags: r.featureTags as string[] ?? [],
        matchFeatureTags: r.matchFeatureTags as string[] ?? [],
        breakdown: {
          speakerScore: r.speaker_score as number ?? 0,
          timbreScore: r.timbre_score as number ?? 0,
          pitchScore: r.pitch_score as number ?? 0,
          qualityScore: r.quality_score as number ?? 0,
        },
        vocalCharacterScore: r.vocal_character_score as number ?? 0,
      } as unknown as AiVoiceMatchResult));
      setResults(rows);
    } catch {
      setError("Failed to load results.");
    }
  }, [uploadContext, router]);

  if (uploadContext === undefined || results === null && !error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-6 text-zinc-300">
        Loading matches...
      </main>
    );
  }

  return (
    <InternalPageShell activeItem="upload">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-300/80">AI matching</p>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Matching Results</h1>
            <p className="mt-2 text-zinc-400">
              {results ? `${results.length} vocalists ranked by acoustic similarity` : "Ranked vocalists for your brief."}
            </p>

          {genreUsed && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-cyan-300/20 bg-cyan-300/5 px-3 py-1 text-xs text-cyan-200">
              {genreUsed === "rap" || genreUsed === "hip-hop"
                ? "Rap mode: weighted more toward vocal identity and tone, less on pitch range"
                : genreUsed === "rnb" || genreUsed === "soul"
                ? "R&B/Soul mode: weighted more toward tone and pitch nuance"
                : genreUsed === "opera" || genreUsed === "classical"
                ? "Classical/Opera mode: weighted more toward pitch precision and tone"
                : "Singing mode: balanced weighting across voice traits"}
            </p>
          )}
          </div>
          <AnimatedButton
            href="/search"
            variant="secondary"
            className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm"
          >
            Upload another reference
          </AnimatedButton>
        </div>

        {uploadContext && <UploadContextBanner context={uploadContext} />}

        {results && results.length >= 2 && (
          <CalibrationDuel
            aiReferenceFilename={aiReferenceFilename}
            aiReferenceUrl={aiReferenceUrl}
            candidates={results.map((row, i) => ({
              filename: (row.filename as string) || String(i),
              label: `${i + 1}. ${row.vocalistName || row.filename || "Vocalist"}`,
              demoAudioUrl: row.demoAudioUrl as string | undefined,
              matchPercent: row.matchPercent,
            }))}
          />
        )}

        {error && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {results && (
          <section className="mt-6 grid gap-4 md:grid-cols-2">
            {results.map((row, i) => (
              <ResultCard key={row.id} row={row} rank={i} genreUsed={genreUsed} />
            ))}
          </section>
        )}
      </div>
    </InternalPageShell>
  );
}
