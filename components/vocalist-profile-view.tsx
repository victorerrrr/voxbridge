"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatedButton } from "@/components/animated-button";
import { InternalPageShell } from "@/components/internal-page-shell";
import { RequestVocalistButton } from "@/components/request-vocalist-button";
import { ShareProfileButton } from "@/components/share-profile-button";
import { useClientAuth } from "@/lib/hooks/use-client-auth";
import { useMounted } from "@/lib/hooks/use-mounted";
import { getVocalistById, type Vocalist } from "@/lib/mockVocalists";
import { getVocalistMatchReasons } from "@/lib/matching";
import { useStoreRevision } from "@/lib/hooks/use-store-subscription";
import {
  getCompletedOrdersCount,
  getVocalistProfileById,
  subscribeVocalistProfiles,
  type VocalistProfile,
} from "@/lib/vocalist-profile";
import {
  getAverageRating,
  getReviewsForVocalist,
  subscribeVocalistReviews,
  type VocalistReview,
} from "@/lib/reviews";
import { ExternalLinksDisplay } from "@/components/external-links-section";

type VocalistProfileViewProps = {
  id: string;
};

export function VocalistProfileView({ id }: VocalistProfileViewProps) {
  useStoreRevision(subscribeVocalistProfiles);
  useStoreRevision(subscribeVocalistReviews);

  const mounted = useMounted();
  const mock = getVocalistById(id);
  const [stored, setStored] = useState<VocalistProfile | undefined>(undefined);
  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    getVocalistProfileById(id).then((p) => {
      if (!cancelled) setStored(p);
    });
    return () => {
      cancelled = true;
    };
  }, [mounted, id]);
  const { user, isReady } = useClientAuth();
  const isOwner = isReady && stored && user?.id === stored.ownerId;

  if (!mounted) {
    if (mock) {
      return <MockVocalistProfile vocalist={mock} />;
    }
    return (
      <InternalPageShell activeItem="explore">
        <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-zinc-950/60 p-8 text-center">
          <p className="text-zinc-400">Loading profile...</p>
        </div>
      </InternalPageShell>
    );
  }

  if (!mock && !stored) {
    return (
      <InternalPageShell activeItem="explore">
        <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-zinc-950/60 p-8 text-center">
          <h1 className="text-2xl font-semibold">Vocalist not found</h1>
          <AnimatedButton href="/search" variant="secondary" className="mt-4 inline-flex rounded-lg px-4 py-2 text-sm">
            Back to search
          </AnimatedButton>
        </div>
      </InternalPageShell>
    );
  }

  if (mock && !stored) {
    return <MockVocalistProfile vocalist={mock} />;
  }

  return <StoredVocalistProfile profile={stored!} isOwner={Boolean(isOwner)} mock={mock} />;
}

function MockVocalistProfile({ vocalist }: { vocalist: Vocalist }) {
  const matchReasons = getVocalistMatchReasons(vocalist);

  return (
    <InternalPageShell activeItem="explore">
      <ProfileLayout
        name={vocalist.name}
        tagline={vocalist.tagline}
        match={vocalist.match}
        description={vocalist.description}
        tags={vocalist.tags}
        matchReasons={matchReasons}
        isDemo
        demoUrl={vocalist.demoUrl}
        priceUsd={vocalist.priceUsd}
        deliveryDays={vocalist.deliveryDays}
        location={vocalist.location}
        vocalistId={vocalist.id}
        vocalistName={vocalist.name}
        completedCount={0}
        reviews={[]}
        averageRating={null}
        demos={[]}
        profileTags={null}
      />
    </InternalPageShell>
  );
}

