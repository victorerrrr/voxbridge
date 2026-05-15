"use client";

import { AnimatedButton } from "@/components/animated-button";
import { FakeWaveform } from "@/components/home/fake-waveform";
import { useHomeAudio } from "@/components/home/home-audio-provider";
import { mockVocalists } from "@/lib/mockVocalists";
import { useUploadContext } from "@/lib/hooks/use-upload-context";

const DEMO_VOCALIST = mockVocalists[0];
const AI_DEMO_URL = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3";

export function HomeBeforeAfterHero() {
  const upload = useUploadContext();
  const { playTrack, isPlaying, track, activeSide } = useHomeAudio();

  const aiTitle = upload?.trackName?.trim() || "Your AI vocal";
  const vocalTitle = DEMO_VOCALIST.name;
  const compareId = DEMO_VOCALIST.id;
  const heroTrackId = "home-before-after";

  const loadHero = (side: "ai" | "vocal") => {
    playTrack(
      {
        id: heroTrackId,
        title: side === "ai" ? aiTitle : `${vocalTitle} — real take`,
        aiLabel: "AI demo",
        vocalLabel: "Real vocal",
        aiUrl: AI_DEMO_URL,
        vocalUrl: DEMO_VOCALIST.demoUrl,
      },
      side
    );
  };

  const aiActive = track?.id === heroTrackId && isPlaying && activeSide === "ai";
  const vocalActive = track?.id === heroTrackId && isPlaying && activeSide === "vocal";

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-purple-500/15 via-zinc-950/90 to-cyan-500/10 p-4 md:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-300">Before / After</h2>
        <AnimatedButton
          href={`/compare/${compareId}`}
          variant="secondary"
          className="rounded-lg px-3 py-1.5 text-xs"
        >
          Full compare
        </AnimatedButton>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <DemoCard
          label="AI demo"
          title={aiTitle}
          active={aiActive}
          variant="ai"
          onPlay={() => loadHero("ai")}
        />
        <DemoCard
          label="Real vocal"
          title={vocalTitle}
          subtitle={DEMO_VOCALIST.genres.join(" · ")}
          active={vocalActive}
          variant="vocal"
          onPlay={() => loadHero("vocal")}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <AnimatedButton
          type="button"
          variant="secondary"
          onClick={() => loadHero("ai")}
          className="rounded-lg px-3 py-2 text-xs"
        >
          Play AI
        </AnimatedButton>
        <AnimatedButton
          type="button"
          variant="secondary"
          onClick={() => loadHero("vocal")}
          className="rounded-lg px-3 py-2 text-xs"
        >
          Play real
        </AnimatedButton>
        <AnimatedButton
          href={`/compare/${compareId}`}
          variant="primary"
          className="rounded-lg px-3 py-2 text-xs font-medium"
        >
          Compare
        </AnimatedButton>
      </div>
    </section>
  );
}

function DemoCard({
  label,
  title,
  subtitle,
  active,
  variant,
  onPlay,
}: {
  label: string;
  title: string;
  subtitle?: string;
  active: boolean;
  variant: "ai" | "vocal";
  onPlay: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPlay}
      className={`rounded-xl border p-3 text-left transition ${
        active
          ? "border-purple-400/40 bg-zinc-950/90 shadow-[0_0_28px_rgba(168,85,247,0.2)]"
          : "border-white/10 bg-black/30 hover:border-white/20"
      }`}
    >
      <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className="mt-1 truncate text-sm font-medium text-white">{title}</p>
      {subtitle ? <p className="mt-0.5 truncate text-xs text-zinc-500">{subtitle}</p> : null}
      <FakeWaveform active={active} variant={variant} className="mt-3 h-10" bars={24} />
    </button>
  );
}