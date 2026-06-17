"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatedButton } from "@/components/animated-button";
import { InternalPageShell } from "@/components/internal-page-shell";
import { TagField } from "@/components/tag-field";
import { defaultUploadContext, saveUploadContext } from "@/lib/upload-context";

const GENRE_SUGGESTIONS = ["Pop", "House", "EDM", "R&B", "Indie", "Cinematic", "Afro House"];
const VOICE_SUGGESTIONS = ["Female", "Male", "Warm", "Airy", "Deep", "Raspy", "Breathy"];
const MOOD_SUGGESTIONS = ["Emotional", "Euphoric", "Dark", "Dreamy", "Aggressive", "Intimate"];

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-black text-zinc-300">
          Loading upload...
        </main>
      }
    >
      <SearchPageContent />
    </Suspense>
  );
}

function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const describeOnly = searchParams.get("mode") === "describe";

  const [fileName, setFileName] = useState("");
  const [trackName, setTrackName] = useState("");
  const [description, setDescription] = useState("");
  const [vibe, setVibe] = useState("");
  const [genreTags, setGenreTags] = useState<string[]>([]);
  const [voiceTags, setVoiceTags] = useState<string[]>([]);
  const [moodTags, setMoodTags] = useState<string[]>([]);
  const [bpm, setBpm] = useState("");
  const [musicalKey, setMusicalKey] = useState("");
  const [spotifyUrl, setSpotifyUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [sunoUrl, setSunoUrl] = useState("");
  const [aiLanguage, setAiLanguage] = useState("English");
  const [partLanguage, setPartLanguage] = useState("English");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const context = {
      ...defaultUploadContext(),
      fileName,
      trackName: trackName.trim() || "Untitled track",
      description: description.trim(),
      vibe: vibe.trim(),
      genreTags,
      voiceTags,
      moodTags,
      bpm: bpm.trim(),
      musicalKey: musicalKey.trim(),
      spotifyUrl: spotifyUrl.trim(),
      youtubeUrl: youtubeUrl.trim(),
      sunoUrl: sunoUrl.trim(),
      aiLanguage,
      partLanguage,
    };
    saveUploadContext(context);

    const fileInput = document.getElementById("referenceFile") as HTMLInputElement;
    const file = fileInput?.files?.[0];
    if (!file && !describeOnly) {
      alert("Please upload an AI vocal file.");
      return;
    }

    setIsLoading(true);
    setLoadingProgress(10);

    try {
      const formData = new FormData();
      if (file) formData.append("ai_vocal", file);
      formData.append("ai_language", aiLanguage);
      formData.append("part_language", partLanguage);
      if (genreTags.length) formData.append("query_tags", genreTags[0]);

      setLoadingProgress(30);
      const res = await fetch("http://localhost:8000/voice-match-producer", {
        method: "POST",
        body: formData,
      });
      setLoadingProgress(80);

      if (!res.ok) throw new Error("Matching failed: " + res.status);
      const data = await res.json();
      sessionStorage.setItem("voxbridge_match_results", JSON.stringify(data));
      setLoadingProgress(100);
      router.push("/results");
    } catch (err) {
      console.error(err);
      alert("Matching failed. Is the backend running?");
    } finally {
      setIsLoading(false);
      setLoadingProgress(0);
    }
  };

  return (
    <InternalPageShell activeItem="upload">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          {describeOnly ? "Describe Your Vocal" : "Upload AI Vocal"}
        </h1>
        <p className="mt-3 text-zinc-400">
          {describeOnly
            ? "Skip the file and describe the tone, vibe, and references — we will mock-match vocalists."
            : "Drop your AI vocal draft, add tags and references, then run AI matching."}
        </p>

        <form
          onSubmit={onSubmit}
          className="mt-8 space-y-6 rounded-2xl border border-white/10 bg-zinc-950/60 p-6"
        onKeyDown={(e) => { if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "BUTTON") { e.preventDefault(); (e.target as HTMLElement).blur(); } }}
        >
          {!describeOnly && (
            <div>
              <label
                htmlFor="referenceFile"
                className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/20 bg-zinc-900/70 px-6 py-12 text-center transition hover:border-purple-400/60 hover:bg-zinc-900"
              >
                <span className="text-lg font-medium">Drop AI vocal here or click to upload</span>
                <span className="mt-2 text-sm text-zinc-400">
                  MP3, WAV, or M4A up to 25MB (mock upload)
                </span>
              </label>
              <input
                id="referenceFile"
                type="file"
                accept="audio/*"
                className="sr-only"
                onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")}
              />
              <p className="mt-3 text-sm text-zinc-400">
                {fileName ? `Selected file: ${fileName}` : "No file selected yet"}
              </p>
            </div>
          )}

          <div className="grid gap-4">
            <input
              required
              value={trackName}
              onChange={(event) => setTrackName(event.target.value)}
              placeholder="Track name"
              className="rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none ring-purple-500/50 placeholder:text-zinc-500 focus:ring-2"
            />
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="Project description (lyrics topic, language, delivery notes...)"
              className="rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none ring-purple-500/50 placeholder:text-zinc-500 focus:ring-2"
            />
            <textarea
              required={describeOnly}
              value={vibe}
              onChange={(event) => setVibe(event.target.value)}
              rows={3}
              placeholder="Describe the vibe (tone, emotion, reference artists...)"
              className="rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none ring-purple-500/50 placeholder:text-zinc-500 focus:ring-2"
            />
          </div>

          <TagField
            label="Genre tags"
            placeholder="Type and press Enter"
            tags={genreTags}
            onChange={setGenreTags}
            suggestions={GENRE_SUGGESTIONS}
          />
          <TagField
            label="Voice tags"
            placeholder="Type and press Enter"
            tags={voiceTags}
            onChange={setVoiceTags}
            suggestions={VOICE_SUGGESTIONS}
          />
          <TagField
            label="Mood tags"
            placeholder="Type and press Enter"
            tags={moodTags}
            onChange={setMoodTags}
            suggestions={MOOD_SUGGESTIONS}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <input
              value={bpm}
              onChange={(event) => setBpm(event.target.value)}
              placeholder="BPM"
              className="rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none ring-purple-500/50 placeholder:text-zinc-500 focus:ring-2"
            />
            <input
              value={musicalKey}
              onChange={(event) => setMusicalKey(event.target.value)}
              placeholder="Key (e.g. Am, F#)"
              className="rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none ring-purple-500/50 placeholder:text-zinc-500 focus:ring-2"
            />
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-zinc-200">Reference links</p>
            <input
              value={spotifyUrl}
              onChange={(event) => setSpotifyUrl(event.target.value)}
              placeholder="Spotify link"
              className="w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none ring-purple-500/50 placeholder:text-zinc-500 focus:ring-2"
            />
            <input
              value={youtubeUrl}
              onChange={(event) => setYoutubeUrl(event.target.value)}
              placeholder="YouTube link"
              className="w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none ring-purple-500/50 placeholder:text-zinc-500 focus:ring-2"
            />
            <input
              value={sunoUrl}
              onChange={(event) => setSunoUrl(event.target.value)}
              placeholder="Suno link"
              className="w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none ring-purple-500/50 placeholder:text-zinc-500 focus:ring-2"
            />
          </div>

          {isLoading && (
            <div className="w-full rounded-full bg-zinc-800 h-2 overflow-hidden">
              <div
                className="h-2 bg-purple-500 transition-all duration-500"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">AI vocal language</label>
              <select
                value={aiLanguage}
                onChange={(e) => setAiLanguage(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm outline-none ring-purple-500/50 focus:ring-2"
              >
                {["English","Spanish","Hindi","Afrikaans","Other"].map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Part language</label>
              <select
                value={partLanguage}
                onChange={(e) => setPartLanguage(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm outline-none ring-purple-500/50 focus:ring-2"
              >
                {["English","Spanish","Hindi","Afrikaans","Other"].map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <AnimatedButton
              type="submit"
              variant="primary"
              disabled={isLoading}
              className="inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-medium disabled:opacity-50"
            >
              {isLoading ? "Matching…" : "Run AI Matching"}
            </AnimatedButton>
            <AnimatedButton
              href="/become-vocalist"
              variant="secondary"
              className="inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm"
            >
              Become a Vocalist
            </AnimatedButton>
          </div>
        </form>
      </div>
    </InternalPageShell>
  );
}
