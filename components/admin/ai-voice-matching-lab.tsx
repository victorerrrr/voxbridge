"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  AdminActionButton,
  AdminPageHeader,
  AdminTable,
} from "@/components/admin/admin-ui";
import {
  generateMockMatchingResults,
  type AiVoiceMatchResult,
  type VocalistDemoItem,
} from "@/lib/admin-ai-voice-matching";
import { mockVocalists } from "@/lib/mockVocalists";

type AiVocalState = {
  fileName: string;
  objectUrl: string;
} | null;

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
  const [isMatching, setIsMatching] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const aiVocalInputRef = useRef<HTMLInputElement>(null);
  const demoUploadRef = useRef<HTMLInputElement>(null);
  const aiAudioRef = useRef<HTMLAudioElement>(null);
  const demoAudioRefs = useRef<Record<string, HTMLAudioElement | null>>({});
  const resultDemoRefs = useRef<Record<string, HTMLAudioElement | null>>({});
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
    setAiVocal({ fileName: file.name, objectUrl });
    setResults([]);
    setMatchError(null);
  };

  const clearAiVocal = () => {
    revokeAiVocal(aiVocal);
    setAiVocal(null);
    setResults([]);
    if (aiVocalInputRef.current) aiVocalInputRef.current.value = "";
  };

  const onDemoUpload = (files: FileList | null) => {
    if (!files?.length) return;
    const uploaded: VocalistDemoItem[] = Array.from(files).map((file) => ({
      id: `upload-${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: file.name.replace(/\.[^.]+$/, "") || file.name,
      audioUrl: URL.createObjectURL(file),
      source: "upload",
    }));
    setDemos((prev) => [...prev, ...uploaded]);
    setResults([]);
    setMatchError(null);
    if (demoUploadRef.current) demoUploadRef.current.value = "";
  };

  const addMockVocalist = (id: string) => {
    const vocalist = mockVocalists.find((v) => v.id === id);
    if (!vocalist) return;
    if (demos.some((d) => d.id === `mock-${vocalist.id}`)) return;
    setDemos((prev) => [
      ...prev,
      {
        id: `mock-${vocalist.id}`,
        name: vocalist.name,
        audioUrl: vocalist.demoUrl,
        source: "mock",
      },
    ]);
    setResults([]);
    setMatchError(null);
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

  const runMatching = async () => {
    if (!aiVocal) {
      setMatchError("Upload an AI vocal reference before running matching.");
      return;
    }
    if (demos.length === 0) {
      setMatchError("Add at least one vocalist demo (upload or mock list).");
      return;
    }
    setMatchError(null);
    setIsMatching(true);
    setResults([]);
    const delayMs = 2000 + Math.floor(Math.random() * 1000);
    await new Promise((resolve) => window.setTimeout(resolve, delayMs));
    setResults(generateMockMatchingResults(demos));
    setIsMatching(false);
  };

  const playAiVocal = () => {
    const audio = aiAudioRef.current;
    if (!audio) return;
    void audio.play().catch(() => undefined);
  };

  const playDemo = (url: string, key: string, map: typeof demoAudioRefs) => {
    const audio = map.current[key];
    if (audio) {
      void audio.play().catch(() => undefined);
      return;
    }
    const el = new Audio(url);
    map.current[key] = el;
    void el.play().catch(() => undefined);
  };

  const availableMock = mockVocalists.filter(
    (v) => !demos.some((d) => d.id === `mock-${v.id}`)
  );

  return (
    <>
      <AdminPageHeader
        title="AI Voice Matching Lab"
        description="Test and debug AI voice similarity system"
      />

      <LabSection
        title="AI Vocal Input"
        description="Upload a reference vocal for similarity testing (client-side only)."
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
            <p className="text-xs text-zinc-500">Preview uses a local object URL — not sent to a server.</p>
          </div>
        )}
      </LabSection>

      <LabSection
        title="Vocalist Demos"
        description="Upload multiple files or pick from the mock vocalist catalog."
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

        {availableMock.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Mock catalog</p>
            <div className="flex flex-wrap gap-2">
              {availableMock.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => addMockVocalist(v.id)}
                  className="rounded-full border border-white/15 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-amber-400/40 hover:text-white"
                >
                  + {v.name}
                </button>
              ))}
            </div>
          </div>
        )}

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
                  <p className="text-xs text-zinc-500">
                    {demo.source === "mock" ? "Mock vocalist" : "Uploaded file"}
                  </p>
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
          onClick={() => void runMatching()}
          disabled={isMatching}
          className="rounded-xl border border-amber-400/45 bg-gradient-to-r from-amber-500/25 via-orange-500/20 to-rose-500/15 px-5 py-2.5 text-sm font-semibold text-amber-50 shadow-[0_0_24px_rgba(251,191,36,0.12)] transition hover:border-amber-300/60 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isMatching ? "Running AI Matching…" : "Run AI Matching"}
        </button>
        {isMatching && (
          <span className="text-sm text-zinc-400">Simulating model inference (2–3s)…</span>
        )}
        {matchError && <p className="text-sm text-rose-300">{matchError}</p>}
      </div>

      <LabSection title="Matching Results" description="Mock scores for debugging — sorted by similarity.">
        {results.length === 0 ? (
          <p className="text-sm text-zinc-500">
            {isMatching ? "Generating results…" : "Run matching to see similarity scores."}
          </p>
        ) : (
          <AdminTable>
            <thead className="border-b border-white/10 bg-zinc-900/80 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3">Vocalist</th>
                <th className="px-4 py-3">Similarity</th>
                <th className="px-4 py-3">Match reasons</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {results.map((row) => (
                <tr key={row.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-medium text-white">{row.vocalistName}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full border border-emerald-400/35 bg-emerald-500/10 px-2.5 py-0.5 text-sm font-semibold text-emerald-200">
                      {row.similarity}%
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <ul className="flex flex-wrap gap-1.5">
                      {row.reasons.map((reason) => (
                        <li
                          key={reason}
                          className="rounded-full border border-white/10 bg-zinc-800/80 px-2 py-0.5 text-xs text-zinc-300"
                        >
                          {reason}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <AdminActionButton
                        label="Play AI vocal"
                        onClick={playAiVocal}
                      />
                      <AdminActionButton
                        label="Play demo"
                        onClick={() => playDemo(row.demoAudioUrl, row.id, resultDemoRefs)}
                      />
                    </div>
                    <audio
                      ref={(el) => {
                        resultDemoRefs.current[row.id] = el;
                      }}
                      src={row.demoAudioUrl}
                      preload="none"
                      className="sr-only"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </AdminTable>
        )}
      </LabSection>
    </>
  );
}
