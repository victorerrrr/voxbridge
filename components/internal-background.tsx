"use client";

import { GlowBackground } from "@/components/glow-background";

export function InternalBackground() {
  return (
    <GlowBackground overlayClassName="bg-gradient-to-b from-black/52 via-black/32 to-black/58" />
  );
}
