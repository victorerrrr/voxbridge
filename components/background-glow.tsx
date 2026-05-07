export function BackgroundGlow() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <div className="glow-orb animate-glow-orb-a absolute left-1/2 top-[-260px] h-[560px] w-[900px] -translate-x-1/2" />
      <div className="glow-orb animate-glow-orb-b absolute left-[-170px] top-[14%] h-[420px] w-[420px]" />
      <div className="glow-orb animate-glow-orb-c absolute right-[-180px] top-[26%] h-[420px] w-[420px]" />
      <div className="glow-orb animate-glow-orb-d absolute left-[18%] bottom-[-180px] h-[360px] w-[360px]" />
      <div className="glow-orb animate-glow-orb-e absolute right-[10%] bottom-[-190px] h-[360px] w-[360px]" />
      <div className="glow-orb animate-glow-orb-f absolute right-[22%] top-[5%] h-[310px] w-[310px]" />
    </div>
  );
}