function StoredVocalistProfile({
  profile,
  isOwner,
  mock,
}: {
  profile: VocalistProfile;
  isOwner: boolean;
  mock?: Vocalist;
}) {
  const { user, isReady } = useClientAuth();
  const [reviews, setReviews] = useState<VocalistReview[]>([]);
  const [averageRating, setAverageRating] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    getReviewsForVocalist(profile.id).then((r) => {
      if (!cancelled) setReviews(r);
    });
    getAverageRating(profile.id).then((avg) => {
      if (!cancelled) setAverageRating(avg);
    });
    return () => {
      cancelled = true;
    };
  }, [profile.id]);
  const [completedCount, setCompletedCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    getCompletedOrdersCount(profile.id).then((count) => {
      if (!cancelled) setCompletedCount(count);
    });
    return () => {
      cancelled = true;
    };
  }, [profile.id]);
  const allTags = [
    ...profile.tags.genres,
    ...profile.tags.moods,
    ...profile.tags.voiceTypes,
    ...profile.voiceTones,
    ...profile.genres,
  ];
  const uniqueTags = [...new Set(allTags)];

  return (
    <InternalPageShell activeItem={isOwner ? "my-profile" : "explore"}>
      <ProfileLayout
        name={profile.username || mock?.name || "Vocalist"}
        tagline={mock?.tagline || profile.bio.slice(0, 80)}
        match={mock?.match}
        description={profile.bio || mock?.description || ""}
        tags={uniqueTags}
        matchReasons={
          mock
            ? getVocalistMatchReasons(mock)
            : [
                profile.vocalRange && `Range: ${profile.vocalRange}`,
                profile.languages.length > 0 && `Languages: ${profile.languages.join(", ")}`,
              ].filter(Boolean) as string[]
        }
        demoUrl={profile.demos[0] ? undefined : mock?.demoUrl}
        demos={profile.demos}
        profileTags={profile.tags}
        priceUsd={mock?.priceUsd}
        deliveryDays={mock?.deliveryDays}
        location={mock?.location}
        vocalistId={profile.id}
        vocalistName={profile.username}
        completedCount={completedCount}
        reviews={reviews}
        averageRating={averageRating}
        studioEquipment={profile.studioEquipment}
        recordingSetup={profile.recordingSetup}
        voiceCharacteristics={profile.voiceCharacteristics}
        externalLinks={
          profile.externalLinks && Object.keys(profile.externalLinks).length > 0
            ? profile.externalLinks
            : isReady
              ? user?.externalLinks
              : undefined
        }
        isOwner={isOwner}
      />
    </InternalPageShell>
  );
}

