"use client";

type HomeDiscoverySearchProps = {
  value: string;
  onChange: (value: string) => void;
  matchingMode?: boolean;
};

export function HomeDiscoverySearch({
  value,
  onChange,
  matchingMode = false,
}: HomeDiscoverySearchProps) {
  return (
    <label className="group flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2.5 text-sm transition focus-within:border-cyan-400/35 focus-within:shadow-[0_0_22px_rgba(34,211,238,0.1)]">
      <SearchIcon />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={
          matchingMode
            ? "Filter matches by name, genre, tone..."
            : "Search vocalists by name, genre, tone..."
        }
        className="min-w-0 flex-1 bg-transparent text-zinc-200 outline-none placeholder:text-zinc-500"
        aria-label="Search vocalists"
      />
    </label>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0 text-zinc-500 group-focus-within:text-cyan-300"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3-3" strokeLinecap="round" />
    </svg>
  );
}
