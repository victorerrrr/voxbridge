"use client";

import { useMemo } from "react";

type FakeWaveformProps = {
  active?: boolean;
  bars?: number;
  variant?: "ai" | "vocal" | "neutral";
  className?: string;
  size?: "sm" | "md" | "lg";
};

const SIZE_BAR = { sm: "w-0.5", md: "w-1", lg: "w-1.5" } as const;

export function FakeWaveform({
  active = false,
  bars = 28,
  variant = "neutral",
  className = "",
  size = "md",
}: FakeWaveformProps) {
  const gradient =
    variant === "ai"
      ? "from-purple-500/95 via-fuchsia-400/80 to-cyan-400/70"
      : variant === "vocal"
        ? "from-cyan-500/95 via-teal-400/80 to-fuchsia-400/65"
        : "from-purple-400/85 via-violet-400/70 to-cyan-400/75";

  const heights = useMemo(
    () =>
      Array.from({ length: bars }, (_, i) => {
        const base = 18 + ((i * 23 + 7) % 62);
        const peak = base + (active ? 12 + (i % 5) * 4 : 0);
        return Math.min(98, peak);
      }),
    [bars, active]
  );

  return (
    <div className={`flex items-end gap-px overflow-hidden ${className}`} aria-hidden>
      {heights.map((height, index) => (
        <span
          key={index}
          className={`${SIZE_BAR[size]} shrink-0 rounded-full bg-gradient-to-t ${gradient} transition-opacity duration-500 ${
            active ? "animate-wave-bar opacity-100" : "opacity-40"
          }`}
          style={{
            height: `${height}%`,
            animationDelay: active ? `${(index % 12) * 55}ms` : undefined,
            animationDuration: active ? `${680 + (index % 7) * 90}ms` : undefined,
          }}
        />
      ))}
    </div>
  );
}