function ProfileLayout({
  name,
  tagline,
  match,
  description,
  tags,
  matchReasons,
  demoUrl,
  demos = [],
  profileTags,
  priceUsd,
  deliveryDays,
  location,
  vocalistId,
  vocalistName,
  completedCount,
  reviews,
  averageRating,
  studioEquipment,
  recordingSetup,
  voiceCharacteristics = [],
  externalLinks,
  isOwner,
  isDemo,
}: {
  name: string;
  tagline: string;
  match?: number;
  description: string;
  tags: string[];
  matchReasons: string[];
  demoUrl?: string;
  demos?: { id: string; trackName: string; description: string; fileName: string }[];
  profileTags?: { genres: string[]; moods: string[]; voiceTypes: string[] } | null;
  priceUsd?: number;
  deliveryDays?: number;
  location?: string;
  vocalistId: string;
  vocalistName: string;
  completedCount: number;
  reviews: { id: string; rating: number; comment: string; producerName: string }[];
  averageRating: number | null;
  studioEquipment?: string;
  recordingSetup?: {
    microphone: string;
    audioInterface: string;
    daw: string;
    environment: string;
    studioSessionsAvailable: boolean | null;
  };
  voiceCharacteristics?: string[];
  externalLinks?: import("@/lib/external-links").ExternalLinks;
  isOwner?: boolean;
  isDemo?: boolean;
}) {
  return (
    <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-zinc-950/60 p-6 md:p-8">
      <Link href={isOwner ? "/home" : "/results"} className="text-sm text-zinc-400 transition hover:text-zinc-200">
        ← {isOwner ? "Back to home" : "Back to results"}
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{name}</h1>
          <p className="mt-2 text-zinc-400">{tagline}</p>
        </div>
        {match != null && (
          <span className="rounded-full border border-purple-400/40 bg-purple-500/10 px-3 py-1 text-sm font-medium text-purple-300">
            {match}% match
          </span>
        )}
        {averageRating != null && (
          <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-sm font-medium text-amber-200">
            ★ {averageRating} ({reviews.length})
          </span>
        )}
      </div>

      <div className="mt-6 grid gap-3 text-sm text-zinc-300 md:grid-cols-3">
        {priceUsd != null && (
          <Stat label="Starting from" value={`$${priceUsd}`} />
        )}
        {deliveryDays != null && <Stat label="Delivery" value={`${deliveryDays} days`} />}
        {location && <Stat label="Location" value={location} />}
        <Stat label="Completed orders" value={String(completedCount)} />
      </div>

      <p className="mt-6 leading-relaxed text-zinc-300">{description}</p>
      {studioEquipment && (
        <p className="mt-2 text-sm text-zinc-500">Studio: {studioEquipment}</p>
      )}

      {recordingSetup &&
        (recordingSetup.microphone || recordingSetup.daw || recordingSetup.environment) && (
          <section className="mt-4 rounded-xl border border-purple-400/20 bg-purple-500/5 p-4 text-sm text-zinc-300">
            <p className="font-medium text-zinc-100">Recording setup</p>
            <ul className="mt-2 space-y-1 text-zinc-400">
              {recordingSetup.microphone && <li>Mic: {recordingSetup.microphone}</li>}
              {recordingSetup.audioInterface && <li>Interface: {recordingSetup.audioInterface}</li>}
              {recordingSetup.daw && <li>DAW: {recordingSetup.daw}</li>}
              {recordingSetup.environment && (
                <li>
                  Environment:{" "}
                  {recordingSetup.environment === "home"
                    ? "Home studio"
                    : recordingSetup.environment === "professional"
                      ? "Professional studio"
                      : "Home & professional"}
                </li>
              )}
              {recordingSetup.studioSessionsAvailable != null && (
                <li>
                  Studio sessions: {recordingSetup.studioSessionsAvailable ? "Available" : "Not available"}
                </li>
              )}
            </ul>
          </section>
        )}

      {voiceCharacteristics.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {voiceCharacteristics.map((trait) => (
            <span
              key={trait}
              className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-xs text-cyan-100"
            >
              {trait}
            </span>
          ))}
        </div>
      )}

      <ExternalLinksDisplay links={externalLinks} />

      <div className="mt-5 flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span key={tag} className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-zinc-300">
            {tag}
          </span>
        ))}
      </div>

      {profileTags && (
        <section className="mt-5 rounded-xl border border-white/10 bg-zinc-900/50 p-4 text-sm text-zinc-400">
          <p>
            <span className="text-zinc-200">Genres:</span> {profileTags.genres.join(", ") || "—"}
          </p>
          <p className="mt-1">
            <span className="text-zinc-200">Mood:</span> {profileTags.moods.join(", ") || "—"}
          </p>
          <p className="mt-1">
            <span className="text-zinc-200">Voice:</span> {profileTags.voiceTypes.join(", ") || "—"}
          </p>
        </section>
      )}

      {matchReasons.length > 0 && (
        <section className="mt-6 rounded-xl border border-white/10 bg-zinc-900/50 p-4">
          <p className="text-sm font-medium text-zinc-200">Match highlights</p>
          <ul className="mt-2 space-y-1.5">
            {matchReasons.map((reason) => (
              <li key={reason} className="text-sm text-zinc-400">
                • {reason}
              </li>
            ))}
          </ul>
        </section>
      )}

      {demos.length > 0 && (
        <section className="mt-6 space-y-3">
          <p className="text-sm font-medium text-zinc-200">Demos</p>
          {demos.map((demo) => (
            <div key={demo.id} className="rounded-xl border border-white/10 bg-zinc-900/60 p-4">
              <p className="font-medium text-zinc-100">{demo.trackName}</p>
              <p className="text-xs text-zinc-500">{demo.fileName}</p>
              {demo.description && <p className="mt-1 text-sm text-zinc-400">{demo.description}</p>}
              <audio controls className="mt-3 w-full">
                <source src="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" />
              </audio>
            </div>
          ))}
        </section>
      )}

      {demoUrl && demos.length === 0 && (
        <div className="mt-8 rounded-xl border border-white/10 bg-zinc-900/60 p-4">
          <p className="mb-3 text-sm text-zinc-400">Demo</p>
          <audio controls className="w-full">
            <source src={demoUrl} />
          </audio>
        </div>
      )}

      {reviews.length > 0 && (
        <section className="mt-6 space-y-3">
          <p className="text-sm font-medium text-zinc-200">Reviews</p>
          {reviews.map((review) => (
            <article key={review.id} className="rounded-lg border border-white/10 bg-zinc-900/50 p-3">
              <p className="text-sm text-amber-200">{"★".repeat(review.rating)}</p>
              <p className="mt-1 text-sm text-zinc-300">{review.comment}</p>
              <p className="mt-1 text-xs text-zinc-500">— {review.producerName}</p>
            </article>
          ))}
        </section>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        {!isDemo && (
          <ShareProfileButton vocalistId={vocalistId} vocalistName={vocalistName || name} />
        )}
        {!isOwner && !isDemo && (
          <RequestVocalistButton vocalistId={vocalistId} vocalistName={vocalistName} />
        )}
        {isOwner && (
          <>
            <AnimatedButton href="/vocalist/demos" variant="secondary" className="rounded-lg px-5 py-2.5 text-sm">
              Edit demos
            </AnimatedButton>
            <AnimatedButton
              href="/vocalist/onboarding"
              variant="secondary"
              className="rounded-lg px-5 py-2.5 text-sm"
            >
              Edit profile
            </AnimatedButton>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-zinc-900/70 p-3">
      <p className="text-zinc-500">{label}</p>
      <p className="mt-1 text-base font-medium text-white">{value}</p>
    </div>
  );
}
