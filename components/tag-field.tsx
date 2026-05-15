"use client";

import { KeyboardEvent, useState } from "react";

type TagFieldProps = {
  label: string;
  placeholder: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
};

export function TagField({ label, placeholder, tags, onChange, suggestions = [] }: TagFieldProps) {
  const [input, setInput] = useState("");

  const addTag = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || tags.includes(trimmed)) return;
    onChange([...tags, trimmed]);
    setInput("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag(input);
    }
    if (event.key === "Backspace" && !input && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-zinc-200">{label}</label>
      <input
        value={input}
        onChange={(event) => setInput(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none ring-purple-500/50 placeholder:text-zinc-500 focus:ring-2"
      />
      {suggestions.length > 0 && (
        <SuggestionChips suggestions={suggestions} tags={tags} onAdd={addTag} />
      )}
      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full border border-purple-400/30 bg-purple-500/10 px-2.5 py-1 text-xs text-purple-100"
            >
              {tag}
              <button
                type="button"
                onClick={() => onChange(tags.filter((t) => t !== tag))}
                className="text-purple-200/80 hover:text-white"
                aria-label={`Remove ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function SuggestionChips({
  suggestions,
  tags,
  onAdd,
}: {
  suggestions: string[];
  tags: string[];
  onAdd: (value: string) => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {suggestions
        .filter((item) => !tags.includes(item))
        .map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onAdd(item)}
            className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-zinc-400 transition hover:border-purple-400/50 hover:text-zinc-200"
          >
            + {item}
          </button>
        ))}
    </div>
  );
}
