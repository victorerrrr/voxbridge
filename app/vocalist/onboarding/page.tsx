"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatedButton } from "@/components/animated-button";
import { ExternalLinksEditor } from "@/components/external-links-section";
import { TagField } from "@/components/tag-field";
import { VocalistFlowShell } from "@/components/vocalist-flow-shell";
import type { ExternalLinks } from "@/lib/external-links";
import {
  AUDIO_INTERFACE_PRESETS,
  DAW_PRESETS,
  DEFAULT_GENRE_TAG_OPTIONS,
  EMPTY_RECORDING_SETUP,
  MICROPHONE_PRESETS,
  VOCAL_REGISTER_OPTIONS,
  VOCAL_TYPE_OPTIONS,
  VOICE_CHARACTERISTIC_OPTIONS,
  getVocalistProfileByOwnerId,
  upsertVocalistProfile,
  type RecordingEnvironment,
  type RecordingSetup,
  type VocalistProfile,
} from "@/lib/vocalist-profile";
import { useVocalistGuard } from "@/lib/use-vocalist-guard";
import type { AuthUser } from "@/lib/auth";

const genreSuggestions = DEFAULT_GENRE_TAG_OPTIONS.slice(0, 8);
const languageSuggestions = ["English", "Spanish", "French", "German", "Portuguese"];

function parseExistingVocalRange(range: string): {
  type: string;
  register: string;
  custom: string;
} {
  const parts = range.split("·").map((p) => p.trim()).filter(Boolean);
  const type =
    VOCAL_TYPE_OPTIONS.find((t) => parts.some((p) => p === t || p.startsWith(t))) ?? "";
  const register =
    VOCAL_REGISTER_OPTIONS.find((r) => parts.some((p) => p === r)) ?? "";
  const known = new Set([type, register].filter(Boolean));
  const custom = parts.filter((p) => !known.has(p)).join(" · ");
  return { type, register, custom };
}

function formatStudioSummary(setup: RecordingSetup): string {
  const parts = [setup.microphone, setup.audioInterface, setup.daw].filter(Boolean);
  return parts.join(" · ");
}

