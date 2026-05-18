"use client";

import { FakeWaveform } from "@/components/home/fake-waveform";
import { HomeAudioPlayButton } from "@/components/home/home-audio-play-button";
import { useHomeAudio } from "@/components/home/home-audio-provider";
import { HOME_DEMO_TRANSFORMATIONS } from "@/lib/home-landing-data";

export function HomeTransformationDemo() {
  return (
    <section className="shrink-0 border-t border-white/[0.06] px-5 py-12 md:px-8 md:py-16">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-2xl font-bold tracking-tight text-white md:text-3xl">
          Hear the transformation
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-center text-vox-secondary">
          AI draft on the left — real human vocal on the right. Tap play to preview.
        </p>

        <ul className="mt-10 grid gap-5 md:grid-cols-2">
          {HOME_DEMO_TRANSFORMATIONS.map((item) => (
            <DemoCard key={item.id} item={item} />
          ))}
        </ul>
      </div>
    </section>
  );
}

function DemoCard({ item }: { item: (typeof HOME_DEMO_TRANSFORMATIONS)[number] }) {
  const { playTrack, track, isPlaying, activeSide } = useHomeAudio();
  const isThis = track?.id === item.id;
  const playing = isThis && isPlaying;

  const playSide = (side: "ai" | "vocal") => {
    playTrack(
      {
        id: item.id,
        title: item.title,
        aiLabel: item.aiLabel,
        vocalLabel: item.vocalLabel,
        aiUrl: item.aiUrl,
        vocalUrl: item.vocalUrl,
      },
      side
    );
  };

  return (
    <li className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 backdrop-blur-sm md:p-5">
      <p className="mb-4 text-sm font-medium text-zinc-300">{item.title}</p>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <AudioLane
          label="AI Demo"
          variant="ai"
          active={isThis && activeSide === "ai"}
          playing={playing && activeSide === "ai"}
          onPlay={() => playSide("ai")}
        />
        <span className="hidden text-center text-lg text-zinc-600 sm:block" aria-hidden>
          →
        </span>
        <AudioLane
          label="Real Vocal"
          variant="vocal"
          active={isThis && activeSide === "vocal"}
          playing={playing && activeSide === "vocal"}
          onPlay={() => playSide("vocal")}
        />
      </div>
    </li>
  );
}

function AudioLane({
  label,
  variant,
  active,
  playing,
  onPlay,
}: {
  label: string;
  variant: "ai" | "vocal";
  active: boolean;
  playing: boolean;
  onPlay: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-3 py-3 transition ${
        active
          ? "border-purple-400/30 bg-purple-500/10 shadow-[0_0_24px_rgba(168,85,247,0.15)]"
          : "border-white/[0.06] bg-black/30"
      }`}
    >
      <HomeAudioPlayButton isPlaying={playing} onClick={onPlay} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</p>
        <FakeWaveform
          active={playing}
          variant={variant}
          bars={20}
          size="sm"
          className="mt-2 h-8 w-full"
        />
      </div>
    </div>
  );
}
