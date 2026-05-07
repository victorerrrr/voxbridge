"use client";

export function InternalBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="glow-orb animate-glow-orb-a absolute -left-32 -top-24 h-96 w-96" />
      <div className="glow-orb animate-glow-orb-b absolute left-1/3 top-[-7rem] h-[26rem] w-[26rem]" />
      <div className="glow-orb animate-glow-orb-c absolute -right-36 top-16 h-[28rem] w-[28rem]" />
      <div className="glow-orb animate-glow-orb-d absolute -bottom-36 left-16 h-[24rem] w-[24rem]" />
      <div className="glow-orb animate-glow-orb-e absolute -bottom-32 right-8 h-[22rem] w-[22rem]" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-black/65" />
    </div>
  );
}
