"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { getAvatarGradient, getVocalistInitials } from "@/lib/matching";
import { useVocalistCatalog } from "@/lib/hooks/use-vocalist-catalog";
import type { RegisteredVocalistSummary } from "@/lib/vocalist-profile";

export const MIN_VOCALIST_SEARCH_QUERY = 2;

type VocalistNameSearchProps = {
  variant?: "hero" | "header" | "sidebar";
  inputId?: string;
  className?: string;
  onNavigate?: () => void;
};

export function VocalistNameSearch({
  variant = "hero",
  inputId,
  className = "",
  onNavigate,
}: VocalistNameSearchProps) {
  const { catalog, loading } = useVocalistCatalog();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < MIN_VOCALIST_SEARCH_QUERY) return [];
    return catalog.filter((v) => {
      const haystack = [v.username, v.bio, v.vocalRange, ...v.genres].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [catalog, query]);

  const showResults = open && query.trim().length >= MIN_VOCALIST_SEARCH_QUERY;

  useEffect(() => {
    if (variant === "header" || variant === "sidebar") {
      const onPointerDown = (event: MouseEvent) => {
        if (!rootRef.current?.contains(event.target as Node)) {
          setOpen(false);
        }
      };
      document.addEventListener("pointerdown", onPointerDown);
      return () => document.removeEventListener("pointerdown", onPointerDown);
    }
  }, [variant]);

  const inputClass =
    variant === "hero"
      ? "mt-2 w-full rounded-xl border border-white/10 bg-zinc-950/80 px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:border-purple-400/40 focus:outline-none focus:ring-1 focus:ring-purple-400/30"
      : variant === "sidebar"
        ? "w-full rounded-lg border border-white/10 bg-zinc-900/80 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-purple-400/40 focus:outline-none"
        : "w-full rounded-lg border border-white/15 bg-zinc-950/90 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-purple-400/40 focus:outline-none focus:ring-1 focus:ring-purple-400/25";

  return (
    <div
      ref={rootRef}
      id={variant === "hero" ? "home-vocalist-search-section" : undefined}
      className={`relative ${className}`}
    >
      {variant === "hero" ? (
        <label className="block text-left">
          <span className="text-sm font-medium text-zinc-300">
            Know a vocalist on VoxBridge? Search by name
          </span>
          <input
            id={inputId}
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="e.g. Magdolina"
            autoComplete="off"
            aria-label="Search vocalists by name"
            aria-expanded={showResults}
            className={inputClass}
          />
        </label>
      ) : (
        <>
          {variant === "sidebar" && (
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
              Find vocalist
            </p>
          )}
          <input
            id={inputId}
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search by name…"
            autoComplete="off"
            aria-label="Search vocalists by name"
            aria-expanded={showResults}
            className={inputClass}
          />
        </>
      )}

      {variant === "hero" && (
        <p className="mt-2 text-left text-xs text-zinc-500">
          {loading
            ? "Loading vocalist directory…"
            : `Type at least ${MIN_VOCALIST_SEARCH_QUERY} characters — results appear below.`}
        </p>
      )}

      {showResults && (
        <div
          className={
            variant === "hero"
              ? "mt-3 overflow-hidden rounded-xl border border-white/10 bg-zinc-950/90 text-left shadow-lg"
              : "absolute left-0 right-0 top-[calc(100%+0.35rem)] z-[80] max-h-72 overflow-y-auto rounded-xl border border-white/10 bg-zinc-950/95 text-left shadow-xl backdrop-blur-xl"
          }
        >
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-zinc-500">
              No vocalist found for &ldquo;{query.trim()}&rdquo;.
            </p>
          ) : (
            <ul className="divide-y divide-white/5">
              {results.map((vocalist) => (
                <SearchResultRow
                  key={vocalist.id}
                  vocalist={vocalist}
                  onNavigate={() => {
                    setOpen(false);
                    setQuery("");
                    onNavigate?.();
                  }}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function SearchResultRow({
  vocalist,
  onNavigate,
}: {
  vocalist: RegisteredVocalistSummary;
  onNavigate: () => void;
}) {
  const gradient = getAvatarGradient(vocalist.id);
  const initials = getVocalistInitials(vocalist.username);

  return (
    <li>
      <Link
        href={`/vocalists/${vocalist.id}`}
        onClick={onNavigate}
        className="flex items-center gap-3 px-4 py-3 transition hover:bg-white/5"
      >
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${gradient} text-xs font-bold text-white`}
        >
          {initials}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-white">{vocalist.username}</span>
          <span className="block truncate text-xs text-zinc-500">
            {vocalist.genres.slice(0, 3).join(" · ") ||
              vocalist.vocalRange ||
              "Registered vocalist"}
          </span>
        </span>
        {vocalist.averageRating != null && (
          <span className="shrink-0 text-xs text-amber-200">★ {vocalist.averageRating}</span>
        )}
        <span className="shrink-0 text-xs text-purple-300">Profile →</span>
      </Link>
    </li>
  );
}
