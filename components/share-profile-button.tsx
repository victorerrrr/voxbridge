"use client";

import { useState } from "react";

type ShareProfileButtonProps = {
  vocalistId: string;
  vocalistName: string;
  className?: string;
};

export function ShareProfileButton({
  vocalistId,
  vocalistName,
  className = "",
}: ShareProfileButtonProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  const profileUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/vocalists/${vocalistId}`
      : `/vocalists/${vocalistId}`;

  const onShare = async () => {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/vocalists/${vocalistId}`
        : `/vocalists/${vocalistId}`;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `${vocalistName} on VoxBridge`,
          text: `Check out ${vocalistName}'s vocalist profile on VoxBridge`,
          url,
        });
        return;
      } catch {
        // User cancelled or share failed — fall through to copy.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setStatus("copied");
      window.setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
      window.setTimeout(() => setStatus("idle"), 2500);
    }
  };

  const label =
    status === "copied" ? "Link copied!" : status === "error" ? "Copy failed" : "Share profile";

  return (
    <button
      type="button"
      onClick={() => void onShare()}
      title={profileUrl}
      className={`rounded-lg border border-white/15 bg-zinc-900/60 px-5 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-purple-400/35 hover:bg-purple-500/10 hover:text-white ${className}`}
    >
      {label}
    </button>
  );
}
