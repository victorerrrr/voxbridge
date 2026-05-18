"use client";

type HomeAudioPlayButtonProps = {
  isPlaying: boolean;
  onClick: () => void;
  size?: "sm" | "md";
  className?: string;
};

export function HomeAudioPlayButton({
  isPlaying,
  onClick,
  size = "md",
  className = "",
}: HomeAudioPlayButtonProps) {
  const dim = size === "sm" ? "h-10 w-10" : "h-12 w-12";
  const icon = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <button
      type="button"
      aria-label={isPlaying ? "Pause" : "Play preview"}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`flex shrink-0 items-center justify-center rounded-full border transition-all duration-300 ${dim} ${
        isPlaying
          ? "border-cyan-400/50 bg-gradient-to-br from-purple-500/35 to-cyan-500/25 text-white shadow-[0_0_24px_rgba(34,211,238,0.35)]"
          : "border-white/15 bg-black/50 text-zinc-200 hover:border-purple-400/45 hover:bg-purple-500/20 hover:text-white hover:shadow-[0_0_20px_rgba(168,85,247,0.3)]"
      } ${className}`}
    >
      {isPlaying ? <PauseIcon className={icon} /> : <PlayIcon className={icon} />}
    </button>
  );
}

function PlayIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`ml-0.5 ${className}`} fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" />
    </svg>
  );
}
