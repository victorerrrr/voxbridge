"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AdminActionButton,
  AdminPageHeader,
  AdminTable,
} from "@/components/admin/admin-ui";
import { VoiceRadarChart } from "@/components/admin/voice-radar-chart";
import {
  buildMatchComparisonAiContext,
  buildMatchComparisonSections,
  resolveMatchFeatureTagsForDisplay,
  formatFeatureTagLabel,
  formatMatchConfidenceLabel,
  isRecordingFeatureTag,
  buildVoiceMatchFormData,
  formatDisplayVocalType,
  formatVoiceMatchGenderDebugLine,
  mapVoiceMatchResultsFromApi,
  resolveMatchConfidenceLevel,
  VOICE_MATCH_REQUEST_URL,
  type AiVoiceMatchResult,
  type MatchComparisonAiContext,
  type MatchConfidenceLevel,
  type VocalistDemoItem,
} from "@/lib/admin-ai-voice-matching";
import {
  useLabAudioPlayback,
  type LabPlaybackId,
} from "@/hooks/use-lab-audio-playback";
type AiVocalState = {
  fileName: string;
  objectUrl: string;
  file: File;
} | null;

const CONFIDENCE_STYLES: Record<
  MatchConfidenceLevel,
  { badge: string; dot: string }
> = {
  "very-strong": {
    badge: "border-emerald-400/40 bg-emerald-500/15 text-emerald-100",
    dot: "bg-emerald-400",
  },
  good: {
    badge: "border-sky-400/40 bg-sky-500/15 text-sky-100",
    dot: "bg-sky-400",
  },
  partial: {
    badge: "border-amber-400/40 bg-amber-500/15 text-amber-100",
    dot: "bg-amber-400",
  },
  weak: {
    badge: "border-zinc-500/40 bg-zinc-700/30 text-zinc-300",
    dot: "bg-zinc-500",
  },
};

function MatchComparisonSections({
  row,
  aiContext,
}: {
  row: AiVoiceMatchResult;
  aiContext?: MatchComparisonAiContext;
}) {
  const { matched, different, recordingQualityNote } = buildMatchComparisonSections(
    row,
    aiContext
  );
  if (matched.length === 0 && different.length === 0 && !recordingQualityNote) return null;

  return (
    <div className="mt-2 max-w-md space-y-2 text-xs">
      {matched.length > 0 && (
        <div>
          <p className="font-medium text-emerald-200/90">Что совпало:</p>
          <ul className="mt-0.5 list-inside list-disc space-y-0.5 text-zinc-400">
            {matched.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      {different.length > 0 && (
        <div>
          <p className="font-medium text-rose-200/90">Что отличается:</p>
          <ul className="mt-0.5 list-inside list-disc space-y-0.5 text-zinc-400">
            {different.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      {recordingQualityNote && (
        <p className="text-[11px] text-zinc-500">{recordingQualityNote}</p>
      )}
    </div>
  );
}

function FeatureTagChips({
  tags,
  variant = "default",
}: {
  tags: string[];
  variant?: "default" | "amber";
}) {
  if (tags.length === 0) return null;

  const chipClass =
    variant === "amber"
      ? "rounded-full border border-amber-400/20 bg-amber-500/10 px-2.5 py-0.5 text-xs text-amber-100/90"
      : "rounded-full border border-white/10 bg-zinc-800/80 px-2 py-0.5 text-xs text-zinc-300";

  return (
    <ul className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <li key={tag} className={chipClass} title={tag}>
          {formatFeatureTagLabel(tag)}
        </li>
      ))}
    </ul>
  );
}

const IS_DEV = process.env.NODE_ENV === "development";

function VocalTypeDisplay({ row }: { row: AiVoiceMatchResult }) {
  return (
    <>
      <p className="text-[11px] text-zinc-400">{formatDisplayVocalType(row)}</p>
      {IS_DEV && (
        <p className="text-[10px] tabular-nums text-zinc-600">
          {formatVoiceMatchGenderDebugLine(row)}
        </p>
      )}
    </>
  );
}

function ConfidenceBadge({ result }: { result: AiVoiceMatchResult }) {
  const level = resolveMatchConfidenceLevel(result);
  const styles = CONFIDENCE_STYLES[level];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles.badge}`}
      title={
        result.confidence != null
          ? `Display tier from ${result.matchPercent}% match (API confidence ${result.confidence}%)`
          : `Derived from ${result.matchPercent}% display match`
      }
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${styles.dot}`} />
      {formatMatchConfidenceLabel(level)}
    </span>
  );
}

