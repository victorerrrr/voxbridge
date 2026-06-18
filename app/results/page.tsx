"use client";

import { useEffect, useState, useRef } from "react";
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

function ConfidenceBadge({ row }: { row: AiVoiceMatchResult }) {
  const level = resolveMatchConfidenceLevel(row);
  const label = formatMatchConfidenceLabel(level);
  const cls = CONFIDENCE_COLORS[level] ?? CONFIDENCE_COLORS.weak;
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

let _globalAudio: HTMLAudioElement | null = null;
let _globalStop: (() => void) | null = null;

function PlayerBar({ url, startAt = 0, label, color = "bg-purple-500" }: { url: string; startAt?: number; label: string; color?: string }) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  if (!url) return null;
  function toggle() {
    if (playing) {
      _globalAudio?.pause();
      setPlaying(false);
      _globalStop = null;
      return;
    }
    if (_globalStop) _globalStop();
    const a = new Audio(url);
    _globalAudio = a;
    _globalStop = () => { a.pause(); setPlaying(false); };
    a.addEventListener("loadedmetadata", () => { setDuration(a.duration); });
    a.addEventListener("timeupdate", () => { setCurrentTime(a.currentTime); });
    a.addEventListener("ended", () => { setPlaying(false); setCurrentTime(0); _globalStop = null; });
    a.currentTime = startAt;
    a.play();
    setPlaying(true);
  }
  function seek(e: React.MouseEvent<HTMLDivElement>) {
    if (!_globalAudio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    _globalAudio.currentTime = pct * duration;
    setCurrentTime(pct * duration);
  }
  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const fmt = (s: number) => String(Math.floor(s / 60)) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
  return (
    <div className="flex flex-col gap-1 w-full">
      <div className="flex items-center gap-2">
        <button onClick={toggle} className="shrink-0 inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium bg-zinc-800 border border-white/10 hover:bg-zinc-700 text-white transition-colors">
          {playing ? "⏸" : "▶"} {label}
        </button>
        <span className="text-xs text-white/40 tabular-nums shrink-0">{fmt(currentTime)}{duration > 0 ? " / " + fmt(duration) : ""}</span>
      </div>
      <div className="relative h-2 w-full rounded-full bg-white/10 cursor-pointer overflow-hidden" onClick={seek}>
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

function ResultCard({ row, rank }: { row: AiVoiceMatchResult; rank: number }) {
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
                { label: "Тембр", val: row.breakdown.timbreScore },
                { label: "Питч", val: row.breakdown.pitchScore },
                { label: "Стиль", val: (row as any).vocalCharacterScore },
                { label: "Чёткость", val: row.breakdown.qualityScore },
                { label: "Голос", val: row.breakdown.speakerScore },
              ].map(({ label, val }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span className="text-xs text-white/50 w-16 shrink-0">{label}</span>
                  <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500/70 rounded-full" style={{ width: (val ?? 0) + "%" }} />
                  </div>
                  <span className="text-xs text-white/40 w-7 text-right">{Math.round(val ?? 0)}</span>
                </div>
              ))}
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
          {(() => {
            const r = row as any;
            const tags: string[] = [];
            if (r.breathiness > 0.18) tags.push("Breathy");
            if (r.vibrato_rate > 4.5 && r.vibrato_depth > 0.08) tags.push("Vibrato");
            if (r.melodic_range_semitones > 14) tags.push(Math.round(r.melodic_range_semitones) + " semitones");
            if (r.pitch_stability < 1.0) tags.push("Stable pitch");
            if (!tags.length) return null;
            return (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {tags.map(t => (
                  <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/50">{t}</span>
                ))}
              </div>
            );
          })()}
          {(() => {
            const r = row as any;
            const tags: string[] = [];
