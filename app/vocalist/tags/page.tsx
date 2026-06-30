"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatedButton } from "@/components/animated-button";
import { TagSectionAddButton } from "@/components/tag-section-add-button";
import { VocalistFlowShell } from "@/components/vocalist-flow-shell";
import {
  buildInitialMatchingTags,
  DEFAULT_GENRE_TAG_OPTIONS,
  DEFAULT_MOOD_TAG_OPTIONS,
  DEFAULT_VOICE_TAG_OPTIONS,
  getAdditionalGenreOptions,
  getVocalistProfileByOwnerId,
  mergeMatchingTagsForSave,
  setVocalistTags,
  type VocalistProfile,
  type VocalistTags,
} from "@/lib/vocalist-profile";
import { useVocalistGuard } from "@/lib/use-vocalist-guard";
import type { AuthUser } from "@/lib/auth";

type TagCategory = keyof VocalistTags;

type CustomTagOptions = Record<TagCategory, string[]>;

function toggleTag(list: string[], tag: string): string[] {
  return list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag];
}

function extractCustomOptions(tags: VocalistTags, profile: VocalistProfile): CustomTagOptions {
  const presetGenres = new Set([...DEFAULT_GENRE_TAG_OPTIONS, ...(profile.genres ?? [])]);
  const presetVoices = new Set([...DEFAULT_VOICE_TAG_OPTIONS, ...(profile.voiceTones ?? [])]);
  const presetMoods = new Set(DEFAULT_MOOD_TAG_OPTIONS);

  return {
    genres: tags.genres.filter((tag) => !presetGenres.has(tag)),
    moods: tags.moods.filter((tag) => !presetMoods.has(tag)),
    voiceTypes: tags.voiceTypes.filter((tag) => !presetVoices.has(tag)),
  };
}

function mergeUniqueOptions(base: string[], custom: string[]): string[] {
  return [...new Set([...base, ...custom])];
}