export default function VocalistOnboardingPage() {
  const user = useVocalistGuard();
  const [existing, setExisting] = useState<VocalistProfile | undefined>(undefined);
  const [profileLoaded, setProfileLoaded] = useState(false);
  useEffect(() => {
    if (!user) {
      setExisting(undefined);
      setProfileLoaded(false);
      return;
    }
    let cancelled = false;
    getVocalistProfileByOwnerId(user.id).then((p) => {
      if (!cancelled) {
        setExisting(p);
        setProfileLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user]);
  if (!user || !profileLoaded) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-zinc-300">
        Loading...
      </main>
    );
  }
  return <VocalistOnboardingForm key={existing?.updatedAt ?? "new"} user={user} existing={existing} />;
}

function VocalistOnboardingForm({
  user,
  existing,
}: {
  user: AuthUser;
  existing: VocalistProfile | undefined;
}) {
  const router = useRouter();
  const [username, setUsername] = useState(user?.username ?? "");
  const [bio, setBio] = useState(existing?.bio ?? "");
  const [genres, setGenres] = useState<string[]>(existing?.genres ?? []);
  const [languages, setLanguages] = useState<string[]>(existing?.languages ?? []);
  const [externalLinks, setExternalLinks] = useState<ExternalLinks>(existing?.externalLinks ?? {});

  const parsedRange = useMemo(
    () => parseExistingVocalRange(existing?.vocalRange ?? ""),
    [existing?.vocalRange]
  );

  const [vocalType, setVocalType] = useState(parsedRange.type);
  const [vocalRegister, setVocalRegister] = useState(parsedRange.register);
  const [customRange, setCustomRange] = useState(parsedRange.custom);
  const [customCharacteristic, setCustomCharacteristic] = useState("");
  const [voiceCharacteristics, setVoiceCharacteristics] = useState<string[]>(() => {
    const preset = new Set<string>(VOICE_CHARACTERISTIC_OPTIONS);
    const fromProfile = existing?.voiceCharacteristics?.length
      ? existing.voiceCharacteristics
      : (existing?.voiceTones ?? []).filter((t: string) => preset.has(t));
    const extras = (existing?.voiceCharacteristics ?? []).filter((t: string) => !preset.has(t));
    return [...new Set([...fromProfile, ...extras])];
  });

  const [recordingSetup, setRecordingSetup] = useState<RecordingSetup>(
    existing?.recordingSetup ?? { ...EMPTY_RECORDING_SETUP }
  );

  const [micPreset, setMicPreset] = useState(() => {
    const mic = existing?.recordingSetup?.microphone ?? "";
    return MICROPHONE_PRESETS.includes(mic as (typeof MICROPHONE_PRESETS)[number]) ? mic : mic ? "Other" : "";
  });
  const [micCustom, setMicCustom] = useState(
    micPreset === "Other" ? (existing?.recordingSetup?.microphone ?? "") : ""
  );

  const [interfacePreset, setInterfacePreset] = useState(() => {
    const iface = existing?.recordingSetup?.audioInterface ?? "";
    return AUDIO_INTERFACE_PRESETS.includes(iface as (typeof AUDIO_INTERFACE_PRESETS)[number])
      ? iface
      : iface
        ? "Other"
        : "";
  });
  const [interfaceCustom, setInterfaceCustom] = useState(
    interfacePreset === "Other" ? (existing?.recordingSetup?.audioInterface ?? "") : ""
  );

  const [dawPreset, setDawPreset] = useState(() => {
    const daw = existing?.recordingSetup?.daw ?? "";
    return DAW_PRESETS.includes(daw as (typeof DAW_PRESETS)[number]) ? daw : daw ? "Other" : "";
  });
  const [dawCustom, setDawCustom] = useState(
    dawPreset === "Other" ? (existing?.recordingSetup?.daw ?? "") : ""
  );

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-zinc-300">
        Loading...
      </main>
    );
  }

  const resolvedRange = [vocalType, vocalRegister, customRange.trim()]
    .filter(Boolean)
    .join(" · ");

  const presetCharacteristics = new Set<string>(VOICE_CHARACTERISTIC_OPTIONS);
  const customCharacteristics = voiceCharacteristics.filter((t) => !presetCharacteristics.has(t));

  const toggleCharacteristic = (value: string) => {
    setVoiceCharacteristics((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const addCustomCharacteristic = () => {
    const tag = customCharacteristic.trim();
    if (!tag || voiceCharacteristics.includes(tag)) return;
    setVoiceCharacteristics((prev) => [...prev, tag]);
    setCustomCharacteristic("");
  };

  const resolvePresetValue = (preset: string, custom: string) =>
    preset === "Other" ? custom.trim() : preset;

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const setup: RecordingSetup = {
      ...recordingSetup,
      microphone: resolvePresetValue(micPreset, micCustom),
      audioInterface: resolvePresetValue(interfacePreset, interfaceCustom),
      daw: resolvePresetValue(dawPreset, dawCustom),
    };

    upsertVocalistProfile(user.id, {
      username: username.trim(),
      bio: bio.trim(),
      voiceTones: voiceCharacteristics,
      voiceCharacteristics,
      genres,
      languages,
      vocalRange: resolvedRange || `${vocalType || "Vocalist"}`.trim(),
      studioEquipment: formatStudioSummary(setup),
      recordingSetup: setup,
      externalLinks,
    });
    router.push("/vocalist/demos");
  };

  const inputClass =
    "w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none ring-purple-500/50 placeholder:text-zinc-500 focus:ring-2";

  const selectClass = inputClass;

  return (
    <VocalistFlowShell
      activeItem="vocal-profile"
      title="Create your profile"
      subtitle="Tell producers who you are and how you sound."
    >
      <form onSubmit={onSubmit} className="space-y-6">
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

        <section className="space-y-4 rounded-xl border border-white/10 bg-zinc-950/40 p-4">
          <h3 className="text-sm font-semibold text-zinc-100">Vocal range</h3>
          <div>
            <p className="mb-2 text-xs text-zinc-500">Voice type</p>
            <div className="flex flex-wrap gap-2">
              {VOCAL_TYPE_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setVocalType(vocalType === option ? "" : option)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${
                    vocalType === option
                      ? "border-purple-400/50 bg-purple-500/20 text-white"
                      : "border-white/10 text-zinc-400 hover:border-white/25"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs text-zinc-500">Register</p>
            <div className="flex flex-wrap gap-2">
              {VOCAL_REGISTER_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setVocalRegister(vocalRegister === option ? "" : option)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${
                    vocalRegister === option
                      ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-100"
                      : "border-white/10 text-zinc-400 hover:border-white/25"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
          <input
            value={customRange}
            onChange={(e) => setCustomRange(e.target.value)}
            placeholder="Custom range note (optional)"
            className={inputClass}
          />
        </section>

        <section className="space-y-3 rounded-xl border border-white/10 bg-zinc-950/40 p-4">
          <h3 className="text-sm font-semibold text-zinc-100">Voice characteristics</h3>
          <p className="text-xs text-zinc-500">Select all that apply, or add your own tag.</p>
          <div className="flex flex-wrap gap-2">
            {VOICE_CHARACTERISTIC_OPTIONS.map((option) => {
              const selected = voiceCharacteristics.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => toggleCharacteristic(option)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${
                    selected
                      ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-100"
                      : "border-white/10 text-zinc-400 hover:border-white/25"
                  }`}
                >
                  {option}
                </button>
              );
            })}
            {customCharacteristics.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleCharacteristic(tag)}
                className="rounded-full border border-pink-400/40 bg-pink-500/15 px-3 py-1.5 text-xs text-pink-100"
              >
                {tag} ×
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={customCharacteristic}
              onChange={(e) => setCustomCharacteristic(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomCharacteristic();
                }
              }}
              placeholder="Custom characteristic"
              className={inputClass}
            />
            <button
              type="button"
              onClick={addCustomCharacteristic}
              className="shrink-0 rounded-lg border border-white/15 px-4 py-2 text-sm text-zinc-300 hover:bg-white/5"
            >
              Add
            </button>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border-2 border-purple-400/35 bg-gradient-to-br from-purple-500/15 via-zinc-950/90 to-cyan-500/10 p-6 shadow-[0_0_60px_-20px_rgba(168,85,247,0.45)] ring-1 ring-purple-400/25">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-purple-400/30 bg-purple-500/20 text-lg">
              🎙
            </span>
            <div>
              <h3 className="text-xl font-semibold text-white">Recording Setup</h3>
              <p className="mt-1 text-sm text-zinc-400">
                Mic, interface, DAW, and environment — helps producers trust your delivery.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1.5 block text-zinc-300">Microphone</span>
              <select
                value={micPreset}
                onChange={(e) => setMicPreset(e.target.value)}
                className={selectClass}
              >
                <option value="">Select microphone</option>
                {MICROPHONE_PRESETS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              {micPreset === "Other" && (
                <input
                  value={micCustom}
                  onChange={(e) => setMicCustom(e.target.value)}
                  placeholder="Your microphone model"
                  className={`${inputClass} mt-2`}
                />
              )}
            </label>

            <label className="block text-sm">
              <span className="mb-1.5 block text-zinc-300">Audio interface</span>
              <select
                value={interfacePreset}
                onChange={(e) => setInterfacePreset(e.target.value)}
                className={selectClass}
              >
                <option value="">Select interface</option>
                {AUDIO_INTERFACE_PRESETS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              {interfacePreset === "Other" && (
                <input
                  value={interfaceCustom}
                  onChange={(e) => setInterfaceCustom(e.target.value)}
                  placeholder="Your interface"
                  className={`${inputClass} mt-2`}
                />
              )}
            </label>

            <label className="block text-sm sm:col-span-2">
              <span className="mb-1.5 block text-zinc-300">DAW</span>
              <select value={dawPreset} onChange={(e) => setDawPreset(e.target.value)} className={selectClass}>
                <option value="">Select DAW</option>
                {DAW_PRESETS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              {dawPreset === "Other" && (
                <input
                  value={dawCustom}
                  onChange={(e) => setDawCustom(e.target.value)}
                  placeholder="Your DAW"
                  className={`${inputClass} mt-2`}
                />
              )}
            </label>
          </div>

          <div>
            <span className="mb-2 block text-sm text-zinc-300">Recording environment</span>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["home", "Home"],
                  ["professional", "Pro"],
                  ["both", "Both"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setRecordingSetup((prev) => ({
                      ...prev,
                      environment: value as RecordingEnvironment,
                    }))
                  }
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${
                    recordingSetup.environment === value
                      ? "border-purple-400/50 bg-purple-500/20 text-white"
                      : "border-white/10 text-zinc-400"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="mb-2 block text-sm text-zinc-300">Available for studio sessions</span>
            <div className="flex gap-2">
              {(
                [
                  [true, "Yes"],
                  [false, "No"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() =>
                    setRecordingSetup((prev) => ({ ...prev, studioSessionsAvailable: value }))
                  }
                  className={`rounded-full border px-4 py-1.5 text-xs transition ${
                    recordingSetup.studioSessionsAvailable === value
                      ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-100"
                      : "border-white/10 text-zinc-400"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <ExternalLinksEditor links={externalLinks} onChange={setExternalLinks} />

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
