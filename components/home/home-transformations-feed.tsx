"use client";

import { FakeWaveform } from "@/components/home/fake-waveform";
import { HomeAudioPlayButton } from "@/components/home/home-audio-play-button";
import { useHomeAudio } from "@/components/home/home-audio-provider";
import { HOME_FEED_TRANSFORMATIONS } from "@/lib/home-landing-data";

export function HomeTransformationsFeed() {
  return (
    <section className="shrink-0 border-t border-white/[0.06] px-5 py-12 md:px-8 md:py-16">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
          New transformations
        </h2>
        <p className="mt-2 text-vox-secondary">Recent AI-to-real vocal swaps on VoxBridge.</p>

        <ul className="mt-8 flex flex-col gap-4">
          {HOME_FEED_TRANSFORMATIONS.map((item) => (
            <FeedCard key={item.id} item={item} />
          ))}
        </ul>
      </div>
    </section>
  );
}

function FeedCard({ item }: { item: (typeof HOME_FEED_TRANSFORMATIONS)[number] }) {
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
    <li className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 backdrop-blur-sm md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-white">{item.title}</h3>
          <p className="mt-1 text-sm text-vox-secondary">{item.description}</p>
          <p className="mt-2 text-vox-meta">{item.producer}</p>
        </div>
        <div className="flex items-center gap-2">
          <PreviewChip
            label={item.aiLabel}
            active={isThis && activeSide === "ai"}
            playing={playing && activeSide === "ai"}
            onPlay={() => playSide("ai")}
          />
          <span className="text-zinc-600" aria-hidden>
            →
          </span>
          <PreviewChip
            label={item.vocalLabel}
            active={isThis && activeSide === "vocal"}
            playing={playing && activeSide === "vocal"}
            onPlay={() => playSide("vocal")}
          />
        </div>
      </div>
      {isThis && (
        <FakeWaveform
          active={playing}
          variant={activeSide}
          bars={32}
          className="mt-4 h-10 w-full max-w-md"
        />
      )}
    </li>
  );
}

function PreviewChip({
  label,
  active,
  playing,
  onPlay,
}: {
  label: string;
  active: boolean;
  playing: boolean;
  onPlay: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 ${
        active ? "border-purple-400/30 bg-purple-500/10" : "border-white/[0.06] bg-black/40"
      }`}
    >
      <HomeAudioPlayButton isPlaying={playing} onClick={onPlay} size="sm" />
      <span className="max-w-[7rem] truncate text-xs font-medium text-zinc-300">{label}</span>
    </div>
  );
}
