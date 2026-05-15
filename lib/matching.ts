import type { Vocalist } from "@/lib/mockVocalists";
import { mockVocalists } from "@/lib/mockVocalists";

export const MATCH_REASON_LABELS = [
  "Similar tone",
  "Close phrasing",
  "Emotional texture",
  "Genre compatible",
] as const;

export type MatchReason = (typeof MATCH_REASON_LABELS)[number];

export function getVocalistMatchReasons(vocalist: Vocalist): MatchReason[] {
  const seed = vocalist.id.length + vocalist.match;
  const ordered = [...MATCH_REASON_LABELS];
  return ordered
    .map((reason, index) => ({ reason, score: (seed + index * 17) % 100 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => item.reason);
}

export function getRankedVocalists(): Vocalist[] {
  return [...mockVocalists].sort((a, b) => b.match - a.match);
}

export function getVocalistInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function getAvatarGradient(id: string): string {
  const palettes = [
    "from-purple-500/80 via-fuchsia-500/60 to-pink-400/50",
    "from-cyan-500/80 via-blue-500/60 to-indigo-400/50",
    "from-emerald-500/80 via-teal-500/60 to-cyan-400/50",
    "from-amber-500/80 via-orange-500/60 to-rose-400/50",
  ];
  const index = id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) % palettes.length;
  return palettes[index];
}