function TopMatchCard({
  match,
  aiContext,
  playButtonLabel,
  onPlayAiVocal,
  onPlayDemo,
}: {
  match: AiVoiceMatchResult;
  aiContext?: MatchComparisonAiContext;
  playButtonLabel: (base: string, id: LabPlaybackId) => string;
  onPlayAiVocal: () => void;
  onPlayDemo: () => void;
}) {
  const demoPlaybackId: LabPlaybackId = `demo-${match.id}`;
  const featureTags = resolveMatchFeatureTagsForDisplay(match);
  const recordingTags = (match.featureTags ?? []).filter(isRecordingFeatureTag);

  return (
    <article className="mb-6 rounded-2xl border border-amber-400/35 bg-gradient-to-br from-amber-500/10 via-zinc-900/70 to-zinc-950/90 p-5 shadow-[0_0_32px_rgba(251,191,36,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <span className="inline-flex items-center rounded-full border border-amber-300/50 bg-amber-400/20 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-50">
            Лучший вариант
          </span>
          <div>
            <h3 className="text-lg font-semibold text-white">{match.vocalistName}</h3>
            <p className="text-vox-meta">{match.filename}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-full border border-emerald-400/45 bg-emerald-500/15 px-3 py-1 text-lg font-bold tabular-nums text-emerald-100">
            {match.matchPercent}%
          </span>
          <ConfidenceBadge result={match} />
          <div className="w-full">
            <VocalTypeDisplay row={match} />
            {IS_DEV && (
              <p className="mt-0.5 text-[10px] tabular-nums text-zinc-600">
                rank {match.finalRankingScore} · sim {match.similarity}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <p className="text-vox-secondary">
          <span className="font-medium text-zinc-200">Почему лучший вариант: </span>
        </p>
        <FeatureTagChips tags={featureTags} variant="amber" />
        {recordingTags.length > 0 && (
          <div className="space-y-1">
            <p className="text-vox-meta">Качество записи:</p>
            <FeatureTagChips tags={recordingTags} variant="amber" />
          </div>
        )}
      </div>

      <MatchComparisonSections row={match} aiContext={aiContext} />

      <div className="mt-4 flex flex-wrap gap-2 border-t border-white/5 pt-4">
        <AdminActionButton
          label={playButtonLabel("Play AI vocal", "ai-vocal")}
          onClick={onPlayAiVocal}
        />
        <AdminActionButton
          label={playButtonLabel("Play demo", demoPlaybackId)}
          onClick={onPlayDemo}
        />
      </div>
    </article>
  );
}

function LabSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-8 rounded-xl border border-amber-500/15 bg-gradient-to-br from-zinc-900/60 via-zinc-950/80 to-black/40 p-4 md:p-5">
      <div className="mb-4 border-b border-white/5 pb-3">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {description && <p className="mt-1 text-sm text-zinc-400">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function AiVoiceMatchingLab() {
  const [aiVocal, setAiVocal] = useState<AiVocalState>(null);
  const [demos, setDemos] = useState<VocalistDemoItem[]>([]);
  const [results, setResults] = useState<AiVoiceMatchResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [genderOverride, setGenderOverride] = useState<string>("auto");
  const [aiLanguage, setAiLanguage] = useState<string>("");
  const [partLanguage, setPartLanguage] = useState<string>("");
  const [matchError, setMatchError] = useState<string | null>(null);
  const [processedFileCount, setProcessedFileCount] = useState<number | null>(null);
  const [selectedQueryTags, setSelectedQueryTags] = useState<
    Record<string, string[]>
  >({});
  const aiVocalInputRef = useRef<HTMLInputElement>(null);
  const demoUploadRef = useRef<HTMLInputElement>(null);
  const aiAudioRef = useRef<HTMLAudioElement>(null);
  const demoAudioRefs = useRef<Record<string, HTMLAudioElement | null>>({});
  const { togglePlayback, stopPlayback, playButtonLabel } =
    useLabAudioPlayback();
  const aiVocalRef = useRef(aiVocal);
  const demosRef = useRef(demos);

  const revokeAiVocal = useCallback((vocal: AiVocalState) => {
    if (vocal?.objectUrl.startsWith("blob:")) {
      URL.revokeObjectURL(vocal.objectUrl);
    }
  }, []);

  useEffect(() => {
    aiVocalRef.current = aiVocal;
  }, [aiVocal]);

  useEffect(() => {
    demosRef.current = demos;
  }, [demos]);

  useEffect(() => {
    return () => {
      revokeAiVocal(aiVocalRef.current);
      demosRef.current.forEach((demo) => {
        if (demo.source === "upload" && demo.audioUrl.startsWith("blob:")) {
          URL.revokeObjectURL(demo.audioUrl);
        }
      });
    };
  }, [revokeAiVocal]);

  const onAiVocalUpload = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    revokeAiVocal(aiVocal);
    const objectUrl = URL.createObjectURL(file);
    setAiVocal({ fileName: file.name, objectUrl, file });
    setResults([]);
    setMatchError(null);
    setProcessedFileCount(null);
  };

  const clearAiVocal = () => {
    stopPlayback();
    revokeAiVocal(aiVocal);
    setAiVocal(null);
    setResults([]);
    setProcessedFileCount(null);
    if (aiVocalInputRef.current) aiVocalInputRef.current.value = "";
  };

  const onDemoUpload = (files: FileList | null) => {
    if (!files?.length) return;
    const uploaded: VocalistDemoItem[] = Array.from(files).map((file) => ({
      id: `upload-${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: file.name.replace(/\.[^.]+$/, "") || file.name,
      originalFileName: file.name,
      audioUrl: URL.createObjectURL(file),
      source: "upload",
      file,
    }));
    setDemos((prev) => [...prev, ...uploaded]);
    setResults([]);
    setMatchError(null);
    setProcessedFileCount(null);
    if (demoUploadRef.current) demoUploadRef.current.value = "";
  };

  const removeDemo = (id: string) => {
    setDemos((prev) => {
      const target = prev.find((d) => d.id === id);
      if (target?.source === "upload" && target.audioUrl.startsWith("blob:")) {
        URL.revokeObjectURL(target.audioUrl);
      }
      return prev.filter((d) => d.id !== id);
    });
    setResults((prev) => prev.filter((r) => r.id !== id));
  };

  const handleRunMatching = useCallback(async () => {
    console.log("Run AI Matching clicked");

    if (!aiVocal) {
      const message = "Загрузите AI vocal (референс) перед запуском matching.";
      setMatchError(message);
      console.warn("[voice-match] blocked:", message);
      return;
    }
    if (demos.length === 0) {
      const message = "Загрузите хотя бы один demo-файл вокалиста.";
      setMatchError(message);
      console.warn("[voice-match] blocked:", message);
      return;
    }
    const missingFile = demos.find((d) => !d.file?.size);
    if (missingFile) {
      const message = `Файл demo пустой или не загружен: ${missingFile.name}`;
      setMatchError(message);
      console.warn("[voice-match] blocked:", message);
      return;
    }
    if (!aiVocal.file.size) {
      const message = "AI vocal файл пустой.";
      setMatchError(message);
      console.warn("[voice-match] blocked:", message);
      return;
    }

    setMatchError(null);
    setProcessedFileCount(null);
    setIsProcessing(true);
    setResults([]);

    try {
      const { formData, demoInputs } = buildVoiceMatchFormData(
        aiVocal.file,
        demos,
        selectedQueryTags,
        undefined,
        aiLanguage || undefined,
        partLanguage || undefined
      );

      console.log("sending voice-match request", {
        url: VOICE_MATCH_REQUEST_URL,
        ai_vocal: aiVocal.file.name,
        demos: demoInputs.map((d) => d.originalFileName),
        demosCount: demoInputs.length,
      });

      const controller = new AbortController();
      const timeoutMs = 120_000;
      const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

      let response: Response;
      try {
        response = await fetch(VOICE_MATCH_REQUEST_URL, {
          method: "POST",
          body: formData,
          signal: controller.signal,
        });
      } catch (fetchErr) {
        const isAbort =
          fetchErr instanceof Error && fetchErr.name === "AbortError";
        const detail =
          fetchErr instanceof Error ? fetchErr.message : "Network request failed";
        throw new Error(
          isAbort
            ? `Запрос к voice-match превысил ${timeoutMs / 1000} с (${VOICE_MATCH_REQUEST_URL}).`
            : `Не удалось отправить запрос: ${detail}. URL: ${VOICE_MATCH_REQUEST_URL}`
        );
      } finally {
        window.clearTimeout(timeoutId);
      }

      const responseText = await response.text();
      console.log("[voice-match] response status:", response.status);
      try {
        const rawJson = JSON.parse(responseText) as
          | { results?: unknown[] }
          | unknown[];
        const rawResults = Array.isArray(rawJson)
          ? rawJson
          : rawJson?.results;
        console.log("[voice-match] API results (full response):", rawResults ?? rawJson);
      } catch {
        console.log("[voice-match] API response (non-JSON preview):", responseText.slice(0, 500));
      }

      const matched = mapVoiceMatchResultsFromApi(
        responseText,
        response.status,
        demoInputs
      );
      console.log("[voice-match] success:", matched.length, "result(s)");
      setResults(matched);
      setProcessedFileCount(matched.length);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "AI matching failed. Check backend.";
      console.error("[voice-match] lab error:", err);
      setMatchError(message);
      setResults([]);
      setProcessedFileCount(null);
    } finally {
      setIsProcessing(false);
    }
  }, [aiVocal, demos, selectedQueryTags]);

  const playAiVocal = () => {
    if (!aiVocal?.objectUrl) return;
    togglePlayback("ai-vocal", aiVocal.objectUrl);
  };

  const playDemo = (url: string, demoId: string) => {
    togglePlayback(`demo-${demoId}`, url);
  };

  const topMatch = results.find((r) => r.isTopMatch === true) ?? null;
  const showTopMatchSummary = topMatch != null;
  const comparisonAiContext = useMemo(
    () => buildMatchComparisonAiContext(results),
    [results]
  );

  return (
    <>
      <AdminPageHeader
        title="AI Voice Matching Lab"
        description="Test and debug AI voice similarity system"
      />

      <LabSection
        title="AI Vocal Input"
        description="Upload a reference vocal sent to the voice-matching service on Run."
      >
        <div className="flex flex-wrap items-center gap-3">
          <label className="cursor-pointer rounded-lg border border-cyan-400/35 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/20">
            Upload audio
            <input
              ref={aiVocalInputRef}
              type="file"
              accept="audio/*"
              className="sr-only"
              onChange={(e) => onAiVocalUpload(e.target.files)}
            />
          </label>
          {aiVocal && (
            <>
              <span className="truncate text-sm text-zinc-300">{aiVocal.fileName}</span>
              <AdminActionButton label="Clear" onClick={clearAiVocal} variant="danger" />
            </>
          )}
        </div>
        {aiVocal && (
          <div className="mt-4 space-y-2">
            <audio
              ref={aiAudioRef}
              controls
              src={aiVocal.objectUrl}
              className="w-full max-w-md rounded-lg"
              preload="metadata"
            />
            <p className="text-xs text-zinc-500">Preview uses a local object URL before matching.</p>
          </div>
        )}
      </LabSection>

      {/* Gender Override */}
        <div className="mb-4">
          <p className="text-xs text-white/50 mb-2">ПОЛ ГОЛОСА</p>
          <div className="flex gap-2">
            <button onClick={() => setGenderOverride("auto")} className={genderOverride === "auto" ? "px-3 py-1 rounded text-sm bg-white text-black" : "px-3 py-1 rounded text-sm bg-zinc-700 text-white"}>Авто</button>
            <button onClick={() => setGenderOverride("female")} className={genderOverride === "female" ? "px-3 py-1 rounded text-sm bg-white text-black" : "px-3 py-1 rounded text-sm bg-zinc-700 text-white"}>Женский</button>
            <button onClick={() => setGenderOverride("male")} className={genderOverride === "male" ? "px-3 py-1 rounded text-sm bg-white text-black" : "px-3 py-1 rounded text-sm bg-zinc-700 text-white"}>Мужской</button>
          </div>
        </div>
        {/* Language Fields */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs text-white/50 mb-1">Language of AI vocal</label>
            <select value={aiLanguage} onChange={(e) => setAiLanguage(e.target.value)} className="w-full px-3 py-1.5 rounded text-sm bg-zinc-800 border border-white/10 text-white focus:outline-none focus:border-white/30"><option value="">Any</option><option value="English">English</option><option value="Russian">Russian</option><option value="Spanish">Spanish</option><option value="French">French</option><option value="German">German</option><option value="Italian">Italian</option><option value="Portuguese">Portuguese</option><option value="Chinese">Chinese</option><option value="Japanese">Japanese</option><option value="Korean">Korean</option><option value="Arabic">Arabic</option><option value="Hindi">Hindi</option><option value="Turkish">Turkish</option><option value="Polish">Polish</option><option value="Ukrainian">Ukrainian</option></select>
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Language of part</label>
            <select value={partLanguage} onChange={(e) => setPartLanguage(e.target.value)} className="w-full px-3 py-1.5 rounded text-sm bg-zinc-800 border border-white/10 text-white focus:outline-none focus:border-white/30"><option value="">Any</option><option value="English">English</option><option value="Russian">Russian</option><option value="Spanish">Spanish</option><option value="French">French</option><option value="German">German</option><option value="Italian">Italian</option><option value="Portuguese">Portuguese</option><option value="Chinese">Chinese</option><option value="Japanese">Japanese</option><option value="Korean">Korean</option><option value="Arabic">Arabic</option><option value="Hindi">Hindi</option><option value="Turkish">Turkish</option><option value="Polish">Polish</option><option value="Ukrainian">Ukrainian</option></select>
          </div>
        </div>
        {/* Voice Character Tags */}
      <div className="rounded-lg border border-white/10 bg-white/5 p-6 mb-8">
        <h2 className="text-lg font-semibold text-white mb-1">Voice Character</h2>
        <p className="text-sm text-white/50 mb-4">
          Describe the AI vocal to improve matching accuracy.
        </p>
        {[
          {
            key: "tonal",
            label: "Tonal character",
            options: [
              "warm",
              "bright",
              "dark",
              "airy",
              "gritty",
              "raspy",
              "soft",
              "deep",
            ],
          },
          {
            key: "emotional",
            label: "Emotional vibe",
            options: [
              "intimate",
              "melancholic",
              "seductive",
              "energetic",
              "neutral",
            ],
          },
          {
            key: "movement",
            label: "Vocal movement",
            options: ["flowing", "legato", "rhythmic", "syncopated", "staccato"],
          },
          {
            key: "density",
            label: "Density",
            options: ["sparse", "dense", "layered"],
          },
        ].map(({ key, label, options }) => (
          <div key={key} className="mb-4">
            <p className="text-xs text-white/60 uppercase tracking-wide mb-2">
              {label}
            </p>
            <div className="flex flex-wrap gap-2">
              {options.map((opt) => {
                const active = (selectedQueryTags[key] || []).includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      setSelectedQueryTags((prev) => {
                        const current = prev[key] || [];
                        return {
                          ...prev,
                          [key]: active
                            ? current.filter((v) => v !== opt)
                            : [...current, opt],
                        };
                      });
                    }}
                    className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                      active
                        ? "bg-orange-500/20 border-orange-500 text-orange-300"
                        : "bg-white/5 border-white/10 text-white/60 hover:border-white/30"
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <LabSection
        title="Vocalist Demos"
        description="Upload one or more demo files — only these files are sent to matching (not a server folder)."
      >
        <div className="flex flex-wrap gap-3">
          <label className="cursor-pointer rounded-lg border border-purple-400/35 bg-purple-500/10 px-4 py-2 text-sm font-medium text-purple-100 transition hover:bg-purple-500/20">
            Upload demos
            <input
              ref={demoUploadRef}
              type="file"
              accept="audio/*"
              multiple
              className="sr-only"
              onChange={(e) => onDemoUpload(e.target.files)}
            />
          </label>
        </div>

        {demos.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">No vocalist demos yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {demos.map((demo) => (
              <li
                key={demo.id}
                className="flex flex-col gap-3 rounded-xl border border-white/10 bg-zinc-900/40 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-white">{demo.name}</p>
                  <p className="truncate text-xs text-zinc-500">{demo.file?.name ?? demo.name}</p>
                  <audio
                    ref={(el) => {
                      demoAudioRefs.current[demo.id] = el;
                    }}
                    controls
                    src={demo.audioUrl}
                    className="mt-2 w-full max-w-sm"
                    preload="metadata"
                  />
                </div>
                <AdminActionButton
                  label="Remove"
                  variant="danger"
                  onClick={() => removeDemo(demo.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </LabSection>

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            void handleRunMatching();
          }}
          disabled={isProcessing}
          aria-busy={isProcessing}
          className="rounded-xl border border-amber-400/45 bg-gradient-to-r from-amber-500/25 via-orange-500/20 to-rose-500/15 px-5 py-2.5 text-sm font-semibold text-amber-50 shadow-[0_0_24px_rgba(251,191,36,0.12)] transition hover:border-amber-300/60 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isProcessing ? "Processing audio…" : "Run AI Matching"}
        </button>
        {isProcessing && (
          <span className="text-sm text-zinc-400">Processing audio…</span>
        )}
        {!isProcessing && !aiVocal && (
          <p className="text-sm text-amber-200/80">Нужен AI vocal.</p>
        )}
        {!isProcessing && aiVocal && demos.length === 0 && (
          <p className="text-sm text-amber-200/80">Нужен хотя бы один demo.</p>
        )}
        {matchError && (
          <p className="w-full text-sm text-rose-300" role="alert">
            {matchError}
          </p>
        )}
      </div>

      <LabSection
        title="Matching Results"
        description="Backend match order (ranked by final_ranking_score). Match % is min–max normalized final rank; raw similarity is debug-only."
      >
        {results.length === 0 ? (
          <p className="text-sm text-zinc-500">
            {isProcessing ? "Processing audio…" : "Run matching to see match scores."}
          </p>
        ) : (
          <>
            {showTopMatchSummary && topMatch && (
              <TopMatchCard
                match={topMatch}
                aiContext={comparisonAiContext}
                playButtonLabel={playButtonLabel}
                onPlayAiVocal={playAiVocal}
                onPlayDemo={() => playDemo(topMatch.demoAudioUrl, topMatch.id)}
              />
            )}

            <p className="text-vox-label mb-3 text-zinc-500">All matches</p>
            <AdminTable>
            <thead className="border-b border-white/10 bg-zinc-900/80 text-vox-label text-zinc-500">
              <tr>
                <th className="px-4 py-3.5">Vocalist</th>
                <th className="px-4 py-3.5">Match %</th>
                <th className="px-4 py-3.5">Confidence</th>
                <th className="px-4 py-3.5">Feature tags</th>
                <th className="px-4 py-3.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {results.map((row, index) => {
                const isTopMatch = row.isTopMatch === true;
                return (
                <tr
                  key={row.id}
                  className={
                    isTopMatch
                      ? "bg-amber-500/[0.06] ring-1 ring-inset ring-amber-400/25 hover:bg-amber-500/[0.08]"
                      : "hover:bg-white/[0.02]"
                  }
                >
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-white">{row.filename}</p>
                      {isTopMatch && (
                        <span className="inline-flex rounded-full border border-amber-300/45 bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-100">
                          Лучший вариант
                        </span>
                      )}
                    </div>
                    {row.vocalistName !== row.filename.replace(/\.[^.]+$/, "") && (
                      <p className="mt-0.5 text-vox-meta">{row.vocalistName}</p>
                    )}
                                  {(aiLanguage || partLanguage) && (
                <div className="flex gap-1.5 mt-1 flex-wrap">
                  {aiLanguage && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-white/5 border border-white/10 text-white/50">
                      AI: {aiLanguage}
                    </span>
                  )}
                  {partLanguage && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-violet-500/10 border border-violet-400/20 text-violet-300">
                      Needs: {partLanguage}
                    </span>
                  )}
                </div>
              )}
              {isTopMatch && resolveMatchFeatureTagsForDisplay(row).length > 0 && (
                      <div className="mt-2 max-w-md space-y-1.5">
                        <p className="text-vox-secondary text-zinc-300">
                          Почему лучший вариант:
                        </p>
                        <FeatureTagChips
                          tags={resolveMatchFeatureTagsForDisplay(row)}
                          variant="amber"
                        />
                        {(row.featureTags ?? []).some(isRecordingFeatureTag) && (
                          <div className="space-y-1">
                            <p className="text-vox-meta">Качество записи:</p>
                            <FeatureTagChips
                              tags={(row.featureTags ?? []).filter(isRecordingFeatureTag)}
                              variant="amber"
                            />
                          </div>
                        )}
                      </div>
                    )}
                    <MatchComparisonSections
                      row={row}
                      aiContext={comparisonAiContext}
                    />
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-sm font-semibold tabular-nums ${
                        isTopMatch
                          ? "border-emerald-300/50 bg-emerald-500/20 text-emerald-50"
                          : "border-emerald-400/35 bg-emerald-500/10 text-emerald-200"
                      }`}
                    >
                      {row.matchPercent}%
                    </span>
                    <p className="mt-1.5 text-[10px] tabular-nums text-zinc-500">
                      #{row.index ?? index} · final rank {row.finalRankingScore} · sim{" "}
                      {row.similarity}
                    </p>
                    <div className="mt-0.5">
                      <VocalTypeDisplay row={row} />
                <VoiceRadarChart
                  timbreScore={row.breakdown?.timbreScore ?? 0}
                  pitchScore={row.breakdown?.pitchScore ?? 0}
                  qualityScore={row.breakdown?.qualityScore ?? 0}
                  vocalCharacterScore={row.breakdown?.vocalCharacterScore ?? 0}
                  speakerScore={Math.min(100, ((row.breakdown?.speakerScore ?? 0) / 20) * 100)}
                  size={180}
                />
                      {IS_DEV && (
                        <p className="text-[10px] tabular-nums text-zinc-600">
                          isTopMatch: {row.isTopMatch === true ? "true" : "false"}
                        </p>
                      )}
                    </div>
                    {(row.breakdown.speakerScore != null ||
                      row.breakdown.timbreScore != null ||
                      row.breakdown.qualityScore != null) && (
                      <p
                        className="mt-1 text-vox-meta"
                        title="Speaker / timbre / quality component scores"
                      >
                        {[
                          row.breakdown.speakerScore != null &&
                            `spk ${row.breakdown.speakerScore}`,
                          row.breakdown.timbreScore != null &&
                            `timb ${row.breakdown.timbreScore}`,
                          row.breakdown.qualityScore != null &&
                            `q ${row.breakdown.qualityScore}`,
                        row.feedback_boost != null && row.feedback_boost !== 0 &&
                          `fb ${row.feedback_boost > 0 ? "+" : ""}${row.feedback_boost}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <ConfidenceBadge result={row} />
                    {row.confidence != null && (
                      <p className="mt-1.5 text-vox-meta tabular-nums">
                        API {row.confidence}%
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    {resolveMatchFeatureTagsForDisplay(row).length === 0 ? (
                      <span className="text-vox-muted">—</span>
                    ) : (
                      <FeatureTagChips
                        tags={resolveMatchFeatureTagsForDisplay(row)}
                        variant={isTopMatch ? "amber" : "default"}
                      />
                    )}
                    {(row.featureTags ?? []).some(isRecordingFeatureTag) && (
                      <div className="mt-2 space-y-1">
                        <p className="text-vox-meta">Качество записи:</p>
                        <FeatureTagChips
                          tags={(row.featureTags ?? []).filter(isRecordingFeatureTag)}
                          variant={isTopMatch ? "amber" : "default"}
                        />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      <AdminActionButton
                        label={playButtonLabel("Play AI vocal", "ai-vocal")}
                        onClick={playAiVocal}
                      />
                      <AdminActionButton
                        label={playButtonLabel(
                          "Play demo",
                          `demo-${row.id}`
                        )}
                        onClick={() => playDemo(row.demoAudioUrl, row.id)}
                      />
                  {row.best_match_sec != null && (
                    <AdminActionButton
                      label={`▶ Best match ~${Math.round(row.best_match_sec)}s`}
                      demoId={`best-${row.id}`}
                      onClick={() => {
                        playDemo(row.demoAudioUrl, row.id);
                        setTimeout(() => {
                          const allAudio = document.querySelectorAll("audio");
                          allAudio.forEach((a) => {
                            if (a.src === row.demoAudioUrl || a.currentSrc === row.demoAudioUrl) {
                              a.currentTime = row.best_match_sec!;
                            }
                          });
                        }, 100);
                      }}
                    />
                  )}
                    </div>
                  </td>
                </tr>
              );
              })}
            </tbody>
            </AdminTable>
            {processedFileCount != null && (
              <p className="mt-5 text-vox-meta">
                Matching completed — {processedFileCount} file
                {processedFileCount === 1 ? "" : "s"} processed
              </p>
            )}
          </>
        )}
      </LabSection>
    </>
  );
}
