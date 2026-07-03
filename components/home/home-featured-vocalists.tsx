"use client";

import Link from "next/link";
import { FakeWaveform } from "@/components/home/fake-waveform";
import { HomeAudioPlayButton } from "@/components/home/home-audio-play-button";
import { useHomeAudio } from "@/components/home/home-audio-provider";
import { HOME_FEATURED_VOCALISTS } from "@/lib/home-landing-data";
import { getAvatarGradient, getVocalistInitials } from "@/lib/matching";

export function HomeFeaturedVocalists() {
  return (
    <section
      id="home-featured-vocalists"
      className="shrink-0 border-t border-white/[0.06] px-5 py-12 md:px-8 md:py-16"
    >
      <div className="mx-auto max-w-5xl">
        <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
          Featured vocalists
        </h2>
        <p className="mt-2 max-w-md text-vox-secondary">
          Demo profiles for browsing the UI — not real registered vocalists.
        </p>

        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {HOME_FEATURED_VOCALISTS.map((vocalist) => (
            <FeaturedCard key={vocalist.id} vocalist={vocalist} />
          ))}
        </ul>
      </div>
    </section>
  );
}

function FeaturedCard({
  vocalist,
}: {
  vocalist: (typeof HOME_FEATURED_VOCALISTS)[number];
}) {
  const { playTrack, track, isPlaying } = useHomeAudio();
  const audioId = `featured-${vocalist.id}`;
  const isThis = track?.id === audioId;
  const playing = isThis && isPlaying;
  const gradient = getAvatarGradient(vocalist.id);
  const initials = getVocalistInitials(vocalist.name);

  return (
    <li>
      <article className="group flex h-full flex-col rounded-2xl border border-white/[0.08] bg-zinc-950/50 p-4 backdrop-blur-sm transition hover:border-purple-400/25 hover:shadow-[0_0_32px_rgba(168,85,247,0.12)]">
        <div className="flex items-start gap-3">
          <span
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-sm font-bold text-white shadow-inner`}
          >
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-lg font-semibold text-white">{vocalist.name}</h3>
              <span className="shrink-0 rounded-full border border-zinc-500/40 bg-zinc-800/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                Demo
              </span>
            </div>
            <p className="mt-0.5 truncate text-sm text-zinc-500">
              {vocalist.genres.join(" · ")}
            </p>
          </div>
          <HomeAudioPlayButton
            isPlaying={playing}
            onClick={() =>
              playTrack(
                {
                  id: audioId,
                  title: vocalist.name,
                  aiLabel: "AI reference",
                  vocalLabel: `${vocalist.name} — preview`,
                  vocalUrl: vocalist.demoUrl,
                },
                "vocal"
              )
            }
            size="sm"
          />
        </div>

        <FakeWaveform
          active={playing}
          variant="vocal"
          bars={24}
          size="sm"
          className="mt-4 h-9 w-full opacity-80"
        />

        <Link
          href={`/vocalists/${vocalist.id}`}
          className="mt-4 text-sm font-medium text-purple-300/90 transition hover:text-purple-200"
        >
          View profile →
        </Link>
      </article>
    </li>
  );
}
