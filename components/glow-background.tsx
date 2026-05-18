type GlowBackgroundProps = {
  className?: string;
  overlayClassName?: string;
};

const ORBS = [
  { anim: "animate-glow-orb-a", className: "left-1/2 top-[-20%] h-[38rem] w-[58rem] -translate-x-1/2" },
  { anim: "animate-glow-orb-b", className: "left-[-14%] top-[6%] h-[26rem] w-[26rem]" },
  { anim: "animate-glow-orb-c", className: "right-[-12%] top-[10%] h-[30rem] w-[30rem]" },
  { anim: "animate-glow-orb-d", className: "left-[4%] bottom-[-10%] h-[24rem] w-[24rem]" },
  { anim: "animate-glow-orb-e", className: "right-[2%] bottom-[-12%] h-[26rem] w-[26rem]" },
  { anim: "animate-glow-orb-f", className: "right-[20%] top-[0%] h-[22rem] w-[22rem]" },
  { anim: "animate-glow-orb-g", className: "left-[26%] top-[30%] h-[20rem] w-[20rem]" },
  { anim: "animate-glow-orb-h", className: "right-[30%] top-[36%] h-[18rem] w-[18rem]" },
  { anim: "animate-glow-orb-i", className: "left-[46%] bottom-[16%] h-[19rem] w-[19rem]" },
  { anim: "animate-glow-orb-j", className: "left-[12%] top-[40%] h-[17rem] w-[17rem]" },
  { anim: "animate-glow-orb-k", className: "right-[12%] bottom-[26%] h-[21rem] w-[21rem]" },
  { anim: "animate-glow-orb-l", className: "left-[60%] top-[16%] h-[16rem] w-[16rem]" },
] as const;

export function GlowBackground({ className = "", overlayClassName }: GlowBackgroundProps) {
  return (
    <div className={`pointer-events-none absolute inset-0 z-0 overflow-hidden ${className}`}>
      {ORBS.map((orb, index) => (
        <div
          key={orb.anim}
          className={`glow-orb ${orb.anim} absolute ${orb.className}`}
          style={{ animationDelay: `${index * 0.35}s` }}
        />
      ))}
      {overlayClassName ? <div className={`absolute inset-0 ${overlayClassName}`} /> : null}
    </div>
  );
}