export default function VocalistTagsPage() {
  const user = useVocalistGuard({ requireProfile: true });
  const [profile, setProfile] = useState<VocalistProfile | undefined>(undefined);
  useEffect(() => {
    if (!user) {
      setProfile(undefined);
      return;
    }
    let cancelled = false;
    getVocalistProfileByOwnerId(user.id).then((p) => {
      if (!cancelled) setProfile(p);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);
  if (!user || !profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-zinc-300">
        Loading...
      </main>
    );
  }
  return <VocalistTagsForm key={profile.updatedAt} user={user} profile={profile} />;
}

function VocalistTagsForm({ user, profile }: { user: AuthUser; profile: VocalistProfile }) {
  const router = useRouter();
  const profileGenres = profile.genres ?? [];
  const profileVoiceTones = profile.voiceTones ?? [];

  const initialTags = buildInitialMatchingTags(profile);
  const [tags, setTags] = useState<VocalistTags>(() => initialTags);
  const [customOptions, setCustomOptions] = useState<CustomTagOptions>(() =>
    extractCustomOptions(initialTags, profile)
  );

  const additionalGenreOptions =
    profileGenres.length > 0
      ? getAdditionalGenreOptions(profileGenres)
      : DEFAULT_GENRE_TAG_OPTIONS;

  const additionalVoiceOptions = DEFAULT_VOICE_TAG_OPTIONS.filter(
    (option) => !profileVoiceTones.includes(option)
  );

  const genreChipOptions = mergeUniqueOptions(
    profileGenres.length > 0 ? additionalGenreOptions : DEFAULT_GENRE_TAG_OPTIONS,
    customOptions.genres
  );

  const voiceChipOptions = mergeUniqueOptions(
    profileVoiceTones.length > 0 ? additionalVoiceOptions : DEFAULT_VOICE_TAG_OPTIONS,
    customOptions.voiceTypes
  );

  const moodChipOptions = mergeUniqueOptions(DEFAULT_MOOD_TAG_OPTIONS, customOptions.moods);

  const addTagToCategory = (category: TagCategory, presetOptions: string[]) => (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed) return;

    const isPreset = presetOptions.includes(trimmed);

    if (!isPreset) {
      setCustomOptions((prev) => {
        if (prev[category].includes(trimmed)) return prev;
        return { ...prev, [category]: [...prev[category], trimmed] };
      });
    }

    setTags((prev) => {
      if (prev[category].includes(trimmed)) return prev;
      return { ...prev, [category]: [...prev[category], trimmed] };
    });
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();

    const finalTags = mergeMatchingTagsForSave(profile, tags);
    if (
      finalTags.genres.length === 0 ||
      finalTags.moods.length === 0 ||
      finalTags.voiceTypes.length === 0
    ) {
      return;
    }

    setVocalistTags(user.id, finalTags);
    router.push("/home");
  };

  const profileId = profile.id;
  const canSubmit =
    tags.genres.length > 0 && tags.moods.length > 0 && tags.voiceTypes.length > 0;

  return (
    <VocalistFlowShell
      activeItem="vocal-profile"
      title="Add matching tags"
      subtitle="Refine how producers find you in search and AI matching."
    >
      <form onSubmit={onSubmit} className="space-y-8">
        {profileGenres.length > 0 ? (
          <section>
            <SectionHeading>Selected genres from your profile</SectionHeading>
            <p className="mb-3 text-xs text-zinc-500">
              From onboarding — add more genres below if you want broader matching.
            </p>
            <TagChipRow
              options={profileGenres}
              selected={tags.genres}
              onToggle={(tag) =>
                setTags((prev) => ({ ...prev, genres: toggleTag(prev.genres, tag) }))
              }
              lockedOptions={profileGenres}
            />
          </section>
        ) : (
          <section>
            <SectionHeadingRow
              title="Genre tags"
              onAddTag={addTagToCategory("genres", DEFAULT_GENRE_TAG_OPTIONS)}
            />
            <p className="mb-3 text-xs text-zinc-500">
              No genres in your profile yet — pick genres that describe your sound.
            </p>
            <TagChipRow
              options={genreChipOptions}
              selected={tags.genres}
              onToggle={(tag) =>
                setTags((prev) => ({ ...prev, genres: toggleTag(prev.genres, tag) }))
              }
            />
          </section>
        )}

        {profileGenres.length > 0 && (
          <section>
            <SectionHeadingRow
              title="Additional genres"
              onAddTag={addTagToCategory("genres", [
                ...DEFAULT_GENRE_TAG_OPTIONS,
                ...profileGenres,
              ])}
            />
            {genreChipOptions.length > 0 && (
              <TagChipRow
                options={genreChipOptions}
                selected={tags.genres}
                onToggle={(tag) =>
                  setTags((prev) => ({ ...prev, genres: toggleTag(prev.genres, tag) }))
                }
              />
            )}
          </section>
        )}

        <section>
          <SectionHeadingRow
            title="Voice tags"
            onAddTag={addTagToCategory("voiceTypes", [
              ...DEFAULT_VOICE_TAG_OPTIONS,
              ...profileVoiceTones,
            ])}
          />
          {profileVoiceTones.length > 0 && (
            <p className="mb-3 text-xs text-zinc-500">Voice tone from your profile</p>
          )}
          {profileVoiceTones.length > 0 && (
            <TagChipRow
              options={profileVoiceTones}
              selected={tags.voiceTypes}
              onToggle={(tag) =>
                setTags((prev) => ({
                  ...prev,
                  voiceTypes: toggleTag(prev.voiceTypes, tag),
                }))
              }
              lockedOptions={profileVoiceTones}
            />
          )}
          <TagChipRow
            options={voiceChipOptions}
            selected={tags.voiceTypes}
            onToggle={(tag) =>
              setTags((prev) => ({
                ...prev,
                voiceTypes: toggleTag(prev.voiceTypes, tag),
              }))
            }
          />
        </section>

        <section>
          <SectionHeadingRow
            title="Mood tags"
            onAddTag={addTagToCategory("moods", DEFAULT_MOOD_TAG_OPTIONS)}
          />
          <TagChipRow
            options={moodChipOptions}
            selected={tags.moods}
            onToggle={(tag) =>
              setTags((prev) => ({ ...prev, moods: toggleTag(prev.moods, tag) }))
            }
          />
        </section>

        <section className="flex flex-wrap gap-3">
          <AnimatedButton
            type="submit"
            variant="primary"
            disabled={!canSubmit}
            className="inline-flex rounded-lg px-5 py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
          >
            Finish & go to home
          </AnimatedButton>
          <AnimatedButton
            href={`/vocalists/${profileId}`}
            variant="secondary"
            className="inline-flex rounded-lg px-5 py-2.5 text-sm font-medium"
          >
            View my profile
          </AnimatedButton>
        </section>
      </form>
    </VocalistFlowShell>
  );
}

function SectionHeading({ children }: { children: string }) {
  return <h2 className="mb-1 text-sm font-semibold text-zinc-100">{children}</h2>;
}

function SectionHeadingRow({
  title,
  onAddTag,
}: {
  title: string;
  onAddTag: (tag: string) => void;
}) {
  return (
    <div className="mb-1 flex items-center gap-1.5">
      <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
      <TagSectionAddButton onAdd={onAddTag} />
    </div>
  );
}

function TagChipRow({
  options,
  selected,
  onToggle,
  lockedOptions = [],
}: {
  options: string[];
  selected: string[];
  onToggle: (tag: string) => void;
  lockedOptions?: string[];
}) {
  const locked = new Set(lockedOptions);

  return (
    <section className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isOn = selected.includes(option);
        const isLocked = locked.has(option);
        return (
          <button
            key={option}
            type="button"
            onClick={() => onToggle(option)}
            className={`rounded-full border px-3 py-1.5 text-sm transition ${
              isOn
                ? isLocked
                  ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
                  : "border-purple-400/50 bg-purple-500/20 text-purple-100 shadow-[0_0_18px_rgba(168,85,247,0.25)]"
                : "border-white/10 text-zinc-400 hover:border-purple-400/40 hover:text-zinc-200"
            }`}
          >
            {option}
            {isLocked && isOn ? (
              <span className="ml-1 text-[10px] uppercase tracking-wide text-emerald-300/80">
                profile
              </span>
            ) : null}
          </button>
        );
      })}
    </section>
  );
}
