"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatedButton } from "@/components/animated-button";
import { TagField } from "@/components/tag-field";
import { VocalistFlowShell } from "@/components/vocalist-flow-shell";
import {
  DEFAULT_GENRE_TAG_OPTIONS,
  DEFAULT_VOICE_TAG_OPTIONS,
  getVocalistProfileByEmail,
  upsertVocalistProfile,
} from "@/lib/vocalist-profile";
import { useVocalistGuard } from "@/lib/use-vocalist-guard";

const voiceToneSuggestions = DEFAULT_VOICE_TAG_OPTIONS.slice(0, 6);
const genreSuggestions = DEFAULT_GENRE_TAG_OPTIONS.slice(0, 8);
const languageSuggestions = ["English", "Spanish", "French", "German", "Portuguese"];
const rangeOptions = ["Low", "Mid", "High", "Full range"];

export default function VocalistOnboardingPage() {
  const router = useRouter();
  const user = useVocalistGuard();
  const existing = user ? getVocalistProfileByEmail(user.email) : undefined;

  const [username, setUsername] = useState(user?.username ?? "");
  const [bio, setBio] = useState(existing?.bio ?? "");
  const [voiceTones, setVoiceTones] = useState<string[]>(existing?.voiceTones ?? []);
  const [genres, setGenres] = useState<string[]>(existing?.genres ?? []);
  const [languages, setLanguages] = useState<string[]>(existing?.languages ?? []);
  const [vocalRange, setVocalRange] = useState(existing?.vocalRange ?? "");
  const [studioEquipment, setStudioEquipment] = useState(existing?.studioEquipment ?? "");

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-zinc-300">
        Loading...
      </main>
    );
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    upsertVocalistProfile(user.email, {
      username: username.trim(),
      bio: bio.trim(),
      voiceTones,
      genres,
      languages,
      vocalRange,
      studioEquipment: studioEquipment.trim(),
    });
    router.push("/vocalist/demos");
  };

  const inputClass =
    "w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none ring-purple-500/50 placeholder:text-zinc-500 focus:ring-2";

  return (
    <VocalistFlowShell
      activeItem="vocal-profile"
      title="Create your profile"
      subtitle="Tell producers who you are and how you sound."
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-200">Username</label>
          <input
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Stage name"
            className={inputClass}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-200">Short bio</label>
          <textarea
            required
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="A few lines about your style and experience"
            className={inputClass}
          />
        </div>

        <TagField
          label="Voice tone"
          placeholder="Add tone and press Enter"
          tags={voiceTones}
          onChange={setVoiceTones}
          suggestions={voiceToneSuggestions}
        />

        <TagField
          label="Genres"
          placeholder="Add genres"
          tags={genres}
          onChange={setGenres}
          suggestions={genreSuggestions}
        />

        <TagField
          label="Languages"
          placeholder="Add languages"
          tags={languages}
          onChange={setLanguages}
          suggestions={languageSuggestions}
        />

        <div>
          <label htmlFor="vocal-range" className="mb-2 block text-sm font-medium text-zinc-200">
            Vocal range
          </label>
          <select
            id="vocal-range"
            required
            value={vocalRange}
            onChange={(e) => setVocalRange(e.target.value)}
            className={inputClass}
          >
            <option value="">Select range</option>
            {rangeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-200">
            Studio / equipment <span className="text-zinc-500">(optional)</span>
          </label>
          <input
            value={studioEquipment}
            onChange={(e) => setStudioEquipment(e.target.value)}
            placeholder="e.g. Neumann TLM, Apollo interface"
            className={inputClass}
          />
        </div>

        <AnimatedButton
          type="submit"
          variant="primary"
          className="inline-flex w-full items-center justify-center rounded-lg px-5 py-2.5 text-sm font-medium sm:w-auto"
        >
          Continue to upload demos
        </AnimatedButton>
      </form>
    </VocalistFlowShell>
  );
}
